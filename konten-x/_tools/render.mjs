// node konten-x/_tools/render.mjs <scene> [out.mp4]   (from myxobrain/, after sh deploy/build.sh)
// Renders a scene of _v.html frame by frame (30 fps, 1920x1080) on a virtual clock and encodes an H.264 mp4 for X
// with a quiet ambient bed. Scenes: caintro caoutro paydex burn morph explainer papers specimen-<org>.
import { execFileSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
import { KIT, CLOCK, serve, chromium, ambient, TICKER } from "./lib.mjs";
const [scene, outArg] = process.argv.slice(2);
if (!scene) { console.log("usage: render.mjs <scene> [out.mp4]"); process.exit(1); }
const out = outArg || path.join(KIT, "video", `${scene}.mp4`); fs.mkdirSync(path.dirname(out), { recursive: true });
const FPS = 30, TMP = path.join(KIT, "_tools", `.f-${scene}`); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP);
const srv = await serve(); const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.addInitScript(CLOCK);
await p.goto(`${srv.base}/kit/_v.html?s=${scene}&ticker=${encodeURIComponent(TICKER)}`);
await p.waitForFunction(() => window.READY === true, null, { timeout: 180000, polling: 100 });
const dur = await p.evaluate(() => window.DUR), n = Math.round(dur * FPS);
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => { window.__step(1000 / 30); window.seek(t); }, i / FPS);
  await p.screenshot({ path: path.join(TMP, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
}
await b.close(); srv.close(); if (errs.length) console.log("page errors:", errs.slice(0, 3));
const silent = process.env.SILENT === "1";
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(TMP, "f%05d.jpg"), ...ambient(dur, silent).slice(0, -1),
  ambient(dur, silent).at(-1) + `;[0]format=yuv420p,fade=t=in:d=0.5,fade=t=out:st=${dur - 0.6}:d=0.6[v]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", out]);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("✓", path.relative(KIT, out), (fs.statSync(out).size / 1e6).toFixed(1) + " MB", dur + "s");
