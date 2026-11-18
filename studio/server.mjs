// MYXOBRAIN studio server: the only moving part behind myxobrain.com. nginx serves the static site and sends
// /studio and /api/ here. The owner sets the $MYXO CA and runs buyback-and-burn by hand (burn.mjs, the OPTIC engine).
// Public: GET /api/token (CA, burns, dead-address balance). Owner: /api/studio/* with the studio key.
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "./burn.mjs";

const PORT = +(process.env.PORT || 5770), HOST = process.env.HOST || "127.0.0.1";
const PAGE = new URL("./studio.html", import.meta.url).pathname;

const send = (res, code, body, headers = {}) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", ...headers }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((ok, no) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 20_000) { no(new Error("Request too large.")); req.destroy(); } }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { no(new Error("Bad JSON.")); } }); });
// nginx is the only client and passes the visitor's address (from the PROXY protocol) in X-Real-IP
const ipOf = (req) => (/^(::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress || "") && req.headers["x-real-ip"]) || req.socket.remoteAddress || "";

// the studio key, compared in constant time; ten wrong keys from one address lock it out for ten minutes
const digest = (x) => crypto.createHash("sha256").update(String(x)).digest(), misses = new Map();
function studioOk(req) {
  const ip = ipOf(req), now = Date.now(), m = (misses.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (m.length >= 10) return "locked";
  if (crypto.timingSafeEqual(digest(req.headers["x-studio-key"] || ""), digest(T.STUDIO_KEY))) return "ok";
  misses.set(ip, [...m, now]); if (misses.size > 5000) misses.clear(); return "bad";
}
async function studio(req, res, p) {
  const a = studioOk(req); if (a !== "ok") return send(res, a === "locked" ? 429 : 401, { error: a === "locked" ? "Too many wrong keys. Wait 10 minutes." : "Wrong studio key." });
  const k = `${req.method} ${p.slice("/api/studio".length)}`;
  if (k === "GET /status") return send(res, 200, await T.status());
  if (k === "POST /token") return send(res, 200, await T.saveToken(await body(req)));
  if (k === "POST /wallet") return send(res, 200, T.saveKey((await body(req)).privateKey || ""));
  if (k === "DELETE /wallet") return send(res, 200, T.removeKey());
  if (k === "POST /buyback") return send(res, 200, await T.buyback((await body(req)).usd));
  if (k === "POST /supply") return send(res, 200, await T.burnSupply((await body(req)).usd));
  if (k === "POST /burn-held") return send(res, 200, await T.burnHeld());
  return send(res, 404, { error: "Not found." });
}

http.createServer(async (req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  try {
    if (p === "/api/token" && req.method === "GET") return send(res, 200, await T.publicView(), { "access-control-allow-origin": "*" });
    if (p.startsWith("/api/studio/")) return await studio(req, res, p);
    if (p === "/studio" || p === "/studio/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "x-robots-tag": "noindex, nofollow", "x-frame-options": "DENY", "referrer-policy": "no-referrer" });
      return fs.createReadStream(PAGE).pipe(res);
    }
    if (p === "/api/health") return send(res, 200, { ok: true });
    return send(res, 404, { error: "Not found." });
  } catch (e) { return send(res, 400, { error: e.shortMessage || e.message || "Something went wrong." }); }
}).listen(PORT, HOST, () => console.log(`MYXOBRAIN studio on http://${HOST}:${PORT}`));
