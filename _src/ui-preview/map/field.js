// field.js: "field notes", one stippled figure per organism. Every mark is drawn from published data:
// the worm from data/connectome-ring.json (Cook et al. 2019), the others from data/league-<EXP>.json organisms[k].frames[t].inner,
// the engine's own per-asset state at each hour. Nothing is generated or random except the dither grain.
import { day } from "./common.js";

const W = 1200, H = 620;
const fix = (v, d = 1) => (+v).toFixed(d);
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// draw shapes as alpha into an offscreen canvas, then dither: each pixel is black with probability = its darkness
function stipple(canvas, draw, seed) {
  canvas.width = W; canvas.height = H;
  const off = document.createElement("canvas"); off.width = W; off.height = H;
  const g = off.getContext("2d"); g.lineCap = g.lineJoin = "round"; g.fillStyle = g.strokeStyle = "#000";
  const mark = draw(g) || {};
  const src = g.getImageData(0, 0, W, H).data, ctx = canvas.getContext("2d"), out = ctx.createImageData(W, H), o = out.data, r = rng(seed);
  for (let i = 0; i < W * H; i++) {
    const d = Math.min(1, 0.035 + (src[i * 4 + 3] / 255) * 1.15), ink = r() < d;
    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = ink ? 18 : 241; o[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  if (mark.labels) { ctx.font = "500 15px 'JetBrains Mono', monospace"; ctx.fillStyle = "#3a3a36"; for (const [t, x, y, al] of mark.labels) { ctx.textAlign = al || "left"; ctx.fillText(t, x, y); } }
  return mark.dot ? [mark.dot[0] / W, mark.dot[1] / H] : null;
}

const series = (F, n) => F.map((f) => Array.from({ length: n }, (_, i) => Math.max(0, +(f.inner || [])[i] || 0)));
const smooth = (S, k) => S.map((_, t) => S[0].map((__, i) => { let s = 0, c = 0; for (let u = Math.max(0, t - k); u <= Math.min(S.length - 1, t + k); u++) { s += S[u][i]; c++; } return s / c; }));
const argmax = (a) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

// ---------- the six figures ----------
const FIG = {
  physarum(L, F) {
    const n = L.syms.length, S = series(F, n), T = S.length, mx = Math.max(...S.flat(), 1e-9);
    const core = [70, H / 2], node = (i) => [W - 120 - 70 * Math.sin((Math.PI * i) / (n - 1)), 40 + ((H - 80) * i) / (n - 1)];
    const share = L.syms.map((_, i) => mean(S.map((r) => r[i]))), top = argmax(share), tot = share.reduce((a, b) => a + b, 0);
    const idle = L.syms.filter((_, i) => S.filter((r) => r[i] < 0.01 * (r.reduce((a, b) => a + b, 0) || 1)).length > T / 2).length;
    return {
      draw: (g) => {
        S.forEach((row, t) => row.forEach((v, i) => {
          const q = v / mx; if (q < 0.004) return;
          const [x, y] = node(i), u = t / (T - 1) - 0.5;   // each strand is one hour, fanned by time
          g.globalAlpha = 0.05 + 0.1 * q; g.lineWidth = 0.6 + 11 * Math.sqrt(q);
          g.beginPath(); g.moveTo(...core);
          g.bezierCurveTo(W * 0.32, core[1] + (y - core[1]) * 0.12 + u * H * 0.5, W * 0.62, y - u * H * 0.22, x, y); g.stroke();
        }));
        g.globalAlpha = 1; g.beginPath(); g.arc(...core, 16, 0, 7); g.fill();
        return { dot: node(top), labels: L.syms.map((s, i) => [s, node(i)[0] + 16, node(i)[1] + 5]) };
      },
      right: `Over ${T} hours the thickest tube ran to ${L.syms[top]}, ${fix((share[top] / tot) * 100, 0)}% of all conductivity. ${idle ? `${idle} of ${n} tubes carried under 1% of the flow for more than half the hours.` : `Every tube kept some flow most of the time.`}`,
      src: "physarum.frames[].inner · tube conductivity core→asset",
    };
  },
  worm(L, F, C) {
    const N = C.n.length, order = C.n.map((v, i) => i).sort((a, b) => C.n[a][2] - C.n[b][2]), rank = new Array(N);
    order.forEach((k, r) => (rank[k] = r));
    const P = (k) => { const a = -Math.PI / 2 + (rank[k] * 2 * Math.PI) / N; return [W / 2 + Math.cos(a) * W * 0.43, H / 2 + Math.sin(a) * H * 0.43]; };
    const n = L.syms.length, S = F.map((f) => (f.inner || []).slice(0, n).map((v) => +v || 0)), wins = new Array(n).fill(0);
    S.forEach((r) => { if (r.some((v) => v !== 0)) wins[argmax(r)]++; });
    const top = argmax(wins), live = wins.reduce((a, b) => a + b, 0);
    const awc = C.n.findIndex((v) => v[0] === "AWCL");
    return {
      draw: (g) => {
        g.lineWidth = 1.1;
        for (const [a, b] of C.l) {
          const [x1, y1] = P(a), [x2, y2] = P(b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          g.globalAlpha = 0.16; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(W / 2 + (mx - W / 2) * 0.35, H / 2 + (my - H / 2) * 0.35, x2, y2); g.stroke();
        }
        g.globalAlpha = 0.9; for (let k = 0; k < N; k++) { const [x, y] = P(k); g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
        return { dot: awc >= 0 ? P(awc) : null, labels: [["HEAD", W / 2, 22, "center"], ["TAIL", W / 2, H - 8, "center"]] };
      },
      right: live
        ? `Its learned value was highest for ${L.syms[top]} in ${fix((wins[top] / live) * 100, 0)}% of the hours it held a view. The amber dot is AWCL, the smell neuron the market enters through.`
        : `In this experiment its learned values stayed at zero. The amber dot is AWCL, the smell neuron the market enters through.`,
      src: `connectome-ring.json · ${N} neurons, ${C.l.length} connections, ordered head to tail`,
    };
  },
  fry(L, F) {
    const n = L.syms.length, S = series(F, n), T = S.length, mx = Math.max(...S.flat(), 1e-9);
    const row = (i) => 92 + ((H - 130) * i) / (n - 1), X = (t) => 30 + ((W - 130) * t) / (T - 1), h = (H - 130) / (n - 1) / 2;
    let pk = [0, 0]; S.forEach((r, t) => r.forEach((v, i) => { if (v > S[pk[0]][pk[1]]) pk = [t, i]; }));
    return {
      draw: (g) => {
        g.globalAlpha = 0.92;
        for (let i = 0; i < n; i++) {
          g.beginPath(); g.moveTo(X(0), row(i));
          S.forEach((r, t) => g.lineTo(X(t), row(i) - h * 0.95 * (r[i] / mx)));
          for (let t = T - 1; t >= 0; t--) g.lineTo(X(t), row(i) + h * 0.95 * (S[t][i] / mx));
          g.closePath(); g.fill();
        }
        return { dot: [X(pk[0]), row(pk[1])], labels: L.syms.map((s, i) => [s, W - 88, row(i) + 5]) };
      },
      right: `Mean firing ${fix(mean(S.flat()))} Hz. The fastest cell was ${L.syms[pk[1]]} at ${fix(mx)} Hz on ${day(L.t[pk[0]])}. A cell that fires hard enough buys.`,
      src: "fry.frames[].inner · firing rate (Hz) per cell",
    };
  },
  ant(L, F) {
    const n = L.syms.length, S = series(F, n), T = S.length, mx = Math.max(...S.flat(), 1e-9);
    const V = smooth(S.map((r) => { const s = r.reduce((a, b) => a + b, 0) || 1; return r.map((v) => v / s); }), 6), vmx = Math.max(...V.flat(), 1e-9);
    const lead = new Array(n).fill(0); S.forEach((r) => lead[argmax(r)]++); const top = argmax(lead);
    const path = (i) => { const a = (2 * Math.PI * i) / n, c = [W / 2 + Math.cos(a) * W * 0.07, H / 2 + Math.sin(a) * H * 0.08];
      return S.map((r, t) => { const th = (2 * Math.PI * t) / T, rr = H * 0.1 + H * 0.3 * (V[t][i] / vmx); return [c[0] + rr * 1.6 * Math.cos(th), c[1] + rr * Math.sin(th)]; }); };
    let pk = [0, 0]; S.forEach((r, t) => r.forEach((v, i) => { if (v > S[pk[0]][pk[1]]) pk = [t, i]; }));
    return {
      draw: (g) => {
        for (let i = 0; i < n; i++) {
          const p = path(i); g.beginPath(); p.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
          g.globalAlpha = 0.07; g.fill(); g.globalAlpha = 0.75; g.lineWidth = 2.2; g.stroke();
        }
        return { dot: path(pk[1])[pk[0]] };
      },
      right: `${L.syms[top]} held the strongest trail in ${fix((lead[top] / T) * 100, 0)}% of hours. Pheromone ranged ${fix(Math.min(...S.flat()), 2)} to ${fix(mx, 2)}. Each loop is one asset, once around per ${T} hours.`,
      src: "ant.frames[].inner · pheromone share per trail, 13-hour average",
    };
  },
  bee(L, F) {
    const n = L.syms.length, S = series(F, n), T = S.length, mx = Math.max(...S.flat(), 1e-9);
    const danced = S.filter((r) => r.some((v) => v > 0)).length, tot = L.syms.map((_, i) => S.reduce((s, r) => s + r[i], 0)), top = argmax(tot);
    const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
    let pk = [0, 0]; S.forEach((r, t) => r.forEach((v, i) => { if (v > S[pk[0]][pk[1]]) pk = [t, i]; }));
    const tip = (i, c) => { const s = H * 0.1 + H * 0.36 * (c / mx); return [W / 2 + Math.cos(ang(i)) * s * 1.5, H / 2 + Math.sin(ang(i)) * s]; };
    return {
      draw: (g) => {
        g.lineWidth = 1.3;
        S.forEach((r) => r.forEach((c, i) => {
          if (c <= 0) return;
          const s = H * 0.1 + H * 0.36 * (c / mx), a = ang(i), ca = Math.cos(a), sa = Math.sin(a);
          g.globalAlpha = 0.1 + 0.35 * (c / mx); g.beginPath();
          for (let k = 0; k <= 64; k++) {   // figure-eight waggle dance, its axis pointing at the site
            const u = (k / 64) * 2 * Math.PI, d = 1 + Math.sin(u) ** 2, px = (s * Math.cos(u)) / d, py = (s * 0.55 * Math.sin(u) * Math.cos(u)) / d;
            const x = W / 2 + (px * ca - py * sa) * 1.5, y = H / 2 + (px * sa + py * ca); k ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }));
        return { dot: tip(pk[1], S[pk[0]][pk[1]]), labels: L.syms.map((s, i) => { const [x, y] = tip(i, mx * 1.08); return [s, Math.min(W - 70, Math.max(10, x)), Math.min(H - 10, Math.max(20, y)), "center"]; }) };
      },
      right: danced
        ? `Scouts danced in ${danced} of ${T} hours. Most dances went to ${L.syms[top]}. The largest crowd at one site was ${fix(mx, 0)} scouts. Each figure eight points at its site.`
        : `No scout danced in this experiment.`,
      src: "bee.frames[].inner · scouts dancing per site",
    };
  },
  ecoli(L, F) {
    const n = L.syms.length, S = series(F, n), T = S.length, sums = S.map((r) => r.reduce((a, b) => a + b, 0)), smax = Math.max(...sums, 1e-9);
    const R = smooth(S, 6), rs = R.map((r) => r.reduce((a, b) => a + b, 0)), X = (t) => 20 + ((W - 40) * t) / (T - 1), k = (H * 0.8) / Math.max(...rs, 1e-9);
    let pk = [0, 0]; S.forEach((r, t) => r.forEach((v, i) => { if (v > S[pk[0]][pk[1]]) pk = [t, i]; }));
    const spread = mean(S.map((r) => r.filter((v) => v > 0).length));
    const base = (t) => H / 2 + 20 - (rs[t] * k) / 2;   // silhouette streamgraph
    const yAt = (t, i) => base(t) + R[t].slice(0, i).reduce((a, b) => a + b, 0) * k;
    return {
      draw: (g) => {
        for (let i = 0; i < n; i++) {
          g.beginPath(); for (let t = 0; t < T; t++) g.lineTo(X(t), yAt(t, i)); for (let t = T - 1; t >= 0; t--) g.lineTo(X(t), yAt(t, i + 1)); g.closePath();
          g.globalAlpha = i % 2 ? 0.5 : 0.18; g.fill(); g.globalAlpha = 0.85; g.lineWidth = 1.4; g.stroke();
        }
        return { dot: [X(pk[0]), yAt(pk[0], pk[1]) + (R[pk[0]][pk[1]] * k) / 2] };
      },
      right: `On average the cells sat at ${fix(spread)} of ${n} sites. The biggest cluster was ${fix(S[pk[0]][pk[1]], 0)} cells on ${L.syms[pk[1]]}, ${day(L.t[pk[0]])}. Bands are sites, stacked hour by hour.`,
      src: "ecoli.frames[].inner · cells at each site, 13-hour average",
    };
  },
};

const NOTE = {
  physarum: ["FN-01", "Tubes That Follow<br>the Flow", "A single cell with no neurons finds the shortest path through a maze. Tubes that carry flow thicken. Idle tubes fade.", "Nakagaki 2000 · Tero 2007"],
  worm: ["FN-02", "302 Neurons,<br>Wired as Found", "The first animal whose whole nervous system was mapped. Every curve is a real connection, every dot a neuron.", "White 1986 · Cook 2019"],
  fry: ["FN-03", "Eleven Cells,<br>Firing", "Nearly every neuron of a larval zebrafish brain can be imaged at once. Here, one model neuron per asset learns by Hebb's rule.", "Ahrens 2013 · Hebb 1949"],
  ant: ["FN-04", "Trails That<br>Evaporate", "Real ants pick the shorter bridge through pheromone alone. Trails that pay get more. Trails that don't, evaporate.", "Goss 1989 · Dorigo 1997"],
  bee: ["FN-05", "Dances Toward<br>a Quorum", "Scouts dance longer for better sites. When enough scouts agree on one site, the swarm moves.", "Seeley 1999 · Passino 2006"],
  ecoli: ["FN-06", "Run, Tumble,<br>Repeat", "A bacterium keeps swimming while things get better and tumbles to a random heading when they don't.", "Berg & Brown 1972"],
};

export function fieldNotes(el, L, C) {
  if (!el || !L) return;
  const orgs = Object.keys(NOTE).filter((k) => L.organisms[k] && (k !== "worm" || C));
  el.innerHTML = orgs.map((k) => { const [id, title] = NOTE[k];
    return `<article class="fn" data-o="${k}"><div class="fig"><canvas aria-hidden="true"></canvas><span class="tag">${id}</span><i class="dot"></i></div>
      <h3>${title}</h3><div class="cols"><p class="bio"></p><p class="dat"></p></div><div class="src"></div></article>`; }).join("");
  orgs.forEach((k, j) => {
    const a = el.querySelector(`[data-o="${k}"]`), f = FIG[k](L, L.organisms[k].frames || [], C), [, , bio, cite] = NOTE[k];
    const d = stipple(a.querySelector("canvas"), f.draw, 7 + j);
    const dot = a.querySelector(".dot"); if (d) { dot.style.left = d[0] * 100 + "%"; dot.style.top = d[1] * 100 + "%"; } else dot.remove();
    a.querySelector(".bio").textContent = `${bio} ${cite}.`;
    a.querySelector(".dat").textContent = f.right;
    a.querySelector(".src").textContent = `data/${k === "worm" ? "" : `league-${L.id}.json · `}${f.src}`;
    a.querySelector("canvas").setAttribute("aria-label", `${k}: ${f.right}`);
  });
}
