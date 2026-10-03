// The Balance (ART.md section 1): the household's balance sheet drawn to scale as an accountant's
// T-account. Pure: runs in Node, and tools/test_balance.mjs checks it against its own decode of the
// snapshot. app.js draws what layout() returns and nothing else.

import { fixed, niceStep } from './units.js';

/** The words a run of shallow blocks is labeled with, singular and plural. */
const KIND = {
  account: ['account', 'accounts'], fund: ['fund', 'funds'], shares: ['share plan', 'share plans'],
  pension: ['pension', 'pensions'], vehicle: ['vehicle', 'vehicles'], other: ['other item', 'other items'],
  property: ['property', 'properties'], card: ['card', 'cards'], overdraft: ['overdrawn account', 'overdrawn accounts'],
  loan: ['loan', 'loans'], rest: ['other', 'other'],
};
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const desc = (a, b) => b.value - a.value;

/**
 * The items of each side, most liquid first. Own: accounts in credit (largest first), funds, counted
 * shares, pension when it is counted, vehicles, other things, property. Owe: accounts in debit, then
 * loans, smallest first. A side whose items fall short of what `netWorth` totals by more than 1 gains
 * one block, so the T balances on the snapshot's own total.
 */
export function balanceItems(s) {
  const own = [], owe = [], nw = s.netWorth || {};
  const add = (side, kind, name, value, ref) => { if (value > 0) side.push({ kind, name, value, ref }); };
  const accounts = Array.isArray(s.accounts) ? s.accounts : [];
  for (const a of accounts.filter((x) => x.balance > 0).sort((x, y) => y.balance - x.balance)) add(own, 'account', a.name || 'Account', a.balance, a);
  const funds = (s.investments && Array.isArray(s.investments.funds) ? s.investments.funds : []).map((f) => ({ f, value: num(f.value) }));
  for (const { f, value } of funds.sort(desc)) add(own, 'fund', f.name || 'Fund', value, f);
  if (s.equity && !s.equity.error) add(own, 'shares', s.equity.provider || 'Employee shares', num(s.equity.counted), s.equity);
  if (s.pension && s.pension.includeInNetWorth !== false) add(own, 'pension', s.pension.provider || 'Pension', num(s.pension.counted), s.pension);
  const assets = (Array.isArray(s.assets) ? s.assets : []).map((a) => ({ a, value: num(a.value) }));
  const kindOf = (a) => (a.kind === 'vehicle' || a.kind === 'property' ? a.kind : 'other');
  for (const kind of ['vehicle', 'other', 'property']) {
    for (const { a, value } of assets.filter((x) => kindOf(x.a) === kind).sort(desc)) add(own, kind, a.name || 'Asset', value, a);
  }
  const debit = accounts.filter((x) => x.balance < 0).map((a) => ({ a, value: -a.balance })).sort((x, y) => x.value - y.value);
  for (const { a, value } of debit) add(owe, a.type === 'credit' ? 'card' : 'overdraft', a.name || 'Account', value, a);
  const loans = (Array.isArray(s.loans) ? s.loans : []).map((l) => ({ l, value: -num(l.balance) })).sort((x, y) => x.value - y.value);
  for (const { l, value } of loans) add(owe, 'loan', l.name || 'Loan', value, l);

  const sum = (side) => side.reduce((t, i) => t + i.value, 0);
  const wantOwn = num(nw.cash) + num(nw.investments) + num(nw.pension) + num(nw.assets), wantOwe = -num(nw.liabilities);
  if (wantOwn - sum(own) > 1) add(own, 'rest', 'Other, as the snapshot totals it', wantOwn - sum(own));
  if (wantOwe - sum(owe) > 1) add(owe, 'rest', 'Other, as the snapshot totals it', wantOwe - sum(owe));
  const owned = sum(own), owed = sum(owe);
  return { own, owe, owned, owed, net: owned - owed, total: num(nw.total) };
}

/** The scale in money per CSS pixel: the first 1, 2, 2.5 or 5 times a power of ten (10 000, 20 000,
 *  25 000, 50 000 … for kroner) that keeps the deeper side within `px` pixels. */
export function rung(max, px = 160) {
  for (let k = 0; k < 15; k++) for (const m of [1, 2, 2.5, 5]) if (max / (m * 10 ** k) <= px) return m * 10 ** k;
  return 1e15;
}

/** A label for a run of blocks: one name, two names, or their kinds counted. */
export function runLabel(run) {
  if (run.length === 1) return run[0].name;
  if (run.length === 2) return `${run[0].name}, ${run[1].name}`;
  const n = new Map();
  for (const i of run) n.set(i.kind, (n.get(i.kind) || 0) + 1);
  return [...n].map(([k, c]) => `${fixed(c, 0)} ${KIND[k][c === 1 ? 0 : 1]}`).join(', ');
}

/**
 * The drawing at width W, its net worth figure figW wide: every coordinate app.js uses. Blocks hang
 * from the crossbar at `top`, their positions cumulative and rounded so a side is exactly as deep as its
 * total; a block's top row is the page (a 1 px gap) unless it is under 2 px deep, when it is one 1 px ink
 * row. A run of blocks under 12 px shares a label; a label within 12 px of the one before is left out.
 * The figure goes beside the hollow when the room there and the labels' room at the left allow it,
 * else under the double rule.
 */
export function layout(B, W, figW = 110) {
  const scale = rung(Math.max(B.owned, B.owed));
  const step = niceStep(16 * scale);          // a ruler step at least 16 px apart
  const div = step >= 1e6 ? 1e6 : step >= 1e3 ? 1e3 : 1;
  const dec = [0, 1, 2].find((d) => Math.abs(Math.round((step / div) * 10 ** d) - (step / div) * 10 ** d) < 1e-6) ?? 2;
  const deepest = Math.max(B.owned, B.owed), ticks = [];
  for (let v = 0; v <= deepest + 1e-6; v += step) ticks.push({ v, label: fixed(v / div, dec) });
  const rw = Math.max(...ticks.map((t) => t.label.length)) * 5.6 + 10;   // the ruler's width: labels, gap, tick
  const COL = W < 340 ? 44 : 56, GAP = 6, FIG = Math.ceil(figW) + 18, top = 22;
  const depthOwn = Math.round(B.owned / scale), depthOwe = Math.round(B.owed / scale);
  const foot = top + Math.max(depthOwn, depthOwe);
  const hollowSide = B.owned >= B.owed ? 'owe' : 'own';
  // the hollow ends at the foot, not at the double rule 2 px below it: its depth is the net worth to scale
  const hollow = { side: hollowSide, y0: top + Math.min(depthOwn, depthOwe), y1: foot };
  const spare = W - rw - 2 * COL - 2 * GAP - 1;
  const beside = hollowSide === 'owe' && spare - FIG >= 70 && hollow.y1 - hollow.y0 >= 40;
  const leftW = beside ? spare - FIG - 12 : Math.floor(spare / 2) - 12;
  const lx0 = Math.round(rw + 6 + leftW + 6), lx1 = lx0 + COL, stem = lx1 + GAP, rx0 = stem + 1 + GAP, rx1 = rx0 + COL;

  const side = (items, x0, x1, which) => {
    let cum = 0;
    const blocks = items.map((it) => {
      const y0 = top + Math.round(cum / scale);
      cum += it.value;
      const y1 = top + Math.round(cum / scale), d = y1 - y0;
      return { ...it, y0, y1, rect: d >= 2 ? [x0, y0 + 1, COL, d - 1] : [x0, y0, COL, 1] };
    });
    const groups = [];
    for (const b of blocks) {
      const last = groups[groups.length - 1];
      if (b.y1 - b.y0 < 12 && last && last.run && last.items[last.items.length - 1].y1 - last.items[last.items.length - 1].y0 < 12) last.items.push(b);
      else groups.push({ run: b.y1 - b.y0 < 12, items: [b] });
    }
    let prev = -Infinity;
    for (const g of groups) {
      g.y0 = g.items[0].y0; g.y1 = g.items[g.items.length - 1].y1; g.mid = (g.y0 + g.y1) / 2;
      g.value = g.items.reduce((t, i) => t + i.value, 0);
      g.label = runLabel(g.items);
      g.shown = g.mid - prev >= 12;
      if (g.shown) prev = g.mid;
    }
    const lab = which === 'own' ? { x: lx0 - 6, anchor: 'end', width: lx0 - 6 - (rw + 6) } : { x: rx1 + 6, anchor: 'start', width: W - rx1 - 6 };
    return { blocks, groups, depth: which === 'own' ? depthOwn : depthOwe, x0, x1, lab };
  };
  const own = side(B.own, lx0, lx1, 'own'), owe = side(B.owe, rx0, rx1, 'owe');
  const words = beside
    ? { x: rx1 + 16, y: (hollow.y0 + hollow.y1) / 2, beside: true }
    : { x: W, y: foot + 26, beside: false };
  return {
    W, scale, top, foot, stem, COL, rw, own, owe, hollow, words,
    bar: [lx0, top - 2, rx1 - lx0, 2],
    rules: [foot + 2, foot + 5],
    ruler: { x: rw, unit: `${div === 1e6 ? 'million ' : div === 1e3 ? 'thousand ' : ''}`, ticks: ticks.map((t) => ({ ...t, y: top + Math.round(t.v / scale) })) },
    height: words.beside ? foot + 10 : foot + 36,
  };
}

/** What a tap at (x, y) in the drawing reads: a group of blocks, or the hollow. */
export function hitAt(L, x, y) {
  const s = x < L.stem + 0.5 ? L.own : L.owe, which = s === L.own ? 'own' : 'owe';
  if (L.hollow.side === which && y >= L.hollow.y0 && L.hollow.y1 > L.hollow.y0) return { hollow: true };
  if (y > L.foot) return { hollow: true };   // the double rule and the words under it
  let best = null;
  for (const g of s.groups) { const d = y < g.y0 ? g.y0 - y : y > g.y1 ? y - g.y1 : 0; if (!best || d < best.d) best = { d, g }; }
  return best ? { side: which, group: best.g } : { hollow: true };
}

/** The sentence VoiceOver reads for the drawing: built from the data, never from the picture. */
export function sayBalance(B, when, unitWord) {
  const most = (side) => side.reduce((m, i) => (!m || i.value > m.value ? i : m), null);
  const part = (side, total) => {
    const m = most(side);
    return `${fixed(total, 0).replace(/ /g, '')} ${unitWord}${m && side.length > 1 ? `, the ${m.name.toLowerCase()} ${fixed(m.value, 0).replace(/ /g, '')} of it` : ''}`;
  };
  const net = fixed(B.total, 0).replace(/ /g, '').replace('−', 'minus ');
  return `Balance on ${when}: owned ${part(B.own, B.owned)}; owed ${part(B.owe, B.owed)}; net worth ${net} ${unitWord}.`;
}
