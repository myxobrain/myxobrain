// $MYXO token settings and the manual buyback-and-burn (engine shared with OPTIC and WORMBRAIN), run by the owner from /studio. Nothing here runs on its own.
// One wallet key lives here, the buyback wallet's, encrypted at rest (AES-256-GCM under a scrypt key from BURN_SECRET).
// A buyback spends the dollars the owner names (paid in ETH at the live price) on the token (on the Pons curve before graduation, on Uniswap v4 after) and sends
// exactly what it bought to the dead address. A supply burn sends tokens the wallet already holds, sized in dollars. Every step is written to history.json before the next wait, so a restart
// mid-burn leaves the hashes on record instead of losing them.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ethers } from "ethers";

const DATA = new URL("./data/", import.meta.url).pathname, DIR = path.join(DATA, "burn");
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch { return d; } };
const write = (f, v) => { const p = path.join(DIR, f), tmp = `${p}.${process.pid}.tmp`; if (v === null) return fs.rmSync(p, { force: true }); fs.writeFileSync(tmp, JSON.stringify(v, null, 1), { mode: 0o600 }); fs.renameSync(tmp, p); };

// ---------- secrets: from .env when set, otherwise generated once on this machine and kept in data/burn/secrets.json (0600) ----------
const SECRETS = (() => {
  const s = read("secrets.json", {});
  if (!s.studioKey || !s.burnSecret) { s.studioKey ||= crypto.randomBytes(24).toString("hex"); s.burnSecret ||= crypto.randomBytes(32).toString("hex"); write("secrets.json", s); }
  return { studioKey: (process.env.STUDIO_KEY || s.studioKey).trim(), burnSecret: (process.env.BURN_SECRET || s.burnSecret).trim() };
})();
export const STUDIO_KEY = SECRETS.studioKey;
const SECRET = SECRETS.burnSecret;

const RPC = (process.env.RPC_URL || process.env.RPC_URLS || "https://rpc.mainnet.chain.robinhood.com").split(",")[0].trim();
const provider = new ethers.JsonRpcProvider(RPC, 4663, { staticNetwork: true, cacheTimeout: -1 });
export const EXPLORER = "https://explorer.mainnet.chain.robinhood.com";
// Pons v2 and Uniswap v4 on Robinhood Chain (the same addresses the EOLA engine burns with)
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e", HOOK = "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044";
const ROUTER = "0x8876789976dEcBfCbBbe364623C63652db8C0904", POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
export const DEAD = "0x000000000000000000000000000000000000dEaD";
const POOL_CREATED = 2, BPS = 10_000n, SLIPPAGE_BPS = 500n, GAS_ROOM = ethers.parseEther("0.0008");
const MAX_USD = Number(process.env.BURN_MAX_USD || 100), DAY_USD = Number(process.env.BURN_DAY_USD || 300);
const FACTORY_ABI = [
  "function getLaunchedToken(address token) view returns (tuple(address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists))",
  "function getLaunchFeePolicy(address token) view returns (tuple(address protocolFeeRecipient, uint16 protocolFeeShareBps, uint16 buybackBurnBps, uint16 hookFeeBps, uint16 maxInternalPriceImpactBps))",
];
const CURVE_ABI = [
  "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256)",
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)", "function sellableTokens() view returns (uint256)",
  "function feeBps() view returns (uint256)", "function creatorTaxBps() view returns (uint256)", "function currentSnipeTaxBps(address recipient) view returns (uint256)",
];
const ERC20 = ["function balanceOf(address) view returns (uint256)", "function transfer(address to, uint256 amount) returns (bool)", "function symbol() view returns (string)", "function totalSupply() view returns (uint256)"];

/** Retries a chain read: the shared public RPC answers bursts with 429. */
async function again(fn, tries = 6) {
  for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (["CALL_EXCEPTION", "INSUFFICIENT_FUNDS"].includes(e.code)) throw e; if (i >= tries) throw new Error(`The Robinhood Chain RPC is busy (${e.shortMessage || e.message}). Try again in a minute.`); await new Promise((r) => setTimeout(r, 3000 * i)); } }
}
/** Sends without losing the transaction to a 429: gas, fees and nonce are filled with retries, the transaction is signed once,
 *  and the same signed bytes are rebroadcast (same hash), so a retry can never send it twice. */
async function send(w, req) {
  const pop = await again(async () => w.populateTransaction({ ...req, nonce: await provider.getTransactionCount(w.address, "pending") }));
  const signed = await w.signTransaction(pop), hash = ethers.keccak256(signed);
  for (let i = 1; ; i++) {
    try { await provider.broadcastTransaction(signed); return hash; } catch (e) {
      if (/already known/i.test(e.message) || await provider.getTransaction(hash).catch(() => null)) return hash;   // the first try landed, only its answer was lost
      if (e.code === "INSUFFICIENT_FUNDS" || /nonce too low/i.test(e.message)) throw e;
      if (i >= 6) throw new Error(`The Robinhood Chain RPC is busy (${e.shortMessage || e.message}). Nothing was sent. Try again in a minute.`);
      await new Promise((ok) => setTimeout(ok, 3000 * i));
    }
  }
}
/** Waits for a receipt by polling, so one 429 never loses track of a sent transaction. */
async function receipt(hash) {
  for (let i = 0; i < 90; i++) { const r = await provider.getTransactionReceipt(hash).catch(() => null); if (r) return r; await new Promise((ok) => setTimeout(ok, 2000)); }
  return null;
}

let logs = read("log.json", []);
function log(level, text) { logs = [{ t: new Date().toISOString(), level, text }, ...logs].slice(0, 120); write("log.json", logs); console.log(`[burn] ${level} ${text}`); }
const history = () => read("history.json", []);
function record(id, patch) { const h = history(), i = h.findIndex((x) => x.id === id); if (i < 0) h.unshift({ id, t: new Date().toISOString(), ...patch }); else Object.assign(h[i], patch); write("history.json", h.slice(0, 500)); }
const totals = () => read("totals.json", { boughtEth: "0", burned: "0", runs: 0 });
/** kind: "buyback" (bought with ETH), "supply" (tokens the wallet already held) or "held" (the recovery button) */
function addTotals(spentWei, burnedWei, kind = "buyback", usd = 0) {
  const t = totals(); t.boughtEth = (BigInt(t.boughtEth || "0") + spentWei).toString(); t.burned = (BigInt(t.burned || "0") + burnedWei).toString(); t.runs = (t.runs || 0) + 1;
  if (kind === "buyback") { t.boughtBurned = (BigInt(t.boughtBurned || "0") + burnedWei).toString(); t.buybacks = (t.buybacks || 0) + 1; t.boughtUsd = +((t.boughtUsd || 0) + usd).toFixed(2); }
  else { t.supplyBurned = (BigInt(t.supplyBurned || "0") + burnedWei).toString(); t.supplyBurns = (t.supplyBurns || 0) + 1; }
  write("totals.json", t);
}

// ---------- prices: ETH in dollars from Coinbase (CoinGecko as backup), the token from its curve or pool ----------
let ethUsdCache = { at: 0, v: 0 };
async function ethUsd() {
  if (Date.now() - ethUsdCache.at < 60_000 && ethUsdCache.v) return ethUsdCache.v;
  for (const [url, pick] of [["https://api.coinbase.com/v2/prices/ETH-USD/spot", (j) => +j.data.amount], ["https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", (j) => +j.ethereum.usd]]) {
    try { const v = pick(await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json()); if (v > 0) { ethUsdCache = { at: Date.now(), v }; return v; } } catch {}
  }
  if (ethUsdCache.v) return ethUsdCache.v;
  throw new Error("Could not read the ETH price. Try again in a minute.");
}
/** ETH per whole token: the curve's reserves before graduation, the v4 pool's price after. */
async function tokenPriceEth(token, l) {
  if (l.phase === POOL_CREATED) {
    const m = new ethers.Contract(POOL_MANAGER, ["function extsload(bytes32 slot) view returns (bytes32)"], provider);
    const state = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [poolId(token, l.pool), 6n])));
    const P = BigInt(await m.extsload(ethers.toBeHex(state, 32))) & ((1n << 160n) - 1n); if (!P) throw new Error("The pool has no price yet.");
    const tokPerEth = (Number(P) / 2 ** 96) ** 2; return 1 / tokPerEth;
  }
  const [qr, tr] = await new ethers.Contract(l.curve, CURVE_ABI, provider).getReserves();
  return Number(ethers.formatEther(qr)) / Number(ethers.formatUnits(tr, 18));
}
const usdIn = (v) => { const n = Number(String(v ?? "").trim().replace(/^\$/, "").replace(",", ".")); if (!(n > 0)) throw new Error("Enter an amount in dollars, for example 10."); return n; };
const usdToday = () => history().filter((h) => h.kind === "buyback" && h.status !== "failed" && Date.now() - Date.parse(h.t) < 864e5).reduce((a, h) => a + (+h.usd || 0), 0);

// ---------- token settings ----------
const DEFAULTS = { ca: "", symbol: "MYXO" };
export const tokenConfig = () => ({ ...DEFAULTS, ...read("token.json", {}) });
export async function saveToken({ ca, symbol }) {
  const out = { ...tokenConfig() };
  if (ca !== undefined) {
    const c = String(ca).trim();
    if (c === "") out.ca = "";
    else { if (!ethers.isAddress(c)) throw new Error("That is not a contract address."); out.ca = ethers.getAddress(c); }
  }
  if (symbol !== undefined) { const s = String(symbol).trim().replace(/^\$/, "").toUpperCase(); if (!/^[A-Z0-9]{1,12}$/.test(s)) throw new Error("Ticker: 1 to 12 letters or digits."); out.symbol = s; }
  let warn = null;
  if (out.ca) { const l = await again(() => launchOf(out.ca)).catch(() => null); if (!l) warn = "Saved, but the Pons factory has no launch for this address. Check the CA."; }
  write("token.json", out); log("info", `Token set: ${out.ca || "(none)"} $${out.symbol}`); cache = null;
  return { config: out, warn };
}

// ---------- the key ----------
const kdf = (salt) => crypto.scryptSync(SECRET, salt, 32);
export function saveKey(pk) {
  let w; try { w = new ethers.Wallet(String(pk).trim()); } catch { throw new Error("That is not a valid private key."); }
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", kdf(salt), iv);
  const data = Buffer.concat([c.update(w.privateKey, "utf8"), c.final()]);
  write("wallet.enc", { address: w.address, salt: salt.toString("hex"), iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), data: data.toString("hex") });
  log("info", `Buyback wallet set: ${w.address}`); return { address: w.address };
}
function wallet() {
  const f = read("wallet.enc", null); if (!f) return null;
  const d = crypto.createDecipheriv("aes-256-gcm", kdf(Buffer.from(f.salt, "hex")), Buffer.from(f.iv, "hex")); d.setAuthTag(Buffer.from(f.tag, "hex"));
  return new ethers.Wallet(Buffer.concat([d.update(Buffer.from(f.data, "hex")), d.final()]).toString("utf8"), provider);
}
const walletAddress = () => read("wallet.enc", null)?.address || null;
export function removeKey() { if (busy) throw new Error("Wait for the buyback to finish."); write("wallet.enc", null); log("info", "Buyback wallet removed"); return { ok: true }; }

// ---------- Pons and Uniswap v4 ----------
const coder = ethers.AbiCoder.defaultAbiCoder();
const poolId = (token, k) => ethers.keccak256(coder.encode(["address", "address", "uint24", "int24", "address"], [ethers.ZeroAddress, token, k.fee, k.tickSpacing, k.hooks]));
async function launchOf(token) {
  const l = await new ethers.Contract(FACTORY, FACTORY_ABI, provider).getLaunchedToken(token);
  if (!l?.exists) return null;
  return { curve: l.curve, pairToken: l.pairToken, phase: Number(l.phase), creatorTaxBps: BigInt(l.creatorTaxBps), pool: { fee: Number(l.poolFee), tickSpacing: Number(l.tickSpacing), hooks: HOOK } };
}
const minOut = (expected, feeBps = 0n) => (expected * (BPS - feeBps) * (BPS - SLIPPAGE_BPS)) / (BPS * BPS);
async function quoteCurve(curveAddr, quoteIn, recipient) {
  const c = new ethers.Contract(curveAddr, CURVE_ABI, provider);
  const [[qr, tr], sellable, fee, tax, snipe0] = await Promise.all([c.getReserves(), c.sellableTokens(), c.feeBps(), c.creatorTaxBps(), c.currentSnipeTaxBps(recipient)]);
  const snipe = snipe0 > BPS - fee - tax - 100n ? BPS - fee - tax - 100n : snipe0;
  const net = quoteIn - (quoteIn * fee) / BPS - (quoteIn * tax) / BPS - (snipe > 0n ? (quoteIn * snipe) / BPS : 0n);
  const out = (net * tr) / (qr + net);
  return out <= sellable ? out : sellable;
}
async function quoteV4(token, key, amountIn) {
  const m = new ethers.Contract(POOL_MANAGER, ["function extsload(bytes32 slot) view returns (bytes32)"], provider);
  const state = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [poolId(token, key), 6n])));
  const [slot0, liq] = await Promise.all([m.extsload(ethers.toBeHex(state, 32)), m.extsload(ethers.toBeHex(state + 3n, 32))]);
  const P = BigInt(slot0) & ((1n << 160n) - 1n), L = BigInt(liq) & ((1n << 128n) - 1n), Q96 = 1n << 96n;
  if (!P || !L) throw new Error("The Uniswap v4 pool has no price or liquidity yet.");
  return (L * (P - (L * Q96 * P) / (L * Q96 + amountIn * P))) / Q96;
}
function v4BuyData(token, amountIn, key, min) {
  const swap = coder.encode(["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)"], [[[ethers.ZeroAddress, token, key.fee, key.tickSpacing, key.hooks], true, amountIn, min, "0x"]]);
  const input = coder.encode(["bytes", "bytes[]"], ["0x060c0f", [swap, coder.encode(["address", "uint256"], [ethers.ZeroAddress, amountIn]), coder.encode(["address", "uint256"], [token, min])]]);
  return new ethers.Interface(["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"]).encodeFunctionData("execute", ["0x10", [input], Math.floor(Date.now() / 1000) + 300]);
}

// ---------- the two actions ----------
let busy = false, quietUntil = 0;
/** True while the studio is open or a buyback runs: the engine skips its cycles so the RPC rate limit is left for the burn. */
export const quiet = () => busy || Date.now() < quietUntil;
async function ready() {
  const cfg = tokenConfig(), w = wallet();
  if (!ethers.isAddress(cfg.ca)) throw new Error("Save the contract address first.");
  if (!w) throw new Error("Add the buyback wallet key first.");
  return { cfg, w, token: ethers.getAddress(cfg.ca) };
}
const guard = async (fn) => {
  if (busy) throw new Error("Another buyback is still running.");
  busy = true; quietUntil = Date.now() + 120_000;
  try { return await fn(); } catch (e) { const m = e.shortMessage || e.message; log("error", m); throw new Error(m); } finally { busy = false; }
};
async function burnAmount(w, token, amount, cfg, id) {
  log("info", `Burning ${ethers.formatUnits(amount, 18)} $${cfg.symbol}`);
  const hash = await send(w, { to: token, data: new ethers.Interface(ERC20).encodeFunctionData("transfer", [DEAD, amount]) });
  record(id, { status: "burning", burnTx: hash, burned: ethers.formatUnits(amount, 18) });   // on disk before the wait
  const rc = await receipt(hash); if (!rc) throw new Error(`Burn sent (${hash}) but no receipt yet. Check the explorer before trying again.`);
  if (rc.status !== 1) { record(id, { status: "failed" }); throw new Error(`Burn ${hash} failed.`); }
  return hash;
}

/** Spends `usd` dollars (paid in ETH at the live price) from the buyback wallet on the token, then burns exactly what that buy returned. */
export const buyback = (usdRaw) => guard(async () => {
  const { cfg, w, token } = await ready(), usd = usdIn(usdRaw);
  if (usd > MAX_USD) throw new Error(`At most $${MAX_USD} per buyback (BURN_MAX_USD).`);
  const today = usdToday(); if (today + usd > DAY_USD) throw new Error(`Daily limit is $${DAY_USD} (BURN_DAY_USD); $${today.toFixed(2)} already used in the last 24 hours.`);
  const price = await ethUsd(), spend = ethers.parseEther((usd / price).toFixed(18));
  const bal = await again(() => provider.getBalance(w.address)), most = bal > GAS_ROOM ? bal - GAS_ROOM : 0n;
  if (spend > most) throw new Error(`$${usd} is ${ethers.formatEther(spend).slice(0, 10)} ETH, but the wallet can spend ${ethers.formatEther(most).slice(0, 10)} ETH (about $${(Number(ethers.formatEther(most)) * price).toFixed(2)}). Add ETH or enter less.`);
  const l = await again(() => launchOf(token));
  if (!l) throw new Error("The Pons factory has no launch for this CA.");
  if (l.pairToken !== ethers.ZeroAddress) throw new Error("Only native ETH Pons launches are supported.");
  if (l.phase !== 0 && l.phase !== POOL_CREATED) throw new Error(`The launch is moving from the curve to its pool (phase ${l.phase}). Try again in a minute.`);
  const erc = new ethers.Contract(token, ERC20, w), before = await again(() => erc.balanceOf(w.address));
  const id = crypto.randomBytes(5).toString("hex");
  let hash;
  if (l.phase === POOL_CREATED) {
    const fee = BigInt((await again(() => new ethers.Contract(FACTORY, FACTORY_ABI, provider).getLaunchFeePolicy(token))).hookFeeBps) + l.creatorTaxBps;
    const min = minOut(await again(() => quoteV4(token, l.pool, spend)), fee), req = { to: ROUTER, value: spend, data: v4BuyData(token, spend, l.pool, min) };
    const gas = await again(() => w.estimateGas(req), 3);   // a swap that would revert stops here and costs nothing
    log("info", `Buying $${cfg.symbol} on Uniswap v4 with ${ethers.formatEther(spend)} ETH`);
    hash = await send(w, { ...req, gasLimit: (gas * 13n) / 10n });
  } else {
    const min = minOut(await again(() => quoteCurve(l.curve, spend, w.address)));
    log("info", `Buying $${cfg.symbol} on the Pons curve with ${ethers.formatEther(spend)} ETH`);
    hash = await send(w, { to: l.curve, value: spend, data: new ethers.Interface(CURVE_ABI).encodeFunctionData("buy", [spend, min, w.address]) });
  }
  record(id, { kind: "buyback", status: "buying", usd, spentEth: ethers.formatEther(spend), buyTx: hash });
  const rc = await receipt(hash); if (!rc) throw new Error(`Buy sent (${hash}) but no receipt yet. If it went through, use "Burn what the wallet holds".`);
  if (rc.status !== 1) { record(id, { status: "failed" }); throw new Error(`Buy ${hash} failed.`); }
  const bought = (await again(() => erc.balanceOf(w.address))) - before;
  if (bought <= 0n) { record(id, { status: "failed" }); throw new Error(`The buy went through (${hash}) but no $${cfg.symbol} arrived. Nothing burned.`); }
  const burnTx = await burnAmount(w, token, bought, cfg, id);
  addTotals(spend, bought, "buyback", usd); record(id, { status: "done" }); cache = null;
  log("ok", `Bought and burned ${ethers.formatUnits(bought, 18)} $${cfg.symbol} for $${usd} (${ethers.formatEther(spend)} ETH)`);
  return { ok: true, usd, burned: ethers.formatUnits(bought, 18), buyTx: hash, burnTx };
});

/** Burns tokens the wallet already holds (send the supply to the buyback wallet first), sized in dollars at the live price.
 *  usd "max" burns everything the wallet holds. */
export const burnSupply = (usdRaw) => guard(async () => {
  const { cfg, w, token } = await ready(), l = await again(() => launchOf(token));
  if (!l) throw new Error("The Pons factory has no launch for this CA.");
  const bal = await again(() => new ethers.Contract(token, ERC20, provider).balanceOf(w.address));
  if (bal === 0n) throw new Error(`The burn wallet holds no $${cfg.symbol}. Send the supply you want to burn to ${w.address} first.`);
  const px = (await again(() => tokenPriceEth(token, l))) * (await ethUsd());
  let amount, usd;
  if (String(usdRaw).trim().toLowerCase() === "max") { amount = bal; usd = Number(ethers.formatUnits(bal, 18)) * px; }
  else {
    usd = usdIn(usdRaw); amount = ethers.parseUnits((usd / px).toFixed(6), 18);
    if (amount > bal) throw new Error(`$${usd} is ${Math.round(usd / px).toLocaleString("en-US")} $${cfg.symbol}, but the wallet holds ${Math.round(Number(ethers.formatUnits(bal, 18))).toLocaleString("en-US")} (about $${(Number(ethers.formatUnits(bal, 18)) * px).toFixed(2)}). Enter less or send more tokens to the burn wallet.`);
  }
  const id = crypto.randomBytes(5).toString("hex"); record(id, { kind: "supply", status: "burning", usd: +usd.toFixed(2), priceUsd: px });
  const burnTx = await burnAmount(w, token, amount, cfg, id);
  addTotals(0n, amount, "supply"); record(id, { status: "done" }); cache = null;
  log("ok", `Burned ${ethers.formatUnits(amount, 18)} $${cfg.symbol} from supply (about $${usd.toFixed(2)})`);
  return { ok: true, usd: +usd.toFixed(2), burned: ethers.formatUnits(amount, 18), burnTx };
});

/** Burns everything the wallet holds, for example after a buy that stopped before its burn. */
export const burnHeld = () => guard(async () => {
  const { cfg, w, token } = await ready(), bal = await again(() => new ethers.Contract(token, ERC20, provider).balanceOf(w.address));
  if (bal === 0n) throw new Error(`The wallet holds no $${cfg.symbol}.`);
  const id = crypto.randomBytes(5).toString("hex"); record(id, { kind: "held", status: "burning", held: true });
  const burnTx = await burnAmount(w, token, bal, cfg, id);
  addTotals(0n, bal, "held"); record(id, { status: "done" }); cache = null;
  log("ok", `Burned ${ethers.formatUnits(bal, 18)} $${cfg.symbol} the wallet held`);
  return { ok: true, burned: ethers.formatUnits(bal, 18), burnTx };
});

// ---------- views ----------
// the split is read from history, so buybacks made before the dollar panel (no kind, no usd) still count as buybacks
const publicTotals = () => {
  const t = totals(), done = history().filter((h) => h.status === "done" && +h.burned > 0), buys = done.filter((h) => h.kind !== "supply"), sup = done.filter((h) => h.kind === "supply");
  const sum = (xs, k) => xs.reduce((a, h) => a + Number(h[k] || 0), 0);
  return { boughtEth: ethers.formatEther(BigInt(t.boughtEth || "0")), boughtUsd: +sum(buys, "usd").toFixed(2), burned: ethers.formatUnits(BigInt(t.burned || "0"), 18), runs: t.runs || 0,
    bought: String(sum(buys, "burned")), buybacks: buys.length, supply: String(sum(sup, "burned")), supplyBurns: sup.length };
};
let cache = null, lastDead = null, supplyOf = null;   // total supply never changes once minted, so it is read once per CA
/** What the site shows: the CA once it is set, the dead-address balance and the finished burns. */
export async function publicView() {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const cfg = tokenConfig(); let v = { live: false, symbol: cfg.symbol };
  if (cfg.ca) {
    // a busy RPC keeps the last balance read for this CA instead of showing nothing
    let dead = null; try { dead = ethers.formatUnits(await again(() => new ethers.Contract(cfg.ca, ERC20, provider).balanceOf(DEAD), 3), 18); lastDead = { ca: cfg.ca, dead }; } catch { if (lastDead?.ca === cfg.ca) dead = lastDead.dead; }
    if (supplyOf?.ca !== cfg.ca) { try { supplyOf = { ca: cfg.ca, v: ethers.formatUnits(await again(() => new ethers.Contract(cfg.ca, ERC20, provider).totalSupply(), 3), 18) }; } catch {} }
    v = { live: true, ca: cfg.ca, supply: supplyOf?.ca === cfg.ca ? supplyOf.v : null, symbol: cfg.symbol, buy: `https://ponsfamily.com/launchpad/${cfg.ca}`, explorer: EXPLORER, deadBalance: dead, totals: publicTotals(),
      burns: history().filter((h) => h.status === "done" && +h.burned > 0).slice(0, 10).map(({ t, kind, burned, usd, spentEth, buyTx, burnTx }) => ({ t, kind: kind || "buyback", burned, usd: usd ?? null, spentEth: spentEth || null, buyTx: buyTx || null, burnTx })) };
  }
  cache = { at: Date.now(), v }; return v;
}
export async function status() {
  quietUntil = Math.max(quietUntil, Date.now() + 90_000);
  const cfg = tokenConfig(), addr = walletAddress(), out = { config: cfg, wallet: addr, busy, maxUsd: MAX_USD, dayUsd: DAY_USD, todayUsd: +usdToday().toFixed(2), totals: publicTotals(), logs: logs.slice(0, 40), history: history().slice(0, 30), explorer: EXPLORER };
  try {
    out.ethUsd = await ethUsd().catch(() => null);
    if (addr) { const b = await again(() => provider.getBalance(addr)); out.walletEth = ethers.formatEther(b); out.spendableEth = ethers.formatEther(b > GAS_ROOM ? b - GAS_ROOM : 0n); if (out.ethUsd) out.spendableUsd = +(Number(out.spendableEth) * out.ethUsd).toFixed(2); }
    if (ethers.isAddress(cfg.ca)) {
      const l = await again(() => launchOf(cfg.ca)); out.phase = l ? l.phase : null; out.onPons = !!l;
      if (l && out.ethUsd) out.tokenPriceUsd = (await again(() => tokenPriceEth(cfg.ca, l))) * out.ethUsd;
      if (addr) { out.tokenBal = ethers.formatUnits(await again(() => new ethers.Contract(cfg.ca, ERC20, provider).balanceOf(addr)), 18); if (out.tokenPriceUsd) out.tokenBalUsd = +(Number(out.tokenBal) * out.tokenPriceUsd).toFixed(2); }
    }
  } catch (e) { out.error = e.shortMessage || e.message; }
  return out;
}
