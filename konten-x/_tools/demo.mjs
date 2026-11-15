// node konten-x/_tools/demo.mjs -> postingan-ca/ca-demo.mp4: intro card + a real screen recording of myxobrain.com + end card.
// SITE defaults to https://myxobrain.com (SITE=http://127.0.0.1:4174 for a local build). The cards come from _v.html.
import { execFileSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
import { KIT, chromium, ambient } from "./lib.mjs";
const here = path.join(KIT, "_tools"), TMP = path.join(here, ".demo"), SITE = process.env.SITE || "https://myxobrain.com";
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: TMP, size: { width: 1600, height: 900 } } });
const T0 = Date.now();
await ctx.addInitScript(() => addEventListener("DOMContentLoaded", () => {
  const st = document.createElement("style");
  st.textContent = `#dCur{position:fixed;z-index:99999;left:800px;top:450px;width:26px;height:26px;pointer-events:none;transition:left .55s cubic-bezier(.3,.7,.2,1),top .55s cubic-bezier(.3,.7,.2,1)}
  #dCap{position:fixed;z-index:99998;left:50%;bottom:54px;transform:translateX(-50%);background:#0B0B09;color:#EDEDE7;border:1px solid rgba(255,176,0,.6);padding:14px 26px;font:500 21px/1.35 Inter,"JetBrains Mono",sans-serif;text-align:center;max-width:1100px;opacity:0;transition:opacity .3s}
  #dCap b{color:#FFB000;font:500 17px "JetBrains Mono",monospace;margin-right:12px}#dCap small{display:block;font:400 14px "JetBrains Mono",monospace;color:#8C8C84;margin-top:4px}`;
  document.head.appendChild(st);
  const cur = document.createElement("div"); cur.id = "dCur"; cur.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  const cap = document.createElement("div"); cap.id = "dCap"; document.body.append(cur, cap);
}));
const p = await ctx.newPage(); const wait = (ms) => p.waitForTimeout(ms);
const caption = (s, t, m = "") => p.evaluate(([s, t, m]) => { const c = document.getElementById("dCap"); c.innerHTML = (s ? `<b>${s}</b>` : "") + t + (m ? `<small>${m}</small>` : ""); c.style.opacity = t ? 1 : 0; }, [s, t, m]);
async function moveTo(l) { const bb = await l.boundingBox(); await p.evaluate(([x, y]) => { const c = document.getElementById("dCur"); c.style.left = x + "px"; c.style.top = y + "px"; }, [bb.x + bb.width / 2, bb.y + bb.height / 2]); await wait(650); }
async function click(sel) { const l = p.locator(sel).first(); await moveTo(l); await l.click(); }
async function scrollToId(id) { await p.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" }), id); await wait(1400); }

await p.goto(SITE + "/?exp=EXP-004", { waitUntil: "networkidle" });
await p.waitForFunction(() => document.querySelectorAll("#league .row[data-k]").length > 5, null, { timeout: 60000 });
await wait(2500); const START = (Date.now() - T0) / 1000;
await caption("", "MYXOBRAIN · six minds in 40 seconds", "a real screen recording of myxobrain.com"); await wait(3000);
await caption("01", "The worm: 302 real neurons, every synapse", "Cook et al. 2019 connectome · drag to turn"); await wait(3400);
await click('#league .row[data-k="fry"]'); await caption("02", "Click a mind: the same particles become its state", "fry · 11 spiking cells, amber = held"); await wait(3800);
await click('#league .row[data-k="ant"]'); await caption("03", "Ants: trails to profit get pheromone"); await wait(3000);
await click('#league .row[data-k="bee"]'); await caption("04", "Bees: the swarm moves at a quorum"); await wait(3000);
await click('#league .row[data-k="physarum"]'); await caption("05", "Physarum: tubes that carry flow thicken"); await wait(3000);
await click("#play"); await caption("06", "Replay the whole test, hour by hour", "the network and the 3D follow the real holdings"); await wait(4200);
await click("#play"); await caption("", "");
await scrollToId("folds"); await caption("07", "Every fold, every gate, every fail", "all four gates, or it failed"); await wait(3400);
await scrollToId("specimens"); await caption("08", "Each mind comes with the paper behind it", "20 papers, all on Crossref"); await wait(3600);
await scrollToId("cli"); await caption("09", "npx myxobrain-agent", "or check every file yourself: myxo verify"); await wait(3600);
await caption("", ""); await wait(300);
const END = (Date.now() - T0) / 1000;
const vid = await p.video().path(); await ctx.close(); await b.close();

const rec = path.join(TMP, "rec.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", START.toFixed(2), "-to", END.toFixed(2), "-i", vid, "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "slow", rec]);
for (const s of ["caintro", "caoutro"]) execFileSync("node", [path.join(here, "render.mjs"), s, path.join(TMP, s + ".mp4")], { env: { ...process.env, SILENT: "1" }, stdio: "inherit" });
const list = path.join(TMP, "list.txt"); fs.writeFileSync(list, ["caintro", "rec", "caoutro"].map((n) => `file '${path.join(TMP, n + ".mp4")}'`).join("\n"));
const joined = path.join(TMP, "joined.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-an", "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", joined]);
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", joined]).toString());
const out = path.join(KIT, "postingan-ca", "ca-demo.mp4"); fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", joined, ...ambient(dur), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", out]);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("✓ postingan-ca/ca-demo.mp4", (fs.statSync(out).size / 1e6).toFixed(1) + " MB", dur.toFixed(1) + "s");
