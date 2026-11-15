// ring.js: the home page's 3D specimen. 302 particles, one per neuron of C. elegans (Cook et al. 2019).
// For the worm they sit on the WORMBRAIN ring (around the ring = head to tail, around the tube = neuron kind) and fire along real synapses.
// For the other five organisms the same particles morph into that organism's state at the selected hour, read from the league file:
//   physarum: tubes from the core to each asset, thicker where conductivity is high
//   fry:      one cell per asset, bigger where the firing rate is high
//   ant:      trails from the nest to each asset, denser where pheromone is high
//   bee:      the swarm gathers where the scouts are; scouts sit at each site
//   ecoli:    rod-shaped cells crowding the assets they have swum to
// Assets the organism holds at that hour glow amber. Nothing here computes a trade; it only draws numbers the engine already published.
const TAU = Math.PI * 2;
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hash = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function createRing(canvas, CON, opts = {}) {   // opts: { labels: false, scale: 0.26 } for stills and banners
  const ctx = canvas.getContext("2d"), N = CON.n.length;
  // sphere sprite, as on WORMBRAIN
  const SPR = document.createElement("canvas"); SPR.width = SPR.height = 64;
  { const g = SPR.getContext("2d"), gr = g.createRadialGradient(24, 22, 1, 32, 32, 31);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(.22, "#e4e4e4"); gr.addColorStop(.62, "#8c8c8c"); gr.addColorStop(.92, "#3a3a3a"); gr.addColorStop(1, "#1c1c1c");
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); }

  // the worm's torus
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const KV = { sensory: 0, inter: 1.6, motor: 3.2, pharynx: 4.7 };
  const rank = new Map(CON.n.map((n, k) => [k, n[2]]).sort((a, b) => a[1] - b[1]).map(([k], i) => [k, i]));
  const byId = {}, ph = new Float32Array(N), sz = new Float32Array(N), TORUS = new Float32Array(N * 3);
  CON.n.forEach((n, k) => { const u = rank.get(k) / N * TAU, v = (KV[n[1]] ?? 2) + (rnd() - .5) * 1.3, tr = .4 * (.9 + rnd() * .2);
    byId[n[0]] = k; TORUS[k * 3] = (1 + tr * Math.cos(v)) * Math.cos(u); TORUS[k * 3 + 1] = (1 + tr * Math.cos(v)) * Math.sin(u); TORUS[k * 3 + 2] = tr * Math.sin(v) * .75;
    ph[k] = rnd() * TAU; sz[k] = .7 + rnd() * .5; });
  const links = CON.l, adj = Array.from({ length: N }, () => []); links.forEach(([a, b], i) => { adj[a].push([b, i]); adj[b].push([a, i]); });
  const TOOLS = ["AWAL", "AWCL", "ASHL", "ASEL", "AIYL", "AIZL", "AIBL", "RIAL", "AVAL", "AVBL", "SMBDL", "RIML"].filter((t) => t in byId).map((t) => [byId[t], t.replace(/(DL|L)$/, "")]);
  const CHAINS = [["AWCL", "AIYL", "AVBL"], ["ASEL", "AIYL", "RIAL"], ["AWAL", "AIZL", "AVAL"], ["ASHL", "AIBL", "AVAL"], ["AWCL", "AIBL", "RIML", "AVAL"]];
  const route = (a, b) => { const prev = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1), q = [a]; prev[a] = a;
    while (q.length) { const x = q.shift(); if (x === b) break; for (const [y, e] of adj[x]) if (prev[y] < 0) { prev[y] = x; via[y] = e; q.push(y); } }
    if (prev[b] < 0) return null; const out = []; let x = b; while (x !== a) { out.unshift([prev[x], x, via[x]]); x = prev[x]; } return out; };

  // state
  const cur = Float32Array.from(TORUS), tgt = Float32Array.from(TORUS), asset = new Int8Array(N).fill(-1);
  const P = new Float32Array(N * 4), order = new Uint16Array(N), glowE = new Float32Array(links.length), glowN = new Float32Array(N);
  let pulses = [], org = "worm", wormA = 1, syms = [], held = [], anchors = [], vals = [], labelOf = () => "";
  let dragX = 0, dragY = 0, vx = 0, vy = 0, drag = null;

  // asset anchors: 11 points around the ring's plane
  const anchor = (i, n) => { const a = -Math.PI / 2 + (i * TAU) / n; return [Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0]; };
  function shape(kind, mass) {
    const n = mass.length, A = mass.map((_, i) => anchor(i, n));
    const core = { physarum: 40, ant: 30, fry: 24, bee: 140, ecoli: 16 }[kind] ?? 30;
    // share the remaining particles by mass (largest remainder), every asset keeps at least 2
    const free = N - core - 2 * n, raw = mass.map((m) => m * free), cnt = raw.map((r) => 2 + Math.floor(r));
    let left = N - core - cnt.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) cnt[i]++; });
    const cen = [0, 0, 0];
    if (kind === "bee") mass.forEach((m, i) => { cen[0] += A[i][0] * m * .7; cen[1] += A[i][1] * m * .7; });
    let k = 0;
    const put = (x, y, z, i) => { tgt[k * 3] = x; tgt[k * 3 + 1] = y; tgt[k * 3 + 2] = z; asset[k] = i; k++; };
    const ball = (c, r, i, j) => { const t = Math.acos(1 - 2 * hash(j)), f = TAU * hash(j + 1), rr = r * Math.cbrt(hash(j + 2)); put(c[0] + rr * Math.sin(t) * Math.cos(f), c[1] + rr * Math.sin(t) * Math.sin(f), c[2] + rr * Math.cos(t), i); };
    for (let c = 0; c < core; c++) ball(cen, kind === "bee" ? .32 : kind === "physarum" ? .2 : .12, -1, k * 7);
    cnt.forEach((c, i) => {
      const a = A[i], m = mass[i], d = Math.hypot(a[0], a[1]), ux = a[0] / d, uy = a[1] / d;
      for (let j = 0; j < c; j++) {
        const h = k * 13 + j, u = hash(h), v = hash(h + 3) * TAU, s = hash(h + 5);
        if (kind === "physarum") { const t = Math.pow(u, .8), r = (.015 + .1 * Math.sqrt(m)) * Math.sqrt(s); put(a[0] * t - uy * r * Math.cos(v), a[1] * t + ux * r * Math.cos(v), r * Math.sin(v), i); }
        else if (kind === "ant") { const t = u, bx = -uy * .35, by = ux * .35, x = 2 * (1 - t) * t * (a[0] * .5 + bx) + t * t * a[0], y = 2 * (1 - t) * t * (a[1] * .5 + by) + t * t * a[1]; put(x + (s - .5) * .03, y + (hash(h + 7) - .5) * .03, (hash(h + 9) - .5) * .03, i); }
        else if (kind === "fry") ball([a[0] * .85, a[1] * .85, 0], .05 + .24 * Math.sqrt(m), i, h);
        else if (kind === "bee") ball([a[0], a[1], 0], .04 + .14 * Math.sqrt(m), i, h);
        else { const L = .06 + .32 * Math.sqrt(m), t = (u - .5) * L, r = .028 * Math.sqrt(s); put(a[0] * .9 + ux * t - uy * r * Math.cos(v), a[1] * .9 + uy * t + ux * r * Math.cos(v), r * Math.sin(v), i); }
      }
    });
    return A;
  }

  // public: show an organism's state at one hour
  function show(kind, st) {
    org = kind; syms = st.syms || []; held = (st.w || []).map((v) => v > 0.01); vals = st.inner || [];
    labelOf = st.label || (() => "");
    if (kind === "worm" || !st.inner) { tgt.set(TORUS); asset.fill(-1); anchors = []; return; }
    const pos = st.inner.map((v) => Math.max(0, +v || 0)), sum = pos.reduce((a, b) => a + b, 0);
    const mass = sum > 0 ? pos.map((v) => v / sum) : pos.map(() => 1 / pos.length);
    anchors = shape(kind, mass);
  }

  // input
  canvas.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; vx = (e.clientX - drag[0]) * .006; vy = (e.clientY - drag[1]) * .006; dragX += vx; dragY += vy; drag = [e.clientX, e.clientY]; });
  const end = () => (drag = null); canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  let ci = 0;
  setInterval(() => { if (org !== "worm" || document.hidden) return; const names = CHAINS[ci++ % CHAINS.length];
    for (let i = 0; i < names.length - 1; i++) { const r = route(byId[names[i]], byId[names[i + 1]]); if (r) pulses.push({ route: r, start: performance.now() + i * 900, speed: 9 }); }
    names.forEach((n) => (glowN[byId[n]] = 1.2)); }, RM ? 9000 : 4200);

  const t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!canvas.offsetParent) return;
    const W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const t = (now - t0) / 1000 * (RM ? .2 : 1), ease = RM ? 1 : .06;
    for (let i = 0; i < N * 3; i++) cur[i] += (tgt[i] - cur[i]) * ease;
    wormA += ((org === "worm" ? 1 : 0) - wormA) * (RM ? 1 : .05);
    if (!drag) { dragX += vx; dragY += vy; vx *= .94; vy *= .94; }
    const spin = t * (org === "worm" ? .42 : .12), ax = .18 + Math.sin(t * .55) * .1 + dragY, ay = Math.sin(t * .4) * .18 + dragX;
    const cz = Math.cos(spin), sz2 = Math.sin(spin), cx1 = Math.cos(ax), sx1 = Math.sin(ax), cy1 = Math.cos(ay), sy1 = Math.sin(ay);
    const S = Math.min(W, H) * (opts.scale ?? (W < 700 ? .24 : .26)), CX = W / 2, CY = H / 2, F = 4;
    const proj = (x, y, z) => { const x1 = x * cz - y * sz2, y1 = x * sz2 + y * cz, y2 = y1 * cx1 - z * sx1, z2 = y1 * sx1 + z * cx1, x3 = x1 * cy1 + z2 * sy1, z3 = -x1 * sy1 + z2 * cy1, p = F / (F - z3); return [CX + x3 * S * p, CY + y2 * S * p, z3, p]; };
    for (let k = 0; k < N; k++) { const j = .02;
      const q = proj(cur[k * 3] + Math.sin(t * 1.3 + ph[k]) * j, cur[k * 3 + 1] + Math.cos(t * 1.1 + ph[k] * 1.3) * j, cur[k * 3 + 2] + Math.sin(t * .9 + ph[k] * .7) * j);
      P[k * 4] = q[0]; P[k * 4 + 1] = q[1]; P[k * 4 + 2] = q[2]; P[k * 4 + 3] = q[3]; order[k] = k; }
    order.sort((a, b) => P[a * 4 + 2] - P[b * 4 + 2]);
    const heads = [];
    for (let i = pulses.length - 1; i >= 0; i--) { const p = pulses[i], el = (now - p.start) / 1000 * p.speed; if (el < 0) continue;
      const step = Math.floor(el); if (step >= p.route.length) { glowN[p.route[p.route.length - 1][1]] = 1; pulses.splice(i, 1); continue; }
      for (let k = 0; k <= step; k++) glowE[p.route[k][2]] = 1;
      const [a, b] = p.route[step], f = el - step; heads.push([P[a * 4] + (P[b * 4] - P[a * 4]) * f, P[a * 4 + 1] + (P[b * 4 + 1] - P[a * 4 + 1]) * f]); }
    for (let i = 0; i < glowE.length; i++) glowE[i] *= .965;
    for (let i = 0; i < N; i++) glowN[i] *= .975;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineCap = "round";
    // synapses: full on the worm ring, fading out as the particles leave it
    if (wormA > .02) for (let li = 0; li < links.length; li++) { const [a, b] = links[li];
      const z = (P[a * 4 + 2] + P[b * 4 + 2]) / 2, f = Math.max(0, Math.min(1, .55 + z * .45)), dd = Math.hypot(TORUS[a * 3] - TORUS[b * 3], TORUS[a * 3 + 1] - TORUS[b * 3 + 1], TORUS[a * 3 + 2] - TORUS[b * 3 + 2]), near = Math.max(.12, 1 - dd / 1.2);
      const g = 150 + 70 * f | 0; ctx.strokeStyle = `rgba(${g},${g},${g},${(.05 + .2 * f) * near * wormA})`; ctx.lineWidth = .4 + .4 * f;
      ctx.beginPath(); ctx.moveTo(P[a * 4], P[a * 4 + 1]); ctx.lineTo(P[b * 4], P[b * 4 + 1]); ctx.stroke();
      if (glowE[li] > .03) { ctx.strokeStyle = `rgba(255,176,0,${glowE[li] * wormA})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(P[a * 4], P[a * 4 + 1]); ctx.lineTo(P[b * 4], P[b * 4 + 1]); ctx.stroke(); } }
    // spheres, back to front
    const base = S * .028;
    for (let q = 0; q < N; q++) { const k = order[q], f = Math.max(0, Math.min(1, .5 + P[k * 4 + 2] * .5)), rr = base * sz[k] * P[k * 4 + 3];
      ctx.globalAlpha = .45 + .55 * f; ctx.drawImage(SPR, P[k * 4] - rr, P[k * 4 + 1] - rr, rr * 2, rr * 2); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "lighter";
    // held assets glow amber
    if (wormA < .98) for (let k = 0; k < N; k++) { const i = asset[k]; if (i < 0 || !held[i]) continue; const x = P[k * 4], y = P[k * 4 + 1], rr = base * 2.2 * P[k * 4 + 3];
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(255,190,60,${.55 * (1 - wormA)})`); g.addColorStop(1, "rgba(255,176,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
    for (const [x, y] of heads) { const g = ctx.createRadialGradient(x, y, 0, x, y, 16); g.addColorStop(0, `rgba(255,226,150,${.95 * wormA})`); g.addColorStop(1, "rgba(255,176,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill(); }
    for (let k = 0; k < N; k++) if (glowN[k] > .05 && wormA > .05) { const x = P[k * 4], y = P[k * 4 + 1], rr = base * 3 * glowN[k], g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(255,214,120,${.75 * glowN[k] * wormA})`); g.addColorStop(1, "rgba(255,176,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";
    // labels: neuron names on the worm, asset names and values on the others
    ctx.font = `${W < 520 ? 10 : 11}px "JetBrains Mono", monospace`; ctx.textBaseline = "middle";
    const pill = (x, y, name, lit, alpha) => { const dir = x < CX ? -1 : 1, lx = x + dir * 22, ly = y - 12;
      ctx.globalAlpha = alpha; ctx.strokeStyle = lit ? "#fff" : "#9a9a9a"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.lineTo(lx + dir * 8, ly); ctx.stroke();
      const w = ctx.measureText(name).width + 12, bx = dir < 0 ? lx - 8 - w : lx + 8;
      ctx.fillStyle = lit ? "rgba(255,176,0,.95)" : "rgba(14,14,14,.85)"; ctx.beginPath(); ctx.roundRect(bx, ly - 9, w, 18, 9); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.stroke(); ctx.fillStyle = lit ? "#000" : "#d8d8d8"; ctx.fillText(name, bx + 6, ly + .5); };
    if (opts.labels === false) { ctx.globalAlpha = 1; return; }
    if (wormA > .05) for (const [k, name] of TOOLS) { const f = Math.max(0, Math.min(1, .5 + P[k * 4 + 2] * .6)), lit = Math.min(1, glowN[k]); pill(P[k * 4], P[k * 4 + 1], name, lit > .2, (.25 + .6 * f + .4 * lit) * wormA); }
    if (wormA < .95) anchors.forEach((a, i) => { const q = proj(a[0] * 1.08, a[1] * 1.08, a[2]), f = Math.max(0, Math.min(1, .5 + q[2] * .6)); pill(q[0], q[1], labelOf(i), held[i], (.35 + .55 * f) * (1 - wormA)); });
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
  return { show };
}
