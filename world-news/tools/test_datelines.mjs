// The decode test (HOUSE.md 7.3): the pinned fixture of data/snapshot.json read with formulas written here, against the app's
// pure modules js/datelines.js and js/units.js. The art pass changes no decoding; this proves the Datelines
// and the dates on screen are what the file says (ART.md section 1; tools/DECISIONS.md, item 13).
//
//   node tools/test_datelines.mjs

process.env.TZ = 'Europe/Oslo';   // set before any Date: the phone's zone for the clock-dependent forms
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = await import(path.join(APP, 'js/datelines.js'));
const U = await import(path.join(APP, 'js/units.js'));
// The fixed day: tools/fixtures/snapshot.json, the file of 1 Oct 2026 every figure below was measured on (ART.md).
// data/snapshot.json is rewritten every hour by the refresh, so it cannot hold these figures (plan 0012 package 4).
import crypto from 'node:crypto';
const FIXTURE = path.join(APP, 'tools/fixtures/snapshot.json');
const FIXTURE_SHA = 'ecb808729f4562dfe98f324aaef3a54ffaeebef03982c62348ab6f8f910c5d2c';
if (crypto.createHash('sha256').update(fs.readFileSync(FIXTURE)).digest('hex') !== FIXTURE_SHA) { console.log(`FAIL tools/fixtures/snapshot.json is not the pinned file (${FIXTURE_SHA.slice(0, 12)}…)`); process.exit(1); }
const snap = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const NB = ' ';

/* ── the file, decoded here ── */
const gen = Date.parse(snap.generatedAt);
const items = snap.regions.flatMap((r, ri) => r.items.map((it, ii) => ({ ri, ii, it, h: (gen - Date.parse(it.published)) / 3600000 })));
const dateOnly = items.filter(({ it }) => /T(00|12):00:00Z$/.test(it.published));
const byLink = {};
for (const r of snap.regions) for (const it of r.items) (byLink[it.link] ||= new Set()).add(r.name);
const cross = Object.values(byLink).filter((s) => s.size > 1).length;
ok(items.length === 48 && snap.regions.length === 6, `the file: ${snap.regions.length} regions, ${items.length} headlines, made ${snap.generatedAt}`);
ok(dateOnly.length === 20 && items.filter(({ it }) => U.isDateOnly(it.published)).length === 20,
  `date-only stamps (exactly 00:00:00 or 12:00:00 UTC): ${dateOnly.length} here, ${items.filter(({ it }) => U.isDateOnly(it.published)).length} by units.isDateOnly (ART.md: 20)`);
ok(cross === 3, `stories under more than one region, by link: ${cross} (ART.md: 3)`);

/* ── the scale and the clusters, at 390 and 320 px, by the rule in ART.md section 1 ── */
const LABEL = 73;   // the widest region name, Middle East, at 12.5 px and 620 in the face, plus 10 (ART.md)
// the Datelines fill their plate's inner width: the phone less the pane's 2 × 16 px and the plate's 2 × 13 px
for (const [phone, width, want] of [[390, 332, { W: 253, ticks: 39, shared: 17 }], [320, 262, { W: 183, ticks: 39, shared: 17 }]]) {
  const W = Math.min(480, width - LABEL - 6), k = W / Math.log2(1440);
  const x = (h) => LABEL + W - k * Math.log2(Math.min(1440, Math.max(1, h)));
  const mine = snap.regions.map((r, ri) => {
    const xs = items.filter((t) => t.ri === ri).map((t) => ({ ...t, x: x(t.h) })).sort((a, b) => a.h - b.h);
    const cl = [];
    for (const t of xs) { const last = cl[cl.length - 1]; if (last && last[0].x - t.x < 3) last.push(t); else cl.push([t]); }   // within 3 px of the tick's own, newest x
    return cl;
  });
  const M = D.model(snap, width, LABEL);
  const ticks = M.rows.reduce((s, r) => s + r.ticks.length, 0), shared = M.rows.reduce((s, r) => s + r.ticks.filter((t) => t.items.length > 1).reduce((q, t) => q + t.items.length, 0), 0);
  const maxParts = Math.max(...M.rows.flatMap((r) => r.ticks.map((t) => t.items.length)));
  const same = M.rows.every((r, ri) => r.ticks.length === mine[ri].length && r.ticks.every((t, j) => Math.abs(t.x - mine[ri][j][0].x) < 1e-9
    && t.items.length === mine[ri][j].length && t.items.every((it, q) => it.ri === mine[ri][j][q].ri && it.ii === mine[ri][j][q].ii)));
  ok(M.G.W === want.W && M.G.x0 === LABEL && Math.abs(M.G.k - W / Math.log2(1440)) < 1e-12, `${phone} px: plot ${M.G.W} px from x ${M.G.x0}, ${(M.G.k).toFixed(1)} px a doubling (ART.md: ${want.W})`);
  ok(same, `${phone} px: every tick's x, its headlines and their order equal this test's own decode (${mine.flat().length} clusters)`);
  ok(ticks === want.ticks && shared === want.shared && maxParts === 3, `${phone} px: ${ticks} ticks for 48 headlines, ${shared} headlines sharing a tick, at most ${maxParts} parts (ART.md: ${want.ticks}, ${want.shared}, 3)`);
  const six = x(6), day = x(24), week = x(168);
  if (phone === 390) ok(Math.round(LABEL + W - six) === 62 && Math.round(LABEL + W - day) === 111 && Math.round(LABEL + W - week) === 178, `390 px: 6 h at ${Math.round(LABEL + W - six)} px from the right, 1 d at ${Math.round(LABEL + W - day)}, 7 d at ${Math.round(LABEL + W - week)} (ART.md: 62, 111, 178)`);
  ok(!M.lo && !M.hi, `${phone} px: no age past either end in this file, so both end labels print closed`);
}

/* ── the ages ART.md quotes ── */
{
  const age = (name, f) => { const hs = items.filter((t) => snap.regions[t.ri].name === name).map((t) => t.h); return f(...hs); };
  const eu = [age('Europe', Math.min), age('Europe', Math.max)], oc = items.filter((t) => snap.regions[t.ri].name === 'Oceania').map((t) => t.h).sort((a, b) => a - b);
  ok(U.spokenAge(eu[0]) === '2 days 5 hours' && U.spokenAge(eu[1]) === '15 days 20 hours', `Europe: newest ${U.spokenAge(eu[0])}, oldest ${U.spokenAge(eu[1])} (ART.md: 2 d 5 h, 15 d 20 h)`);
  ok(oc.filter((h) => h < 15).length === 5 && [16, 35, 50].every((d, i) => Math.floor(oc[5 + i] / 24) === d), `Oceania: ${oc.filter((h) => h < 15).length} headlines in the last 15 hours, then ${oc.slice(5).map((h) => Math.floor(h / 24)).join(', ')} days (ART.md: 5; 16, 35, 50)`);
  const spread = Math.max(...items.map((t) => t.h)) / Math.min(...items.map((t) => t.h));
  ok(Math.round(spread / 10) * 10 === 550, `the spread of ages: a factor of ${spread.toFixed(0)} (ART.md: 550)`);
  const M = D.model(snap, 358, LABEL);
  // Europe's newest is Global Voices at 29 Sep 00:00:00 UTC, a date without a time: a span, never "2 days 5 hours"
  ok(D.label(M).startsWith('Europe: 8 headlines, the newest 1 or 2 days and the oldest 15 days 20 hours before the file was made. Americas: 8 headlines,'), `the picture's label for VoiceOver begins "${D.label(M).slice(0, 96)}…"`);
  const rowsD = M.rows.filter((r) => r.n && [r.newest, r.oldest].some((t) => U.isDateOnly(t.iso)));
  const said = rowsD.every((r) => { const lab = D.label({ ...M, rows: [r] }); return [r.newest, r.oldest].every((t) => (U.isDateOnly(t.iso) ? lab.includes(U.spokenDated(gen, t.iso)) && !lab.includes(U.spokenAge(t.h)) : lab.includes(U.spokenAge(t.h)))); });
  ok(rowsD.length === 3 && said, `${rowsD.length} rows have a date-only newest or oldest headline: each is read as its span, never its placeholder's hours`);
}

/* ── kept from an earlier run, open ends, the tap ── */
{
  const stale = JSON.parse(JSON.stringify(snap));
  stale.regions[0].stale = true;
  for (const it of stale.regions[0].items) it.stale = true;
  const M = D.model(stale, 358, LABEL);
  ok(D.hollows(M) === 8 && M.rows[0].ticks.every((t) => t.items.every((i) => i.stale)) && M.rows.slice(1).every((r) => r.stale === 0)
    && D.label(M).startsWith('Europe: 8 headlines, the newest 1 or 2 days and the oldest 15 days 20 hours before the file was made; all kept from an earlier run.'),
  `Europe kept from an earlier run: ${D.hollows(M)} hollow parts, its sentence ends "all kept from an earlier run"`);
  const open = JSON.parse(JSON.stringify(snap));
  open.regions[5].items[0].published = new Date(gen + 10 * 60000).toISOString();          // a feed's clock ahead
  open.regions[5].items[7].published = new Date(gen - 70 * 86400000).toISOString();       // older than 60 d
  const O = D.model(open, 358, LABEL), xs = O.rows[5].ticks.map((t) => t.x);
  ok(O.lo && O.hi && Math.abs(Math.max(...xs) - (LABEL + 279)) < 1e-9 && Math.abs(Math.min(...xs) - LABEL) < 1e-9 && U.ageLabel(1, '≤') === `≤ 1${NB}h` && U.ageLabel(1440, '≥') === `≥ 60${NB}d`,
    'an age under 1 h and one over 60 d sit on the ends, and the ends print open ("≤ 1 h", "≥ 60 d")');
  const M2 = D.model(snap, 358, LABEL), t = M2.rows[1].ticks[0];
  const y = D.TOP + 1 * D.ROW + 9;
  ok(D.hit(M2, t.x + 10, y) === t && D.hit(M2, t.x - 21, y) !== null && D.hit(M2, 5, y) === null && D.hit(M2, t.x, D.TOP - 2) === null && D.hit(M2, t.x, D.TOP + 6 * D.ROW + 2) === null,
    `a tap picks the nearest tick within ${D.REACH} px in its row (Americas' newest at x ${t.x.toFixed(1)}), and nothing on the label column or outside the rows`);
}

/* ── a crowded tick and a run of near ages (the reviewer's should 5) ── */
{
  // Middle East gets six headlines: four UN-style noon stamps on one day and two more 12 minutes apart on another
  const six = JSON.parse(JSON.stringify(snap)), me = six.regions[3];
  me.items = [...[0, 1, 2, 3].map((j) => ({ ...me.items[j], published: '2026-09-28T12:00:00Z' })),
    { ...me.items[4], published: '2026-09-30T12:00:00Z' }, { ...me.items[5], published: '2026-09-30T11:48:00Z' }];
  const M6 = D.model(six, 358, LABEL), big = M6.rows[3].ticks.find((t) => t.items.length === 4);
  ok(big && M6.rows[3].ticks.length === 2, `four headlines at one age share one tick (${big ? big.items.length : 0}); the row has ${M6.rows[3].ticks.length} ticks`);
  // a fake SVG, enough for draw(): the count past four is printed beside the tick, and the parts stop at four
  const node = (tag) => ({ tag, kids: [], attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v; }, append(e) { this.kids.push(e); }, replaceChildren() { this.kids = []; } });
  globalThis.document = { createElementNS: (ns, tag) => node(tag) };
  const five = JSON.parse(JSON.stringify(six));
  five.regions[3].items.push({ ...me.items[6], published: '2026-09-28T12:00:00Z' }, { ...me.items[7], published: '2026-09-28T12:00:00Z' });
  const M7 = D.model(five, 358, LABEL), svg = node('svg');
  D.draw(svg, M7, new Set([3]), null);
  const g = svg.kids.filter((k) => k.tag === 'g')[3], cnt = g.kids.filter((k) => k.attrs.class === 'cnt');
  const tickX = Math.round(M7.rows[3].ticks.find((t) => t.items.length === 6).x), parts = g.kids.filter((k) => k.tag === 'rect' && k.attrs.x + 1 === tickX);
  ok(cnt.length === 1 && cnt[0].textContent === '6' && parts.length === 4, `a tick of 6 headlines is drawn in ${parts.length} parts with "${cnt.map((c) => c.textContent).join()}" beside it (none for a tick of 4 or fewer)`);
  // a run of ages 2 px apart: the old rule chained them into one tick; now no headline stands 3 px or more from its tick
  const run = JSON.parse(JSON.stringify(snap)), k = 279 / Math.log2(1440);
  run.regions[3].items = run.regions[3].items.slice(0, 5).map((it, j) => ({ ...it, published: new Date(gen - 10 * 2 ** ((2 * j) / k) * 36e5).toISOString() }));
  const MR = D.model(run, 358, LABEL), far = Math.max(...MR.rows[3].ticks.flatMap((t) => t.items.map((i) => t.x - i.x)));
  ok(MR.rows[3].ticks.length === 3 && far < D.GAP, `five ages 2 px apart make ${MR.rows[3].ticks.length} ticks, never one chained tick; the farthest headline ${far.toFixed(2)} px from its tick (under ${D.GAP})`);
  const sel = node('svg');
  D.draw(sel, M7, new Set([3]), { ri: 3, ii: 0 });
  const c = sel.kids.find((x) => x.attrs.class === 'sel'), y = D.TOP + 3 * D.ROW;
  ok(c && c.attrs.cy - c.attrs.r - 0.75 >= y + 3 && c.attrs.cy + c.attrs.r + 0.75 <= y + 3 + D.TICK, `the selected tick's head (r ${c && c.attrs.r} with its 1.5 px ring) stays inside its own tick, y ${y + 3} to ${y + 3 + D.TICK}, never touching the row above`);
  // the final reviewer's case at 390 px: one headline 91 h old and six about 100 h old make a tick of six at x 175.3
  // and a newer tick at 178.9. The "6" starts at x 178, on the newer tick (x 178 to 180), so it is drawn before
  // every tick of its row; drawn after, its 3 px --page halo erased that tick.
  const halo = JSON.parse(JSON.stringify(snap)), base = gen - 100 * 36e5;
  halo.regions[3].items = halo.regions[3].items.slice(0, 7).map((it, i) => ({ ...it, published: new Date(i ? base - (i - 1) * 6e4 : base + 9 * 36e5).toISOString(), stale: false }));
  const MH = D.model(halo, 358, LABEL), hs = node('svg');
  D.draw(hs, MH, new Set([3]), null);
  const hg = hs.kids.filter((x) => x.tag === 'g')[3], [newer, six6] = MH.rows[3].ticks, at = hg.kids.findIndex((x) => x.attrs.class === 'cnt');
  const nr = hg.kids.find((x) => x.tag === 'rect' && x.attrs.x === Math.round(newer.x) - 1), cn = hg.kids[at];
  ok(MH.rows[3].ticks.length === 2 && newer.items.length === 1 && six6.items.length === 6 && Math.abs(newer.x - 178.9) < 0.05 && Math.abs(six6.x - 175.3) < 0.05
    && cn && cn.textContent === '6' && nr && cn.attrs.x >= nr.attrs.x && cn.attrs.x <= nr.attrs.x + nr.attrs.width && hg.kids.every((x, i) => x.tag !== 'rect' || i > at),
    `a tick of six at x ${six6.x.toFixed(1)} and a newer one at ${newer.x.toFixed(1)}: the "${cn && cn.textContent}" starts at x ${cn && cn.attrs.x}, on the newer tick (x ${nr && nr.attrs.x} to ${nr && nr.attrs.x + nr.attrs.width}), and is the row's child ${at}, the newer tick child ${hg.kids.indexOf(nr)}: drawn before every tick, its halo covers none`);
}

/* ── units: the dates and spans on screen, the same on every locale ── */
{
  const now = Date.parse('2026-10-01T10:00:00Z');
  const una = items.find(({ it }) => it.published === '2026-09-23T12:00:00Z').it.published;
  ok(U.itemWhen(una, now) === '23 Sep' && U.itemWhen('2026-09-29T00:00:00Z', now) === '29 Sep' && U.itemWhen('2026-09-30T22:07:52Z', now) === '1 Oct, 00:07' && U.itemWhen('2026-09-28T06:00:15Z', now) === '28 Sep, 08:00',
    `a story's date: date-only "${U.itemWhen(una, now)}" (the feed's UTC date), with a time "${U.itemWhen('2026-09-30T22:07:52Z', now)}" in the phone's zone (Oslo), 24-hour`);
  ok(U.itemWhen('2026-09-29T00:00:00Z', Date.parse('2027-01-05T10:00:00Z')) === '29 Sep 2026' && U.itemWhen('2026-09-30T14:09:26Z', Date.parse('2027-01-05T10:00:00Z')) === '30 Sep 2026, 16:09', 'the year is added when it is not the phone\'s');
  ok(U.stampWhen(gen, now) === '07:01' && U.stampWhen(gen, now + 86400000) === '1 Oct, 07:01' && U.full(gen) === 'Thu 1 Oct 2026, 07:01 (UTC+2)', `the stamp "${U.stampWhen(gen, now)}", the day after "${U.stampWhen(gen, now + 86400000)}"; About "${U.full(gen)}"`);
  ok([1, 6, 24, 168, 1440].map((h) => U.ageLabel(h)).join('|') === ['1 h', '6 h', '1 d', '7 d', '60 d'].map((s) => s.replace(' ', NB)).join('|'), 'the scale labels: 1 h, 6 h, 1 d, 7 d, 60 d, U+202F before the unit');
  ok(U.spokenAge(185.02) === '7 days 17 hours' && U.spokenAge(24) === '1 day' && U.spokenAge(1.5) === '1 hour' && U.spokenAge(0.2) === 'under an hour' && U.spokenAge(-1) === 'under an hour', 'spoken ages: "7 days 17 hours", "1 day", "1 hour", "under an hour"');
  ok(U.int(16380) === `16${NB}380` && U.int(2026) === `2${NB}026` && U.count(1, 'headline') === '1 headline' && U.list(['a', 'b', 'c']) === 'a, b and c', 'counts grouped from four digits with U+202F; plurals; lists joined with "and"');
  ok(U.spoken('Europe, 23 Sep: x') === 'Europe, 23 September: x', 'the live region hears months in words');
  // a date-only stamp's age is a span of the UTC day the feed named (the reviewer's should 2)
  const sd = ['2026-09-23T12:00:00Z', '2026-09-29T00:00:00Z', '2026-09-30T00:00:00Z', '2026-10-01T00:00:00Z', '2026-10-02T12:00:00Z'].map((iso) => U.spokenItem(gen, iso));
  ok(sd.join('|') === '7 or 8 days|1 or 2 days|at most 1 day 5 hours|at most 5 hours|under an hour' && U.spokenItem(gen, '2026-09-28T06:00:15Z') === U.spokenAge((gen - Date.parse('2026-09-28T06:00:15Z')) / 36e5),
    `date-only ages: ${sd.map((x) => `"${x}"`).join(', ')}; a stamp with a time keeps its hours`);
  let wrong = 0;
  for (let m = 0; m < 24 * 60; m += 7) for (const day of ['2026-09-23', '2026-09-29', '2026-09-30']) {
    const real = Date.parse(`${day}T00:00:00Z`) + m * 60000, h = (gen - real) / 36e5, said = U.spokenDated(gen, `${day}T12:00:00Z`);
    const days = said.match(/^(\d+) or (\d+) days$/);
    if (days ? ![+days[1], +days[2]].includes(Math.floor(h / 24)) : h > (gen - Date.parse(`${day}T00:00:00Z`)) / 36e5) wrong++;
  }
  ok(wrong === 0, 'for every minute of the named day, the real age is inside the span said (whole days as spokenAge counts them)');
}

/* ── the register (plan 0012 package 4): each item carries its source; a region's newest age, floored ── */
{
  const M = D.model(snap, 358, 73), all = M.rows.flatMap((r) => r.ticks.flatMap((t) => t.items));
  const want = snap.regions.flatMap((r, ri) => r.items.map((it, ii) => `${ri}.${ii}:${it.source}`)).sort().join();
  ok(all.length === 48 && all.every((i) => Object.keys(i).join() === 'ri,ii,h,x,stale,iso,src') && all.map((i) => `${i.ri}.${i.ii}:${i.src}`).sort().join() === want,
    `the model's ${all.length} items each carry their source as src, the file's own name (the ticks' color by sources[] order)`);
  const NB2 = '\u202f', got = [0.4, 1, 14.9, 23.99, 24, 47.9, 1439].map(U.ageShort);
  ok(got.join('|') === [`under 1${NB2}h`, `1${NB2}h`, `14${NB2}h`, `23${NB2}h`, `1${NB2}d`, `1${NB2}d`, `59${NB2}d`].join('|'),
    `a region's newest age, never rounded up: ${got.map((x) => `"${x}"`).join(', ')}`);
  const newest = snap.regions.map((r) => U.ageShort(Math.min(...r.items.map((it) => D.ageOf(gen, it.published)))));
  ok(newest.length === 6 && newest.every((x) => /^(under 1|\d+)\u202f[hd]$/.test(x)), `each region's newest headline on its plate's head: ${snap.regions.map((r, i) => `${r.name} ${newest[i]}`).join(', ')}`);
}

console.log(fails.length ? `\n${fails.length} of ${n} failed` : `\nall ${n} checks pass`);
process.exit(fails.length ? 1 : 0);
