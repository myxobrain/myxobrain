// token.js: the $MYXO contract and the burn ledger, read from /api/token (studio/server.mjs on the VPS).
// Hidden until the owner saves a CA in /studio, and on hosts without the studio server (the GitHub Pages mirror).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const big = (v) => { const n = Number(v || 0); return n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toFixed(0); };

export async function token() {
  let T; try { const r = await fetch("api/token", { cache: "no-store" }); if (!r.ok) return; T = await r.json(); } catch { return; }
  if (!T?.live || !T.ca) return;
  const sym = "$" + esc(T.symbol), short = T.ca.slice(0, 6) + "…" + T.ca.slice(-4);
  const chip = $("cachip");
  chip.innerHTML = `<span class="sym">${sym}</span><code title="${esc(T.ca)}">${short}</code><button type="button" id="caCopy">COPY CA</button><a class="buy" href="${esc(T.buy)}" target="_blank" rel="noopener">BUY</a>`;
  chip.hidden = false;
  $("caCopy").onclick = async () => { try { await navigator.clipboard.writeText(T.ca); $("caCopy").textContent = "COPIED"; setTimeout(() => ($("caCopy").textContent = "COPY CA"), 1400); } catch {} };

  const t = T.totals || {}, dead = Number(T.deadBalance || 0), supply = Number(T.supply || 0);
  $("burnLede").innerHTML = `Every burn below was sent from the studio wallet to the dead address. Each line links to its transaction on the Robinhood Chain explorer. Contract <a href="${esc(T.explorer)}/token/${esc(T.ca)}" target="_blank" rel="noopener">${esc(T.ca)}</a>.`;
  $("burnStats").innerHTML = [
    [big(dead), `${sym} in the dead address`],
    [supply ? (dead / supply * 100).toFixed(2) + "%" : "–", supply ? `of ${big(supply)} supply burned` : "of supply burned"],
    [String(t.buybacks || 0), "buybacks"],
    ["$" + Number(t.boughtUsd || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }), "spent on buybacks"],
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");
  const tx = (h) => (h ? `<a href="${esc(T.explorer)}/tx/${esc(h)}" target="_blank" rel="noopener">${esc(h.slice(0, 10))}…</a>` : "–");
  const kind = { buyback: "buyback", supply: "supply burn", held: "held burn" };
  $("burnLog").innerHTML = "<tr><th>when (UTC)</th><th>type</th><th>burned</th><th>dollars</th><th>buy</th><th>burn</th></tr>" +
    ((T.burns || []).map((b) => `<tr><td>${esc(b.t.slice(0, 16).replace("T", " "))}</td><td>${esc(kind[b.kind] || b.kind)}</td><td>${big(b.burned)} ${sym}</td><td>${b.usd != null ? "$" + esc(b.usd) : "–"}</td><td>${tx(b.buyTx)}</td><td>${tx(b.burnTx)}</td></tr>`).join("") ||
      `<tr><td colspan="6" style="color:var(--dim)">No burns yet. The first one will show here with its transaction.</td></tr>`);
  $("burns").hidden = false;
}
