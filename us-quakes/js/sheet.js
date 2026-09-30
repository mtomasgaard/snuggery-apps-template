// The sheet's words (DESIGN §3.4, §3.5, §8), built with textContent only: the Live stamp and largest row,
// the History label, the bodies and lists, the long-press list and the event, fault and volcano cards.
// A USGS field is explained only by about.json's quote, prefixed "USGS:"; without one the bare value
// is shown.

import { el, sizeCanvas, xBtn, radios, cssVar, nums } from './util.js';
import { storyList } from './stories.js';
import { drawDot, dotSize, rampBar, rampPos } from './ramp.js';
import { num, utc, msOf, hhmmUTC, hhmmLocal, age, dist, depthKm, magText, elev, tenKm } from './units.js';
import { magType, statusOf, textOf, liveOf, wx, wy } from './data.js';
import { T1900 } from './timeline.js';

const R = 6371.0088, rad = Math.PI / 180;
export const lonLat = (C, i) => [172 + 0.002 * C.x[i], 17 + 0.001 * C.y[i]];
function hav(lon1, lat1, lon2, lat2) {
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
function bearing(lon1, lat1, lon2, lat2) {
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return COMPASS[Math.round((((Math.atan2(y, x) / rad) + 360) % 360) / 22.5) % 16];
}
const cap = (s) => (s ? s[0] + s.slice(1).toLowerCase() : s);

export function placeOf(A, i) {
  const tx = textOf(A.C, i);
  if (tx && tx.place) return { text: tx.place, computed: false };
  const [lon, lat] = lonLat(A.C, i);
  let best = null, bd = Infinity;
  for (const p of A.G.places) { const d = hav(lon, lat, p.lon, p.lat); if (d < bd) { bd = d; best = p; } }
  const name = best.n.replace(/\s+/g, ' ');
  return { text: `Near ${name} (the map's place list), ${dist(bd)} ${bearing(best.lon, best.lat, lon, lat)}`, computed: true };
}

export function dotCanvas(A, i, capPx, box = 16) {
  const C = A.C, c = el('canvas'), m = C.m[i];
  const x = sizeCanvas(c, box, box, A.dpr);
  if (m === 255) {
    x.strokeStyle = cssVar('--ink'); x.lineWidth = 1.25;
    x.beginPath(); x.moveTo(box / 2 - 3, box / 2 - 3); x.lineTo(box / 2 + 3, box / 2 + 3); x.moveTo(box / 2 + 3, box / 2 - 3); x.lineTo(box / 2 - 3, box / 2 + 3); x.stroke();
  } else drawDot(x, box / 2, box / 2, Math.min(capPx, dotSize((m - 20) / 10)), depthKm(C.d[i]), A.hollow(i), A.dpr);
  return c;
}

export function rowEl(A, i, when) {
  const b = el('button', 'row');
  b.append(dotCanvas(A, i, 14), el('span', 'm', A.C.m[i] === 255 ? '×' : `M ${magText(A.C.m[i])}`), el('span', 'p', placeOf(A, i).text), el('span', 'w', when(i)));
  b.addEventListener('click', () => A.select(i, true));
  return b;
}
export function list(A, rows, when) {
  const ul = el('ul', 'list');
  for (const i of rows) { const li = el('li'); li.append(rowEl(A, i, when)); ul.append(li); }
  return ul;
}

// Live
export function stamp(A, p) {
  p.textContent = '';
  const S = A.C && A.C.S;
  if (!S) { p.append(A.snapErr ? 'The live data could not be read' : 'No live data in this copy'); return; }
  const ageMs = Date.now() - S.gen;
  p.append('USGS feed ', el('span', 'mono', `${hhmmUTC(S.gen)} UTC`));
  if (ageMs < 0) return;
  if (ageMs < 3 * 3600e3) p.append(` · ${age(ageMs)} ago`);
  else p.append(' · ', el('b', null, `${age(ageMs)} ago`), ', not refreshed since');
}
export function staleText(A) {
  const S = A.C && A.C.S;
  if (!S) return null;
  const ageMs = Date.now() - S.gen;
  if (ageMs < 48 * 3600e3) return null;
  return `This copy is ${age(ageMs)} old. It shows nothing newer than ${utc(minOfMs(S.gen))}.`;
}
const minOfMs = (ms) => Math.floor((ms - Date.UTC(1600, 0, 1)) / 60000);

export function largestRow(A, b, i, arr) {
  b.textContent = '';
  if (i < 0) { b.append(el('span', 'p', A.C && A.C.S ? 'No earthquakes in this window' : '')); b.disabled = true; return; }
  b.disabled = false;
  const r = el('span');
  if (arr) r.append(el('span', 'mono', num(arr.n)), ' new since ', el('span', 'mono', `${hhmmUTC(msOf(arr.since))} UTC`)); else r.append(el('span', 'mono', age(Date.now() - msOf(A.C.t[i]))), ' ago');
  b.append(el('span', 'mono', `M ${magText(A.C.m[i])}`), el('span', 'p', placeOf(A, i).text), r, '›');
  b.onclick = () => A.select(i, true);
}

function note(A, id, withQuote = true) {
  const n = A.about && A.about.notes.find((x) => x.id === id);
  if (!n) return null;
  const d = el('div', 'note');
  const p = el('p'); p.append(el('b', null, n.title + '. '), n.text); d.append(p);
  if (withQuote && n.quote) d.append(el('p', 'quote', `USGS: “${n.quote}”`));
  return d;
}
function credits(A) {
  const d = el('div', 'note');
  d.append(el('h2', null, 'Sources'));
  for (const s of (A.C && A.C.S ? A.C.S.sources : [])) d.append(el('p', null, `${s.attribution} Read ${s.readAt ? s.readAt.replace('T', ' ').replace(/:\d\dZ$/, ' UTC') : 'at an unknown time'}.`));
  if (A.about) for (const s of A.about.sources) if (s.attribution) d.append(el('p', null, s.attribution));
  return d;
}

export function liveBody(A, body) {
  const S = A.C && A.C.S;
  const w = el('p', 'warn'); const nw = A.about && A.about.notes.find((x) => x.id === 'not-a-warning');
  w.append(el('b', null, 'Not a warning service. '), nw ? nw.text : ''); body.append(w);
  if (!S) { body.append(el('p', null, A.snapErr || 'This copy has no data/snapshot.json, so Live has nothing to show. History works to the end of the app\'s catalog.')); return; }
  const st = staleText(A); if (st) body.append(el('p', 'warn', st));
  if (A.C.stale) body.append(el('p', 'warn', `The live data here is older than the app's history (feed of ${utc(minOfMs(S.gen), false)}).`));
  body.append(el('h2', null, `Largest in ${A.win.label}`));
  const big = A.largest(10);
  body.append(big.length ? list(A, big, (i) => `${age(Date.now() - msOf(A.C.t[i]))}`) : el('p', null, 'No earthquakes in this window.'));
  const pb = A.perBox();
  const cn = el('p', 'counts');
  cn.append(nums(`In the map boxes: ${['Lower 48', 'Alaska', 'Hawaii', 'Puerto Rico'].map((n, k) => `${n} ${num(pb.n[k])}`).join(' · ')}`, true));
  body.append(cn);
  body.append(radios('Sizes', [[true, 'All sizes'], [false, 'M 2.5+']], A.st.liveAll, (liveAll) => A.set({ liveAll })));
  const hol = A.about && A.about.reading.find((r) => r.id === 'hollow');
  if (hol) body.append(el('p', 'note', hol.text));
  body.append(volcanoLine(A), credits(A));
}
function volcanoLine(A) {
  const vs = A.vstat, p = el('p', 'note');
  if (!vs.known) { p.textContent = 'Volcano status not available in this copy.'; return p; }
  const up = [];
  for (const v of A.G.volcanoes) { const m = vs.byVnum.get(String(v.vnum)); if (m && (m.alert !== 'NORMAL' || m.color !== 'GREEN')) up.push(`${v.name} (${cap(m.alert)}, ${cap(m.color)})`); }
  const S = A.C.S, asOf = vs.readAt && Date.parse(vs.readAt) < S.gen - 3600e3 ? ` As of ${vs.readAt.replace('T', ' ').slice(0, 16)} UTC.` : '';
  p.append(nums(`${up.length ? `${up.length} volcano${up.length === 1 ? '' : 'es'} above Normal: ${up.join(', ')}.` : 'No volcano above Normal.'}${asOf}`, true));
  return p;
}

// History
// Two lines by design (three when rows without a magnitude are drawn): the window and floor; the counts;
// the × counted apart. Each break is a " · " kept in the text for readers and hidden on screen.
// numbers in mono, words in Atkinson (ART.md "Type")
export function histLabel(A, p, n, x, inView) {
  p.textContent = '';
  const s = el('span'), br = () => el('i', 'br', ' · ');
  s.append(' · ', el('span', 'mono', `M ${A.floorText()}+`), br(), nums(`${num(n)} earthquake${n === 1 ? '' : 's'} · ${num(inView)} in view`));
  if (x) { const q = el('span', 'nomag'); q.append(nums(`${num(x)} × without magnitude`)); s.append(br(), q); }
  p.append(el('b', null, A.win.label), s);
}
export function histBody(A, body) {
  const C = A.C;
  if (C.gap) body.append(el('p', 'warn', `No data from ${utc(C.gap.from, false)} to ${utc(C.gap.to, false)} in this copy: the app's history ends ${utc(C.gap.from, false)}, and the live data starts ${utc(C.gap.to, false)}. Install the app's latest ZIP to fill it.`));
  if (A.st.floor === 45 && A.about) {
    const q = (A.about.notes.find((x) => x.id === 'completeness') || {}).quote || '';
    const m = q.match(/Within the conterminous U\.S\., the level of completeness.*?(is probably in the magnitude [^.]*?range\.)/);
    if (m) body.append(el('p', 'quote', `USGS: “Within the conterminous U.S., the level of completeness … ${m[1]}”`));
  }
  if (A.win.t0 < T1900) { const b = note(A, 'before-1900', false); if (b) body.append(b); }
  storyList(A, body);
  body.append(el('h2', null, `Largest in ${A.win.label}`));
  const big = A.largest(10);
  body.append(big.length ? list(A, big, (i) => utc(A.C.t[i], false)) : el('p', null, 'No earthquakes in this window at this floor.'));
  const n = note(A, 'more-instruments'); if (n) body.append(n);
  body.append(credits(A));
}

// The long-press list and the event card
export function pressList(A, body, rows) {
  const h = el('div', 'l1');
  h.append(el('h2', null, `${num(rows.length)} earthquake${rows.length === 1 ? '' : 's'} here`));
  h.append(xBtn('Close the list', () => A.closeCard()));
  body.append(h, list(A, rows.slice(0, 50), (i) => utc(A.C.t[i], false)));
  if (rows.length > 50) body.append(el('p', 'note', `and ${num(rows.length - 50)} more`));
}

export function nearestFault(G, lon, lat, km = 25) {
  const F = G.faults, X = wx(lon), Y = wy(lat), kmPerW = 2 * Math.PI * R * Math.cos(lat * rad), lim = km / kmPerW;
  let best = -1, bd = lim;
  for (let g = 0; g < F.lines.length; g++) {
    const sh = F.lines[g], bb = sh.bb;
    if (X < bb[0] - bd || X > bb[2] + bd || Y < bb[1] - bd || Y > bb[3] + bd) continue;
    const p = sh.p;
    let at = 0;
    for (const c of sh.counts) {
      for (let k = at; k < at + 2 * c - 2; k += 2) {
        const ax = p[k], ay = p[k + 1], dx = p[k + 2] - ax, dy = p[k + 3] - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / L2)) : 0;
        const d = Math.hypot(X - ax - t * dx, Y - ay - t * dy);
        if (d < bd) { bd = d; best = g; }
      }
      if (c === 1 && Math.hypot(X - p[at], Y - p[at + 1]) < bd) { bd = Math.hypot(X - p[at], Y - p[at + 1]); best = g; }
      at += 2 * c;
    }
  }
  return best < 0 ? null : { g: best, km: bd * kmPerW };
}

export function card(A, i) {
  const C = A.C, ab = A.about || {}, fields = ab.fields || {};
  const d = el('article', 'card');
  const m = C.m[i], mt = magType(C, i), mtName = ab.magTypeNames && ab.magTypeNames[mt.toLowerCase()];
  const l1 = el('div', 'l1'), diam = m === 255 ? 6 : dotSize((m - 20) / 10);
  const ty = el('span', 'type');
  if (mt) ty.append(el('span', 'mono', mt), mtName ? ` · ${mtName.name}` : '');
  l1.append(dotCanvas(A, i, 40, Math.ceil(Math.max(diam, A.hollow(i) ? 3.7 : 0) + 4)), el('span', 'mag', m === 255 ? 'No magnitude' : `M ${magText(m)}`), ty);
  l1.append(xBtn('Close the card', () => A.closeCard()));
  const place = placeOf(A, i), L = liveOf(C, i), t = C.t[i];
  d.append(l1, el('p', 'place', place.text));
  const tm = el('p', 'time'); tm.append(nums(`${utc(t)}${L ? ` · ${hhmmLocal(msOf(t))} on your phone` : ''}${t < T1900 ? ' (as the catalog lists it)' : ''}`));
  d.append(tm);
  const km = depthKm(C.d[i]), dep = el('div', 'dep');
  if (km == null) dep.append('Depth not given in the catalog');
  else dep.append('Depth ', el('span', 'mono', dist(km, 1)));
  const g = el('canvas'), gx = sizeCanvas(g, 72, 12, A.dpr);
  if (km == null) { gx.fillStyle = '#8a9099'; gx.fillRect(0, 3, 72, 6); } else { rampBar(gx, 0, 3, 72, 6); gx.fillStyle = cssVar('--ink'); gx.fillRect(Math.round(rampPos(km) * 72) - 1, 0, 2, 12); }
  dep.append(g); d.append(dep);
  const small = (...s) => { const p = el('p', 'small'); p.append(...s); d.append(p); }, mono = (s) => el('span', 'mono', s);
  // code 1500 is the catalog's 10 and nothing else: a depth that only rounds to 10.00 km is stored as 9.99 or
  // 10.01 (CONTRACT §1), so the fixed depth's quote is shown only where the catalog says 10
  if (km != null && C.d[i] === 1500 && fields.fixedDepth && fields.fixedDepth.more) small('At ', mono(tenKm()), `, as the catalog lists it. USGS: “${fields.fixedDepth.more.quote}”`);
  if (km != null && km < 0 && fields.depth) small(`USGS: “${fields.depth.quote}”`);
  const st = statusOf(C, i), live = t >= C.liveFrom;
  small(st === 'automatic' && !live ? 'Status: automatic, as the catalog lists it' : `Status: ${st}`);
  if (st === 'automatic' && live && fields.status) small(`USGS: “${fields.status.quote}”`);
  if (L) {
    if (L.felt != null && L.felt > 0) small(`${fields.felt ? fields.felt.label : 'Felt reports'}: ${num(L.felt)}${fields.felt ? ` — USGS: “${fields.felt.quote}”` : ''}`);
    if (L.tsunami) small(`${fields.tsunami ? fields.tsunami.label : 'Tsunami flag'}: 1${fields.tsunami ? ` — USGS: “${fields.tsunami.quote}”` : ''}`);
    if (L.alert) small(`${fields.alert ? fields.alert.label : 'PAGER alert'}: ${L.alert}${fields.alert ? ` — USGS: “${fields.alert.quote}”` : ''}`);
  }
  const [lon, lat] = lonLat(C, i);
  const f = nearestFault(A.G, lon, lat, 25);
  if (f) {
    const F = A.G.faults, gr = F.groups[f.g];
    small(`Nearest mapped fault: ${F.names[gr[0]]}${F.sections[gr[1]] ? `, ${F.sections[gr[1]]}` : ''}, `, mono(dist(f.km)), ` · ${F.ages[gr[2]]}`);
    const fn = (ab.notes || []).find((n) => n.id === 'faults'), s = fn && fn.text.match(/Nearness is not cause[^.]*\./);
    if (s) small(s[0]);
  }
  let v = null, vd = 50;
  for (const q of A.G.volcanoes) { const k = hav(lon, lat, q.lon, q.lat); if (k <= vd) { vd = k; v = q; } }
  if (v) {
    const ms = A.vstat.byVnum.get(String(v.vnum));
    small(`Nearest volcano: ${v.name}, `, mono(dist(vd)), ', ', mono(elev(v.elev_m)), ` · ${ms ? `${cap(ms.alert)}, ${cap(ms.color)}` : A.vstat.known ? 'not monitored' : 'status not available in this copy'}`);
  }
  const tx = textOf(C, i);
  d.append(el('p', 'addr', tx && ab.eventPage ? ab.eventPage.replace('{id}', tx.id) : 'The catalog id is kept in this app for M 4.5 and up.'));
  d.dataset.row = String(i);
  d.setAttribute('aria-label', `Magnitude ${magText(m) || 'not given'}, ${utc(t, false)}, ${km == null ? 'no depth' : `depth ${dist(km, 0)}`}, ${place.text}`);
  return d;
}

// faults and volcanoes (DESIGN §8.4): their own labels; meanings only as quoted
function head(A, d, title, label) {
  const l1 = el('div', 'l1');
  l1.append(el('h3', 'place', title), xBtn(label, () => A.closeCard())); d.append(l1);
}
export function faultCard(A, g) {
  const F = A.G.faults, [n, sec, age, slip, sense, line, cls, yr] = F.groups[g], ab = A.about || {}, d = el('article', 'card');
  head(A, d, F.names[n] || 'Unnamed fault', 'Close the fault card');
  const small = (s) => s && d.append(el('p', 'small', s));
  small(F.sections[sec] && `Section: ${F.sections[sec]}`);
  small(`Age class: ${F.ages[age] || 'not given'}`); small(F.slipRates[slip] && `Slip rate: ${F.slipRates[slip]}`);
  small(F.senses[sense] && `Slip sense: ${F.senses[sense]}`); small(F.lineTypes[line] && `Line: ${F.lineTypes[line]}`);
  const q = ab.faultClasses && ab.faultClasses[F.classes[cls]];
  small(F.classes[cls] && `Class ${F.classes[cls]}${q ? ` — USGS: “${q.quote}”` : ''}`);
  small(yr ? `Last reviewed ${yr}` : '');
  const fn = note(A, 'faults'); if (fn) d.append(fn);
  return d;
}
export function volcanoCard(A, v) {
  const d = el('article', 'card'), ms = A.vstat.byVnum.get(String(v.vnum)), L = (A.about || {}).volcanoLevels || {};
  head(A, d, v.name, 'Close the volcano card');
  const small = (s) => s && d.append(el('p', 'small', s)), line = (s) => { const p = el('p', 'small'); p.append(nums(s)); d.append(p); };
  line(`Elevation ${elev(v.elev_m)}${v.threat ? ` · ${v.threat}` : ''} · observatory ${v.obs.toUpperCase()}`);
  if (ms) {
    line(`Alert level ${cap(ms.alert)} · aviation color code ${cap(ms.color)}${ms.sent ? ` · latest notice ${ms.sent.replace('T', ' ').slice(0, 16)} UTC` : ''}`);
    for (const k of [ms.alert, ms.color]) if (L[k]) small(`${cap(k)} — USGS: “${L[k].quote}”`);
  } else if (!A.vstat.known) small('Volcano status not available in this copy.');
  else { small('Not monitored'); const vn = note(A, 'volcanoes', false); if (vn) d.append(vn); }
  return d;
}
