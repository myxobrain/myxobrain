// Render every MYXOBRAIN still: the X banner, the MYXO PAPER cards and product screenshots of the real site, then write _src/paper-captions.txt.
// Usage (from myxobrain/):  sh deploy/build.sh && node konten-x/_src/stills.mjs [banner,cards,product,posts]
// Needs Playwright's chromium (PLAYWRIGHT=path/to/playwright/index.mjs, default: the copy WORMBRAIN's capture uses).
import { createServer } from "node:http";
import { readFile, stat, mkdir, cp, rm, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS } from "./cards.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, "../.."), DIST = join(REPO, "deploy/dist"), OUT = join(REPO, "konten-x");
const PW = process.env.PLAYWRIGHT || "/Users/sergiodyegogmail.com/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
const { chromium } = await import(PW);
const only = (process.argv[2] || "banner,cards,product,posts").split(",");

// the built site plus this studio, served like the real host (extensionless pages)
await rm(join(DIST, "_studio"), { recursive: true, force: true });
await cp(HERE, join(DIST, "_studio"), { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  for (const c of [p, p + ".html"]) { try { const f = join(DIST, c); if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {} }
  res.writeHead(404); res.end();
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function still(url, w, h, file, settle = 3200, prep) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(BASE + url, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.__ready !== false, null, { timeout: 15000 }).catch(() => {});
  if (prep) await prep(p);
  await p.waitForTimeout(settle);
  await mkdir(dirname(file), { recursive: true });
  await p.screenshot({ path: file, type: "png" }); await p.close(); console.log("✓", file.replace(REPO + "/", ""));
}

if (only.includes("banner")) await still("/_studio/studio.html?banner", 3000, 1000, join(REPO, "brand/MYXOBRAIN-X/banner-3000x1000.png"), 4500);
if (only.includes("cards")) for (const c of CARDS) await still(`/_studio/studio.html?card=${c.n}`, 1920, 1080, join(OUT, `paper/${String(c.n).padStart(2, "0")}-${c.slug}.png`), 4200);
if (only.includes("product")) {
  const pick = (k) => async (p) => { await p.click(`#league .row[data-k="${k}"]`); };
  const at = (sel) => async (p) => { await p.evaluate((s) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 60); }, sel); };
  await still("/", 1600, 900, join(OUT, "_src/product/hero-worm.png"), 3500);
  for (const k of ["physarum", "fry", "ant", "bee", "ecoli"]) await still("/", 1600, 900, join(OUT, `_src/product/hero-${k}.png`), 4000, pick(k));
  await still("/", 1600, 900, join(OUT, "_src/product/specimens.png"), 1500, at("#specimens"));
  await still("/", 1600, 900, join(OUT, "_src/product/folds-gates.png"), 1500, at(".grid"));
  await still("/", 1600, 900, join(OUT, "_src/product/rules.png"), 1500, at("#rules"));
  await still("/", 1600, 900, join(OUT, "_src/product/ledger.png"), 1500, at("#ledger"));
  await still("/", 1600, 900, join(OUT, "_src/product/sources.png"), 1500, at("#papers"));
  await still("/", 1600, 900, join(OUT, "_src/product/cli.png"), 1500, at("#cli"));
  await still("/organism?k=fry&exp=EXP-004", 1600, 900, join(OUT, "_src/product/specimen-fry.png"), 3500);
  await still("/organism?k=worm&exp=EXP-004", 1600, 900, join(OUT, "_src/product/specimen-worm.png"), 3500);
}
await browser.close(); server.close();
await rm(join(DIST, "_studio"), { recursive: true, force: true });

if (only.includes("posts")) {
  const pad = (n) => String(n).padStart(2, "0");
  const research = CARDS.map((c) => `--- R${pad(c.n)} · MYXO PAPER №${pad(c.n)} · ${c.tag}\nGambar: paper/${pad(c.n)}-${c.slug}.png\nSumber: ${c.cite}\n\n${c.post}\n`).join("\n");
  const P = [
    ["hero-worm.png", "What is MYXOBRAIN?\n\nSix models of real organisms, from a slime mold to a 302-neuron worm, reading the same 11 Robinhood Chain assets as food.\n\nNo language model makes the calls. myxobrain.com"],
    ["hero-physarum.png", "Click Physarum on myxobrain.com and the same 302 particles become a slime mold's tube network, thick where the conductivity is high.\n\nThe amber tubes are what it holds at that hour."],
    ["hero-fry.png", "This is the fry: 11 spiking cells, one per asset.\n\nBig, bright cells are firing. Amber ones are held. Drag the time slider and watch them change hour by hour."],
    ["hero-ant.png", "The ant colony, drawn from its own pheromone.\n\nDense trails, more pheromone. The colony's trail share is its portfolio."],
    ["hero-bee.png", "The swarm gathers where the scouts are dancing.\n\nOne click on myxobrain.com, one organism, one hour of its real state."],
    ["hero-ecoli.png", "E. coli: rod-shaped cells crowding the assets they swam to.\n\nWhen the food drops, they tumble somewhere else."],
    ["specimens.png", "Every organism on the site comes with its papers: what it is, who published it, and what the engine takes from it."],
    ["folds-gates.png", "The scoreboard nobody likes to show: every fold, every gate, every FAIL.\n\nTo pass, an organism has to beat holding on return and Sharpe, with no worse drawdown, and win 3 of 4 folds."],
    ["rules.png", "The rules are written before the run.\n\n4 folds. 48 settings chosen on past data only. 5 seeds. 0.3% cost. A blind twin with no food as the control. The last 3 months stay sealed until something passes."],
    ["ledger.png", "Six experiments so far: momentum, on-chain flow, news, mean reversion, risk guard, hold with a tilt.\n\n36 runs. 0 passes. All published."],
    ["sources.png", "20 papers behind the six minds, each looked up on Crossref, each linked to the line of code that uses it."],
    ["cli.png", "MYXOBRAIN in your terminal:\n\nnpx myxobrain-agent\n\nLeague, folds, gates, the live test, and `myxo verify` to re-hash every engine and data file the site publishes."],
    ["specimen-fry.png", "Open any organism to watch it think: inputs per asset on the left, its own state in the middle, the portfolio on the right.\n\nThen press Recompute and your browser re-runs the whole test."],
    ["specimen-worm.png", "The worm's page: food in, 302 neurons, a portfolio out.\n\nEvery number on it can be recomputed in your browser."],
  ];
  const product = P.map(([img, t], i) => `--- P${pad(i + 1)} · produk\nGambar: _src/product/${img}\n\n${t}\n`).join("\n");
  await writeFile(join(OUT, "_src/paper-captions.txt"), `MYXOBRAIN · semua post X (${CARDS.length} riset + ${P.length} produk)

Riset = seri "MYXO PAPER", tiap kartu ada nomornya dan sumber paper aslinya. Produk = screenshot situs live.
Ritme saran: 3-4 post/hari (1-2 riset, 1-2 produk). Urutan riset ikut nomor: pembuka, lalu Physarum, Worm, Fry, Ant, Bee, E. coli, penutup.
Sebelum posting angka (return, gates), cek dulu di myxobrain.com atau: npx myxobrain-agent

=========================================================
RISET · MYXO PAPER №01–${pad(CARDS.length)}
=========================================================

${research}
=========================================================
PRODUK · screenshot myxobrain.com
=========================================================

${product}`);
  console.log("✓ konten-x/_src/paper-captions.txt (copy the sections you need into captions.txt)");
}
