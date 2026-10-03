/* Power Hours, a Snuggery mini-app. The look is ART.md (the house system, Template/HOUSE.md, and the Landing);
 * every number, date and span on screen is written by js/units.js, the prices are read by js/prices.js and the
 * drawing is laid out by js/staircase.js.
 *
 * ---------------------------------------------------------------------------
 * SHAPE OF ./data/snapshot.json
 * ---------------------------------------------------------------------------
 * Whatever rewrites this file next year will not have read the conversation
 * that built it, so the contract lives here. Everything that changes is in the
 * JSON; this file and style.css should sit untouched for months.
 *
 * {
 *   "schema": 1,                            // bumped only on a breaking change
 *   "generatedAt": "2026-09-21T09:24:24Z",  // ISO 8601 UTC, when the job ran
 *   "zone": "NO2", "zoneName": "Norway south-west",
 *   "timezone": "Europe/Oslo",              // the calendar the market settles on
 *   "unit": "EUR/MWh",                      // the source's unit, unconverted
 *   "resolutionMinutes": 15,                // length of one hours[] entry
 *   "source": {
 *     "name": "Energy-Charts, Fraunhofer ISE",
 *     "endpoint": "api.energy-charts.info/price",
 *     "licence": "CC BY 4.0 from Bundesnetzagentur | SMARD.de",
 *     "licenceInfo": "CC BY 4.0 (creativecommons.org/licenses/by/4.0) from ...",
 *                                           // what the API said about THIS
 *                                           // answer; preferred over `licence`
 *                                           // in the credits, absent in --demo
 *     "publishable": true,                  // false: this zone is private use
 *     "attribution": "Day-ahead prices: Energy-Charts (Fraunhofer ISE)"
 *   },
 *
 *   "days": [                               // today first, then tomorrow
 *     {"date":"2026-09-21","label":"Today","source":"fetched",
 *      "intervals":96,"min":7.73,"max":152.67,"mean":93.25},
 *     {"date":"2026-09-22","label":"Tomorrow","source":"pending","intervals":0,
 *      "note":"no prices published for 2026-09-22"}
 *   ],                                      // source: fetched | carried
 *                                           //         | pending | failed
 *                                           // `label` is never read: "Today"
 *                                           // was true when the file was made
 *                                           // and is wrong by the next morning
 *
 *   "hours": [{"start":"2026-09-21T00:00:00+02:00","price":18.71}],
 *                                           // local ISO with offset, ascending.
 *                                           // One entry per MARKET INTERVAL:
 *                                           // the European day-ahead market
 *                                           // settles in 15-minute intervals,
 *                                           // so a day is 96 entries and not
 *                                           // 24; an hourly zone gives 24 and
 *                                           // everything below still works.
 *
 *   "lastGood": null,                       // or {"generatedAt","days","hours"}
 *                                           // when the job fetched NOTHING at
 *                                           // all: this app draws that curve
 *                                           // and says so, because a day-old
 *                                           // price is worth more than an error
 *                                           // where a price should be
 *
 *   "ask": [ ... ]                          // flat rows for Snuggery's Ask.
 *                                           // NEVER read by this app: it is a
 *                                           // table for questions in words, and
 *                                           // the numbers on screen are worked
 *                                           // out here from hours[] instead.
 * }
 *
 * ---------------------------------------------------------------------------
 * SHAPE OF ./data/appliances.json, the file a person edits
 * ---------------------------------------------------------------------------
 *   {"schema": 1, "appliances": [{"name": "Dishwasher", "hours": 2}, ...]}
 *
 * Editable in Snuggery: Options, then App Files. `hours` is how long the
 * appliance runs; fractions are fine. The refresh job never overwrites this
 * file, so an edit on the phone survives every data refresh.
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON SAFETY, since this file renders data somebody else's server wrote:
 * nothing from either JSON file ever reaches markup as markup. Every value goes
 * in through textContent (the el() helper below) or an attribute. innerHTML is
 * never assigned. Keep it that way.
 * ---------------------------------------------------------------------------
 */

import { NB, int, count, price, priced, ordinal, runLength, spokenLength, stampWhen, full, span, zone, hm, dateFull, isoDate, spokenPrice, spoken } from './js/units.js';
import * as P from './js/prices.js';
import { layout, draw as drawSvg, indexAt, caption as captionOf, describe } from './js/staircase.js';

const SNAPSHOT_URL = './data/snapshot.json';
const APPLIANCES_URL = './data/appliances.json';
const LABEL_FONT = '400 10.5px "Ysabeau Office", system-ui, sans-serif';
const WHEN_FONT = '620 12.5px "Ysabeau Office", system-ui, sans-serif', VALS_FONT = '400 11.5px "Ysabeau Office", system-ui, sans-serif';   // the readout's two lines, as style.css sets them
const CREDIT_FALLBACK = 'Day-ahead prices: Energy-Charts (Fraunhofer ISE).';
const AHEAD_OF_CLOCK = 3600000;   // a file made more than an hour after the phone's time says so
const LANDSCAPE = '(orientation: landscape) and (max-height: 500px)';

/* Used only when data/appliances.json is missing, unreadable or empty, and the app says so on screen. */
const FALLBACK_APPLIANCES = [
  { name: 'Dishwasher', hours: 2 },
  { name: 'Washing machine', hours: 1.5 },
  { name: 'Car charging', hours: 4 },
  { name: 'Tumble dryer', hours: 2 },
];

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let D = null;                       // the prices as drawn (derive())
let texts = { snap: null, apps: null };   // both files as last read, to tell a new file from the same one
let appliance = 0;                  // the chosen appliance, an index into D.apps; the app stores nothing
let chosen = 0;                     // the chosen interval, an index into D.M.iv
let follow = true;                  // the chosen interval follows the present until the reader moves it
let L = null, shut = null;          // the drawing's layout and its handle
let tick = 0;                       // the clock redraw's timeout

/** One polite live region for sentences (HOUSE 4.9): never twice for one event. */
function announce(text) {
  const n = $('live');
  n.textContent = '';
  setTimeout(() => { n.textContent = text; }, 60);
}

/* ── reading the files ────────────────────────────────────────────────── */

/** The app's only network-shaped call, and it never leaves the package: anything but ./data/<name>.json is
 *  refused here rather than quietly fetched. */
async function readText(url) {
  if (!/^\.\/data\/[\w-]+\.json$/.test(url)) return { error: `is not a file this app reads (${url}).` };
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `could not be read (HTTP ${res.status}).` };
    return { text: await res.text() };
  } catch (err) {
    return { error: `could not be read (${err.message || err}).` };
  }
}

function parseSnapshot(r) {
  if (r.error) return { problems: [`data/snapshot.json ${r.error}`], unread: true };
  let d;
  try { d = JSON.parse(r.text); } catch { return { problems: ['data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing.'] }; }
  const problems = P.validate(d);
  return problems.length ? { problems } : { value: d };
}

/** The appliances, and a sentence when the file could not be used as it stands. */
function parseAppliances(r) {
  const f = 'data/appliances.json';
  if (r.error) return { list: FALLBACK_APPLIANCES, note: `${f} ${r.error.replace(/\.$/, '')}, so this is the built-in list.` };
  let file;
  try { file = JSON.parse(r.text); } catch { return { list: FALLBACK_APPLIANCES, note: `${f} is not valid JSON, so this is the built-in list. A trailing comma or a missing quote will do it.` }; }
  const rows = (Array.isArray(file) ? file : file && file.appliances) || [];
  const clean = (Array.isArray(rows) ? rows : [])
    .filter((x) => x && typeof x.name === 'string' && x.name.trim() && Number(x.hours) > 0 && Number(x.hours) <= 24)
    .map((x) => ({ name: x.name.trim().slice(0, 40).trim(), hours: Number(x.hours) }));
  if (!clean.length) return { list: FALLBACK_APPLIANCES, note: `${f} holds no usable rows, so this is the built-in list. Each row needs a name and a run length in hours.` };
  const skipped = rows.length - clean.length;
  return { list: clean, note: skipped ? `${count(skipped, 'row')} in ${f} ${skipped === 1 ? 'was' : 'were'} skipped: each needs a name and a run length between 0 and 24 hours.` : '' };
}

/** Everything the pane draws, from the two files at the phone's present. */
function derive(data, apps, note, now = Date.now()) {
  const M = P.model(data, now);
  const kept = P.usingLastGood(data);
  const made = Date.parse(kept && data.lastGood ? data.lastGood.generatedAt : data.generatedAt);
  return { data, M, kept, made: Number.isNaN(made) ? null : made, note, list: apps,
    apps: apps.map((a) => ({ ...a, run: P.cheapest(M, a.hours) })) };
}

/** The interval chosen when nothing was: the current one, else the chosen run's first, else the first ahead. */
function defaultChosen() {
  const M = D.M, run = D.apps[appliance] && D.apps[appliance].run;
  return M.cur >= 0 ? M.cur : run && !run.none ? run.from : M.first;
}

async function load() {
  const [a, b] = await Promise.all([readText(SNAPSHOT_URL), readText(APPLIANCES_URL)]);
  const appsText = b.text != null ? b.text : `error ${b.error}`;
  if (D && a.text != null && a.text === texts.snap && appsText === texts.apps) { $('notice').hidden = true; refresh(); return; }
  const S = parseSnapshot(a);
  if (S.problems) return fail(S.problems, S.unread);
  const A = parseAppliances(b), before = D, was = texts;
  const keepStart = D && !follow ? D.M.iv[chosen].start : null, keepName = D && D.apps[appliance] ? D.apps[appliance].name : null;
  try { await document.fonts.load(LABEL_FONT); } catch { /* measured in the fallback face */ }
  D = derive(S.value, A.list, A.note);
  texts = { snap: a.text, apps: appsText };
  $('notice').hidden = true;
  const k = keepName == null ? -1 : D.apps.findIndex((x) => x.name === keepName);
  appliance = k >= 0 ? k : 0;
  const keep = keepStart == null ? -1 : D.M.iv.findIndex((x) => x.start === keepStart);
  chosen = keep >= 0 ? keep : defaultChosen();
  follow = keep < 0;
  const top = $('main').scrollTop;
  render();
  if (before) {
    $('main').scrollTop = top;
    announce(a.text !== was.snap ? `New prices${D.made !== null ? `, updated ${stampWhen(D.made)}` : ''}.` : 'The appliances were read again from data/appliances.json.');
  }
  schedule();
}

/** The same two files on a return, or the clock at a step boundary: the present moved, so the stamp is written
 *  again, and the pane is drawn again only when an interval has ended since (the faint quarters, Now, the
 *  stretch searched, the landing). */
function refresh() {
  const was = D.M, keepStart = follow ? null : was.iv[chosen].start;
  const next = derive(D.data, D.list, D.note);
  if (next.M.first === was.first && next.M.cur === was.cur && next.M.history === was.history) { D.M.now = next.M.now; stamp(); schedule(); return; }
  D = next;
  const keep = keepStart == null ? -1 : D.M.iv.findIndex((x) => x.start === keepStart);
  chosen = keep >= 0 ? keep : defaultChosen();
  const top = $('main').scrollTop;
  render();
  $('main').scrollTop = top;
  schedule();
}

/** While visible, one timeout to the next interval boundary, so `now` and Now never show a quarter that has
 *  ended; cleared when hidden. */
function schedule() {
  clearTimeout(tick);
  tick = 0;
  if (!D || document.hidden || D.M.history || !D.M.n) return;
  const M = D.M, at = M.cur >= 0 ? M.iv[M.cur].at + M.step : M.iv[M.first].at;
  const wait = at - Date.now() + 50;
  if (wait > 0 && wait < 2 ** 31 - 1) tick = setTimeout(refresh, wait);
}

/** A problem with the prices is a sentence on a plate (HOUSE 4.9). A broken replacement keeps the prices that
 *  were showing, the stamp, the pane and the scroll, and says so; Close puts the plate away. `unread`: the file
 *  could not be read at all, so nothing arrived. */
function fail(problems, unread = false) {
  const box = $('notice');
  box.replaceChildren();
  if (D) {
    const x = el('button', 'textkey', 'Close');
    x.type = 'button';
    x.onclick = () => { box.hidden = true; };
    const what = unread ? `${problems.join(' ')} Nothing new arrived.` : `A new data/snapshot.json arrived and cannot be used. ${problems.join(' ')}`;
    box.append(el('p', null, `${what} Still showing the prices ${D.made !== null ? `updated ${stampWhen(D.made)}` : 'that were open'}.`), x);
    box.classList.add('kept');
  } else {
    $('stamp').textContent = 'No usable prices';
    $('pane').replaceChildren();
    $('capline').textContent = '';
    box.classList.remove('kept');
    for (const p of problems) box.append(el('p', null, p));
    box.append(el('p', 'notice-lines', 'In Snuggery, Options, then App Files shows what the file holds.'));
  }
  box.hidden = false;
}

/* ── the stamp ────────────────────────────────────────────────────────── */

/** When the prices were made, on the phone's clock, in words. Day-ahead prices are final once published, so a
 *  file is never stale while it holds the present: staleness is coverage, not age (ART.md B4). Every state that
 *  needs saying is a sentence in ink, never a color. */
function stamp() {
  const M = D.M, now = Date.now(), node = $('stamp'), leads = [];
  if (M.history) leads.push(`Prices ran out ${span(now - (M.iv[M.n - 1].at + M.step))} ago.`);
  if (D.kept) leads.push('Kept from the run before.');
  if (D.made === null) leads.push('Undated file.');
  else if (D.made - now > AHEAD_OF_CLOCK) leads.push('Made after the phone’s time.');
  const words = D.made === null ? null : `Updated ${stampWhen(D.made)}`;
  if (!leads.length) { node.textContent = words; return; }
  node.replaceChildren(el('span', 'lead', leads.join(' ')), ...(words ? [` ${words}`] : []));
}

/* ── the pane ─────────────────────────────────────────────────────────── */

function render() {
  const pane = $('pane');
  pane.replaceChildren(zoneTitle(), ...nowSection(), landingBlock(), runsSection(), ...statements());
  drawLanding();
  stamp();
  $('capline').textContent = captionOf(D.M);
  credits();
  aboutList();
}

const offsetsOf = (M) => [...new Set(M.iv.map((x) => x.off))];
const cityOf = (tz) => (typeof tz === 'string' && tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : null);

/** The zone: its name, then the bidding zone, the market and the clock the times are told on. */
function zoneTitle() {
  const d = D.data, t = el('div', 'title'), city = cityOf(d.timezone);
  t.append(el('h2', null, typeof d.zoneName === 'string' && d.zoneName ? d.zoneName : String(d.zone || 'Bidding zone')));
  const offs = offsetsOf(D.M).map(zone).join(' and ');
  t.append(el('p', null, `${d.zone ? `Bidding zone ${d.zone}, ` : ''}day-ahead prices, ${city ? `${city} time` : 'the zone’s time'} (${offs})`));
  return t;
}

/** Now, only while the present is in the file: the current interval's price, the pane's one large figure. */
function nowSection() {
  const M = D.M;
  if (M.cur < 0) return [];
  const sec = el('section', 'sec now'), fig = el('p', 'fig'), r = P.rankDay(M, M.cur);
  const a = P.startWall(M, M.cur), b = P.endWall(M, M.cur);
  const band = r.band === 'cheapest' ? 'in the day’s cheapest quarter' : r.band === 'priciest' ? 'in the day’s most expensive quarter' : 'in the middle half';
  fig.append(el('b', null, price(M.iv[M.cur].v)), el('span', 'u', `${NB}${M.u.label}`));
  sec.append(el('h2', null, 'Now'), fig, el('p', 'lead', `${hm(a)}–${hm(b)}, ${r.rank === 1 ? 'lowest' : `${ordinal(r.rank)} lowest`} of today’s ${count(r.of, M.noun[0], M.noun[1])}, ${band}`));
  return [sec];
}

/** The Landing and its readout (ART.md section 1): the slider named Time, a tap, a sideways drag, the keys. */
function landingBlock() {
  const wrap = el('div', 'stw');
  const box = $('st-tpl').content.firstElementChild.cloneNode(true);
  box.id = 'stair';
  box.setAttribute('aria-valuemax', String(Math.max(0, D.M.n - 1)));
  const ro = el('div', 'ro');
  ro.append(el('p', 'ro-when', ''), el('p', 'ro-vals', ''));
  wrap.append(box, ro);
  wireSlider(box);
  return wrap;
}

/** The appliances sharing the chosen run's intervals, named together at the level's end. */
function namesOn(run) {
  if (!run || run.none) return [];
  return D.apps.filter((x) => x.run && !x.run.none && x.run.from === run.from && x.run.to === run.to).map((x) => x.name);
}

function drawLanding() {
  const pane = $('pane'), box = $('stair');
  if (!box) return;
  const cs = getComputedStyle(pane), ctx = document.createElement('canvas').getContext('2d');
  ctx.font = LABEL_FONT;
  const width = Math.floor(pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  const a = D.apps[appliance], run = a ? a.run : null;
  L = layout(D.M, run, width, matchMedia(LANDSCAPE).matches ? 96 : 120, (t) => ctx.measureText(t).width, namesOn(run));
  shut = drawSvg(box.querySelector('svg'), L);
  $('st-desc').textContent = a ? describe(D.M, run, a.name, a.hours) : '';
  holdReadout(pane.querySelector('.ro'));
  show(chosen);
}

const inRun = (i) => { const r = D.apps[appliance] && D.apps[appliance].run; return r && !r.none && i >= r.from && i <= r.to; };
/** Interval i's rank in words: among the stretch ahead, among the file in history, or "already past". */
function rankWords(i) {
  const M = D.M;
  if (P.isPast(M, i)) return 'already past';
  const r = P.rankAhead(M, i), first = r.rank === 1 ? 'lowest' : `${ordinal(r.rank)} lowest`;
  return M.history ? `${first} of the file’s ${count(r.of, M.noun[0], M.noun[1])}` : `${first} of the ${count(r.of, M.noun[0], M.noun[1])} ahead`;
}
const runTail = (i) => (inRun(i) ? `, inside the run for ${D.apps[appliance].name}` : '');
const whenWords = (i) => `${P.intervalWords(D.M, i)}${i === D.M.cur ? ', now' : ''}`;
const valsWords = (i) => `${priced(D.M.iv[i].v, D.M.u)}, ${rankWords(i)}${runTail(i)}`;
const valueText = (i) => `${P.intervalSpoken(D.M, i)}${i === D.M.cur ? ', now' : ''}, ${spokenPrice(D.M.iv[i].v, D.M.u)}, ${rankWords(i)}${runTail(i)}`;

/** The readout is a fixed block (ART.md section 3): held at the tallest its two lines get for any interval of
 *  this file at this width, measured once per draw, so nothing under it moves while scrubbing. Every interval's
 *  two strings are measured on a canvas in the face, and only the three widest of each line are laid out (a layout
 *  per interval cost 2 to 12 ms a draw in headless Chromium on 96 to 192 intervals; a phone is slower). */
function holdReadout(ro) {
  if (!ro) return;
  const w = ro.querySelector('.ro-when'), v = ro.querySelector('.ro-vals');
  ro.style.minHeight = '';
  const ctx = document.createElement('canvas').getContext('2d');
  const widest = (font, words) => {
    ctx.font = font;
    const ws = [];
    for (let i = 0; i < D.M.n; i++) ws.push([ctx.measureText(words(i)).width, i]);
    return ws.sort((p, q) => q[0] - p[0]).slice(0, 3).map((p) => p[1]);
  };
  let h = 0;
  for (const i of new Set([...widest(WHEN_FONT, whenWords), ...widest(VALS_FONT, valsWords)])) {
    w.textContent = whenWords(i);
    v.textContent = valsWords(i);
    h = Math.max(h, ro.offsetHeight);
  }
  ro.style.minHeight = `${h}px`;
}

/** Interval i shown: the column and the head, the readout, the slider's value. In place. */
function show(i) {
  chosen = i;
  if (shut) shut.place(i);
  const ro = $('pane').querySelector('.ro');
  if (ro) {
    ro.querySelector('.ro-when').textContent = whenWords(i);
    ro.querySelector('.ro-vals').textContent = valsWords(i);
  }
  const box = $('stair');
  if (box) { box.setAttribute('aria-valuenow', String(i)); box.setAttribute('aria-valuetext', valueText(i)); }
}
/** The reader moved the chosen interval: it follows the present again only if they put it back there. */
const moved = (i) => { show(i); follow = i === D.M.cur; };

/** The pointers down on the page, so a second finger on the drawing reads as a pinch and never as a scrub. */
const fingers = new Set();
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, (e) => fingers.delete(e.pointerId), true);

/**
 * The slider's input. A tap picks the interval under the finger; a drag that is mostly sideways moves the chosen
 * interval with the finger, drawn on the next animation frame (the house scrub: the head, the readout and the
 * value show the interval under the finger on every frame); a vertical swipe that starts here scrolls the pane
 * (touch-action: pan-y pinch-zoom) and picks nothing; a second finger is a pinch, which zooms the page and ends
 * a scrub where it stood. A tap is taken in the click that follows the pointer's lift; a click with no pointer
 * tap before it (VoiceOver's press) picks nothing. The arrow keys move one interval, Page Up and Page Down four,
 * Home and End to the ends; a focused slider says its own value, so the keys add no sentence.
 */
function wireSlider(box) {
  let start = null, scrub = false, wanted = null, frame = 0, tap = null;
  const xOf = (e) => e.clientX - box.querySelector('svg').getBoundingClientRect().left;
  const flush = () => { if (frame) cancelAnimationFrame(frame); frame = 0; if (wanted != null && wanted !== chosen) moved(wanted); };
  box.addEventListener('pointerdown', (e) => {
    fingers.add(e.pointerId);
    if (fingers.size > 1) {
      if (scrub) flush();
      start = null; scrub = false; tap = null;
      if (shut) shut.press(false);
      return;
    }
    if (e.button > 0 || !L) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    scrub = false;
  });
  box.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!scrub) {
      const dx = Math.abs(e.clientX - start.x), dy = Math.abs(e.clientY - start.y);
      if (dx < 6 || dx < dy * 1.2) return;
      scrub = true;
      try { box.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
      if (shut) shut.press(true);
    }
    wanted = indexAt(L, xOf(e), true);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (wanted !== chosen) moved(wanted); });
  });
  const end = (e, canceled) => {
    if (!start || e.pointerId !== start.id) return;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y), was = scrub;
    start = null;
    scrub = false;
    if (shut) shut.press(false);
    if (was) { flush(); return; }
    if (!canceled && dist < 10) tap = { x: e.clientX, at: e.timeStamp };
  };
  box.addEventListener('pointerup', (e) => end(e, false));
  box.addEventListener('pointercancel', (e) => end(e, true));
  box.addEventListener('click', (e) => {
    const t = tap;
    tap = null;
    if (!t || e.timeStamp - t.at > 800 || !L) return;
    const i = indexAt(L, t.x - box.querySelector('svg').getBoundingClientRect().left);
    if (i == null) return;
    moved(i);
    announce(`${spoken(valueText(i))}.`);
  });
  box.addEventListener('keydown', (e) => {
    const n = D.M.n, step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 }[e.key];
    const i = step != null ? chosen + step : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (i == null) return;
    e.preventDefault();
    moved(Math.max(0, Math.min(n - 1, i)));
  });
}

/** The runs: one pressed button per appliance, its run's times and what it costs against the mean searched. Each
 *  row's accessible name begins with its visible words and goes on in words ("13:30 to 15:30", "2 hours",
 *  "cents a kilowatt hour", "percent"), so VoiceOver neither spells the unit nor guesses the dash (HOUSE 6.1). */
function runsSection() {
  const M = D.M, sec = el('section', 'sec'), list = el('div', 'runs');
  sec.append(el('h2', null, M.history ? 'Cheapest runs in this file' : 'Cheapest runs ahead'));
  if (M.n) sec.append(el('p', 'note', `Searched from ${P.stretchWords(M)}; mean ${priced(M.meanAhead, M.u)}`));
  D.apps.forEach((a, k) => {
    const b = el('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(k === appliance));
    const r = a.run, why = r.none === 'long' ? 'longer than the file' : M.history ? 'no unbroken run that long in the file' : 'not enough prices left';
    b.append(el('span', 'nm', a.name), el('span', 'tm', r.none ? '' : P.runWords(M, r)), el('span', 'sub', `${runLength(a.hours)} run, ${r.none ? why : P.savingWords(M, r)}`));
    b.setAttribute('aria-label', r.none ? `${a.name}, ${spokenLength(a.hours)} run, ${why}` : `${a.name}, ${P.runWords(M, r, true)}, ${spokenLength(a.hours)} run, ${P.savingSpoken(M, r)}`);
    b.onclick = () => pick(k);
    list.append(b);
  });
  sec.append(list);
  return sec;
}

/** An appliance chosen: the landing moves, the rows' states change, the readout's run words follow; said once. */
function pick(k) {
  appliance = k;
  for (const [j, b] of [...$('pane').querySelectorAll('.runs button')].entries()) b.setAttribute('aria-pressed', String(j === k));
  drawLanding();
  const a = D.apps[k];
  announce(a.run.none ? `${a.name}: ${a.run.none === 'long' ? 'longer than the file' : 'no run of that length fits'}.` : P.runSpoken(D.M, a.name, a.run));
}

/** Sentences on the page, the first words at 620, each only when true; then always where the appliances live. */
function statements() {
  const M = D.M, d = D.data, out = [];
  const say = (lead, text) => { const p = el('p', 'statement'); p.append(el('b', null, lead), ` ${text}`); return p; };
  if (M.history) out.push(say('These prices have all ended,', 'so this is a past day, not a plan. The refresh after each day’s auction brings the next.'));
  const days = (D.kept && d.lastGood && Array.isArray(d.lastGood.days) ? d.lastGood.days : Array.isArray(d.days) ? d.days : []).filter((x) => x && typeof x.date === 'string');
  for (const day of days) {
    if (M.days.has(day.date)) {
      if (day.source === 'carried') out.push(say(`${isoDate(day.date)}’s prices were kept from an earlier run;`, 'the last refresh did not get them.'));
    } else if (M.today && day.date >= M.today) {
      out.push(say(`${isoDate(day.date)}: no prices yet`, `when this file was made${D.made !== null ? ` at ${stampWhen(D.made)}` : ''}. The auction publishes them about 13:00 Central European time; the refresh after that brings them.`));
    }
  }
  if (D.kept) out.push(say('The last refresh could not reach the price service,', `so these are the prices it kept from the run made ${D.made !== null ? stampWhen(D.made) : 'before'}.`));
  if (D.note) out.push(el('p', 'statement', D.note));
  const help = el('p', 'note help', 'The appliances are data/appliances.json: in Snuggery, Options, then App Files. Add a row or change a run length; the app reads it again when it comes back to the screen.');
  out.push(help);
  return out;
}

/** The credits, byte for byte from the snapshot: its attribution and its license words, joined by a full stop. */
function creditText() {
  const s = (D && D.data.source) || {};
  const attr = typeof s.attribution === 'string' && s.attribution ? s.attribution : null;
  const lic = typeof s.licenceInfo === 'string' && s.licenceInfo ? s.licenceInfo : typeof s.licence === 'string' && s.licence ? s.licence : null;
  if (!attr) return CREDIT_FALLBACK;
  const end = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
  return lic ? `${end(attr)} ${end(lic)}` : end(attr);
}
function credits() {
  const t = creditText();
  $('credits').textContent = t;
  $('about-credit').textContent = t;
  $('private').hidden = !(D.data.source && D.data.source.publishable === false);
}

/* ── About ────────────────────────────────────────────────────────────── */

function aboutList() {
  const dl = $('about-list'), d = D.data, M = D.M;
  dl.replaceChildren();
  const add = (k, v) => dl.append(el('dt', null, `${k}:`), el('dd', null, v));
  add('Zone', [d.zone, d.zoneName].filter((x) => typeof x === 'string' && x).join(', ') || 'not in the file');
  add('Time zone', `${typeof d.timezone === 'string' ? `${d.timezone}, ` : ''}${offsetsOf(M).map(zone).join(' and ')}`);
  if (M.n) {
    const a = P.startWall(M, 0), b = P.endWall(M, M.n - 1);
    add('Prices', `${dateFull(a)}, ${hm(a)} to ${dateFull(b)}, ${hm(b)}, ${count(M.n, M.noun[0], M.noun[1])}`);
  }
  add('Updated', D.made !== null ? `${full(D.made)}${D.kept ? ', the run before the last' : ''}` : 'not in the file');
  add('Source unit', M.u.factor === 0.1 ? `${M.u.source}, shown divided by 10 as ${M.u.label}, ${M.u.words}, the unit a household tariff is written in` : `${M.u.source}, shown as the source gives it`);
  add('Scale', `${M.scale.ticks.length ? `${P.scaleWords(M)} ${M.u.label}` : ''} for the whole file`);
  const pending = (Array.isArray(d.days) ? d.days : []).filter((x) => x && typeof x.date === 'string' && !M.days.has(x.date));
  for (const x of pending) add('Next day', `${isoDate(x.date)}, not in this file (${typeof x.note === 'string' && x.note ? x.note : `no prices for ${x.date}`})`);
  add('Appliances', D.note ? `the built-in list of ${int(D.list.length)}, or data/appliances.json as read` : `data/appliances.json, ${count(D.list.length, 'row')}`);
  add('Ask table', Array.isArray(d.ask) && d.ask.length ? count(d.ask.length, 'row') : 'none');
}

let aboutFrom = null;
function about(open) {
  $('about').hidden = !open;
  for (const id of ['head', 'main', 'band']) $(id).inert = open;   // holds Tab inside the sheet
  $('about-list').parentElement.hidden = !D;                       // with no usable file, its prose stands
  if (open) { aboutFrom = document.activeElement; $('about-close').focus(); } else if (aboutFrom) aboutFrom.focus();
}
$('stamp').onclick = () => about(true);
$('about-close').onclick = $('about-close-2').onclick = () => about(false);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('about').hidden) about(false); });

/* Reads come fresh off disk, so reading again when the page comes back into view is what makes an app opened this
   morning show this morning's prices. Snuggery fires the same event when a Shortcut delivers new data while the
   app is open, which is why a new file redraws in place, keeping the appliance, the interval and the scroll.
   Hidden, nothing runs: the clock's timeout is cleared. */
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(tick); tick = 0; } else load(); });
window.addEventListener('pagehide', () => { clearTimeout(tick); tick = 0; });
// A new width (a phone turned on its side) redraws the drawing alone.
let lastW = 0;
new ResizeObserver(() => {
  const w = $('pane').clientWidth;
  if (D && w !== lastW) { lastW = w; drawLanding(); }
}).observe($('pane'));
matchMedia(LANDSCAPE).addEventListener('change', () => { if (D) drawLanding(); });

// The test hook (tools/shoot.mjs): inert, nothing in the app calls it.
window.__ph = {
  ready: () => !!D && !!$('stair'),
  chosen: () => chosen,
  appliance: () => appliance,
  timer: () => tick !== 0,
  staircase: () => L && { G: { ...L.G, xs: undefined }, xs: L.G.xs, n: L.n, past: L.past, land: L.land, mean: L.mean, nowX: L.nowX,
    grid: L.grid.map((g) => g.label), labels: L.labels.map((l) => l.text), dropped: L.dropped, inPlot: L.inPlot.map((l) => l.text), mids: L.mids, hours: L.hours },
};

load();
