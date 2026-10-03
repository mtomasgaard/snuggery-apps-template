// The Block (ART.md section 1): the training block as a coach draws it, one column a week from
// eleven weeks back to race day. Ink is each run's running kilometers, an outline the plan's target
// for the week, tinted where it is still to run. Pure, so tools/test_block.mjs can check it against
// its own decode of the snapshot.

import { f1, f0, dateWords, date } from './units.js';

const DAY = 86400000;
const parse = (s) => Date.parse(`${s}T00:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
export const mondayOf = (s) => { const t = parse(s); return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY); };
const plus = (s, days) => iso(parse(s) + days * DAY);
const runKm = (a) => (a.runKm != null ? a.runKm : a.km);
/** Pixels per kilometer, fixed and printed: Now and Plan. */
export const SCALE = { now: 0.8, plan: 1.2 };

/** The columns: eleven weeks back, this week, then every planned week (at most 26). Without a plan
 *  that reaches this week, fifteen weeks back and this one, ink only. */
export function blockWeeks(acts, plan, today) {
  const now = mondayOf(today);
  const horizon = ((plan && plan.horizon) || []).filter((h) => h && typeof h.w === 'string' && mondayOf(h.w) === h.w);
  const planned = horizon.some((h) => h.w >= now);
  const weeks = [];
  for (let i = planned ? 11 : 15; i > 0; i--) weeks.push(plus(now, -7 * i));
  weeks.push(now);
  if (planned) weeks.push(...[...new Set(horizon.map((h) => h.w).filter((w) => w > now))].sort().slice(0, 26));
  const runs = new Map(weeks.map((w) => [w, []]));
  for (const a of acts) if (a.sport === 'run' && a.d <= plus(now, 6) && runs.has(mondayOf(a.d))) runs.get(mondayOf(a.d)).push(a);
  const race = plan && plan.goal && plan.goal.race && plan.goal.race.date ? plan.goal.race : null;
  const columns = weeks.map((week) => {
    const list = runs.get(week).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || ''))).map(runKm);
    const c = { week, runs: list, km: list.reduce((s, v) => s + v, 0), longest: Math.max(0, ...list), target: null, low: null, range: null, kind: null, note: null, mix: null };
    if (planned && week >= now) {
      const h = horizon.find((x) => x.w === week);
      const wk = ((plan && plan.weeks) || []).find((x) => x && x.start === week);
      const m = wk && String(wk.targetKm || '').match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
      if (m) { c.low = +m[1]; c.target = +m[2]; c.range = wk.targetKm; } else if (h && Number.isFinite(h.km)) c.target = h.km;
      if (h) { c.kind = h.kind || null; c.note = h.note || null; c.mix = Array.isArray(h.mix) ? h.mix : null; }
    }
    return c;
  });
  const now_ = weeks.indexOf(now);
  const raceIdx = race ? weeks.indexOf(mondayOf(race.date)) : -1;
  return {
    columns, now: now_, planned,
    race: raceIdx >= 0 ? { idx: raceIdx, name: race.name, date: race.date, day: ((new Date(parse(race.date)).getUTCDay() + 6) % 7 + 0.5) / 7 } : null,
  };
}

/** The drawing in CSS px, `width` wide at `scale` px per km: a 14 px label row, the plot, 3 px, a
 *  14 px label row; the columns share all but a 30 px gutter at the right, which holds the grid's
 *  values. Block edges are whole pixels, so the 1 px gap between runs is the page. */
export const GUTTER = 30;
export function blockLayout(B, width, scale) {
  const n = B.columns.length, slot = (width - GUTTER) / n;
  const tallest = Math.max(0, ...B.columns.map((c) => Math.max(c.km, c.target || 0)));
  const topKm = Math.max(80, Math.ceil(tallest / 20) * 20);
  const top = 14, base = top + topKm * scale;
  const xs = B.columns.map((_, i) => Math.round(i * slot));
  const colW = (i) => Math.round((i + 1) * slot) - xs[i] - 4;
  const points = [], outlines = [], ticks = [], tints = [];
  B.columns.forEach((c, i) => {
    let edge = base, cum = 0;
    c.runs.forEach((v, k) => {
      cum += v;
      const e = base - Math.round(cum * scale);
      points.push([xs[i], e, colW(i), Math.max(1, edge - e - (k ? 1 : 0)), i]);
      edge = e;
    });
    if (c.target != null) {
      const h = Math.round(c.target * scale);
      outlines.push([xs[i], base - h, colW(i), h, i]);
      // the week still to run: a tint from the outline's top down to the ink (the owner, 2026-10-03)
      if (edge > base - h) tints.push([xs[i], base - h, colW(i), edge - base + h, i]);
      if (c.low != null) ticks.push([xs[i], base - Math.round(c.low * scale), colW(i), i]);
    }
  });
  const grid = [];
  for (let v = 20; v < topKm; v += 20) grid.push([v, base - v * scale]);
  return {
    n, slot, xs, colW, topKm, top, base, height: base + 3 + 14, points, outlines, ticks, tints, grid,
    nowX: xs[B.now] + colW(B.now) / 2,
    raceX: B.race ? xs[B.race.idx] + B.race.day * colW(B.race.idx) : null,
  };
}

/** The drawing's label for VoiceOver, from the data. */
export function blockSay(B) {
  const done = B.columns.slice(0, B.now + 1), ahead = B.columns.slice(B.now + 1).filter((c) => c.target != null);
  const last = done.slice(-3).map((c, i, a) => (i === a.length - 1 ? `so far ${f1(c.km)}` : f1(c.km)));
  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a.join(''));
  const end = B.columns[B.columns.length - 1].week;
  let s = `Weekly running, ${dateWords(B.columns[0].week).replace(/ \d{4}$/, '')} to the week of ${dateWords(end)}: ${done.length} weeks run, the latest ${list(last)} kilometers`;
  if (ahead.length) s += `; ${ahead.length} week${ahead.length === 1 ? '' : 's'} planned, ${list(ahead.map((c) => f0(c.target)))} kilometers`;
  if (B.race) s += `; ${B.race.name} on ${dateWords(B.race.date).replace(/ \d{4}$/, '')}`;
  return `${s}.`;
}

/** One column as the readout card's object: the place, the figure, label and value rows. */
export function blockCard(B, i) {
  const c = B.columns[i], future = i > B.now, rows = [];
  const card = { place: `Week of ${date(c.week)}${future ? ', planned' : ''}`, value: f1(c.km), unit: 'km', rows };
  if (future) { card.value = c.target != null ? f0(c.target) : '–'; if (c.range) rows.push(['Plan', c.range]); }
  else {
    if (i === B.now && c.target != null) rows.push(['So far', `${f1(c.km)} km of ${c.range || `${f0(c.target)} km`} planned`]);
    rows.push(['Runs', String(c.runs.length)]);
    if (c.runs.length) rows.push(['Longest', `${f1(c.longest)} km`]);
    if (i === B.now && c.target != null) rows.push(['Plan', c.range || `${f0(c.target)} km`]);
  }
  if (c.kind) rows.push(['Kind', c.kind]);
  if (c.mix) rows.push(['Mix', `easy ${f0(c.mix[0])} %, moderate ${f0(c.mix[1])} %, hard ${f0(c.mix[2])} %`]);
  if (c.note) rows.push(['Note', c.note]);
  card.say = future
    ? `Week of ${dateWords(c.week)}, planned. ${c.range || `${f0(c.target)} kilometers`}${c.kind ? `, ${c.kind}` : ''}.${c.note ? ` ${c.note}` : ''}`
    : `Week of ${dateWords(c.week)}. ${f1(c.km)} kilometers in ${c.runs.length} run${c.runs.length === 1 ? '' : 's'}${c.runs.length ? `, longest ${f1(c.longest)} kilometers` : ''}.${i === B.now && c.target != null ? ` ${c.range || `${f0(c.target)} kilometers`} planned.` : ''}`;
  return card;
}
