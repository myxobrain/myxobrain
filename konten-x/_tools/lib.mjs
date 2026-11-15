// Shared bits for the MYXOBRAIN X kit tools: a static server (the built site at /, this konten-x folder at /kit/),
// a Playwright chromium, and a virtual clock so the 3D ring renders frame-exact in videos.
// Every tool needs the site built first: sh deploy/build.sh (from myxobrain/).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = join(KIT, "..");
export const DIST = join(REPO, "deploy/dist");
export const TICKER = process.env.TICKER || "$MYXO";   // shown on the launch videos; change here and re-render if the ticker differs
const PW = process.env.PLAYWRIGHT || "/Users/sergiodyegogmail.com/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
export const { chromium } = await import(PW);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4" };
export async function serve() {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname), base = DIST;
    if (p.startsWith("/kit/")) { base = KIT; p = p.slice(4); }
    if (p.endsWith("/")) p += "index.html";
    for (const c of [p, p + ".html"]) { try { const f = join(base, c); if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {} }
    res.writeHead(404); res.end();
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

// performance.now and requestAnimationFrame on a clock we step ourselves: one step = one video frame
export const CLOCK = `(() => { let vt = 0; const q = []; performance.now = () => vt;
  window.requestAnimationFrame = (cb) => (q.push(cb), q.length); window.cancelAnimationFrame = () => {};
  window.__step = (ms) => { vt += ms; for (const f of q.splice(0)) { try { f(vt); } catch (e) { console.error(e); } } }; })();`;

export const ambient = (dur, silent = false) => ["-f", "lavfi", "-i", `anoisesrc=color=brown:amplitude=0.05:d=${dur}`, "-f", "lavfi", "-i", `sine=f=55:d=${dur}`,
  "-filter_complex", `[1]lowpass=f=380,volume=${silent ? 0 : 0.9}[n];[2]volume=${silent ? 0 : 0.05}[s];[n][s]amix=inputs=2:normalize=0,afade=t=in:d=1.2,afade=t=out:st=${Math.max(0, dur - 1.5)}:d=1.5[a]`];
