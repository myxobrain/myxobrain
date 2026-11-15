// node konten-x/_tools/posts.mjs [p01 a02 ...]   (from myxobrain/, after sh deploy/build.sh)
// Screenshots the posts of _p.html (1600x900 at 2x) into prelaunch/ (p..) and afterlaunch/ (a..).
import fs from "node:fs"; import path from "node:path";
import { KIT, CLOCK, serve, chromium, TICKER } from "./lib.mjs";
const srv = await serve(); const b = await chromium.launch();
const B = `${srv.base}/kit/_p.html`;
let ids = process.argv.slice(2);
if (!ids.length) { const p = await b.newPage(); await p.goto(B); await p.waitForFunction(() => window.POSTS); ids = await p.evaluate(() => window.POSTS); await p.close(); }
for (const id of ids) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const miss = []; p.on("response", (r) => r.status() >= 400 && miss.push(r.url().split("/").slice(-2).join("/")));
  await p.addInitScript(CLOCK);
  await p.goto(`${B}?p=${id}&ticker=${encodeURIComponent(TICKER)}`); await p.waitForFunction(() => window.READY === true, null, { timeout: 60000, polling: 100 });
  for (let i = 0; i < 150; i++) await p.evaluate(() => window.__step(1000 / 30));   // let the 3D settle into its shape
  const dir = path.join(KIT, id.startsWith("p") ? "prelaunch" : "afterlaunch"); fs.mkdirSync(dir, { recursive: true });
  if (miss.length) console.log(id, "warning, missing:", miss.join(" "));
  await p.screenshot({ path: path.join(dir, `${id}.png`) }); await p.close(); console.log("✓", id, await Promise.resolve(miss.length ? "(with fallback)" : ""));
}
await b.close(); srv.close();
