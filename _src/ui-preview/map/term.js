// term.js: the MYXOBRAIN//TERM home page. Read-only view of the published league files; nothing here touches the engine.
// Every number comes from data/league-*.json, data/league-summary.json, data/sources.json, live/live.json or site.json.
import { BOOKS, EXPS, league, pct, day, weights, stats, SOURCES, INNER } from "./common.js";
import { createRing } from "./ring.js";
import { fieldNotes } from "./field.js";

const $ = (id) => document.getElementById(id);
const ORG = Object.keys(BOOKS).filter((k) => BOOKS[k].kind === "org");
const NS = "http://www.w3.org/2000/svg";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cls = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
const GATE_SHORT = ["RET", "SHARPE", "DD", "3/4"];

const EX = await EXPS;
const want = new URLSearchParams(location.search).get("exp");
let L, idx = 0, focus = "worm", playing = false, timer = null;

// the 3D specimen in the hero (a compact copy of the connectome, written at build time)
const CON = await fetch("data/connectome-ring.json").then((r) => (r.ok ? r.json() : null), () => null);
const RING = CON ? createRing($("ring"), CON) : null;
function setFocus(k) { if (BOOKS[k]?.kind !== "org" || !L.organisms[k]) return; focus = k; leagueTable(); gates(); net(); equity(); stamp(); }

// ---------- experiment tabs ----------
$("exps").innerHTML = EX.map((e) => `<button data-e="${e.id}" title="${esc(e.title)}">${e.id}</button>`).join("");
$("exps").onclick = (e) => { const b = e.target.closest("button"); if (b) load(b.dataset.e); };

async function load(id) {
  L = await league(id);
  idx = L.t.length - 1;
  history.replaceState(null, "", (L.id === "EXP-004" ? location.pathname : "?exp=" + L.id) + location.hash);   // the default experiment keeps a clean URL
  document.querySelectorAll("#exps button").forEach((b) => b.classList.toggle("on", b.dataset.e === L.id));
  document.querySelectorAll("#cards .card").forEach((c) => c.classList.toggle("on", c.dataset.e === L.id));
  if (!L.organisms[focus]) focus = ORG.filter((k) => L.organisms[k]).sort((a, b) => passed(b) - passed(a))[0] || ORG[0];
  $("bar").max = L.t.length - 1; $("bar").value = idx;
  leagueTable(); foldMatrix(); gates(); conf(); net(); equity(); stamp(); tout();
  try { fieldNotes($("fns"), L, CON); } catch (e) { console.error(e); }
}
const passed = (k) => (L.organisms[k] ? L.organisms[k].gates.filter((g) => g.pass).length : -1);

// ---------- league table ----------
function leagueTable() {
  const keys = Object.keys(BOOKS).filter((k) => stats(L, k)).sort((a, b) => stats(L, b).ret - stats(L, a).ret);
  const max = Math.max(...keys.map((k) => Math.abs(stats(L, k).ret)), 0.01);
  $("league").innerHTML = `<div class="row hd"><span>#</span><span>BOOK</span><span class="r">RET</span><span>BAR</span><span class="r">GATES</span></div>` +
    keys.map((k, i) => {
      const m = stats(L, k), b = BOOKS[k], n = Math.max(1, Math.round((Math.abs(m.ret) / max) * 14));
      const st = b.kind === "bench" ? `<span class="d">BENCH</span>` : `<span class="${L.organisms[k].verdict === "FAILED" ? "dn" : "up"}">${passed(k)}/4</span>`;
      return `<div class="row${k === focus ? " on" : ""}" data-k="${k}"${b.kind === "org" ? ' role="button" tabindex="0"' : ""} title="Sharpe ${m.sharpe.toFixed(2)} · max DD ${(m.maxDD * 100).toFixed(1)}%"><span class="d">${String(i + 1).padStart(2, "0")}</span><span><i class="dot" style="background:${b.color}"></i>${esc(b.name.toUpperCase())}</span>
      <span class="r ${cls(m.ret)}">${pct(m.ret)}</span><span class="bar ${cls(m.ret)}">${m.ret >= 0 ? "▶" : "◀"}${"█".repeat(n)}</span><span class="r">${st}</span></div>`;
    }).join("");
  $("league").querySelectorAll(".row[data-k]").forEach((r) => {
    const pick = () => setFocus(r.dataset.k);
    r.onclick = pick; r.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick());
  });
}

// ---------- folds matrix ----------
function foldMatrix() {
  const hf = L.bench.holdFolds || [];
  const span = (o) => (o.folds || []).map((f) => day(f.from).slice(0, 7));
  const first = ORG.map((k) => L.organisms[k]).find(Boolean);
  let h = `<span class="hd"></span>${(first ? span(first) : [1, 2, 3, 4]).map((d, i) => `<span class="hd">F${i + 1} · ${d}</span>`).join("")}`;
  h += `<span class="d">HOLD</span>${hf.map((f) => `<span class="l ${cls(f.ret)}">${pct(f.ret)}</span>`).join("")}`;
  ORG.forEach((k) => {
    const o = L.organisms[k]; if (!o) return;
    h += `<span>${esc(BOOKS[k].name.toUpperCase())}</span>` + o.folds.map((f) => f.win ? `<span class="w">${pct(f.test.ret)} W</span>` : `<span class="l ${cls(f.test.ret)}">${pct(f.test.ret)} L</span>`).join("");
  });
  $("folds").innerHTML = h;
}

// ---------- gates matrix + note ----------
function gates() {
  let h = `<span class="hd"></span>${GATE_SHORT.map((g) => `<span class="hd">${g}</span>`).join("")}`;
  ORG.forEach((k) => {
    const o = L.organisms[k]; if (!o) return;
    h += `<span class="nm" style="${k === focus ? "color:var(--acc)" : ""}">${esc(BOOKS[k].name.toUpperCase())}</span>` + o.gates.map((g) => `<span class="${g.pass ? "ps" : "fl"}" title="${esc(g.name)}">${g.pass ? "PASS" : "FAIL"}</span>`).join("");
  });
  $("gates").innerHTML = h;
  const o = L.organisms[focus], any = ORG.some((k) => L.organisms[k] && L.organisms[k].verdict !== "FAILED");
  $("note").innerHTML = o ? `<span class="p">&gt; ${esc(BOOKS[focus].name.toUpperCase())}</span> ${esc(BOOKS[focus].rule || "")}<br>
    ${pct(o.stitched.ret)} vs hold ${pct(L.bench.hold.ret)} · blind twin (no food) ${pct(o.blind.ret)} · 5 seeds ${pct(Math.min(...o.seeds.map((s) => s.ret)))} … ${pct(Math.max(...o.seeds.map((s) => s.ret)))}<br>
    <span class="d">${any ? "An organism passed every gate in this run." : "No organism passed every gate, so the sealed last three months stay sealed."}</span>` : "";
  $("openOrg").href = `organism?k=${focus}&exp=${L.id}`;
  $("openOrg").textContent = `[ O ] OPEN ${BOOKS[focus].name.toUpperCase()} · RECOMPUTE IT`;
}

// ---------- network: assets -> organisms -> trade, edges = holdings at the selected hour ----------
const el = (tag, at, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
function net() {
  const svg = $("net"); svg.innerHTML = "";
  const n = L.syms.length, ay = (i) => 12 + (i * 226) / (n - 1), oy = (j) => 22 + (j * 206) / (ORG.length - 1), AX = 54, OX = 236, TX = 382, TY = 125;
  const curve = (x1, y1, x2, y2) => `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
  const gE = el("g", { fill: "none" }, svg), gT = el("g", { fill: "none" }, svg);
  ORG.forEach((k, j) => {
    const w = weights(L, k, idx) || [], on = k === focus, col = on ? "#FFB000" : BOOKS[k].color;
    w.forEach((v, i) => { if (v > 0.004) el("path", { class: "e", d: curve(AX, ay(i), OX, oy(j)), stroke: col, "stroke-width": (0.6 + v * (on ? 14 : 8)).toFixed(2), opacity: on ? 0.9 : 0.18 }, gE); });
    const inv = w.reduce((a, b) => a + b, 0);
    el("path", { d: curve(OX, oy(j), TX, TY), stroke: on ? "#FFB000" : "#3A3A30", "stroke-width": (0.8 + inv * 2.2).toFixed(2), opacity: on ? 1 : 0.6 }, gT);
  });
  L.syms.forEach((s, i) => {
    const held = ORG.some((k) => k === focus && (weights(L, k, idx) || [])[i] > 0.004);
    el("circle", { cx: AX, cy: ay(i), r: 3, fill: held ? "#FFB000" : "#8C8C84" }, svg);
    const t = el("text", { x: AX - 8, y: ay(i) + 3.5, "text-anchor": "end", "font-size": 9, fill: held ? "#FFB000" : "#8C8C84", "font-family": "JetBrains Mono" }, svg); t.textContent = s;
  });
  ORG.forEach((k, j) => {
    const on = k === focus, w = weights(L, k, idx) || [], inv = w.reduce((a, b) => a + b, 0);
    const g = el("g", { style: "cursor:pointer" }, svg);
    el("circle", { cx: OX, cy: oy(j), r: on ? 8 : 7, fill: on ? "#FFB000" : "#070707", stroke: on ? "#FFB000" : BOOKS[k].color, "stroke-width": 1.6 }, g);
    const t = el("text", { x: OX + 13, y: oy(j) - 6, "font-size": 9, fill: on ? "#FFB000" : "#B4B4AC", "font-family": "JetBrains Mono" }, g);
    t.textContent = `${BOOKS[k].name.toUpperCase()} · ${(inv * 100).toFixed(0)}% in`;
    g.onclick = () => setFocus(k);
  });
  el("circle", { cx: TX, cy: TY, r: 12, fill: "#070707", stroke: "#FFB000", "stroke-width": 2 }, svg);
  el("circle", { cx: TX, cy: TY, r: 4, fill: "#FFB000" }, svg);
  const tt = el("text", { x: TX, y: TY + 28, "text-anchor": "middle", "font-size": 9, fill: "#FFB000", "font-family": "JetBrains Mono" }, svg); tt.textContent = "TRADE";
  spec();
}

// ---------- the 3D specimen: worm = connectome ring, others = their state per asset at this hour ----------
function spec() {
  const b = BOOKS[focus], fr = L.organisms[focus]?.frames[idx], w = fr?.w || [];
  $("spName").textContent = `> SPECIMEN · ${b.name.toUpperCase()}`;
  $("spSub").textContent = focus === "worm" ? `${CON ? CON.n.length : 302} neurons · ${CON ? CON.l.length.toLocaleString("en-US") : ""} synapses · drag to turn`
    : `${INNER[focus] || "state"} per asset · ${day(L.t[idx])} · amber = held`;
  RING?.show(focus, { syms: L.syms, w, inner: fr?.inner, label: (i) => (w[i] > 0.01 ? `${L.syms[i]} ${(w[i] * 100).toFixed(0)}%` : L.syms[i]) });
}

// ---------- equity curves ----------
function equity() {
  const svg = $("eq"); svg.innerHTML = "";
  const ks = Object.keys(L.eq), all = ks.flatMap((k) => L.eq[k]), lo = Math.min(...all), hi = Math.max(...all), N = L.t.length;
  const X = (i) => (i / (N - 1)) * 1000, Y = (v) => 182 - ((v - lo) / (hi - lo || 1)) * 174;
  L.fold.forEach((f, i) => { if (i && f !== L.fold[i - 1]) { el("line", { x1: X(i), x2: X(i), y1: 0, y2: 190, stroke: "#262622" }, svg); } });
  el("line", { x1: 0, x2: 1000, y1: Y(1), y2: Y(1), stroke: "#33332D", "stroke-dasharray": "2 4" }, svg);
  ks.sort((a, b) => (a === focus) - (b === focus)).forEach((k) => {
    const pts = L.eq[k].map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    el("polyline", { points: pts, fill: "none", stroke: k === focus ? "#FFB000" : k === "hold" ? "#8C8C84" : BOOKS[k].color, "stroke-width": k === focus ? 2.2 : 1, opacity: k === focus || k === "hold" ? 1 : 0.35, "stroke-dasharray": k === "hold" ? "5 4" : "", "vector-effect": "non-scaling-stroke" }, svg);
  });
  el("line", { id: "cur", x1: X(idx), x2: X(idx), y1: 0, y2: 190, stroke: "#D8D8D2", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, svg);
}

// ---------- scrubber ----------
function stamp() {
  const k = focus, eq = L.eq[k] ? L.eq[k][idx] - 1 : 0, h = L.eq.hold[idx] - 1;
  $("dt").innerHTML = `${day(L.t[idx])} · F${L.fold[idx]} · <span class="${cls(eq)}">${pct(eq)}</span>`;
  const c = document.getElementById("cur"); if (c) { const x = (idx / (L.t.length - 1)) * 1000; c.setAttribute("x1", x); c.setAttribute("x2", x); }
  $("dt").title = `hold ${pct(h)}`;
}
$("bar").oninput = (e) => { idx = +e.target.value; net(); stamp(); };
$("play").onclick = () => {
  playing = !playing; $("play").textContent = playing ? "❚❚" : "▶"; $("play").setAttribute("aria-label", playing ? "Pause" : "Play");
  clearInterval(timer);
  if (playing) { if (idx >= L.t.length - 1) idx = 0; timer = setInterval(() => { idx = (idx + 1) % L.t.length; $("bar").value = idx; net(); stamp(); }, 60); }
};

// ---------- what `myxo league` prints for this experiment (same layout as the CLI) ----------
function tout() {
  const rows = [["hold", L.bench.hold], ["random", L.bench.random], ...Object.entries(L.organisms).map(([k, o]) => [k, o.stitched, o])].sort((a, b) => b[1].ret - a[1].ret);
  const max = Math.max(...rows.map((r) => Math.abs(r[1].ret)), 0.01), P = (s, n, r) => (r ? String(s).padStart(n) : String(s).padEnd(n));
  const line = ([k, m, o], i) => { const n = Math.max(1, Math.round((Math.abs(m.ret) / max) * 14)), c = cls(m.ret);
    const st = o ? `<span class="${o.verdict === "FAILED" ? "dn" : "up"}">${o.verdict === "FAILED" ? "FAIL" : o.verdict} ${passed(k)}/4</span>` : `<span class="d">BENCH</span>`;
    return `<span class="d">${String(i + 1).padStart(2, "0")}</span>  ${P(BOOKS[k].name.toUpperCase(), 10)}<span class="${c}">${P(pct(m.ret), 7, true)}  ${P((m.ret >= 0 ? "▶" : "◀") + "█".repeat(n), 16)}</span>${P(m.sharpe.toFixed(2), 6, true)}  ${st}`; };
  $("tout").innerHTML = `<span class="p">MYXOBRAIN//TERM</span> <span class="d">·</span> ${esc(L.id)} · ${esc(L.title)}\n<span class="d">${"─".repeat(52)}</span>\n<span class="d">#   BOOK         RETURN  BAR              SHARPE  STATUS</span>\n` + rows.map(line).join("\n");
}
$("copy").onclick = async () => {
  const b = $("copy"), txt = $("npx").textContent;
  try { await navigator.clipboard.writeText(txt); b.textContent = "COPIED"; }
  catch { const r = document.createRange(); r.selectNodeContents($("npx")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = "SELECTED"; }
  setTimeout(() => (b.textContent = "COPY"), 1600);
};

// ---------- rules.conf ----------
function conf() {
  const r = L.rules, v = (x) => `<span class="v">${x}</span>`, c = (x) => `<span class="cm"># ${x}</span>`;
  $("conf").innerHTML = `${c("walk-forward: every organism is born fresh at the start of each fold")}
folds        = ${v(r.folds)}
settings     = ${v(r.budget)}      ${c("chosen on training Sharpe, past data only")}
seeds        = ${v(r.seeds)}       ${c("test returns averaged")}
cost         = ${v(r.cost)}   ${c("per unit traded")}
control      = ${v("blind_twin")}   ${c("same organism, no food")}
holdout      = ${v("sealed_last_3_months")}   ${c("opened only after a full pass")}

${c("gates, ALL required")}
gate.return  = beats equal_weight_hold
gate.sharpe  = beats equal_weight_hold
gate.dd      = no_worse_than hold
gate.folds   = wins >= 3 of 4`;
}

// ---------- specimens: what each organism is, the paper behind it, how it reads the market ----------
const REFS = await SOURCES;
const SPEC = {
  physarum: ["A single cell with no neurons that solves mazes and redrew Tokyo's rail network.", "food at each asset drains the plate; tubes that carry flow thicken, idle ones fade"],
  worm: ["The first animal whose whole nervous system was mapped: 302 neurons, every synapse.", "food per asset drives the smell neurons AWC and ASE; the real wiring turns or runs"],
  fry: ["A transparent larva whose whole brain can be imaged at once.", "food drives 11 spiking cells, one per asset; a cell that fires hard enough buys"],
  ant: ["A colony that finds the shorter bridge to food with pheromone alone.", "profitable trails get pheromone, idle trails evaporate; trail share is the portfolio"],
  bee: ["A swarm that picks a new home by dancing and quorum, with no leader.", "scouts dance for assets in proportion to food; at a quorum the swarm moves"],
  ecoli: ["A bacterium that finds food by run and tumble, comparing now with a moment ago.", "cells stay on an asset while food improves and tumble to a new one when it drops"],
};
const paperLink = (e) => `<a class="t" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>`;
$("specs").innerHTML = ORG.map((k, i) => {
  const b = BOOKS[k], R = REFS.filter((e) => e.org === k), model = R.find((e) => e.role === "model"), bg = R.find((e) => e.role !== "model");
  return `<div class="spec"><div class="stop"><span class="d">${String(i + 1).padStart(2, "0")}</span><b><i class="dot" style="background:${b.color}"></i>${esc(b.name.toUpperCase())}</b><i>${esc(b.latin)}</i></div>
    <div class="fact">${esc(SPEC[k]?.[0] || b.rule || "")}</div>
    <div class="kv2"><span>brain</span><span>${esc(b.brain || "")}</span><span>model</span><span>${model ? esc(model.cite) : "–"}</span>${bg ? `<span>evidence</span><span>${esc(bg.cite)}</span>` : ""}<span>market</span><span>${esc(SPEC[k]?.[1] || "")}</span><span>papers</span><span>${R.length} on Crossref</span></div>
    <a class="open" href="organism?k=${k}">[ open ${esc(b.name.toLowerCase())} · recompute ]</a></div>`;
}).join("");

// ---------- papers: every source, grouped by organism ----------
$("paperList").innerHTML = ORG.map((k) => {
  const R = REFS.filter((e) => e.org === k).sort((a, z) => (a.role === "model" ? 0 : 1) - (z.role === "model" ? 0 : 1) || a.year - z.year);
  return `<div class="pg"><b><i class="dot" style="background:${BOOKS[k].color}"></i>${esc(BOOKS[k].name.toUpperCase())} <span class="d" style="font-weight:400">· ${R.length}</span></b>${R.map((e) =>
    `<div class="pp">${paperLink(e)}<span class="r ${e.role === "model" ? "model" : ""}">${e.role === "model" ? "model" : "background"}</span>
     <div class="m">${esc(e.cite)}${e.venue ? " · " + esc(e.venue) : ""}${e.doi ? ` · <a href="https://doi.org/${esc(e.doi)}" target="_blank" rel="noopener">doi</a>` : ""}</div>
     <div class="u">${esc(e.use)}</div></div>`).join("")}</div>`;
}).join("");

// ---------- ledger cards ----------
const S = await fetch("data/league-summary.json").then((r) => r.json());
$("cards").innerHTML = S.map((e) => {
  const best = Object.entries(e.orgs).sort((a, b) => b[1].ret - a[1].ret)[0], pass = Object.values(e.orgs).some((o) => o.gates === 4);
  return `<button class="card" data-e="${e.id}"><div class="t"><b style="color:var(--hi)">${e.id}</b>${pass ? `<span class="up">PASS</span>` : `<span class="dn">FAIL</span>`}</div>
  <div class="p">${esc(e.title.toLowerCase())}</div>
  <div class="ft"><span>hold ${pct(e.hold.ret)}</span><span>best ${esc(BOOKS[best[0]].name.toUpperCase())} <span class="${cls(best[1].ret)}">${pct(best[1].ret)}</span></span></div></button>`;
}).join("");
$("cards").onclick = (e) => { const c = e.target.closest(".card"); if (c) { load(c.dataset.e); scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } };
const runs = S.reduce((a, e) => a + Object.keys(e.orgs).length, 0), full = S.reduce((a, e) => a + Object.values(e.orgs).filter((o) => o.gates === 4).length, 0);
$("ledgerNote").textContent = `${S.length} experiments · ${runs} organism runs · ${full} passed all gates · sealed holdout: ${full ? "opened" : "still sealed"}`;
$("labstats").innerHTML = [["0", "language models", 1], [String(ORG.length), "organisms"], ["302", "neurons in the worm"], [String(REFS.length), "papers on Crossref"], [String(runs), "organism runs"], [String(full), "passed all gates", 1]]
  .map(([v, l, z]) => `<div class="${z ? "z" : ""}"><b>${v}</b><span>${l}</span></div>`).join("");

// ---------- live + sources + repo ----------
const site = await fetch("site.json").then((r) => (r.ok ? r.json() : {}), () => ({}));
const lv = await fetch("live/live.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null), () => null);
const kv = (k, v) => `<span class="d">${k}</span><span>${v}</span>`;
$("liveBox").innerHTML = !lv || lv.waiting
  ? kv("state", "waiting for the first closed market bars") + (lv ? kv("registered", lv.registeredAt.slice(0, 16).replace("T", " ") + "Z") : "") + kv("cadence", "hourly, forward only") + kv("money", "paper")
  : kv("registered", lv.registeredAt.slice(0, 16).replace("T", " ") + "Z") + kv("market hours", lv.bars) + kv("hold", `<span class="${cls(lv.hold.ret)}">${pct(lv.hold.ret)}</span>`) +
    [...lv.books].sort((a, b) => b.ret - a.ret).slice(0, 3).map((b) => kv(`${BOOKS[b.org].name} · ${b.exp}`, `<span class="${cls(b.ret)}">${pct(b.ret)}</span>`)).join("") +
    kv("updated", lv.updatedAt.slice(0, 16).replace("T", " ") + "Z");
const SRC = [["prices", "Yahoo Finance, hourly"], ["swaps", "Robinhood Chain public RPC"], ["news tone", "The GDELT Project"], ["connectome", "Cook et al. 2019 via OpenWorm"], ["papers", `${REFS.length} checked on Crossref`]];
$("srcBox").innerHTML = SRC.map(([a, b]) => `<div>${a.padEnd(14, ".")} ${b}</div>`).join("") +
  (site.anchor?.confirmed ? `<div>ledger${".".repeat(8)} timestamped in <a class="p" href="https://mempool.space/block/${site.anchor.block}" target="_blank" rel="noopener">Bitcoin block ${site.anchor.block}</a></div>` : "");
if (site.repo) { $("repo").href = site.repo; $("repo").target = "_blank"; document.querySelectorAll(".ghLink").forEach((a) => (a.href = site.repo)); }

await load(want && EX.find((e) => e.id === want) ? want : "EXP-004");
