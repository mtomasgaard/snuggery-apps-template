/* Outdoor Window, a Snuggery mini-app. The look is ART.md (the house system, Template/HOUSE.md, and the
 * Shutters); every number, date and span on screen is written by js/units.js, the scores by js/score.js,
 * the Shutters by js/shutters.js.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS APP READS
 * ---------------------------------------------------------------------------
 * Two files, both under ./data/, both read again every time the app comes back
 * into view. Nothing else. No network: a mini-app in Snuggery cannot reach it,
 * and this one does not want to.
 *
 *   data/snapshot.json   the forecast. Rewritten by a Shortcut on the phone.
 *   data/rules.json      what counts as a good hour. Written by the person,
 *                        in Snuggery's Options, then App Files.
 *
 * ---------------------------------------------------------------------------
 * data/snapshot.json: THE RAW OPEN-METEO REPLY, AS IT ARRIVES
 * ---------------------------------------------------------------------------
 * This app is unusual in the template: it has no GitHub Action behind it. The
 * Shortcut asks the phone for its own location, fetches the forecast for that
 * spot, and hands the reply straight over. So the shape below is not ours to
 * choose; it is Open-Meteo's forecast response, written here unmodified:
 *
 * {
 *   "latitude": 42.36, "longitude": -71.06,
 *   "generationtime_ms": 0.22,        // how long THEIR server took. NOT a clock.
 *   "utc_offset_seconds": -14400,     // the forecast place's offset. Load-bearing.
 *   "timezone": "America/New_York",
 *   "timezone_abbreviation": "GMT-4",
 *   "elevation": 16.0,
 *   "current":  { "time": "2026-09-21T05:15", "interval": 900,
 *                 "temperature_2m": 13.7, "is_day": 0 },
 *   "hourly_units": { "temperature_2m": "°C", "wind_gusts_10m": "km/h", ... },
 *   "hourly": {                       // 48 steps, from the current hour on
 *     "time":                     ["2026-09-21T05:00", ...],   // LOCAL wall clock
 *     "temperature_2m":           [13.8, ...],
 *     "precipitation_probability":[3, ...],      // %
 *     "precipitation":            [0.0, ...],    // mm
 *     "wind_gusts_10m":           [27.7, ...],   // km/h
 *     "dew_point_2m":             [12.7, ...],
 *     "cloud_cover":              [100, ...],    // %, shown but never scored
 *     "is_day":                   [0, ...]       // 1 between sunrise and sunset
 *   },
 *   "daily": { "time": ["2026-09-21", ...],
 *              "sunrise": ["2026-09-21T06:30", ...],
 *              "sunset":  ["2026-09-21T18:43", ...] },
 *
 *   // Everything below is OPTIONAL, and absent from a phone-delivered file.
 *   "schema": 1,
 *   "generatedAt": "2026-09-21T09:22:13Z",   // ISO 8601 UTC
 *   "demoPlace": "Boston Common",
 *   "ask": [ { "date": "2026-09-21", "time": "07:00", "pass": "yes",
 *              "score": 75, "tempC": 13.3, "rainChancePct": 0, ... } ]
 * }
 *
 * WHERE THE HEADER'S STAMP COMES FROM, precisely, in this order:
 *   1. `generatedAt`, if it is a string that parses. The demo script writes it;
 *      a Shortcut can add it with one *Set Dictionary Value* action.
 *   2. `current.time`: Open-Meteo's own "now", rounded to the quarter hour,
 *      read as local wall clock and shifted by `utc_offset_seconds`. This is
 *      why the fetch asks for `&current=`: without it the file carries no
 *      moment at all. Shown as "Updated about HH:MM".
 *   3. `hourly.time[0]` shifted the same way: the first hour of the forecast.
 *      Shown as "Forecast from HH:MM", because it is a lower bound on the age,
 *      not the age.
 * `generationtime_ms` is never used for this. It is a duration in
 * milliseconds (how long their server spent computing), and reading it as a
 * timestamp is the obvious wrong turn, so it is named here to close it off.
 *
 * WHAT ASK CAN AND CANNOT SEE. Snuggery's *Ask About This Data* reads one key:
 * a top-level `ask` array. The committed demo has one; a file delivered by the
 * Shortcut does not, because Shortcuts cannot build 48 scored rows without a
 * Repeat loop. The app itself never needs `ask` (it scores the hours below),
 * but Ask does. PROMPT.md says this plainly and gives the optional recipe.
 *
 * ---------------------------------------------------------------------------
 * data/rules.json: WHAT COUNTS AS A GOOD HOUR
 * ---------------------------------------------------------------------------
 * {
 *   "schema": 1,
 *   "activity": "A walk outside",     // heads the Windows and Rules panes
 *   "maxRainChancePct": 30,           // hourly.precipitation_probability ≤ this
 *   "maxPrecipMm": 0.2,               // hourly.precipitation ≤ this
 *   "maxGustKmh": 35,                 // hourly.wind_gusts_10m ≤ this
 *   "temperatureC": { "min": 2, "max": 26 },
 *   "dewPointC":    { "min": -10, "max": 17 },
 *   "daylight": "daylight",           // "any" | "daylight" | "golden", read ignoring case
 *   "goldenHourMinutes": 75,          // the width of the golden band, each end
 *   "minWindowHours": 2               // shorter runs of good hours are not windows
 * }
 * Any rule may be left out; a missing rule is simply not applied. The numbers
 * are in whatever units the snapshot uses; the shipped fetch is °C and km/h.
 * How an hour is scored is in js/score.js's header comment.
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON SAFETY, since this file renders data somebody else's server wrote:
 * nothing from either JSON file ever reaches markup as markup. Every value goes
 * in through textContent (the el() helper below) or an attribute. innerHTML is
 * never assigned. Keep it that way.
 * ---------------------------------------------------------------------------
 */

import { scoreHours, findWindows, sunTimes, isNumber, localToEpoch, lightRule } from './js/score.js';
import { int, count, list, num, withUnit, spokenValue, coords, meters, stampWhen, full, span, zone, placeClock, placeDate, placeFull, placeDays, placeSpan, spokenHour } from './js/units.js';
import { model as shutterModel, draw as drawSvg, hourAt, nameOf, caption as shutterCaption, describe } from './js/shutters.js';

const SNAPSHOT_URL = './data/snapshot.json';
const RULES_URL = './data/rules.json';
const STALE_HOURS = 6;        // the stock's threshold, unchanged (owner call 1)
const LABEL_FONT = '400 10.5px "Ysabeau Office", system-ui, sans-serif';

/* The hourly variables the scoring needs. `cloud_cover` is shown, never
   scored, so it is not in this list: a file without it still works. */
const REQUIRED_HOURLY = [
  'temperature_2m',
  'precipitation_probability',
  'precipitation',
  'wind_gusts_10m',
  'dew_point_2m',
  'is_day'
];

/* Used only when data/rules.json is missing or unreadable, and the app says
   on screen when it has fallen back to them. */
const DEFAULT_RULES = {
  activity: 'A walk outside',
  maxRainChancePct: 30,
  maxPrecipMm: 0.2,
  maxGustKmh: 35,
  temperatureC: { min: 2, max: 26 },
  dewPointC: { min: -10, max: 17 },
  daylight: 'daylight',
  goldenHourMinutes: 75,
  minWindowHours: 2
};

const TABS = [['windows', 'Windows'], ['hours', 'Hours'], ['rules', 'Rules']];

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let S = null;                       // the forecast as drawn (derive())
let texts = { snap: null, rules: null };   // both files as last read, to tell a new file from the same one
let tab = 'windows';                // the pane; the app stores nothing
let chosen = 0;                     // the chosen hour, an index into S.all
let labelW = 0;                     // the Shutters' label column, measured in the face
let M = null, shut = null;          // the Shutters' model and drawing on the open pane

/** One polite live region for sentences (HOUSE 4.9): never twice for one event. */
function announce(text) {
  const n = $('live');
  n.textContent = '';
  setTimeout(() => { n.textContent = text; }, 60);
}

/* ── reading the files ────────────────────────────────────────────────── */

async function readText(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `could not be read (HTTP ${res.status}).` };
    return { text: await res.text() };
  } catch (err) {
    return { error: `could not be read (${err.message || err}).` };
  }
}

/** What is wrong with a parsed forecast, as whole sentences, or [] when it is usable. */
function validate(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return ['data/snapshot.json is not a JSON object.'];
  if (s.error) {
    const reason = String(s.reason || 'no reason given').replace(/\.\s*$/, '');
    return [`The weather service refused the request: ${reason}. Check the latitude and longitude the Shortcut passes.`];
  }
  const h = s.hourly;
  if (!h || typeof h !== 'object' || !Array.isArray(h.time) || !h.time.length) return ['data/snapshot.json has no hourly.time, so it is not a forecast.'];
  const out = [];
  for (const name of REQUIRED_HOURLY) {
    const series = h[name];
    if (!Array.isArray(series)) out.push(`data/snapshot.json is missing hourly.${name}: add it to the hourly list in the address the Shortcut fetches.`);
    else if (series.length !== h.time.length) out.push(`data/snapshot.json has ${count(series.length, 'value')} of hourly.${name} for ${count(h.time.length, 'hour')}.`);
  }
  if (!isNumber(s.utc_offset_seconds)) out.push('data/snapshot.json has no utc_offset_seconds, so its local times cannot be put on a clock: add timezone=auto to the address.');
  return out;
}

function parseSnapshot(r) {
  if (r.error) return { problems: [`data/snapshot.json ${r.error}`] };
  let d;
  try { d = JSON.parse(r.text); } catch { return { problems: ['data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing.'] }; }
  const problems = validate(d);
  return problems.length ? { problems } : { value: d };
}

/** The rules file, or the end of the sentence that says why it cannot be used. */
function parseRules(r) {
  if (r.error) return { problem: `it ${r.error}` };
  let d;
  try { d = JSON.parse(r.text); } catch { return { problem: 'it is not valid JSON; a trailing comma or a missing quote will do it, and JSON allows neither, nor comments.' }; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { problem: 'it is not a JSON object.' };
  return { value: d };
}

/* The stamp, and how sure we are of it. See the header comment. */
function timestampOf(snapshot, offset) {
  if (typeof snapshot.generatedAt === 'string') {
    const ms = Date.parse(snapshot.generatedAt);
    if (!Number.isNaN(ms)) return { ms, kind: 'exact' };
  }
  const current = snapshot.current && snapshot.current.time;
  if (typeof current === 'string') {
    const ms = localToEpoch(current, offset);
    if (!Number.isNaN(ms)) return { ms, kind: 'about' };
  }
  const first = Array.isArray(snapshot.hourly && snapshot.hourly.time) ? snapshot.hourly.time[0] : null;
  if (typeof first === 'string') {
    const ms = localToEpoch(first, offset);
    if (!Number.isNaN(ms)) return { ms, kind: 'from' };
  }
  return null;
}

const unitOr = (v, d) => (typeof v === 'string' && v ? v : d);

/** Everything the panes draw, scored from the two files at the phone's present. */
function derive(snap, rules, rulesProblem) {
  const offset = snap.utc_offset_seconds, hu = snap.hourly_units || {};
  const temp = unitOr(hu.temperature_2m, '°C');
  const units = { temp, rain: unitOr(hu.precipitation_probability, '%'), precip: unitOr(hu.precipitation, 'mm'), gust: unitOr(hu.wind_gusts_10m, 'km/h'), dew: unitOr(hu.dew_point_2m, temp), cloud: unitOr(hu.cloud_cover, '%') };
  const all = scoreHours(snap, rules), now = Date.now();
  // Hours that have already happened are dropped from the windows and the table: a file fetched at local
  // midnight carries the whole day, and a window that closed this morning is not an answer to "when can I go
  // out". The Shutters still draw them, faint. When every hour has ended, every hour is used.
  let rows = all.filter((row) => Number.isFinite(row.epoch) && row.epoch + 3600000 > now), ranOut = false;
  if (rows.length === 0) { rows = all; ranOut = true; }
  return { snap, rules, rulesProblem, offset, units, all, rows, ranOut, now,
    windows: findWindows(rows, rules.minWindowHours), stamp: timestampOf(snap, offset), sun: sunTimes(snap, offset),
    place: typeof snap.demoPlace === 'string' ? snap.demoPlace : null, hasAsk: Array.isArray(snap.ask) && snap.ask.length > 0 };
}

/** The hour chosen when nothing was: the first hour of the next window, or the best-scoring hour. */
const defaultHour = (D) => (D.windows.length ? D.windows[0].start.index : D.rows.reduce((a, b) => (b.score > a.score ? b : a), D.rows[0]).index);

async function load() {
  const [a, b] = await Promise.all([readText(SNAPSHOT_URL), readText(RULES_URL)]);
  const rulesText = b.text != null ? b.text : `error ${b.error}`;
  if (S && a.text != null && a.text === texts.snap && rulesText === texts.rules) { $('notice').hidden = true; refresh(); return; }
  const P = parseSnapshot(a);
  if (P.problems) return fail(P.problems);
  const R = parseRules(b), before = S, was = texts, hourStamp = S ? S.all[chosen].stamp : null;
  const D = derive(P.value, R.value || DEFAULT_RULES, R.problem || null);
  try { await document.fonts.load(LABEL_FONT); } catch { /* measured in the fallback face */ }
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = LABEL_FONT;
  labelW = D.all.length && D.all[0].checks.length ? Math.ceil(Math.max(...D.all[0].checks.map((c) => ctx.measureText(nameOf(c)).width))) + 8 : 0;
  S = D;
  texts = { snap: a.text, rules: rulesText };
  $('notice').hidden = true;
  const keep = hourStamp == null ? -1 : S.all.findIndex((row) => row.stamp === hourStamp);
  chosen = keep >= 0 ? keep : defaultHour(S);
  if (!before) buildTabs();
  const top = $('main').scrollTop;
  render();
  if (before) {
    $('main').scrollTop = top;
    announce(a.text !== was.snap ? `New forecast${S.stamp ? `, updated ${stampWhen(S.stamp.ms)}` : ''}.` : 'The rules were read again from data/rules.json.');
  }
}

/** The same two files on a return: the present moved, so the stamp is written again, and the panes are drawn
 *  again only when an hour has ended since (the Shutters' faint hours, the table's first row). */
function refresh() {
  const D = derive(S.snap, S.rules, S.rulesProblem);
  if (D.ranOut === S.ranOut && D.rows[0].index === S.rows[0].index) { S.now = D.now; stamp(); return; }
  S = D;
  const top = $('main').scrollTop;
  render();
  $('main').scrollTop = top;
}

/** A problem with the forecast is a sentence on a plate (HOUSE 4.9). A broken replacement keeps the forecast
 *  that was showing, the stamp, the pane and the scroll, and says so; Close puts the plate away. */
function fail(problems) {
  const box = $('notice');
  box.replaceChildren();
  if (S) {
    const x = el('button', 'textkey', 'Close');
    x.type = 'button';
    x.onclick = () => { box.hidden = true; };
    box.append(el('p', null, `A new data/snapshot.json arrived and cannot be used. ${problems.join(' ')} Still showing the forecast ${S.stamp ? `updated ${stampWhen(S.stamp.ms)}` : 'that was open'}.`), x);
    box.classList.add('kept');
  } else {
    $('stamp').textContent = 'No usable forecast';
    $('tabs').hidden = true;
    $('pane').replaceChildren();
    $('capline').textContent = '';
    box.classList.remove('kept');
    for (const p of problems) box.append(el('p', null, p));
    box.append(el('p', 'notice-lines', 'In Snuggery, Options, then App Files shows what the file holds.'));
  }
  box.hidden = false;
}

/* ── the stamp and the tabs ───────────────────────────────────────────── */

/** When the file was made, on the phone's clock, in words; stale and ran out are sentences in ink, never a color. */
function stamp() {
  const s = S.stamp, node = $('stamp');
  if (!s) { node.replaceChildren(el('span', 'lead', 'Undated file.')); return; }
  const words = s.kind === 'exact' ? `Updated ${stampWhen(s.ms)}` : s.kind === 'about' ? `Updated about ${stampWhen(s.ms)}` : `Forecast from ${stampWhen(s.ms)}`;
  const now = Date.now(), end = S.all[S.all.length - 1].epoch + 3600000;
  const lead = S.ranOut && Number.isFinite(end) ? `Forecast ran out ${span(now - end)} ago.` : now - s.ms > STALE_HOURS * 3600000 ? 'Stale.' : null;
  node.replaceChildren(...(lead ? [el('span', 'lead', lead), ` ${words}`] : [words]));
}

/** The tabs, built after the forecast parses, so the camera's wait for Hours proves the data is in (B7). */
function buildTabs() {
  const nav = $('tabs');
  nav.replaceChildren();
  TABS.forEach(([key, name], i) => {
    const b = el('button', null, name);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'pane');
    b.id = `tab-${key}`;
    b.dataset.key = key;
    b.onclick = () => choosePane(key);
    b.onkeydown = (ev) => {
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[ev.key];
      if (j == null) return;
      ev.preventDefault();
      const k = TABS[(j + TABS.length) % TABS.length][0];
      choosePane(k);
      $(`tab-${k}`).focus();
    };
    nav.append(b);
  });
  nav.hidden = false;
}
function markTabs() {
  for (const b of $('tabs').children) {
    const on = b.dataset.key === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) $('pane').setAttribute('aria-labelledby', b.id);
  }
}
/** A pane chosen: the focused tab says its own name, so the live region adds nothing (HOUSE 4.9). */
function choosePane(key) {
  if (key === tab) return;
  tab = key;
  render();
  $('main').scrollTop = 0;
}

/* ── the panes ────────────────────────────────────────────────────────── */

function render() {
  const pane = $('pane');
  pane.replaceChildren(...statements());
  M = null;
  shut = null;
  if (tab === 'hours') hoursPane(pane);
  else if (tab === 'rules') rulesPane(pane);
  else windowsPane(pane);
  if (pane.querySelector('.sh')) drawShutters();
  markTabs();
  stamp();
  caption();
  aboutList();
}

/** Sentences on the page, the first words at 620, at the head of every pane. */
function statements() {
  const out = [], say = (lead, text) => { const p = el('p', 'statement'); p.append(el('b', null, lead), ` ${text}`); return p; };
  // one line at 390 px, so the Shutters lead the pane (the stamp says when it ran out); the way to a forecast of
  // one's own closes the Windows pane
  if (S.place) out.push(say('Example forecast:', `${S.place}, ${placeDays(S.all[0].epoch, S.all[S.all.length - 1].epoch, S.offset)}.`));
  else if (S.ranOut) {
    out.push(say('Every hour in this file has ended,', 'so this is history, not a forecast. Run the Shortcut that refreshes the app.'));
  }
  if (S.rulesProblem) out.push(say('data/rules.json could not be used:', `${S.rulesProblem} The built-in rules are in use; the Rules pane shows them.`));
  else if (!S.all[0].checks.length) out.push(say('No rule is in use,', 'so every hour clears and scores 0. The Rules pane says how to add one.'));
  return out;
}

const activity = () => (typeof S.rules.activity === 'string' && S.rules.activity.trim() ? S.rules.activity : 'Outdoors');

/** The pane's heading: the reader's own activity, and under it the place. */
function title(withPlace) {
  const t = el('div', 'title');
  t.append(el('h2', null, activity()));
  if (withPlace) {
    const s = S.snap, at = isNumber(s.latitude) && isNumber(s.longitude) ? coords(s.latitude, s.longitude) : null;
    const line = [S.place, at].filter(Boolean).join(', ');
    if (line) t.append(el('p', null, line));
  }
  return t;
}

/** The Shutters and their readout (ART.md section 1): the hours' slider, a tap, a sideways drag, the keys. */
function shuttersBlock() {
  const wrap = el('div', 'shw');
  const box = $('sh-tpl').content.firstElementChild.cloneNode(true);
  box.id = 'sh';
  box.setAttribute('aria-valuemax', String(S.all.length - 1));
  const ro = el('div', 'ro'), when = el('p', 'ro-when');
  when.append(el('b', null, ''), el('span', null, ''));
  ro.append(when, el('p', 'ro-vals', ''));
  wrap.append(box, ro);
  wireSlider(box);
  return wrap;
}

function drawShutters() {
  const pane = $('pane'), box = pane.querySelector('.sh');
  if (!box) return;
  const cs = getComputedStyle(pane), ctx = document.createElement('canvas').getContext('2d');
  ctx.font = LABEL_FONT;
  const width = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  M = shutterModel({ rows: S.all, windows: S.windows, offset: S.offset, now: S.now, width, label: labelW, ranOut: S.ranOut, measure: (t) => ctx.measureText(t).width });
  shut = drawSvg(box.querySelector('svg'), M);
  $('sh-desc').textContent = describe(M, S.all, S.windows, S.offset);
  show(chosen);
  holdReadout(pane.querySelector('.ro'));
  caption();
}

/** The readout is a fixed block (ART.md section 3): its first line is held at the tallest it gets for any
    hour of this file at this width, measured once per draw, so nothing under it moves while scrubbing. */
function holdReadout(ro) {
  if (!ro) return;
  const when = ro.querySelector('.ro-when'), b = when.querySelector('b'), span = when.querySelector('span');
  const keep = [b.textContent, span.textContent];
  when.style.minHeight = '';
  let h = 0;
  for (const row of S.all) {
    b.textContent = `${placeDate(row.epoch, S.offset)}, ${placeClock(row.epoch, S.offset)}`;
    span.textContent = ` ${isNow(row) ? 'now, ' : ''}${verdict(row)}`;
    h = Math.max(h, when.offsetHeight);
  }
  [b.textContent, span.textContent] = keep;
  when.style.minHeight = `${h}px`;
}

const isPast = (row) => !S.ranOut && row.epoch + 3600000 <= S.now;
/** The hour the phone's clock is in: the readout and the slider's value say `now` for it. */
const isNow = (row) => !S.ranOut && S.now >= row.epoch && S.now < row.epoch + 3600000;
const verdict = (row) => `${row.pass ? 'clears every rule' : `ruled out by ${list(row.blocked)}`}, score ${row.score}`;
const valueText = (row) => `${spokenHour(row.epoch, S.offset)}${isNow(row) ? ', now' : ''}: ${verdict(row)}`;

/** An hour's values, at the data's own precision (B10, B17), with the sunrise or sunset inside the hour. */
function values(row, speak) {
  const u = S.units, out = [];
  const add = (word, v, unit) => out.push(`${word} ${speak ? spokenValue(v, unit) : withUnit(v, unit) ?? 'not in the file'}`);
  add('air', row.temp, u.temp);
  add('rain chance', row.rainPct, u.rain);
  add('rainfall', row.precip, u.precip);
  add('gusts', row.gust, u.gust);
  add('dew point', row.dew, u.dew);
  if (isNumber(row.cloud)) add('cloud', row.cloud, u.cloud);
  out.push(row.light === 'golden' ? 'golden hour' : row.light === 'day' ? 'daylight' : 'night');
  const sun = S.sun.get(row.stamp.slice(0, 10));
  for (const [word, ms] of sun ? [['sunrise', sun.rise], ['sunset', sun.set]] : []) if (ms >= row.epoch && ms < row.epoch + 3600000) out.push(`${word} ${placeClock(ms, S.offset)}`);
  if (isPast(row)) out.push('already past');
  return out.join(', ');
}

/** Hour i shown: the Shutters' column and head, the readout, the slider's value, the table's row. In place. */
function show(i) {
  chosen = i;
  const row = S.all[i];
  if (shut) shut.place(i);
  const ro = $('pane').querySelector('.ro');
  if (ro) {
    ro.querySelector('b').textContent = `${placeDate(row.epoch, S.offset)}, ${placeClock(row.epoch, S.offset)}`;
    ro.querySelector('.ro-when span').textContent = ` ${isNow(row) ? 'now, ' : ''}${verdict(row)}`;
    ro.querySelector('.ro-vals').textContent = values(row, false);
  }
  const box = $('sh');
  if (box) { box.setAttribute('aria-valuenow', String(i)); box.setAttribute('aria-valuetext', valueText(row)); }
  for (const tr of $('pane').querySelectorAll('tr.on')) tr.classList.remove('on');
  for (const tr of $('pane').querySelectorAll(`tr[data-i="${i}"]`)) tr.classList.add('on');
}

/** A tap on the Shutters: the hour, said once; on the Hours pane the table scrolls until its row is in view. */
function tapped(i) {
  show(i);
  const row = S.all[i];
  announce(`${valueText(row)}. ${values(row, true)}.`);
  if (tab !== 'hours') return;
  const rows = $('pane').querySelectorAll(`tr[data-i="${i}"]`), main = $('main');
  if (!rows.length) return;
  const top = rows[0].getBoundingClientRect().top, bottom = rows[rows.length - 1].getBoundingClientRect().bottom, m = main.getBoundingClientRect();
  if (bottom > m.bottom - 8) main.scrollTop += bottom - m.bottom + 8;
  else if (top < m.top + 8) main.scrollTop += top - m.top - 8;
}

/** The pointers down on the page, so a second finger on the Shutters reads as a pinch and never as a scrub. */
const fingers = new Set();
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, (e) => fingers.delete(e.pointerId), true);

/**
 * The slider's input. A tap picks the hour under the finger; a drag that is mostly sideways moves the chosen
 * hour with the finger, drawn on the next animation frame (the house scrub: the head, the readout and the
 * value show the hour under the finger on every frame); a vertical swipe that starts here scrolls the pane
 * (touch-action: pan-y pinch-zoom) and picks nothing; a second finger is a pinch, which zooms the page. A tap is taken in the click that follows the pointer's lift, so a
 * table row that the tap scrolls under the finger never receives that click; a click with no pointer tap
 * before it (VoiceOver's press) picks nothing. The arrow keys move an hour, Page Up and Page Down six, Home
 * and End to the ends; a focused slider says its own value, so the keys add no sentence.
 */
function wireSlider(box) {
  let start = null, scrub = false, wanted = null, frame = 0, tap = null;
  const xOf = (e) => e.clientX - box.querySelector('svg').getBoundingClientRect().left;
  const flush = () => { if (frame) cancelAnimationFrame(frame); frame = 0; if (wanted != null && wanted !== chosen) show(wanted); };
  box.addEventListener('pointerdown', (e) => {
    fingers.add(e.pointerId);
    if (fingers.size > 1) {   // a second finger: a pinch, which the page zooms (touch-action: pan-y pinch-zoom)
      if (scrub) flush();
      start = null; scrub = false; tap = null;
      if (shut) shut.press(false);
      return;
    }
    if (e.button > 0 || !M) return;
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
    wanted = hourAt(M, xOf(e), true);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (wanted !== chosen) show(wanted); });
  });
  const end = (e, canceled) => {
    if (!start || e.pointerId !== start.id) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y), was = scrub;
    start = null;
    scrub = false;
    if (shut) shut.press(false);
    if (was) { flush(); return; }
    if (!canceled && moved < 10) tap = { x: e.clientX, at: e.timeStamp };
  };
  box.addEventListener('pointerup', (e) => end(e, false));
  box.addEventListener('pointercancel', (e) => end(e, true));
  box.addEventListener('click', (e) => {
    const t = tap;
    tap = null;
    if (!t || e.timeStamp - t.at > 800 || !M) return;
    const i = hourAt(M, t.x - box.querySelector('svg').getBoundingClientRect().left);
    if (i != null) tapped(i);
  });
  box.addEventListener('keydown', (e) => {
    const n = S.all.length, step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 6, PageDown: -6 }[e.key];
    const i = step != null ? chosen + step : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (i == null) return;
    e.preventDefault();
    show(Math.max(0, Math.min(n - 1, i)));
  });
}

const maxOf = (rows, key) => { const v = rows.map((r) => r[key]).filter(isNumber); return v.length ? Math.max(...v) : null; };
const hoursOf = (w) => placeSpan(w.start.epoch, w.end.epoch + 3600000, S.offset);
const facts = (pairs, cls = 'facts') => { const dl = el('dl', cls); for (const [k, v] of pairs) dl.append(el('dt', null, k), el('dd', null, v)); return dl; };

function windowsPane(pane) {
  pane.append(title(true), shuttersBlock());
  const sec = el('section', 'sec'), u = S.units, off = S.offset;
  if (!S.windows.length) {
    const need = isNumber(S.rules.minWindowHours) && S.rules.minWindowHours > 0 ? Math.ceil(S.rules.minWindowHours) : 1;
    const best = S.rows.reduce((a, b) => (b.score > a.score ? b : a), S.rows[0]);
    sec.append(el('h2', null, S.ranOut ? 'No window in this file' : `No window in the next ${count(S.rows.length, 'hour')}`),
      el('p', null, `Nothing here clears every rule for ${count(need, 'hour')} together.`),
      el('p', 'note', `The closest is ${placeDate(best.epoch, off)}, ${placeClock(best.epoch, off)}, scoring ${best.score}${best.blocked.length ? `, ruled out by ${list(best.blocked)}` : ''}.`));
    pane.append(sec, ...ownForecast());
    return;
  }
  const w = S.windows[0], fig = el('p', 'fig');
  fig.append(el('b', null, hoursOf(w)), el('span', null, `${placeDate(w.start.epoch, off)}, ${count(w.hours, 'hour')}, best score ${int(w.best)}`));
  const or = (v, unit) => withUnit(v, unit) ?? 'not in the file';
  const pairs = [['Warmest', or(maxOf(w.rows, 'temp'), u.temp)], ['Highest chance of rain', or(maxOf(w.rows, 'rainPct'), u.rain)], ['Most rainfall', or(maxOf(w.rows, 'precip'), u.precip)],
    ['Strongest gust', or(maxOf(w.rows, 'gust'), u.gust)], ['Highest dew point', or(maxOf(w.rows, 'dew'), u.dew)]];
  const sun = S.sun.get(w.end.stamp.slice(0, 10));
  if (sun && sun.set > w.end.epoch && sun.set < w.end.epoch + 3600000) pairs.push(['Sunset', placeClock(sun.set, off)]);
  sec.append(el('h2', null, S.ranOut ? 'First window in this file' : 'Next window'), fig, facts(pairs));
  pane.append(sec);
  if (S.windows.length > 1) {
    const later = el('section', 'sec');
    later.append(el('h2', null, 'After that'), facts(S.windows.slice(1).map((x) => [`${placeDate(x.start.epoch, off)}, ${hoursOf(x)}`, `${count(x.hours, 'hour')}, best score ${int(x.best)}`]), 'facts wins'));
    pane.append(later);
  }
  pane.append(...ownForecast());
}

/** Under the example forecast's Windows pane: how to get one's own (the statement at the head is one line). */
function ownForecast() {
  if (!S.place) return [];
  const sec = el('section', 'sec');
  sec.append(el('p', 'note', 'Build the Shortcut in PROMPT.md and the app shows where you are.'));
  return [sec];
}

function hoursPane(pane) {
  pane.append(title(true), shuttersBlock());
  const u = S.units, off = S.offset, table = el('table', 'hours'), head = el('tr');
  const th = (word, unit) => { const c = el('th', null, word); c.scope = 'col'; if (unit) c.append(el('br'), unit); return c; };
  head.append(th('Time'), th('Light'), th('Air', u.temp), th('Rain chance', u.rain), th('Rainfall', u.precip), th('Gusts', u.gust), th('Dew point', u.dew));
  const thead = el('thead');
  thead.append(head);
  table.append(thead);
  const inWindow = new Set(S.windows.flatMap((w) => w.rows.map((r) => r.index)));
  let body = null, day = null;
  for (const row of S.rows) {
    const d = placeDate(row.epoch, off);
    if (d !== day) {
      day = d;
      body = el('tbody');
      const tr = el('tr', 'day'), c = el('th', null, d);
      c.colSpan = 7;
      c.scope = 'rowgroup';
      tr.append(c);
      body.append(tr);
      table.append(body);
    }
    const cls = `h${row.pass ? ' ok' : ' has-why'}${inWindow.has(row.index) ? ' win' : ''}${row.index === chosen ? ' on' : ''}`;
    const tr = el('tr', cls);
    tr.dataset.i = row.index;
    const cell = (text, c) => tr.append(el('td', c, text));
    cell(placeClock(row.epoch, off), 't');
    cell(row.light === 'golden' ? 'golden' : row.light === 'day' ? 'day' : 'night', 'lt');
    for (const v of [row.temp, row.rainPct, row.precip, row.gust, row.dew]) cell(num(v) ?? '–');
    body.append(tr);
    if (!row.pass) {
      const why = el('tr', `why${inWindow.has(row.index) ? ' win' : ''}${row.index === chosen ? ' on' : ''}`), c = el('td', null, `ruled out by ${list(row.blocked)}`);
      why.dataset.i = row.index;
      c.colSpan = 6;
      why.append(el('td'), c);
      body.append(why);
    }
  }
  pane.append(table);
}

function rulesPane(pane) {
  const r = S.rules, u = S.units, all = S.all, n = all.length;
  pane.append(title(false));
  const dl = el('dl', 'rules');
  const outOf = (key) => all.filter((h) => h.checks.some((c) => c.key === key && !c.ok)).length;
  const tally = (key) => ` Rules out ${int(outOf(key))} of ${count(n, 'hour')}.`;
  const row = (name, limit, note) => { const g = el('div', 'rule'); g.append(el('dt', null, name), el('dd', null, limit), el('dd', 'note', note)); dl.append(g); };
  const given = (key) => (key in r ? ` The file gives ${JSON.stringify(r[key])}, which this app cannot use, so it is not applied.` : ' Left out, so it is not applied.');
  const max = (name, key, ruleKey, unit, what) => {
    const used = isNumber(r[key]);
    row(name, used ? `≤ ${withUnit(r[key], unit)}` : 'Not used', `${key}: ${what}.${used ? tally(ruleKey) : given(key)}`);
  };
  const band = (name, key, ruleKey, unit, what) => {
    const v = r[key], used = v && isNumber(v.min) && isNumber(v.max), half = v && (isNumber(v.min) || isNumber(v.max));
    row(name, used ? `${num(v.min)} to ${withUnit(v.max, unit)}` : half ? 'Not used: needs both min and max' : 'Not used', `${key}: ${what}.${used ? tally(ruleKey) : half ? '' : given(key)}`);
  };
  max('Rain chance', 'maxRainChancePct', 'rain', u.rain, 'the forecast chance of any rain in the hour');
  max('Rainfall', 'maxPrecipMm', 'rainfall', u.precip, 'how much is expected to fall in the hour');
  max('Gusts', 'maxGustKmh', 'gust', u.gust, 'gusts, not the average wind, because gusts are what you feel');
  band('Temperature', 'temperatureC', 'temp', u.temp, 'the air, from min to max');
  band('Dew point', 'dewPointC', 'dew', u.dew, 'muggy above, raw below; a better guide to comfort than temperature alone');
  const light = lightRule(r), mins = isNumber(r.goldenHourMinutes) ? r.goldenHourMinutes : 0;
  const said = 'daylight' in r ? ` The file gives “${String(r.daylight)}”.` : '';
  if (light === 'daylight') row('Light', 'Daylight only', `daylight: “any”, “daylight” or “golden”, read ignoring case.${said}${tally('light')}`);
  else if (light === 'golden') row('Light', `Golden hour, ${withUnit(mins, 'min')}`, `daylight and goldenHourMinutes: within this much of sunrise or sunset, on the hour’s own day.${said}${tally('light')}`);
  else row('Light', 'Any hour', `daylight: “any”, “daylight” or “golden”, read ignoring case.${said || ' Left out, so any hour qualifies.'}`);
  const need = isNumber(r.minWindowHours) && r.minWindowHours > 0 ? Math.ceil(r.minWindowHours) : 1;
  row('Shortest window', count(need, 'hour'), 'minWindowHours: a run of open hours shorter than this is not offered as a window.');
  const sec = el('section', 'sec'), steps = el('ol', 'steps');
  for (const s of ['In Snuggery, Options, then App Files: data/rules.json.', 'Edit the numbers and save; a rule you leave out is not applied.', 'Come back here; the app reads both files again when it returns to the screen.']) steps.append(el('li', null, s));
  sec.append(el('h2', null, 'Changing them'), steps);
  pane.append(dl, sec);
}

/** The caption band's line (HOUSE 4.5), two fixed lines: how to read the pane. */
function caption() {
  const c = $('capline'), u = S.units;
  if (tab === 'windows') { c.textContent = M ? shutterCaption(M) : ''; return; }
  if (tab === 'hours') {
    const air = u.temp === u.dew ? `Air and dew point in ${u.temp}` : `Air in ${u.temp}, dew point in ${u.dew}`;
    c.textContent = `Hours in ${S.place ? `${S.place}’s` : 'the forecast’s'} own time, ${zone(S.offset / 60)}. ${air}, rain chance in ${u.rain}, rainfall in ${u.precip}, gusts in ${u.gust}.`;
    return;
  }
  c.textContent = `${S.rulesProblem ? 'The built-in rules: data/rules.json could not be used.' : 'Read from data/rules.json.'} An hour must clear every rule, in the forecast’s own units.`;
}

/* ── About ────────────────────────────────────────────────────────────── */

function aboutList() {
  const dl = $('about-list'), s = S.snap, n = S.all.length;
  dl.replaceChildren();
  const add = (k, v) => dl.append(el('dt', null, `${k}:`), el('dd', null, v));
  if (S.place) add('Place', `${S.place} (an example)`);
  if (isNumber(s.latitude) && isNumber(s.longitude)) add('Grid point', `${coords(s.latitude, s.longitude)}${isNumber(s.elevation) ? `, ${meters(s.elevation)}` : ''}`);
  add('Time zone', `${typeof s.timezone === 'string' ? `${s.timezone.replace(/_/g, ' ')}, ` : ''}${zone(S.offset / 60)}`);
  add('Forecast', `${placeFull(S.all[0].epoch, S.offset)} to ${placeFull(S.all[n - 1].epoch + 3600000, S.offset)}, ${count(n, 'hour')}`);
  const st = S.stamp;
  if (st) add('Updated', st.kind === 'exact' ? `${full(st.ms)}, from the file’s own time` : st.kind === 'about' ? `about ${full(st.ms)}, the weather service’s time to the quarter hour` : `${full(st.ms)} at the earliest: the forecast’s first hour`);
  else add('Updated', 'not in the file');
  add('Stale after', count(STALE_HOURS, 'hour'));
  add('Rules', S.rulesProblem ? 'built in, because data/rules.json could not be used' : 'data/rules.json');
  add('Ask table', S.hasAsk ? count(s.ask.length, 'row') : 'none: the file came straight from the weather service');
  $('about-ask').textContent = S.hasAsk
    ? 'This file carries an ask table, so Snuggery’s Ask About This Data can answer questions about these hours.'
    : 'This file came straight from the weather service, so it has no ask table, and Snuggery’s Ask has only the raw file to read; PROMPT.md says what to add.';
}

let aboutFrom = null;
function about(open) {
  $('about').hidden = !open;
  for (const id of ['head', 'main', 'band']) $(id).inert = open;   // holds Tab inside the sheet
  $('about-list').parentElement.hidden = !S;                       // with no usable file, its prose stands
  $('about-ask').hidden = !S;
  if (open) { aboutFrom = document.activeElement; $('about-close').focus(); } else if (aboutFrom) aboutFrom.focus();
}
$('stamp').onclick = () => about(true);
$('about-close').onclick = $('about-close-2').onclick = () => about(false);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('about').hidden) about(false); });

/* Reads come fresh off disk, so reading again when the page comes back into view is what makes an app opened
   this morning show this morning's forecast. Snuggery fires the same event when a Shortcut delivers new data
   while the app is open, which is why a new file redraws in place, keeping the pane, the scroll and the hour. */
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
// A new width (a phone turned on its side) redraws the Shutters alone.
let lastW = 0;
new ResizeObserver(() => {
  const w = $('pane').clientWidth;
  if (S && w !== lastW) { lastW = w; drawShutters(); }
}).observe($('pane'));

// The test hook (tools/shoot.mjs): inert, nothing in the app calls it.
window.__ow = {
  ready: () => !!S && !$('tabs').hidden && !!$('pane').firstElementChild,
  pane: () => tab,
  chosen: () => chosen,
  shutters: () => M && { G: M.G, n: M.n, nowAt: M.nowAt, labels: M.labels.map((l) => l.text),
    rules: M.rules.map((r) => ({ key: r.key, name: r.name, out: r.out, blocks: r.blocks, hollows: r.hollows, bars: r.bars })), brackets: M.brackets },
};

load();
