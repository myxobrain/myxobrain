// deploy/ring-data.mjs: compact copy of the connectome for the home page's 3D ring (read-only; the engine file is not changed).
// Output: { n: [[id, kind, y-position], ...], l: [[a, b], ...] } with l = chemical synapses of weight >= 5, as WORMBRAIN draws them.
import { readFileSync, writeFileSync } from "node:fs";
const [src, out] = process.argv.slice(2);
const C = JSON.parse(readFileSync(src, "utf8"));
const idx = new Map(C.neurons.map((n, i) => [n.id, i]));
const ring = {
  source: C.source,
  n: C.neurons.map((n) => [n.id, n.kind, Math.round(n.pos[1] * 10) / 10]),
  l: C.chem.filter((e) => e[2] >= 5).map(([a, b]) => [idx.get(a), idx.get(b)]),
};
writeFileSync(out, JSON.stringify(ring));
console.log(`ring: ${ring.n.length} neurons, ${ring.l.length} synapses -> ${out}`);
