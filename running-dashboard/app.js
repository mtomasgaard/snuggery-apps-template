/* Running Dashboard, a Snuggery mini-app. The look is ART.md (the house system, its pane-app register,
 * Template/HOUSE.md section 11, and the Block).
 *
 * ---------------------------------------------------------------------------
 * SHAPE OF ./data/snapshot.json
 * ---------------------------------------------------------------------------
 * Whatever rewrites this file tomorrow will not have the conversation that
 * built it, so the contract lives here. Everything that changes is in the JSON;
 * this file and style.css should sit untouched for months.
 *
 * {
 *   "schema": 1,                          // bumped only on a breaking change
 *   "generatedAt": "2026-09-13T14:20:00Z",// ISO 8601 UTC, shown in the header
 *   // activities[].zk: kilometers run in Z1–Z5, then below the Z1 floor (six values)
 *   "dataThrough": "2026-09-13",          // date of the newest activity
 *
 *   "athlete": {
 *     "maxHr": 190, "lthr": 170, "restingHr": 48,
 *     "zoneFloors": [114,133,152,162,171],// lower bpm bound of zones 1..5
 *     "vo2maxRunning": 54.0, "weightKg": 70, "heightCm": 180
 *   },
 *
 *   "gear": [                             // catalog; `code` keys activities.
 *     {"code":"RSA","name":"Road shoes A","type":"Shoes",
 *      "since":"2026-02-15","km":412.5,"activities":38,"maxKm":800}
 *   ],                                    // order is stable: it fixes shoe colors
 *
 *   "activities": [                       // oldest first, one row per session
 *     {"id":"demo-0121",                 // whatever the pull gives; never drawn
 *      "d":"2026-09-08",                  // local calendar date
 *      "type":"running",                  // Garmin's own type string
 *      "sport":"run",                     // run|bike|strength|elliptical|walk|row|swim|other
 *      "indoor":false,
 *      "name":"Easy run",
 *      "km":9.0, "min":52.3, "movMin":51.6,     // whole session
 *      "hr":136, "hrMax":152,             // null when the session has no HR
 *      "elev":41, "cal":610,
 *      "z":[1980,1020,96,0,0],            // SECONDS in HR zone 1..5
 *      "g":["RSA","STROLLER"],            // gear codes used, [] if none logged
 *      "race":false,
 *                                         // OPTIONAL, outdoor runs only — the
 *                                         // watch's run/walk detection:
 *      "runKm":8.85, "runMin":50.4, "runHr":137,    // the running inside the session
 *      "walkKm":0.15, "walkMin":1.2, "walkHr":118,  // the walk breaks
 *      "standMin":0.3,
 *      "t":"17:40",                       // local start time, when known
 *                                         // OPTIONAL, sessions newer than
 *                                         // `detailSince` only:
 *      "dt":{"mov":3096,"minHr":78,"cad":172,"maxCad":184,"stride":112,
 *            "gct":262,"vo":8.8,"pwr":265,"maxPwr":410,"np":270,
 *            "te":2.4,"anTe":0,"teLabel":"RECOVERY","load":61,
 *            "modMin":12,"vigMin":0,"elevGain":41,"elevLoss":39,
 *            "maxElev":96,"minElev":58,"bb":-6,"feel":75,"rpe":30,
 *            "maxSpd":3.6},                // Garmin's per-activity summary
 *      "laps":[[1000,349,346,131,140,171,255,5,4,3.2,null], ...]
 *            // per lap: [meters, seconds, moving seconds, avg HR, max HR,
 *            //  cadence, power W, gain m, loss m, max speed m/s,
 *            //  kind: "W" warm-up | "A" work | "R" recovery | "C" cool-down
 *            //        | null for a plain auto-lap]
 *      "note":{"written":"2026-09-08","verdict":"Easy, as asked",
 *              "tone":"good",            // good|warning|serious|critical|neutral
 *              "body":["para", ...]}     // the agent's evaluation of THIS
 *                                        // session, written on the refresh
 *                                        // that first saw it
 *     }
 *   ],
 *   "detailSince": "2026-03-14",          // dt/laps exist from this date on
 *
 *   "garminLoad": [                       // Garmin's own numbers, daily
 *     {"d":"2026-09-13","atl":177,"ctl":122,"status":"PEAKING","vo2":54}
 *   ],                                    // atl = acute (7d) load, ctl = chronic
 *
 *   "sleep": [
 *     {"d":"2026-09-13","score":73,"h":7.13,"deep":19.2,"rem":19.2,
 *      "hrv":72,"stress":25}
 *   ],
 *
 *   "daily": [                            // one wellness summary per day, for Health
 *     {"d":"2026-09-13","steps":11669,"goal":8000,"up":12.9,"down":14.1,
 *      "kcal":2125,"active":416,"activeMin":75,"sedMin":719,"mod":14,"vig":0,
 *      "rhr":49,"minHr":46,"maxHr":147,"stress":26,"bbHigh":69,"bbLow":19,
 *      "spo2":98,"spo2Low":93,"resp":14.6}   // any key may be missing on a day
 *   ],
 *   "weight": [{"d":"2026-09-14","kg":70.2,"bmi":21.7,"fat":14.0}],   // weigh-ins, oldest first
 *   "vo2": [{"d":"2026-09-16","v":54.3}],   // the days Garmin recomputed the estimate;
 *                                           // garminLoad[].vo2 is the fallback when absent
 *
 *   "ask": [                              // flat rows for Snuggery's Ask: never drawn
 *     {"row":"session","date":"2026-09-08","weekday":"Tue","sport":"run","type":"running",
 *      "name":"Easy run","km":9.0,"minutes":51.6,"avgHr":136,"maxHr":152,"pace":"5:44",
 *      "elevM":41,"easyMin":50.0,"moderateMin":1.6,"hardMin":0.0,"load":61,
 *      "gear":"Road shoes A","indoor":false,"race":false},   // one per session, last 60 days
 *     {"row":"week","weekStart":"2026-09-07","runs":6,"km":68.4,"minutes":352,"longestKm":22.1,
 *      "avgHr":146,"load":610,"easyPct":78,"hardPct":9,"walkKm":4.2,"sleepHours":7.4,
 *      "hrv":66,"acuteLoad":420,"chronicLoad":390},              // one per ISO week, newest 52
 *     {"row":"status","date":"2026-09-10","trainingStatus":"PRODUCTIVE",...,
 *      "predictHalf":"1:36:40"}                                  // one, from garminNow
 *   ],
 *
 *   "garminNow": { ... },                 // today's training status / readiness
 *                                         // / race predictions, verbatim
 *
 *   "racecast": {                         // the agent's own race predictions
 *     "updated":"2026-09-10", "kind":"full",          // full | nudge
 *     "basis":{"vo2":54.0,"runKm28":58.4,"longestRunKm90":24.0,
 *              "lastRace":"2026-08-16","lastQuality":"2026-09-09"},
 *     "anchors":[{"date","event","time","pace","note"}],
 *     "predictions":[{"key":"5K","label":"5 km","mine":"21:10",
 *                     "low":"20:45","high":"21:40",
 *                     "confidence":"moderate","why":"..."}],  // mine null = no basis
 *     "summary":"...", "outlook":{"horizon","condition","5K","10K","half"},
 *     "method":["...", ...]
 *   },
 *
 *   "intraday": {                         // the last 24 h from the hourly pull, or null
 *     "pulledAt":"2026-09-13T18:00:00Z", "restingHr":48,
 *     "hr":[[1789236000,66], ...],        // [epoch seconds, bpm], ~2-minute samples
 *     "bb":[[1789236000,71], ...],        // body battery 0–100
 *     "stress":[[1789236000,23], ...]     // 0–100, unmeasured samples dropped
 *   },
 *
 *   "plan": {                             // the agent's plan, rewritten each run
 *     "updated":"2026-09-10", "tone":"good",
 *     "headline":"...", "why":"...",
 *     "goal":{"kind":"race"|"fitness", "text":"...",
 *             "race":{"name","date","distanceKm","start","expect","source"}|null,
 *             "preferences":["nothing new on race day — ..."],
 *             "strength":{"from":"2026-05-24","perWeek":1,"day":"Monday","programme":["..."],"notes":"..."}},
 *     "weeks":[{"start":"2026-09-07","label":"Race week","targetKm":"26–30 km",
 *               "intensity":"easy, then the race",
 *               "sessions":[{"date":"2026-09-08","kind":"easy",   // rest|easy|long|quality|strength|race
 *                            "what":"9 km easy","km":"9","pace":"~5:30","hr":"<150",
 *                            "zones":[55,45,0,0,0],           // planned share of time, %
 *                            "why":"...", "alt":"Fresh: … Normal: … Flat: …"}]}],
 *     "horizon":[{"w":"2026-09-14","km":22,"mix":[92,8,0],  // 26 Mondays; mix = easy/moderate/hard % of time
 *                 "kind":"build"|"hold"|"down"|"race","note":"..."}],
 *     "after":"...", "guardrails":["...", ...]
 *   },
 *
 *   "assessment": {                       // written by the agent on each run
 *     "updated":"2026-09-10",
 *     "verdict":"Ready to race",          // 2–3 words
 *     "tone":"good",                      // good|warning|serious|critical|neutral
 *     "headline":"...", "summary":"...",
 *     "metrics":[{"label":"...","value":"...","note":"..."}],
 *     "sections":[{"title":"...","tone":"...","body":["para", ...],
 *                  "bullets":["...", ...]}]
 *   }
 * }
 *
 * Load-bearing fields: schema, generatedAt, activities[] with d/km/min/z, and
 * athlete.zoneFloors. If any are missing or the wrong type the app says so on
 * screen instead of drawing an empty chart — an expired credential returns an
 * error page that is perfectly valid JSON, and the Shortcut writes it straight
 * over this file.
 *
 * Running distance, pace and heart rate prefer the run-only fields when they
 * are present, so a run-walk session is judged on the running it contained.
 * Sessions without them (treadmill, older data) fall back to the whole-session
 * numbers. Zone time and load always cover the whole session — the zone
 * seconds cannot be split between running and walking.
 *
 * Weekly load is Edwards TRIMP computed here: minutes in zone i weighted by i.
 * It is used instead of Garmin's per-activity training load because Garmin only
 * exposes that for recent activities, and a load curve that starts two thirds of
 * the way through the history is worse than no curve at all.
 */

import { NB, f0, f1, signed, u, si, km as kmU, pct, pace, perKm, span, mmss, ago as agoText, dayMon, date, dowDate, dowDay, month, clock, dayOf, full, spoken } from './js/units.js';
import { RAMP } from './js/palette.js';
import { SCALE, mondayOf, blockWeeks, blockLayout, blockSay, blockCard } from './js/block.js';

const SPORTS = [
  { key: 'run', label: 'Running', color: 'var(--series-1)' },
  { key: 'bike', label: 'Cycling', color: 'var(--series-2)' },
  { key: 'strength', label: 'Strength', color: 'var(--series-3)' },
  { key: 'elliptical', label: 'Elliptical', color: 'var(--series-4)' },
  { key: 'walk', label: 'Hike or walk', color: 'var(--series-6)' },
  { key: 'other', label: 'Other', color: 'var(--series-5)' },
];
const SPORT_FALLBACK = { row: 'other', swim: 'other', other: 'other' };
const ZONES = [1, 2, 3, 4, 5].map((n) => ({ key: 'z' + n, label: 'Zone ' + n, color: `var(--zone-${n})` }));
const SHOE_SLOTS = 8; // categorical color slots in style.css
const AMOUNT = 'var(--amount)';   // every chart of one quantity (ART.md section 2)
const INK = 'var(--ink)';

// Which filters each pane answers to. Anything not listed is hidden there,
// so a control never sits above charts it does not scope.
const PANE_FILTERS = {
  now: [],
  plan: [],
  training: ['time', 'sport', 'gear'],
  health: ['time'],
  sessions: ['time', 'sport', 'gear'],
};

const DAY = 86400000;
const state = {
  tab: 'now',
  weeks: [],          // every ISO-Monday in the data, ascending
  from: 0,
  to: 0,
  sport: 'all',       // 'all' or one SPORTS key
  gear: 'all',
  preset: '1y',       // null while the slider is somewhere custom
  tables: new Set(),
  zoneUnit: 'pct',
  scatterBy: 'stroller',
  activity: null,     // id of the session open on the Sessions pane
};
let DATA = null;
const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const darkMQ = matchMedia('(prefers-color-scheme: dark)');

/* ------------------------------------------------------------------ dates */

const iso = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(s + 'T00:00:00Z');

const localIso = (d) => iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
const pulledMs = () => Date.parse(DATA.pulledAt || DATA.generatedAt);
/** A date, never before the newest data: by default the phone's (race day counts from it). */
const phoneIso = (t = localIso(new Date())) => (DATA.dataThrough > t ? DATA.dataThrough : t);
/** The last day the data saw: the phone's date, never past the pull's, so a window counting back
 *  from it never shows days the data has not seen as days without running. */
function todayIso() {
  const t = phoneIso(), p = phoneIso(localIso(new Date(pulledMs())));
  return t > p ? p : t;
}
const pastPull = () => todayIso() < phoneIso();
/** The present's mark on a chart of weeks (w) or days: `updated` once the phone is past the data. */
const markWord = (w) => ((w ? mondayOf(phoneIso()) > mondayOf(todayIso()) : pastPull()) ? 'updated' : w ? 'now' : 'today');
function weeksBetween(a, b) {
  const out = [];
  for (let t = parse(a).getTime(); t <= parse(b).getTime(); t += 7 * DAY) out.push(iso(new Date(t)));
  return out;
}
const plusDays = (s, n) => iso(new Date(parse(s).getTime() + n * DAY));
function ago(fromStr, toStr) {
  return Math.round((parse(toStr) - parse(fromStr)) / DAY);
}
/** "12 Jan to 4 Oct 2026", the year once when both ends share it. */
const spanDates = (a, b) => (a.slice(0, 4) === b.slice(0, 4) ? `${dayMon(a)} to ${date(b)}` : `${date(a)} to ${date(b)}`);

/* -------------------------------------------------------------- formatting */

const r1 = (v) => Math.round(v * 10) / 10;   // SVG coordinates, never text
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (tag === 'button') n.type = 'button';   // never a form's submit
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ------------------------------------------------- running-only accessors */

// The running inside a session, falling back to the whole session when the
// watch produced no run/walk split (treadmill, or anything that is not a run).
const runKm = (a) => (a.runKm != null ? a.runKm : a.km);
const runMin = (a) => (a.runMin != null ? a.runMin : a.min);
const runHr = (a) => (a.runHr != null ? a.runHr : a.hr);
const walkKm = (a) => a.walkKm || 0;
const hasSplit = (a) => a.runKm != null;

/* ----------------------------------------------------------- remembering */

// Per-device conveniences only: which pane and filters were open last time.
// The slider position is deliberately not stored — it is an index into a
// week list that grows every refresh.
const STORE_KEY = 'running-dashboard.ui.v3';  // v3: the default window became one year
function recall() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (s.tab && PANE_FILTERS[s.tab]) state.tab = s.tab;
    if (s.preset && PRESETS.some((p) => p[0] === s.preset)) state.preset = s.preset;
    if (s.sport === 'all' || SPORTS.some((x) => x.key === s.sport)) state.sport = s.sport;
    if (typeof s.gear === 'string') state.gear = s.gear;
    if (s.zoneUnit === 'pct' || s.zoneUnit === 'min') state.zoneUnit = s.zoneUnit;
    if (s.scatterBy === 'stroller' || s.scatterBy === 'shoe') state.scatterBy = s.scatterBy;
    if (typeof s.activity === 'string') state.activity = s.activity;
  } catch (_) { /* private mode, blocked storage: defaults are fine */ }
}
function remember() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      tab: state.tab, preset: state.preset, sport: state.sport, gear: state.gear,
      zoneUnit: state.zoneUnit, scatterBy: state.scatterBy, activity: state.activity,
    }));
  } catch (_) { /* ignore */ }
}

/* ------------------------------------------- the live region and the card */

/** One polite live region for sentences (HOUSE 4.9): never per move, never twice for one event. */
function announce(text) {
  const n = $('live');
  n.textContent = '';
  setTimeout(() => { n.textContent = text; }, 60);
}
const SVGNS = document.querySelector('svg').namespaceURI;   // the page's own inline marks carry it
const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  return n;
};
const svgText = (attrs, text) => Object.assign(svgEl('text', attrs), { textContent: text });

// The readout card (HOUSE 4.7): one per chart, the house's one card. Chart code hands it an object
// { place, value, unit, rows: [[label, value]…], say? }; it is written as text and updated in place
// while a finger drags, never rebuilt per move.
let openCard = null;
function cardOf(wrap) {
  if (wrap._card) return wrap._card;
  const c = el('div', 'readout');
  c.hidden = true;
  const where = el('div', 'readout-where'), place = el('span');
  const close = el('button', 'readout-close');
  close.setAttribute('aria-label', 'Close');
  const x = $('x-mark').cloneNode(true);
  x.removeAttribute('id');
  x.removeAttribute('hidden');
  close.append(x);
  close.onclick = () => unpin();
  where.append(place, close);
  const value = el('span', 'readout-value'), unit = el('span', 'readout-unit'), rows = el('dl', 'readout-all');
  const main = el('div', 'readout-main');
  main.append(value, unit);
  c.append(where, main, rows);
  wrap.append(c);
  return (wrap._card = { c, place, value, unit, rows });
}
/** Show `card` in `wrap` 12 px clear of the point (ax, ay) or the column at ax: top-left, inset 8 px,
 *  else top-right, else bottom-left, else hung from the chart's foot (over its head if no room below). */
function showCard(wrap, card, ax, ay) {
  const k = cardOf(wrap);
  k.place.textContent = card.place;
  k.value.textContent = card.value == null ? '' : card.value;
  k.unit.textContent = card.unit ? `${NB}${card.unit}` : '';
  const rows = card.rows || [], kids = k.rows.children;
  while (kids.length > rows.length * 2) kids[kids.length - 1].remove();
  rows.forEach(([l, v], i) => {
    if (!kids[i * 2]) k.rows.append(el('dt'), el('dd'));
    kids[i * 2].textContent = l;
    kids[i * 2 + 1].textContent = v;
  });
  k.c.hidden = false;
  const W = wrap.clientWidth, H = wrap.clientHeight, cw = k.c.offsetWidth, ch = k.c.offsetHeight;
  const off = ([x, y]) => ax == null || ax < x - 12 || ax > x + cw + 12 || (ay != null && (ay < y - 12 || ay > y + ch + 12));
  let [left, top] = (ch + 16 <= H && [[8, 8], [W - cw - 8, 8], [8, H - ch - 8]].find(off)) || [8, H];
  if (top === H && wrap.getBoundingClientRect().bottom + ch > $('main').getBoundingClientRect().bottom) top = -ch - 8;
  k.c.style.left = `${left}px`;
  k.c.style.top = `${top}px`;
  openCard = { wrap, card };
}
function hideCard(wrap) {
  if (wrap._card) wrap._card.c.hidden = true;
  if (openCard && openCard.wrap === wrap) openCard = null;
}
const sayCard = (c) => c.say || `${spoken([c.place, u(c.value, c.unit), ...(c.rows || []).map(([l, v]) => `${l} ${v}`)].join('. '))}.`;

/* --------------------------------------------------------- readout pinning */

// A tap on a chart pins its readout until a tap lands somewhere else, so a
// value can be read without keeping a finger on the screen. Dragging while
// pressed scrubs; hovering with a mouse still works when nothing is pinned.
// Only one readout is pinned at a time.
const pin = { wrap: null, clear: null };
document.addEventListener('pointerdown', (ev) => {
  if (pin.wrap && !pin.wrap.contains(ev.target)) unpin();
}, true);
function pinTo(wrap, clear) {
  if (pin.wrap && pin.wrap !== wrap && pin.clear) pin.clear();
  pin.wrap = wrap;
  pin.clear = clear;
}
function unpin() {
  const clear = pin.clear;
  pin.wrap = null;
  pin.clear = null;
  if (clear) clear();
}
const isPinned = (wrap) => pin.wrap === wrap;

/** Hover, scrub and tap-to-pin on a chart's hit layer. A mouse reads on the press; a finger waits:
 *  a tap pins the card and says it once, a sideways slide scrubs, a scroll (pointercancel) leaves none. */
function readout(hit, wrap, show, hide) {
  let down = 0, at = null, id = null;   // at: a finger's first point; id: the pointer that is reading
  const open = (ev) => { down = 1; at = null; id = ev.pointerId; show(ev); pinTo(wrap, () => hide()); };
  const say = () => { if (openCard && openCard.wrap === wrap) announce(sayCard(openCard.card)); };
  const on = (type, f) => hit.addEventListener(type, f);
  on('pointerdown', (ev) => { if (ev.pointerType === 'touch') at = [ev.clientX, ev.clientY]; else { open(ev); say(); } });
  // while one pointer reads, another (a trackpad's, a second finger) neither moves its card nor ends it
  // (Finances' fix of plan 0012: a resting mouse that a card moved under froze a finger's slide)
  const other = (ev) => down && ev.pointerId !== id;
  on('pointermove', (ev) => {
    if (other(ev)) return;
    if (!at) { if (down || !isPinned(wrap)) show(ev); return; }
    const dx = Math.abs(ev.clientX - at[0]);
    if (dx > 8 && dx > Math.abs(ev.clientY - at[1])) open(ev);
  });
  on('pointerup', (ev) => { if (other(ev)) return; if (at) { open(ev); say(); } down = 0; at = null; });
  on('pointercancel', (ev) => { if (other(ev)) return; if (down && isPinned(wrap)) unpin(); down = 0; at = null; });
  on('pointerleave', (ev) => { if (other(ev)) return; down = 0; if (!isPinned(wrap)) hide(); });
}

/* ------------------------------------------------------------------ loading */

let lastRaw = null, lastDay = null;
async function load() {
  let raw;
  try {
    const res = await fetch('./data/snapshot.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
    // the same file on the same day: nothing to redraw, nothing folded away
    if (raw === lastRaw && localIso(new Date()) === lastDay) { $('notice').hidden = true; stamp(); return; }
  } catch (err) {
    return fail(`could not be read (${err.message || err}).`, null,
      'The app is installed but its data file is missing or unreadable. Run the Shortcut again.');
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return fail(`is not valid JSON${/^\s*</.test(raw) ? '; it looks like a web page was written over it' : ''}.`, raw,
      'Something wrote a body that is not JSON over the data file.');
  }
  const problems = validate(json);
  if (problems.length) {
    return fail('is not the shape this app expects:', raw,
      'This is what a dead GitHub token looks like: 404 Not Found is valid JSON, and the Shortcut ' +
      'writes it straight over the good data. Check the token before the address.', problems);
  }
  DATA = json;
  lastRaw = raw;
  lastDay = localIso(new Date());
  $('notice').hidden = true;
  boot();
}

function validate(j) {
  const p = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return ['top level is not an object'];
  if (j.schema !== 1) p.push(`schema: expected 1, got ${JSON.stringify(j.schema)}`);
  if (typeof j.generatedAt !== 'string' || isNaN(Date.parse(j.generatedAt))) {
    p.push(`generatedAt: expected an ISO 8601 timestamp, got ${JSON.stringify(j.generatedAt)}`);
  }
  if (!Array.isArray(j.activities) || j.activities.length === 0) {
    p.push('activities: expected a non-empty array');
  } else {
    const bad = j.activities.findIndex(
      (a) => !a || typeof a.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.d) ||
        typeof a.km !== 'number' || typeof a.min !== 'number' ||
        !Array.isArray(a.z) || a.z.length !== 5
    );
    if (bad >= 0) p.push(`activities[${bad}]: needs d (YYYY-MM-DD), km, min and z[5]`);
  }
  if (!j.athlete || !Array.isArray(j.athlete.zoneFloors) || j.athlete.zoneFloors.length !== 5) {
    p.push('athlete.zoneFloors: expected 5 numbers');
  }
  for (const k of ['garminLoad', 'sleep', 'gear']) {
    if (!Array.isArray(j[k])) p.push(`${k}: expected an array`);
  }
  return p;
}

/** A problem with the data is a sentence on a plate, never a blank pane (HOUSE 4.9). A broken
 *  replacement keeps the data that was showing, its pane, scroll and card, and says so; Close puts
 *  the plate away (a dead token can stay dead for days). */
function fail(what, raw, hint, lines) {
  const box = $('notice');
  box.replaceChildren();
  if (DATA) {
    const p = pulledMs(), x = el('button', 'textkey', 'Close');
    x.onclick = () => { box.hidden = true; };
    box.append(el('p', null, `The new data/snapshot.json ${what.replace(/:$/, '.')} Still showing the data from ${dayOf(p)}, ${clock(p)}.`), x);
    box.classList.add('kept');
    box.hidden = false;
    return;
  }
  $('stamp').textContent = 'No usable data';
  $('tabs').hidden = true;
  $('filters').hidden = true;
  $('pane').replaceChildren();
  box.classList.remove('kept');
  box.append(el('p', null, `data/snapshot.json ${what}`));
  if (lines) box.append(el('p', 'notice-lines', lines.join('\n')));
  if (raw != null) box.append(el('p', 'notice-lines', `The file begins: ${raw.slice(0, 240)}`));
  if (hint) box.append(el('p', 'notice-lines', hint));
  box.hidden = false;
}

/* ------------------------------------------------------------------- boot */

let booted = false;
function boot() {
  const acts = DATA.activities;
  const first = mondayOf(acts[0].d);
  const last = mondayOf(acts[acts.length - 1].d);
  const firstBoot = !booted;
  booted = true;
  state.weeks = weeksBetween(first, last);
  if (firstBoot) recall();
  if (state.preset) {
    applyPreset(state.preset);
  } else {
    // a custom slider window survives a background refresh, clamped to the
    // (possibly longer) new week list
    state.to = Math.min(state.to, state.weeks.length - 1);
    state.from = Math.min(state.from, state.to);
  }

  stamp();
  buildTabs();
  buildFilters();
  render();
  aboutList();

  if (firstBoot) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) load();
    });
    darkMQ.addEventListener('change', () => render());
  }
}

/** The stamp (HOUSE 4.2): when the data was pulled, in words; stale is a sentence, never a color. */
function stamp() {
  const gen = Date.parse(DATA.generatedAt), pulled = DATA.pulledAt ? Date.parse(DATA.pulledAt) : gen;
  const stale = Date.now() - gen > 48 * 3600e3;
  const today = new Date().toDateString();
  const when = new Date(pulled).toDateString() === today ? clock(pulled) : `${dayOf(pulled)}, ${clock(pulled)}`;
  const tail = `Updated ${when}${DATA.dataThrough ? `, last session ${dayMon(DATA.dataThrough)}` : ''}`;
  // Example data (HOUSE 11.1 rule 8): every activity id the generator's own demo-…, the rule the OpenStreetMap
  // credit keys on. It leads in place of Stale., never beside it: an example never refreshes. A real pull's ids
  // never show it.
  const example = DATA.activities.length && DATA.activities.every((a) => OSM(a));
  const lead = example ? 'Example data.' : stale ? 'Stale.' : null;
  $('stamp').replaceChildren(...(lead ? [el('span', 'stale', lead), ` ${tail}`] : [tail]));
}

const TABS = [
  ['now', 'Now'],
  ['plan', 'Plan'],
  ['training', 'Training'],
  ['health', 'Health'],
  ['sessions', 'Sessions'],
];

// Built after the snapshot parses, never in the static markup: the marketing camera waits for the
// tab named Health as its proof that the data is in.
function buildTabs() {
  const nav = $('tabs');
  nav.hidden = false;
  if (!nav.children.length) {
    for (const [key, label] of TABS) {
      const b = el('button', null, label);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'pane');
      b.id = `tab-${key}`;
      b.dataset.key = key;
      b.onclick = (ev) => choose(key, ev.detail === 0);
      b.onkeydown = (ev) => {
        const i = TABS.findIndex((t) => t[0] === key), d = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
        if (!d) return;
        ev.preventDefault();
        const k = TABS[(i + d + TABS.length) % TABS.length][0];
        choose(k, true);
        nav.querySelector(`[data-key="${k}"]`).focus();
      };
      nav.append(b);
    }
  }
  for (const b of nav.children) {
    const on = b.dataset.key === state.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) $('pane').setAttribute('aria-labelledby', b.id);
  }
}
function choose(key, byKeyboard) {
  state.tab = key;
  remember();
  buildTabs();
  render();
  $('main').scrollTop = 0;
  if (byKeyboard) announce(`${TABS.find((t) => t[0] === key)[1]}.`);
}

const PRESETS = [['3m', '3 months', 13], ['6m', '6 months', 26], ['1y', '1 year', 52], ['all', 'All', Infinity]];

function applyPreset(key) {
  const n = (PRESETS.find((p) => p[0] === key) || PRESETS[3])[2];
  state.preset = key;
  state.to = state.weeks.length - 1;
  state.from = Math.max(0, state.weeks.length - (n === Infinity ? state.weeks.length : n));
}

/** A row of words (HOUSE 4.3): aria-pressed buttons in a named group, the tracer under the chosen. */
function words(name, items, cur, pick) {
  const g = el('div', 'words');
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', name);
  for (const [key, label] of items) {
    const b = el('button', null, label);
    b.setAttribute('aria-pressed', String(key === cur));
    b.onclick = () => pick(key);
    g.append(b);
  }
  return g;
}
/** One word that switches something on and off. */
function toggleWord(label, on, flip) {
  const b = el('button', null, label);
  b.setAttribute('aria-pressed', String(on));
  b.onclick = flip;
  return b;
}

function buildFilters() {
  $('presets').replaceWith(Object.assign(words('Time window', PRESETS, state.preset, (key) => { applyPreset(key); remember(); syncRanges(); render(); }), { id: 'presets' }));

  // Two thumbs on one track. Dragging one past the other pushes it along, so
  // the pair can always be separated again from either end.
  const from = $('fromRange');
  const to = $('toRange');
  from.max = to.max = String(state.weeks.length - 1);
  const moved = () => { state.preset = null; remember(); syncRanges(); render(); };
  from.oninput = () => { state.from = +from.value; if (state.from > state.to) state.to = state.from; moved(); };
  to.oninput = () => { state.to = +to.value; if (state.to < state.from) state.from = state.to; moved(); };
  syncRanges();

  const sport = $('sportSelect');
  sport.replaceChildren();
  for (const [v, label] of [['all', 'All sports'], ...SPORTS.map((s) => [s.key, s.label])]) {
    const o = el('option');
    o.value = v; o.textContent = label;
    o.selected = state.sport === v;
    sport.append(o);
  }
  sport.onchange = () => { state.sport = sport.value; remember(); render(); };

  const sel = $('gearSelect');
  sel.replaceChildren();
  const opts = [['all', 'Any equipment']];
  for (const g of DATA.gear) opts.push([g.code, isShoe(g) ? `${g.name}, ${u(f0(g.km), 'km')}` : g.name]);
  opts.push(['stroller-yes', 'With stroller'], ['stroller-no', 'Without stroller'], ['none', 'No gear logged']);
  for (const [v, label] of opts) {
    const o = el('option');
    o.value = v; o.textContent = label;
    o.selected = state.gear === v;
    sel.append(o);
  }
  if (sel.selectedIndex < 0) { sel.selectedIndex = 0; state.gear = 'all'; }
  sel.onchange = () => { state.gear = sel.value; remember(); render(); };
}

function syncRanges() {
  const from = $('fromRange');
  const to = $('toRange');
  from.value = String(state.from);
  to.value = String(state.to);
  const max = Math.max(1, state.weeks.length - 1);
  const fill = $('dualFill');
  fill.style.left = `${(state.from / max) * 100}%`;
  fill.style.right = `${100 - (state.to / max) * 100}%`;
  for (const [i, [key]] of PRESETS.entries()) {
    const b = $('presets').children[i];
    if (b) b.setAttribute('aria-pressed', String(state.preset === key));
  }
  const [a, b] = windowRange();
  $('winLabel').textContent = spanDates(a, b);
  from.setAttribute('aria-valuetext', `Week of ${date(a)}`);
  to.setAttribute('aria-valuetext', `Week ending ${date(b)}`);
}

function syncFilterVisibility() {
  const f = PANE_FILTERS[state.tab] || [];
  const has = (k) => f.includes(k);
  $('filters').hidden = f.length === 0;
  $('timeRow').hidden = !has('time');
  $('dual').hidden = !has('time');
  $('sportSelect').hidden = !has('sport');
  $('gearSelect').hidden = !has('gear');
  $('picksRow').hidden = !(has('sport') || has('gear'));
}

// The filters stay under the tabs while the pane scrolls beneath them (the owner, 2026-10-03). The sport
// and equipment row at their top goes up and out with a scroll down and stays out until the pane is back
// at its top (the owner, 2026-10-08: "I do not want them to pop up until we are at the top"). It is held
// to the scroll itself, pixel for pixel, so it slides back only over the last of its own height; never on
// a timer. A key that focuses a control in the row takes the pane back to the top, where the row is.
function tucked() {
  const s = $('main').scrollTop, h = $('filters').hidden ? 0 : $('picksRow').offsetHeight;
  const tuck = Math.max(0, Math.min(h, s));
  $('filters').style.transform = tuck ? `translateY(${-tuck}px)` : '';
}
$('main').addEventListener('scroll', tucked, { passive: true });
$('filters').addEventListener('focusin', (ev) => {   // a key, never a finger on a thumb
  if (ev.target.matches(':focus-visible') && $('picksRow').contains(ev.target)) $('main').scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
});

/* -------------------------------------------------------------- filtering */

function windowRange() {
  const start = state.weeks[state.from];
  const end = plusDays(state.weeks[state.to], 6);
  return [start, end];
}

function gearMatch(a) {
  const g = a.g || [];
  switch (state.gear) {
    case 'all': return true;
    case 'none': return g.length === 0;
    case 'stroller-yes': return g.includes('STROLLER');
    case 'stroller-no': return !g.includes('STROLLER');
    default: return g.includes(state.gear);
  }
}

function sportKey(a) {
  return SPORTS.some((s) => s.key === a.sport) ? a.sport : (SPORT_FALLBACK[a.sport] || 'other');
}
function sportMatch(a) {
  return state.sport === 'all' || sportKey(a) === state.sport;
}

// Only the filters the current pane shows are applied, so a gear choice made
// on Sessions cannot silently thin out the Plan pane.
function selected({ sportFilter = true, gearFilter = true } = {}) {
  const [start, end] = windowRange();
  const f = PANE_FILTERS[state.tab] || [];
  const useSport = sportFilter && f.includes('sport');
  const useGear = gearFilter && f.includes('gear');
  return DATA.activities.filter((a) =>
    a.d >= start && a.d <= end &&
    (!useSport || sportMatch(a)) &&
    (!useGear || gearMatch(a))
  );
}

const trimp = (z) => z.reduce((sum, secs, i) => sum + (secs / 60) * (i + 1), 0);

function weekRows(acts) {
  const keys = state.weeks.slice(state.from, state.to + 1);
  const map = new Map(keys.map((k) => [k, {
    key: k, runKm: 0, walkKm: 0, km: 0, min: 0, trimp: 0, zmin: 0, muscle: 0,
    z: [0, 0, 0, 0, 0], bySport: {}, bySportMin: {}, bySportMuscle: {}, bySportDur: {}, runs: 0, sessions: 0, longRun: 0, quality: 0, elev: 0,
  }]));
  for (const a of acts) {
    const w = map.get(mondayOf(a.d));
    if (!w) continue;
    const sk = sportKey(a);
    const t = trimp(a.z);
    w.sessions++;
    w.km += a.km;
    w.min += a.min;
    w.trimp += t;
    w.elev += a.elev || 0;
    w.bySport[sk] = (w.bySport[sk] || 0) + t;
    const zm = a.z.reduce((s, v) => s + v, 0) / 60;
    w.zmin += zm;
    w.bySportMin[sk] = (w.bySportMin[sk] || 0) + zm;
    const ml = muscleLoad(a).total;
    w.muscle += ml;
    w.bySportMuscle[sk] = (w.bySportMuscle[sk] || 0) + ml;
    w.bySportDur[sk] = (w.bySportDur[sk] || 0) + a.min;
    for (let i = 0; i < 5; i++) w.z[i] += a.z[i];
    if (a.sport === 'run') {
      w.runKm += runKm(a);
      w.walkKm += walkKm(a);
      w.runs++;
      w.longRun = Math.max(w.longRun, runKm(a));
      if (a.z[3] + a.z[4] >= 300) w.quality++;
    }
  }
  return keys.map((k) => map.get(k));
}

function rolling(values, n) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - n + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/* -------------------------------------------------------- chart primitives */

function niceStep(span, count = 4) {
  const raw = Math.abs(span) / count || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
}
const round6 = (v) => Math.round(v * 1e6) / 1e6;
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const step = niceStep(max, count);
  const out = [];
  // Run to the first tick at or above max, so the top tick always covers the
  // tallest bar: stopping at the last tick below it clipped everything above.
  for (let v = 0; ; v += step) {
    out.push(round6(v));
    if (v >= max - step * 0.001) break;
  }
  return out;
}
/** The unit caption above the plot, left-aligned to it. */
function yCaption(svg, text, padL) {
  if (text) svg.append(svgText({ x: padL, y: 10, class: 'ycap' }, text));
}
/** Ticks that sit inside an arbitrary [lo, hi] window rather than starting at 0. */
function ticksIn(lo, hi, count = 4) {
  const step = niceStep(hi - lo, count);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(round6(v));
  return out.length ? out : [lo, hi];
}
const tickLabel = (svg, x, y, text, anchor = 'end') => svg.append(svgText({ x, y, 'text-anchor': anchor, class: 'tk' }, text));
const gridLine = (svg, x1, x2, y, strong) => svg.append(svgEl('line', { x1, x2, y1: r1(y), y2: r1(y), class: strong ? 'base' : 'grid' }));
/** A threshold a reader measures against: 1 px --ink-2 dashed, its label at the right end. */
function ruleLine(svg, x1, x2, y, label) {
  svg.append(svgEl('line', { x1, x2, y1: r1(y), y2: r1(y), class: 'rule' }));
  if (label) svg.append(svgText({ x: x2 - 2, y: r1(y - 3), 'text-anchor': 'end', class: 'tk halo' }, label));
}
/** A line of values; an ink line rides on a 4 px --page casing so it reads over any data color. */
function linePath(svg, d, color, dash, w = 2) {
  if (color === INK) svg.append(svgEl('path', { d, class: 'casing' }));
  svg.append(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': dash }));
}
/** A stacked bar segment: filled when done; when planned, a 1.5 px outline of its token around a light
 *  tint of it (.tint, 20 %: the owner asked to see the plan, 2026-10-03; tools/art/palette.py check 8). */
function segRect(svg, x, y, w, h, color, plan) {
  if (!plan) return svg.append(svgEl('rect', { x: r1(x), y: r1(y), width: r1(w), height: r1(Math.max(0.6, h)), fill: color }));
  if (h < 3) return svg.append(svgEl('line', { x1: r1(x), x2: r1(x + w), y1: r1(y + h / 2), y2: r1(y + h / 2), stroke: color, 'stroke-width': 1.5 }));
  svg.append(svgEl('rect', { x: r1(x + 0.75), y: r1(y + 0.75), width: r1(w - 1.5), height: r1(h - 1.5), fill: color, stroke: color, 'stroke-width': 1.5, class: 'tint' }));
}
/** Month labels for week or day columns: thinned from the right so the newest survives, the year
 *  on the first label and on every January (never a two-digit year: B10). */
function monthLabels(svg, cands, W, H, minGap) {
  const chosen = [];
  for (let k = cands.length - 1; k >= 0; k--) {
    if (chosen.length && chosen[chosen.length - 1].px - cands[k].px < minGap) continue;
    chosen.push(cands[k]);
  }
  chosen.reverse().forEach((c, k) => {
    const text = c.key ? month(c.key, k === 0 || c.key.slice(5, 7) === '01') : c.text;
    const half = text.length * 2.7;
    let cx = c.px, anchor = 'middle';
    if (cx + half > W - 2) { cx = W - 2; anchor = 'end'; } else if (cx - half < 2) { cx = 2; anchor = 'start'; }
    svg.append(svgText({ x: r1(cx), y: H - 8, 'text-anchor': anchor, class: 'tk' }, text));
  });
}

/** Column chart: stacked bars (filled when done, outlined when planned), lines, a band, marks. */
function columnChart(host, spec) {
  const wrap = el('div', 'chartwrap');
  host.append(wrap);

  function draw() {
    const W = Math.max(260, wrap.clientWidth || host.clientWidth || 320);
    const H = spec.height || 190;
    const padL = spec.padL != null ? spec.padL : 38;
    const padR = 8, padT = spec.yLabel ? 20 : 10, padB = 26;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const rows = spec.rows;
    const n = rows.length;

    wrap.querySelectorAll('svg, .empty').forEach((s) => s.remove());
    if (!n) {
      wrap.append(el('p', 'empty', 'No sessions in this window.'));
      return;
    }

    let y, ticks;
    if (spec.yMin != null) {
      // Non-zero baseline: only legal because these charts draw a LINE, never a
      // bar. A truncated bar exaggerates the change; a truncated line does not.
      const vals = [];
      for (const line of spec.lines || []) for (const v of line.values) if (v != null) vals.push(v);
      const lo = spec.yMin;
      const hi = spec.yMax != null ? spec.yMax : Math.max(lo + 1, ...vals);
      ticks = ticksIn(lo, hi, 4);
      y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
    } else {
      let max = 0;
      for (const r of rows) max = Math.max(max, r.total || 0);
      for (const line of spec.lines || []) for (const v of line.values) if (v != null) max = Math.max(max, v);
      if (spec.band) for (const v of spec.band.hi) if (v != null) max = Math.max(max, v);
      if (spec.minMax) max = Math.max(max, spec.minMax);
      ticks = niceTicks(max || 1, 4);
      const top = ticks[ticks.length - 1] || 1;
      y = (v) => padT + ih - (v / top) * ih;
    }
    const tickStep = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
    const tickText = spec.tickFmt || ((t) => (tickStep % 1 === 0 ? f0(t) : f1(t)));

    const slot = iw / n;
    const gap = Math.min(2, slot * 0.34);
    const bw = Math.max(1.2, slot - gap);
    const x = (i) => padL + i * slot + gap / 2;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'chart' });
    yCaption(svg, spec.yLabel, padL);

    for (const t of ticks) {
      gridLine(svg, padL, W - padR, y(t));
      tickLabel(svg, padL - 5, r1(y(t) + 3.5), tickText(t));
    }

    if (spec.band) {
      // one closed shape per run of days that have both edges; gaps stay empty
      let d = '', run = [];
      const flush = () => {
        if (run.length) {
          d += run.map((i, k) => `${k ? 'L' : 'M'}${r1(x(i) + bw / 2)},${r1(y(spec.band.hi[i]))}`).join('');
          for (let k = run.length - 1; k >= 0; k--) d += `L${r1(x(run[k]) + bw / 2)},${r1(y(spec.band.lo[run[k]]))}`;
          d += 'Z';
        }
        run = [];
      };
      for (let i = 0; i < n; i++) { if (spec.band.hi[i] == null || spec.band.lo[i] == null) flush(); else run.push(i); }
      flush();
      if (d) svg.append(svgEl('path', { d, fill: spec.band.color, opacity: spec.band.opacity || 0.16 }));
    }

    rows.forEach((r, i) => {
      let acc = 0;
      const segs = (r.seg || []).filter((s) => s.v > 0);
      segs.forEach((s, si) => {
        const y0 = y(acc), y1 = y(acc + s.v);
        let h = y0 - y1;
        if (si < segs.length - 1) h = Math.max(0.5, h - 1); // a 1 px gap of the page between segments
        segRect(svg, x(i), y0 - h, bw, h, s.color, s.plan);
        acc += s.v;
      });
    });

    for (const line of spec.lines || []) {
      let d = '', open = false;
      line.values.forEach((v, i) => {
        if (v == null) { open = false; return; }
        d += `${open ? 'L' : 'M'}${r1(x(i) + bw / 2)},${r1(y(v))}`;
        open = true;
      });
      if (d) linePath(svg, d, line.color, line.dash);
    }

    // anchored inside the chart, so a label near the right edge never runs off it (B9); as on the Block,
    // a word that would collide with the race's loses its word, and a line under a label starts below it
    const ms = (spec.marks || []).map((m) => {
      const px = r1(m.after ? x(m.i) + bw + gap / 2 : x(m.i) + bw / 2), w = (m.label || '').length * 5.4 + 3, right = px + w > W - padR;
      return { m, px, right, x0: right ? px - w : px, x1: right ? px : px + w };
    });
    const said = ms.filter((a) => a.m.label && (a.m.race || !ms.some((b) => b.m.race && b.x0 < a.x1 && a.x0 < b.x1)));
    for (const { m, px } of ms) svg.append(svgEl('line', { x1: px, x2: px, y1: padT + (said.some((b) => px > b.x0 && px < b.x1) ? 12 : 0), y2: padT + ih, class: m.race ? 'mark race' : m.label ? 'mark' : 'grid' }));
    for (const { m, px, right } of said) svg.append(svgText({ x: right ? px - 3 : px + 3, y: padT + 9, 'text-anchor': right ? 'end' : 'start', class: m.race ? 'tk halo' : 'tk mk halo' }, m.label));

    for (const rule of spec.rules || []) ruleLine(svg, padL, W - padR, y(rule.at), rule.label);

    // x labels: the first of each month, or the spec's own labels (days)
    const cands = [];
    rows.forEach((r, i) => {
      if (spec.xLabel) { const t = spec.xLabel(r, i); if (t) cands.push({ px: x(i) + bw / 2, text: t }); return; }
      if (parse(r.key).getUTCDate() <= 7) cands.push({ px: x(i) + bw / 2, key: r.key });
    });
    monthLabels(svg, cands, W, H, spec.xLabel ? 30 : 46);

    gridLine(svg, padL, W - padR, padT + ih, true);

    const cursor = svgEl('rect', { x: 0, y: padT, width: Math.max(bw, 6), height: ih, fill: INK, opacity: 0, 'pointer-events': 'none' });
    svg.append(cursor);
    const hit = svgEl('rect', { x: padL, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const i = Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - box.left) * scale - padL) / slot)));
      cursor.setAttribute('x', r1(x(i) - gap / 2));
      cursor.setAttribute('width', r1(slot));
      cursor.setAttribute('opacity', 0.07);
      showCard(wrap, spec.tip(rows[i], i), (x(i) + bw / 2) / scale);
    };
    const leave = () => { hideCard(wrap); cursor.setAttribute('opacity', 0); };
    readout(hit, wrap, move, leave);
  }

  draw();
  new ResizeObserver(() => draw()).observe(wrap);
  return wrap;
}

/** The cursor on a line or a dot: a 1 px ink rule at 50 % and a 7 px ink disc on a 2 px --page ring. */
const cursorDot = (r = 3.5) => svgEl('circle', { r, class: 'cdot', opacity: 0, 'pointer-events': 'none' });

/** Scatter with a nearest-point hit layer. */
function scatterChart(host, spec) {
  const wrap = el('div', 'chartwrap');
  host.append(wrap);

  function draw() {
    const W = Math.max(260, wrap.clientWidth || 320);
    const H = spec.height || 220;
    const padL = 42, padR = 10, padT = spec.yLabel ? 20 : 10, padB = 34;
    const iw = W - padL - padR, ih = H - padT - padB;
    wrap.querySelectorAll('svg, .empty').forEach((s) => s.remove());
    const pts = spec.points;
    if (!pts.length) {
      wrap.append(el('p', 'empty', 'No sessions match this filter.'));
      return;
    }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const xPad = (x1 - x0) * 0.08 || 1, yPad = (y1 - y0) * 0.08 || 1;
    const sx = (v) => padL + ((v - (x0 - xPad)) / ((x1 + xPad) - (x0 - xPad))) * iw;
    const sy = (v) => padT + ih - ((v - (y0 - yPad)) / ((y1 + yPad) - (y0 - yPad))) * ih;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'scatter chart' });
    yCaption(svg, spec.yLabel, padL);

    for (const t of ticksIn(y0 - yPad, y1 + yPad, 5)) {
      gridLine(svg, padL, W - padR, sy(t));
      tickLabel(svg, padL - 5, r1(sy(t) + 3.5), spec.yFmt ? spec.yFmt(t) : f0(t));
    }
    for (const t of ticksIn(x0 - xPad, x1 + xPad, 4)) tickLabel(svg, r1(sx(t)), H - 13, spec.xFmt ? spec.xFmt(t) : f0(t), 'middle');
    svg.append(svgText({ x: padL + iw / 2, y: H - 2, 'text-anchor': 'middle', class: 'tk' }, spec.xLabel || ''));

    for (const p of pts) svg.append(svgEl('circle', { cx: r1(sx(p.x)), cy: r1(sy(p.y)), r: 4.5, fill: p.color, class: 'dot' }));

    const ring = svgEl('circle', { r: 7.5, fill: 'none', stroke: INK, 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' });
    svg.append(ring);
    const hit = svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const hide = () => { hideCard(wrap); ring.setAttribute('opacity', 0); };
    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const cx = (ev.clientX - box.left) * scale, cy = (ev.clientY - box.top) * scale;
      let best = null, bd = 1e9;
      for (const p of pts) {
        const d = (sx(p.x) - cx) ** 2 + (sy(p.y) - cy) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (!best || bd > 40 * 40) return hide();
      ring.setAttribute('cx', r1(sx(best.x))); ring.setAttribute('cy', r1(sy(best.y))); ring.setAttribute('opacity', 1);
      showCard(wrap, best.tip, sx(best.x) / scale, sy(best.y) / scale);
    };
    readout(hit, wrap, move, hide);
  }

  draw();
  new ResizeObserver(() => draw()).observe(wrap);
}

/** Lap chart: one bar per lap, bar width proportional to lap duration, so an
 *  interval session looks like an interval session. */
function lapChart(host, laps, spec) {
  const wrap = el('div', 'chartwrap');
  host.append(wrap);

  function draw() {
    const W = Math.max(260, wrap.clientWidth || 320);
    const H = spec.height || 170;
    const padL = spec.padL != null ? spec.padL : 40, padR = 8, padT = spec.yLabel ? 20 : 10, padB = 24;
    const iw = W - padL - padR, ih = H - padT - padB;
    wrap.querySelectorAll('svg, .empty').forEach((s) => s.remove());
    const total = laps.reduce((s, l) => s + (l.dur || 0), 0);
    const vals = laps.map(spec.value);
    const finite = vals.filter((v) => v != null && isFinite(v));
    if (!total || !finite.length) {
      wrap.append(el('p', 'empty', spec.emptyText || 'Nothing to plot for these laps.'));
      return;
    }
    const hi = Math.max(...finite, ...(spec.rules || []).map((r) => r.at));
    const ticks = niceTicks(hi, 4);
    const top = ticks[ticks.length - 1] || 1;
    const y = (v) => padT + ih - (v / top) * ih;
    const x = (t) => padL + (t / total) * iw;
    const tickText = spec.tickFmt || ((t) => f0(t));

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'lap chart' });
    yCaption(svg, spec.yLabel, padL);
    for (const t of ticks) {
      gridLine(svg, padL, W - padR, y(t));
      tickLabel(svg, padL - 5, r1(y(t) + 3.5), tickText(t));
    }
    const starts = [];
    let t0 = 0;
    laps.forEach((l, i) => {
      starts.push(t0);
      const v = vals[i];
      const x0 = x(t0), x1 = x(t0 + (l.dur || 0));
      if (v != null && isFinite(v) && v > 0) svg.append(svgEl('rect', { x: r1(x0 + 0.5), y: r1(y(v)), width: r1(Math.max(1, x1 - x0 - 1)), height: r1(Math.max(0.6, ih - (y(v) - padT))), fill: spec.color(l, i) }));
      t0 += l.dur || 0;
    });
    for (const rule of spec.rules || []) ruleLine(svg, padL, W - padR, y(rule.at), rule.label);
    // time axis in minutes
    const stepMin = [1, 2, 5, 10, 15, 20, 30, 60, 120].find((st) => total / 60 / st <= 6) || 240;
    for (let m = stepMin; m * 60 < total; m += stepMin) tickLabel(svg, r1(x(m * 60)), H - 8, u(f0(m), 'min'), 'middle');
    gridLine(svg, padL, W - padR, padT + ih, true);

    const cursor = svgEl('rect', { x: 0, y: padT, width: 4, height: ih, fill: INK, opacity: 0, 'pointer-events': 'none' });
    svg.append(cursor);
    const hit = svgEl('rect', { x: padL, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const show = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const t = Math.max(0, Math.min(total - 0.01, ((ev.clientX - box.left) * scale - padL) / iw * total));
      let i = starts.findIndex((st, k) => t >= st && t < st + (laps[k].dur || 0));
      if (i < 0) i = laps.length - 1;
      const l = laps[i];
      cursor.setAttribute('x', r1(x(starts[i])));
      cursor.setAttribute('width', r1(Math.max(2, x(starts[i] + (l.dur || 0)) - x(starts[i]))));
      cursor.setAttribute('opacity', 0.07);
      showCard(wrap, spec.tip(l, i), x(starts[i] + (l.dur || 0) / 2) / scale);
    };
    const hide = () => { hideCard(wrap); cursor.setAttribute('opacity', 0); };
    readout(hit, wrap, show, hide);
  }

  draw();
  new ResizeObserver(() => draw()).observe(wrap);
}

/* ---------------------------------------------------------------- widgets */

/** A section of a pane (no card): a heading, then its content, then a row of text keys, `How to
 *  read it` and `Show the table`. Content appended later still lands above the keys. */
let headTag = 'h2';   // h3 under a pane's group heads
function card(title, sub) {
  const c = el('section', 'sec');
  if (title) c.append(el(headTag, null, title));
  const keys = el('div', 'keys');
  c.append(keys);
  c.keys = keys;
  c.append = (...n) => keys.before(...n);
  if (sub) {
    const d = el('details', 'howto');
    d.append(el('summary', null, 'How to read it'), el('p', null, sub));
    keys.prepend(d);
  }
  return c;
}
/** A caption line under a chart: what one bar or point is, one line at 390 px (HOUSE 11.1 rule 9). */
const help = (text) => el('p', 'cap', text);
/** A method sentence into its section's `How to read it` fold, after whatever the fold already says (HOUSE
 *  11.1 rule 9); returns the paragraph, so words written later (a stream's series) land in it. */
function howTo(c, text) {
  let d = c.keys.querySelector(':scope > .howto');
  if (!d) { d = el('details', 'howto'); d.append(el('summary', null, 'How to read it')); c.keys.prepend(d); }
  const p = el('p', null, text);
  d.append(p);
  return p;
}
/** A label whose words change: one line under the drawing, or, past 64 characters (one line of 11 px type at
 *  390 px), in the section's fold instead (HOUSE 11.1 rule 9). */
function capOrFold(c) {
  const cap = help(''), fold = howTo(c, '');
  cap.hidden = fold.hidden = true;
  return { cap, say(text) { const long = text.length > 64; cap.textContent = long ? '' : text; fold.textContent = long ? text : ''; cap.hidden = long; fold.hidden = !long; } };
}
/** The key in place of a how-to-read sentence (HOUSE 11.1 rule 6): a swatch and a word for each mark. */
function pkey(...items) {
  const k = el('div', 'pkey');
  for (const [cls, word] of items) k.append(el('span', cls, word));
  return k;
}

function legend(items) {
  const l = el('div', 'legend');
  for (const it of items) {
    const s = el('span');
    const i = el('i', it.line ? 'line' : it.plan ? 'plan' : null);
    i.style.setProperty('--c', it.color);
    if (it.dash) i.classList.add('dash');
    s.append(i, it.label);
    l.append(s);
  }
  return l;
}

function tableToggle(host, id, build) {
  const b = el('button', 'textkey', state.tables.has(id) ? 'Hide the table' : 'Show the table');
  b.setAttribute('aria-expanded', String(state.tables.has(id)));
  const box = el('div', 'tableview');
  box.hidden = !state.tables.has(id);
  if (state.tables.has(id)) box.append(build());
  b.onclick = () => {
    const open = !state.tables.has(id);
    if (open) state.tables.add(id); else state.tables.delete(id);
    box.replaceChildren(...(open ? [build()] : []));
    box.hidden = !open;
    b.textContent = open ? 'Hide the table' : 'Show the table';
    b.setAttribute('aria-expanded', String(open));
  };
  if (host.keys) { host.keys.append(b); host.keys.after(box); } else host.append(b, box);
}

function table(headers, rows) {
  const t = el('table');
  const thead = el('thead');
  const hr = el('tr');
  for (const h of headers) hr.append(el('th', null, h));
  thead.append(hr); t.append(thead);
  const tb = el('tbody');
  for (const r of rows) {
    const tr = el('tr');
    for (const cell of r) tr.append(el('td', null, cell));
    tb.append(tr);
  }
  t.append(tb);
  return t;
}

/** A fact as a row (ART.md section 3): the quantity in words at the left, the value at the right
 *  with its unit, the note after it. */
function tile(label, value, note, unit) {
  const r = el('div', 'fact');
  r.dataset.label = label;
  const dd = el('dd');
  dd.append(el('b', null, unit ? u(value, unit) : String(value)));
  if (note) dd.append(el('span', /^per /.test(note) ? 'per' : null, note));   // "7.7 h per night"
  r.append(el('dt', null, label), dd);
  return r;
}
const facts = () => el('dl', 'facts');
/** The tone of a piece of coaching text, as a word (color carried it before). */
function toneWord(t) {
  return { good: 'on track', warning: 'watch', serious: 'act now', critical: 'stop', neutral: 'note' }[t] || t;
}
const toneSentence = (t) => { const w = toneWord(t || 'neutral'); return `${w.charAt(0).toUpperCase()}${w.slice(1)}.`; };
/** The tone sentence in its color, leading the data's own words (HOUSE 11.3: --up on track, --watch watch,
 *  --down act now and stop; a note stays ink). Words before it (a session's own verdict) stay ink; the color
 *  never carries the tone alone, the word does. */
function verdict(tone, text, before) {
  const p = el('p', `verdict said tone-${tone || 'neutral'}`);
  if (before) p.append(el('b', null, before), ' ');
  p.append(el('b', 'tw', toneSentence(tone)), text ? ` ${text}` : '');
  return p;
}
/** A tone and its sentence as the register sets them (HOUSE 11.1 rules 2 and 5): the tone sentence in its color,
 *  the data's verdict after it in ink, over a rule; then the headline under it. */
function toneLines(tone, verdictWords, headline) {
  const v = el('p', `tone said tone-${tone || 'neutral'}`);   // said: the coaching routine's words, shown as written
  v.append(el('b', null, toneSentence(tone)), verdictWords && verdictWords.toLowerCase() !== toneWord(tone || 'neutral') ? ` ${verdictWords}.` : '');
  return [v, el('p', 'tone-text said', headline || '')];
}
/** The key at the end of every pane (HOUSE 11.1 rule 1). */
const ABOUT_KEY = 'Sources, method and credits are in About.';
function aboutKey(host) {
  const b = el('button', 'aboutlink', ABOUT_KEY);
  b.type = 'button';
  b.onclick = () => about(true);
  host.append(b);
}

/* ------------------------------------------------------------------ panes */

let shownTab = null;
const PANES = () => ({ now: paneNow, plan: panePlan, training: paneTraining, health: paneHealth, sessions: paneSessions });
// each keyed by its words and its place among folds with the same words
const folds = () => { const n = {}; return [...$('pane').querySelectorAll('details')].map((d) => { const w = d.firstChild.textContent; n[w] = (n[w] || 0) + 1; return [`${w}\n${n[w]}`, d]; }); };
function render() {
  const main = $('main'), pane = $('pane');
  // A filter or chip re-renders the whole pane; emptying it briefly shortens
  // the pane and the scroller clamps to the top. Keep the reader's place on a
  // same-pane re-render (a tab switch starts at the top), its folds too.
  const samePane = shownTab === state.tab;
  const keep = samePane ? main.scrollTop : 0, was = new Map(samePane ? folds() : []);
  pane.style.minHeight = samePane ? `${pane.offsetHeight}px` : '';
  pin.wrap = pin.clear = openCard = null;
  pane.innerHTML = '';
  shownTab = state.tab;
  headTag = 'h2';
  syncFilterVisibility();
  PANES()[state.tab](pane);
  aboutKey(pane);   // every pane ends with it (HOUSE 11.1 rule 1)
  for (const [k, d] of folds()) if (was.has(k)) d.open = was.get(k).open;
  main.scrollTop = keep;
  pane.style.minHeight = '';
}

/** A heading between the groups of a long pane, sentence case (B12). */
function groupHead(main, text) {
  main.append(el('h2', 'group', text));
  headTag = 'h3';
}

/* --- Training: running volume, load and the heart-rate picture, one pane ---- */

function paneTraining(main) {
  groupHead(main, 'Running');
  paneRunning(main);
  groupHead(main, 'Load');
  paneLoad(main);
  groupHead(main, 'Heart');
  paneHeart(main);
}

/* --- The Block (ART.md section 1) ---------------------------------------- */

let lastBlock = null;
function blockSection(main, scale) {
  const B = blockWeeks(DATA.activities, DATA.plan, todayIso());
  const c = card(null);
  c.classList.add('blocksec');
  const wrap = el('div', 'chartwrap');
  c.append(wrap);
  const draw = () => {
    const W = Math.max(260, wrap.clientWidth || 320), L = blockLayout(B, W, scale);
    wrap.querySelectorAll('svg').forEach((s) => s.remove());
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${L.height}`, width: W, height: L.height, role: 'img', 'aria-label': blockSay(B) });
    wrap.prepend(svg);
    lastBlock = { B, L, scale, svg };
    const last = L.grid.length - 1;
    L.grid.forEach(([v, y], k) => gridLine(svg, 0, W, y));
    gridLine(svg, 0, W, L.base, true);
    for (const [x, y, w, h] of L.points) svg.append(svgEl('rect', { x, y, width: w, height: h, class: 'ink' }));
    for (const [x, y, w, h] of L.tints) svg.append(svgEl('rect', { x, y, width: w, height: h, class: 'ink tint' }));
    for (const [x, y, w, h] of L.outlines) svg.append(svgEl('rect', { x: x + 0.75, y: y + 0.75, width: w - 1.5, height: h - 1.5, class: 'outline' }));
    for (const [x, y, w] of L.ticks) svg.append(svgEl('line', { x1: x, x2: x + w, y1: y + 0.5, y2: y + 0.5, class: 'lowtick' }));
    L.grid.forEach(([v, y], k) => svg.append(svgText({ x: W, y: y - 2, 'text-anchor': 'end', class: 'tk mk halo' }, k === last ? u(v, 'km') : String(v))));
    // over the race's week: a rule at the race day and its name, anchored at its right end (B9)
    let raceLeft = Infinity;
    const nx = Math.round(L.nowX) + 0.5;
    const notch = svgEl('line', { x1: nx, x2: nx, y1: 8, y2: L.top, class: 'notch' });
    svg.append(notch);
    if (B.race) {
      const rx = Math.round(L.raceX) + 0.5, col = L.outlines.find((o) => o[4] === B.race.idx);
      svg.append(svgEl('line', { x1: rx, x2: rx, y1: 2, y2: col ? col[1] : L.base, class: 'racerule' }));
      const t = svgText({ x: rx - 3, y: 9, 'text-anchor': 'end', class: 'tk halo' }, `${B.race.name}, ${dayMon(B.race.date)}`);
      svg.append(t);
      const w = t.getComputedTextLength();
      if (w > rx - 3) { t.setAttribute('x', rx + 3); t.setAttribute('text-anchor', 'start'); raceLeft = rx; } else raceLeft = rx - 3 - w;
    }
    // `now` over this week; under the race's name, in the month row if free there, without a notch
    const word = markWord(1), under = nx + word.length * 2.7 + 2 > raceLeft - 4;
    if (!under) svg.append(svgText({ x: nx, y: 7, 'text-anchor': 'middle', class: 'tk mk' }, word));
    else notch.remove();
    // months under the plot: the first column of each, the year on the first and on January
    let lastRight = -Infinity, first = true;
    const months = [];
    B.columns.forEach((col, i) => {
      if (i && col.week.slice(0, 7) === B.columns[i - 1].week.slice(0, 7)) return;
      const t = month(col.week, first || col.week.slice(5, 7) === '01');
      if (L.xs[i] < lastRight + 6) return;
      const m = svgText({ x: L.xs[i], y: L.base + 14, class: 'tk' }, t);
      svg.append(m);
      months.push([L.xs[i], L.xs[i] + m.getComputedTextLength()]);
      lastRight = L.xs[i] + t.length * 5.2;
      first = false;
    });
    if (under) {
      const t = svgText({ x: nx, y: L.base + 14, 'text-anchor': 'middle', class: 'tk mk' }, word);
      svg.append(t);
      const h = t.getComputedTextLength() / 2 + 4;   // 4 px clear of a month's name, or not drawn
      if (months.some(([a, b]) => a < nx + h && nx - h < b)) t.remove();
    }
    const cursor = svgEl('rect', { x: 0, y: L.top, width: 0, height: L.base - L.top, fill: INK, opacity: 0, 'pointer-events': 'none' });
    const hit = svgEl('rect', { x: 0, y: 0, width: W, height: L.height, fill: 'transparent' });
    svg.append(cursor, hit);
    const show = (ev) => {
      const box = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(L.n - 1, Math.floor(((ev.clientX - box.left) * W / box.width) / L.slot)));
      cursor.setAttribute('x', L.xs[i] - 2); cursor.setAttribute('width', L.colW(i) + 4); cursor.setAttribute('opacity', 0.07);
      showCard(wrap, blockCard(B, i), L.xs[i] + L.colW(i) / 2);
    };
    readout(hit, wrap, show, () => { hideCard(wrap); cursor.setAttribute('opacity', 0); });
  };
  main.append(c);
  draw();
  new ResizeObserver(() => draw()).observe(wrap);
  const race = B.race ? ` to ${B.race.name}` : '';
  c.append(pkey(['k-done', 'Run'], ['k-plan', B.planned ? `Planned week${race}` : 'No plan in this snapshot']));   // a key, not a sentence
  tableToggle(c, 'block', () => table(['Week', 'Run km', 'Runs', 'Longest', 'Plan'],
    B.columns.map((col, i) => [date(col.week), i > B.now ? '–' : f1(col.km), i > B.now ? '–' : String(col.runs.length), col.runs.length ? f1(col.longest) : '–', col.range || (col.target != null ? f0(col.target) : '–')])));
  return B;
}

/** The pane's key number (HOUSE 11.1 rule 2): its label above at 12.5 px, the figure at 34 px, its lead under it
 *  at 13.5 px. On the pane it opens a plate of its own, which it returns; inside a section it is that section's. */
function figure(host, what, value, lead) {
  const plate = host === $('pane') ? card(null) : null, f = el('div', 'hl');
  if (plate) plate.classList.add('headline');
  f.append(el(plate ? 'h2' : 'span', 'hl-what', what), el('span', 'hl-fig', value));
  if (lead) f.append(el('span', 'hl-lead', lead));
  (plate || host).append(f);
  if (plate) host.append(plate);
  return plate;
}

/* --- Now ---------------------------------------------------------------- */

function paneNow(main) {
  const acts = DATA.activities;
  const today = todayIso();
  const since = (days) => acts.filter((a) => ago(a.d, today) < days);
  const past = pastPull(), last = (n) => (past ? `${n} days to ${dayMon(today)}` : `last ${n} days`);

  const w1 = since(7), w4 = since(28), prev4 = acts.filter((a) => ago(a.d, today) >= 28 && ago(a.d, today) < 56);
  const runsIn = (list) => list.filter((a) => a.sport === 'run');
  const km = (list) => runsIn(list).reduce((s, a) => s + runKm(a), 0);
  const walked = (list) => runsIn(list).reduce((s, a) => s + walkKm(a), 0);
  const lastRun = [...acts].reverse().find((a) => a.sport === 'run');

  // A percentage against a near-zero base is arithmetic, not information — after
  // a lay-off it reads "+757%". Show the two numbers instead unless the previous
  // block was substantial enough for a ratio to mean something.
  const km4 = km(w4), kmPrev4 = km(prev4);
  const ch = ((km4 / kmPrev4) - 1) * 100;
  const note28 = kmPrev4 >= 10
    ? `${pct(Math.abs(ch))} ${ch >= 0 ? 'more' : 'less'} than the 28 days before`
    : `the 28 days before: ${kmU(kmPrev4)}`;
  const walkNote = (list) => (walked(list) >= 0.2 ? `, ${kmU(walked(list))} walked` : '');

  const a = DATA.assessment;
  const gn = DATA.garminNow || {};
  // The week first, against its plan (HOUSE 11.1 rule 2), with the verdict under it; then the facts as tiles
  // (rule 3); a metric whose words run on (over 64 characters, or a second sentence) is the evaluation's, after
  // the Block. The week is blockWeeks()'s column at now, the figure the Block draws.
  const Bw = blockWeeks(DATA.activities, DATA.plan, today), wk0 = Bw.columns[Bw.now];
  const head = card(null), hl = el('div', 'hl'), row = el('div', 'hl-row');
  head.classList.add('headline');
  hl.append(el('h2', 'hl-what', past ? `Week of ${dayMon(wk0.week)}, data to ${dayMon(today)}` : `This week, ${dayMon(wk0.week)} to ${dayMon(plusDays(wk0.week, 6))}`));
  row.append(el('span', 'hl-fig', kmU(wk0.km)));
  if (wk0.target != null) row.append(el('span', 'hl-lead', `of ${wk0.range || u(f0(wk0.target), 'km')} planned`));
  hl.append(row);
  if (wk0.target) {
    const bar = el('div', 'pbar'), done = el('i', 'pdone');
    bar.setAttribute('aria-hidden', 'true');
    done.style.width = `${Math.min(100, (wk0.km / wk0.target) * 100)}%`;
    bar.append(done);
    hl.append(bar, pkey(['k-done', 'Done'], ['k-plan', 'Planned']));
  }
  head.append(hl);
  if (a) head.append(...toneLines(a.tone, a.verdict, a.headline));
  main.append(head);
  const top = card(null), t = el('dl', 'tiles'), long = el('dl', 'long');
  top.classList.add('tilesec');
  t.append(tile(`Run, ${last(7)}`, f1(km(w1)), `${plural(runsIn(w1).length, 'run')}${walkNote(w1)}`, 'km'));
  t.append(tile(`Run, ${last(28)}`, f1(km4), note28 + walkNote(w4), 'km'));
  t.append(tile('Garmin status', (gn.trainingStatus || '–').replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase(),
    `acute ${f0(gn.acuteLoad)}, chronic ${f0(gn.chronicLoad)}`));
  t.append(tile('VO₂ max', f1(gn.vo2max || DATA.athlete.vo2maxRunning), lastRun ? `last run ${dayMon(lastRun.d)}` : ''));
  if (a && a.metrics) for (const m of a.metrics) (`${m.value} ${m.note || ''}`.length > 64 || /[.!?] [A-Z]/.test(m.note || '') ? long : t).append(tile(si(m.label), si(m.value), si(m.note || '')));
  top.append(t);
  main.append(top);

  blockSection(main, SCALE.now);

  if (!a) {
    const c = card('Evaluation');
    c.append(el('p', null, 'No assessment in this snapshot. The data pull does not write one; the optional daily coaching routine does. If that is set up and this stays empty, the routine is not completing.'));
    main.append(c);
  } else if (long.children.length) {
    // the long facts behind the verdict, on their own plate
    const lc = card(null);
    lc.classList.add('longsec');
    lc.append(long);
    main.append(lc);
  }
  planPointer(main);

  raceCard(main, gn);
  if (!a) return;

  const ev = card('The full evaluation');
  if (a.summary) ev.append(el('p', 'said', a.summary));
  for (const s of a.sections || []) {
    const d = el('details', 'fold');
    d.append(el('summary', null, s.tone ? `${s.title}: ${toneWord(s.tone)}` : s.title));
    const sec = el('div', 'section said');
    for (const p of s.body || []) sec.append(el('p', null, p));
    if (s.bullets && s.bullets.length) {
      const ul = el('ul');
      for (const b of s.bullets) ul.append(el('li', null, b));
      sec.append(ul);
    }
    d.append(sec);
    ev.append(d);
  }
  howTo(ev, `Written ${a.updated ? date(a.updated) : 'with this snapshot'}, from the full history, and rewritten by each run of the coaching routine so it moves with the training rather than describing one good week.`);
  main.append(ev);
}

const KIND_WORD = { rest: 'rest', easy: 'easy', long: 'long', quality: 'hard', race: 'race', strength: 'strength', done: 'done', missed: 'missed' };
const MIX = [
  { label: 'Easy (Z1–2)', color: 'var(--zone-2)' },
  { label: 'Moderate (Z3)', color: 'var(--zone-3)' },
  { label: 'Hard (Z4–5)', color: 'var(--zone-4)' },
];

/** On the Now pane: the plan's headline and a way into the Plan tab. */
function planPointer(main) {
  const p = DATA.plan;
  if (!p) return;
  const c = card('What to do next');
  c.append(...toneLines(p.tone, null, p.headline));
  if (p.goal && p.goal.race) c.append(help(`Planned around ${p.goal.race.name}, ${date(p.goal.race.date)}.`));
  const b = el('button', 'textkey', 'Open the plan');
  b.onclick = () => choose('plan');
  c.keys.append(b);
  main.append(c);
}

/* --- Today: the last 24 hours from the hourly pull ------------------------ */

/** A series of [sec, value] into a stream-shaped object with null points across gaps
 *  longer than maxGap seconds, so the line breaks where the watch was off. */
function daySeries(points, t0, maxGap) {
  const t = [], v = [];
  let prev = null;
  for (const [sec, val] of points) {
    if (prev != null && sec - prev > maxGap) { t.push(prev - t0 + 1); v.push(null); }
    t.push(sec - t0); v.push(val);
    prev = sec;
  }
  return { t, d: t.map(() => 0), v };
}

/** Centered running mean over k samples, never reaching across a gap (null). */
function smoothed(series, k) {
  const v = series.v, out = [];
  const half = Math.floor(k / 2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] == null) { out.push(null); continue; }
    let sum = 0, n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= v.length) continue;
      if (v[j] == null) { if (j < i) { sum = 0; n = 0; continue; } break; }
      sum += v[j]; n++;
    }
    out.push(n ? sum / n : v[i]);
  }
  return { t: series.t, d: series.d, v: out };
}
/** The window five samples span, in minutes, from the series' own median spacing. */
const window5 = (pts) => { const d = pts.slice(1).map((p, i) => p[0] - pts[i][0]).sort((a, b) => a - b); return Math.round((d[d.length >> 1] || 120) * 5 / 60); };
const stressWord = (v) => (v < 26 ? 'rest' : v < 51 ? 'low' : v < 76 ? 'medium' : 'high');

let todaySmooth = false;
function paneToday(main) {
  const it = DATA.intraday;
  if (!it || !it.hr || it.hr.length < 2) {
    const c = card('Today', 'Heart rate, body battery and stress through the last 24 hours, refreshed by the hourly pull.');
    c.append(el('p', null, 'Nothing here yet: the first hourly pull since this pane was added has not landed. It fills in on its own.'));
    main.append(c);
    return;
  }
  const all = [...it.hr, ...(it.bb || []), ...(it.stress || [])].map((p) => p[0]);
  const tEnd = Math.max(...all);
  const t0 = tEnd - 24 * 3600;
  const inWin = (pts) => (pts || []).filter((p) => p[0] >= t0);
  const hr = inWin(it.hr), bb = inWin(it.bb), st = inWin(it.stress);
  const lastHr = hr[hr.length - 1], lastBb = bb[bb.length - 1], lastSt = st[st.length - 1];
  // a sample's time, with its day when it is not the phone's today
  const at = (sec) => `${localIso(new Date(sec * 1000)) === localIso(new Date()) ? '' : `${dayOf(sec * 1000)}, `}${clock(sec * 1000)}`;
  const pulled = it.pulledAt ? Date.parse(it.pulledAt) : null;

  const t = facts();
  t.append(tile('Heart rate', lastHr ? String(lastHr[1]) : '–', lastHr ? `at ${at(lastHr[0])}${it.restingHr ? `, resting ${it.restingHr}` : ''}` : '', 'bpm'));
  t.append(tile('Body battery', lastBb ? String(lastBb[1]) : '–', lastBb ? `at ${at(lastBb[0])}` : 'not recorded'));
  t.append(tile('Stress', lastSt ? String(lastSt[1]) : '–', lastSt ? `${stressWord(lastSt[1])}, at ${at(lastSt[0])}` : 'not recorded'));
  const hrs = hr.map((p) => p[1]);
  t.append(tile('24\u202Fh range', `${Math.min(...hrs)}–${Math.max(...hrs)}`, `${hr.length} samples`, 'bpm'));
  const tc = card(null);   // on a plate, as every section (HOUSE 11.1 rule 4)
  tc.append(t);
  main.append(tc);

  const hourTicks = [];
  for (let s = Math.ceil(t0 / 3600) * 3600; s <= tEnd; s += 3600) {
    const h = new Date(s * 1000).getHours();
    if (h % 3 === 0) hourTicks.push({ at: s - t0, label: `${String(h).padStart(2, '0')}:00`, grid: h === 0 });
  }
  const floors = DATA.athlete.zoneFloors;
  const hrWin = window5(hr), stWin = window5(st);

  const c1 = card('Heart rate, last 24 hours',
    `Every couple of minutes from the watch, colored by zone; gaps are where it was off the wrist. Samples to ${at(tEnd)}${pulled ? `, updated ${agoText(Date.now() - pulled)}` : ''}. Tap or slide sideways to read a point.`);
  const chips = el('div');
  c1.append(chips);
  const area1 = el('div');
  c1.append(area1);
  const cap1 = help('');
  c1.append(legend(LINE_LEGEND), cap1);
  main.append(c1);
  const sHrRaw = daySeries(hr, t0, 15 * 60);
  const drawHr = () => {
    area1.replaceChildren();
    const sHr = todaySmooth ? smoothed(sHrRaw, 5) : sHrRaw;
    streamChart(area1, sHr, {
      height: 200, xMode: 'time', value: (i) => sHr.v[i], color: (i, v) => zoneColor(v), width: 1.4,
      yMin: Math.max(35, (it.restingHr || 50) - 10),
      rules: floors.slice(0, 4).map((f, k) => ({ at: f, label: `Z${k + 1}` })),
      xTicks: hourTicks, aria: 'Heart rate over the last 24 hours', yLabel: 'bpm',
      tip: (i) => ({ place: at(t0 + sHr.t[i]), value: sHr.v[i] == null ? '–' : f0(sHr.v[i]), unit: 'bpm',
        rows: sHr.v[i] == null ? [] : [['Zone', zoneOf(sHr.v[i]) ? String(zoneOf(sHr.v[i])) : 'below 1'], ...(todaySmooth ? [['Mean of', u(hrWin, 'min')]] : [])] }),
    });
    cap1.textContent = todaySmooth ? `Each point the mean of five samples, about ${u(hrWin, 'min')}.` : 'Each point one sample from the watch.';
  };
  let drawSt = () => {};
  const pick = (key) => { todaySmooth = key; chips.replaceChildren(words('Heart-rate samples', [[false, 'Every sample'], [true, 'Smoothed']], todaySmooth, pick)); drawHr(); drawSt(); };
  chips.append(words('Heart-rate samples', [[false, 'Every sample'], [true, 'Smoothed']], todaySmooth, pick));
  drawHr();

  if (bb.length > 1) {
    const c2 = card('Body battery', 'Garmin’s 0 to 100 energy estimate: it charges in sleep and rest, drains with stress and exercise. The morning level is the one that tells you something about the day.');
    const sBb = daySeries(bb, t0, 30 * 60);
    streamChart(c2, sBb, {
      height: 150, xMode: 'time', value: (i) => sBb.v[i], color: AMOUNT, area: true, yMin: 0, yMax: 100, width: 1.6,
      xTicks: hourTicks, aria: 'Body battery over the last 24 hours', yLabel: 'body battery, 0 to 100',
      tip: (i) => ({ place: at(t0 + sBb.t[i]), value: sBb.v[i] == null ? '–' : String(sBb.v[i]), rows: [['Body battery', 'of 100']] }),
    });
    main.append(c2);
  }
  if (st.length > 1) {
    const c3 = card('Stress', 'Heart-rate variability read as stress, 0 to 100. Under 25 is rest, over 50 is worth noticing if it is not exercise. Samples during activity are left out. Follows the sample switch above.');
    const area3 = el('div'), cap3 = capOrFold(c3);
    c3.append(area3, cap3.cap);
    main.append(c3);
    const sStRaw = daySeries(st, t0, 30 * 60);
    drawSt = () => {
      area3.replaceChildren();
      const sSt = todaySmooth ? smoothed(sStRaw, 5) : sStRaw;
      streamChart(area3, sSt, {
        height: 130, xMode: 'time', value: (i) => sSt.v[i], color: 'var(--series-2)', yMin: 0, yMax: 100, width: 1.4,
        xTicks: hourTicks, aria: 'Stress over the last 24 hours', yLabel: 'stress, 0 to 100',
        tip: (i) => ({ place: at(t0 + sSt.t[i]), value: sSt.v[i] == null ? '–' : f0(sSt.v[i]),
          rows: sSt.v[i] == null ? [] : [['Level', stressWord(sSt.v[i])], ...(todaySmooth ? [['Mean of', u(stWin, 'min')]] : [])] }),
      });
      cap3.say(todaySmooth ? `Each point the mean of five samples, about ${u(stWin, 'min')}.` : 'Each point one sample: under 26 is rest, under 51 low, under 76 medium, then high.');
    };
    drawSt();
  }
  // how the group refreshes is a method sentence: the group's first chart's fold holds it (HOUSE 11.1 rule 9)
  howTo(c1, 'This group is the live end of the app: the pull runs every hour and replaces these 24 hours each time, while the rest of the app changes only when a session is logged or the morning text is written.');
}

/* --- Plan --------------------------------------------------------------- */

function panePlan(main) {
  const p = DATA.plan;
  if (!p) {
    blockSection(main, SCALE.plan);
    const c = card('Plan');
    c.append(el('p', null, 'No plan in this snapshot. The data pull does not write one; the optional daily coaching routine does. If that is set up and this stays empty, the routine is not completing.'));
    main.append(c);
    return;
  }
  const today = todayIso();
  blockSection(main, SCALE.plan);

  const g = p.goal || {}, phone = phoneIso();
  let head = null;
  if (g.race && g.race.date >= phone) {
    const n = ago(phone, g.race.date);
    head = figure(main, 'Race day', n ? plural(n, 'day') : 'Today', `to ${g.race.name}, ${dayMon(g.race.date)}${g.race.start ? `, ${g.race.start}` : ''}`);
  }
  if (!head) { head = card(null); main.append(head); }   // the plan's verdict on a plate either way
  head.append(verdict(p.tone, p.headline || ''));

  if (g.race) {
    const c = card(`Goal: ${g.race.name}`);
    const t = facts();
    t.append(tile('Race day', date(g.race.date), g.race.start ? `start ${g.race.start}` : ''));
    t.append(tile('Distance', f1(g.race.distanceKm), '', 'km'));
    if (g.race.expect) t.append(tile('Expect', g.race.expect.split(' ')[0], g.race.expect.split(' ').slice(1).join(' ')));
    c.append(t);
    main.append(c);
  }

  runPlan(main, p, today);
  horizonLoad(main, p, today);
  dayChart(main, p, today);
  dayChart(main, p, today, 'load');

  for (const w of p.weeks || []) main.append(weekCard(w, today));

  // The reasoning, folded: the charts and the week are the plan; this is the why.
  const about = card('About this plan');
  const fold = (title, paras, open) => {
    const items = paras.filter(Boolean);
    if (!items.length) return;
    const d = el('details', 'fold');
    if (open) d.open = true;
    d.append(el('summary', null, title));
    const body = el('div', 'section said');
    for (const t of items) body.append(typeof t === 'string' ? el('p', null, t) : t);
    d.append(body);
    about.append(d);
  };
  const list = (xs) => { const ul = el('ul'); for (const x of xs) ul.append(el('li', null, x)); return ul; };
  fold(g.race ? 'The goal' : 'Goal: general fitness', [g.text, g.preferences && g.preferences.length ? `Preferences: ${g.preferences.join('; ')}.` : null]);
  if (g.strength && g.strength.programme) {
    fold(`Strength program${g.strength.from ? `, from ${date(g.strength.from)}` : ''}`,
      [`${plural(g.strength.perWeek || 1, 'session')} a week${g.strength.day ? `, ${g.strength.day} by default` : ''}.`, list(g.strength.programme), g.strength.notes]);
  }
  fold('Why this shape', [p.why]);
  fold('After that', [p.after]);
  if (p.guardrails && p.guardrails.length) fold('Stop signs', [list(p.guardrails)], true);
  howTo(about, `Plan written ${p.updated ? date(p.updated) : 'with this snapshot'} from the load, recovery, session notes and history, and the Garmin calendar. The coaching routine rewrites it each time it runs; a race added to Garmin Connect reshapes it on the routine’s next run.`);
  main.append(about);
}

/** Kilometers run in each zone, six values: Z1–Z5, then the meters run with the heart rate still
 *  under the zone 1 floor (the start of a run, mostly), which count as distance but as no training
 *  zone. With the record stream (`zk`) it is exact. Otherwise, with laps, each lap's distance goes
 *  to the zone of its average heart rate, so a fast kilometer at 173 is a zone 3 kilometer, not a
 *  share of the whole run. Without laps (older sessions) the run's kilometers are split by time in
 *  zone, which undercounts the fast zones because fast running covers more ground per minute.
 *  Scaled to the running-only distance either way. */
function kmByZone(a) {
  const out = [0, 0, 0, 0, 0, 0];
  const km = runKm(a);
  if (!(km > 0)) return out;
  if (a.zk) { // exact: every meter credited to the zone of that second's heart rate
    const zk = a.zk.length >= 6 ? a.zk.slice(0, 6) : a.zk.concat([0]);
    const tot = zk.reduce((s, v) => s + v, 0) || 1;
    return zk.map((v) => v * km / tot);
  }
  const laps = (a.laps || []).filter((l) => l[0] > 0);
  const lapTot = laps.reduce((s, l) => s + l[0], 0) / 1000;
  if (laps.length && lapTot > km * 0.6) {
    let unknown = 0;
    for (const l of laps) {
      const z = l[3] ? zoneOf(l[3]) : 0;
      if (z) out[z - 1] += l[0] / 1000; else unknown += l[0] / 1000;
    }
    const known = out.reduce((s, v) => s + v, 0);
    const scale = km / (known + unknown || 1);
    for (let i = 0; i < 5; i++) out[i] *= scale;
    if (unknown > 0) { // laps without heart rate: spread by the session's time in zone
      const t = a.z.reduce((s, v) => s + v, 0) || 1;
      for (let i = 0; i < 5; i++) out[i] += unknown * scale * a.z[i] / t;
    }
    return out;
  }
  const t = a.z.reduce((s, v) => s + v, 0);
  if (!t) { out[0] = km; return out; }
  for (let i = 0; i < 5; i++) out[i] = km * a.z[i] / t;
  return out;
}

/** Zone load per kilometer of running, from the last eight weeks with runs:
 *  what a planned kilometer is worth in load when only its distance is known. */
function loadPerKm(today) {
  const thisMon = mondayOf(today);
  const weeks = new Map();
  for (const a of DATA.activities) {
    if (a.sport !== 'run' || a.d >= thisMon) continue;
    const k = mondayOf(a.d);
    if (ago(k, thisMon) > 8 * 7) continue;
    const w = weeks.get(k) || { km: 0, load: 0 };
    w.km += runKm(a); w.load += measure(a);
    weeks.set(k, w);
  }
  const ratios = [...weeks.values()].filter((w) => w.km > 5).map((w) => w.load / w.km).sort((x, y) => x - y);
  return ratios.length ? ratios[Math.floor(ratios.length / 2)] : (isLoad() ? 8 : 6.5);
}

/** Zone load split into easy / moderate / hard, all sports. */
function loadMix(a) {
  const t = trimp(a.z);
  const part = (idx) => idx.reduce((s, i) => s + (a.z[i] / 60) * (i + 1), 0);
  return t ? [part([0, 1]), part([2]), part([3, 4])] : [0, 0, 0];
}

const BELOW = { label: 'Below Z1', color: 'var(--zone-0)' };

/* ---- Muscle load -------------------------------------------------------
 * The heart-rate measures say what the aerobic system did. This estimates
 * what the muscles did, as mechanical work in kJ per kg of body mass, from
 * the biomechanics literature rather than points:
 *   running    total mechanical work on the level about 1.0 + 0.3·v J/kg/m
 *              (external about 1, internal rising with speed v in m/s: Cavagna &
 *              Kaneko 1977, Willems, Cavagna & Heglund 1995), half of it
 *              positive (concentric) and half negative (eccentric)
 *   walking    about 0.7 J/kg/m on the level (same sources), split the same way
 *   height     g = 9.81 J/kg per meter climbed (concentric) or descended
 *              (eccentric); the metabolic cost of slopes in Minetti et al.
 *              2002 is what the grade-adjusted pace uses, the work is this
 *   eccentric  weighted for strain, since damage follows active strain more
 *              than force (Lieber & Fridén 1993): ×1 on the level (short,
 *              elastic stretch-shortening), ×3 on descents (Eston,
 *              Mickleborough & Baltzopoulos 1995; Vernillo et al. 2017), ×5
 *              for lifting through a full range under load
 *   cycling    concentric only: the watch's average power × time, else the
 *              session's calories at a gross efficiency of 0.22 (Ettema &
 *              Lorås 2009), else the Compendium MET below
 *   strength   no sets are pulled, so time at 5 MET (Ainsworth et al. 2011
 *              Compendium, moderate–vigorous resistance training) at 20%
 *              mechanical efficiency, half concentric, half eccentric ×5;
 *              full body assumed every time
 *   elliptical 5 MET at 20%, concentric; other 4 MET at 20%, half and half
 *   pack       "12 kg" in a hike's name scales its work by (mass + pack) / mass,
 *              as load carriage does (Pandolf, Givoni & Goldman 1977)
 * The weights ×3 and ×5 are the one judgment call; everything else is a
 * published magnitude. Tune them here.
 */
const MUSCLE = {
  runLevel: (v) => 1.0 + 0.3 * v, walkLevel: 0.7, g: 9.81,
  strain: { level: 1, downhill: 3, lift: 5 },
  efficiency: { bike: 0.22, lift: 0.20, other: 0.20 },
  met: { strength: 5.0, elliptical: 5.0, bike: 7.5, other: 4.0 },
  kcalJ: 4184,
};
const MUSCLE_MIX = [
  { label: 'Concentric work', color: 'var(--series-1)' },
  { label: 'Eccentric, strain-weighted', color: 'var(--series-6)' },
];
function packKg(a) {
  if (a.dt && a.dt.packKg > 0) return a.dt.packKg; // what the watch recorded for a rucking session
  const m = String(a.name || '').match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}
/** Muscle load for one activity in kJ/kg: total, concentric and (weighted)
 *  eccentric parts, and the pack weight read from the name. */
function muscleLoad(a) {
  const mass = (DATA.athlete && DATA.athlete.weightKg) || 75;
  const sport = SPORTS.some((x) => x.key === a.sport) ? a.sport : 'other';
  const gain = a.indoor ? 0 : (a.elev || 0);
  const loss = a.indoor ? 0 : (a.dt && a.dt.elevLoss != null ? a.dt.elevLoss : gain);
  const kg = sport === 'walk' ? packKg(a) : 0;
  const pack = (mass + kg) / mass;
  const metJ = (met, min) => met * MUSCLE.kcalJ * min / 60; // metabolic J/kg
  let con = 0, ecc = 0;
  if (sport === 'run') {
    const v = runKm(a) > 0 && runMin(a) > 0 ? runKm(a) * 1000 / (runMin(a) * 60) : 3;
    const level = MUSCLE.runLevel(v) * runKm(a) * 1000 + MUSCLE.walkLevel * walkKm(a) * 1000;
    con = level / 2 + MUSCLE.g * gain;
    ecc = (level / 2) * MUSCLE.strain.level + MUSCLE.g * loss * MUSCLE.strain.downhill;
  } else if (sport === 'walk') {
    const level = MUSCLE.walkLevel * a.km * 1000 * pack;
    con = level / 2 + MUSCLE.g * gain * pack;
    ecc = (level / 2) * MUSCLE.strain.level + MUSCLE.g * loss * MUSCLE.strain.downhill * pack;
  } else if (sport === 'bike') {
    const pw = a.dt && a.dt.pwr;
    con = pw ? pw * a.min * 60 / mass
      : a.cal ? a.cal * MUSCLE.kcalJ * MUSCLE.efficiency.bike / mass
      : metJ(MUSCLE.met.bike, a.min) * MUSCLE.efficiency.bike;
    if (!pw) con += MUSCLE.g * gain; // with power the climb is already in the watts
  } else if (sport === 'strength') {
    const work = metJ(MUSCLE.met.strength, a.min) * MUSCLE.efficiency.lift;
    con = work / 2; ecc = (work / 2) * MUSCLE.strain.lift;
  } else if (sport === 'elliptical') {
    con = metJ(MUSCLE.met.elliptical, a.min) * MUSCLE.efficiency.other;
  } else {
    const work = metJ(MUSCLE.met.other, a.min) * MUSCLE.efficiency.other;
    con = work / 2; ecc = (work / 2) * MUSCLE.strain.level;
  }
  return { total: (con + ecc) / 1000, con: con / 1000, ecc: ecc / 1000, kg };
}

/* Time in zone, aerobic load or muscle load: one switch for every chart that
 * shows training as something other than kilometers. Remembered on the device. */
const UNITS = [['time', 'Zone time'], ['load', 'Aerobic'], ['muscle', 'Muscle'], ['sport', 'Sport time']];
const UNIT_LONG = { time: 'time in zone', load: 'aerobic load', muscle: 'muscle load', sport: 'time in training by sport' };
let loadUnit = (() => { try { const v = localStorage.getItem('tl-loadunit'); return UNITS.some((x) => x[0] === v) ? v : 'time'; } catch (e) { return 'time'; } })();
const isLoad = () => loadUnit === 'load';
const isMuscle = () => loadUnit === 'muscle';
const isSport = () => loadUnit === 'sport';
const unitWord = () => (loadUnit === 'time' || loadUnit === 'sport' ? 'min' : loadUnit === 'muscle' ? 'kJ/kg' : 'load');
const unitName = () => UNIT_LONG[loadUnit];
const unitAxis = (per) => `${loadUnit === 'load' ? 'aerobic load' : unitWord()} per ${per}`;  // y-axis caption for the load charts
const mixDef = () => (isSport() ? SPORTS : isMuscle() ? MUSCLE_MIX : MIX);
const mixWord = (i) => (isSport() ? SPORTS[i].label.toLowerCase() : isMuscle() ? ['concentric', 'eccentric'][i] : ['easy', 'moderate', 'hard'][i]);
function unitChips() {
  return words('Load unit', UNITS, loadUnit, (key) => { loadUnit = key; try { localStorage.setItem('tl-loadunit', key); } catch (e) { /* private mode */ } render(); });
}
/** One activity in the chosen unit, split three ways: easy / moderate / hard
 *  for the heart-rate units, concentric / eccentric for muscle load. */
function measureMix(a) {
  if (isSport()) return SPORTS.map((sp) => (sportKey(a) === sp.key ? a.min : 0));
  if (isMuscle()) { const m = muscleLoad(a); return [m.con, m.ecc]; }
  return isLoad() ? loadMix(a) : [(a.z[0] + a.z[1]) / 60, a.z[2] / 60, (a.z[3] + a.z[4]) / 60];
}
const measure = (a) => (isSport() ? a.min : isMuscle() ? muscleLoad(a).total : isLoad() ? trimp(a.z) : a.z.reduce((s, v) => s + v, 0) / 60);

/** A typical strength session in the chosen unit, split like the past ones
 *  (or a fixed guess before any exist), for the planned bars. */
function plannedStrength() {
  const past = DATA.activities.filter((a) => a.sport === 'strength' && a.min > 15);
  const n = mixDef().length;
  if (!past.length) {
    const total = isSport() ? 50 : isMuscle() ? 10 : isLoad() ? 25 : 20;
    const split = isSport() ? SPORTS.map((sp) => (sp.key === 'strength' ? 1 : 0)) : isMuscle() ? [1 / 6, 5 / 6] : [1, 0, 0];
    return { total, split };
  }
  const totals = past.map(measure).sort((x, y) => x - y);
  const total = totals[Math.floor(totals.length / 2)];
  const sum = new Array(n).fill(0);
  for (const a of past) { const m = measureMix(a); for (let i = 0; i < n; i++) sum[i] += m[i] || 0; }
  const all = sum.reduce((x, v) => x + v, 0) || 1;
  return { total, split: sum.map((v) => v / all) };
}
/** Where a planned running kilometer's value goes: by the plan's easy /
 *  moderate / hard mix, all concentric for muscle, the running slot for sport time. */
function plannedRunSplit(mix) {
  if (isSport()) return SPORTS.map((sp) => (sp.key === 'run' ? 1 : 0));
  if (isMuscle()) return [1, 0];
  const m = mix || [100, 0, 0];
  return [m[0] / 100, m[1] / 100, m[2] / 100];
}

/** Two four-week averages over one series of weeks: the actual one up to and
 *  including this week, the planned one from this week on, meeting at now. */
function avgLines(totals, nowIdx) {
  const all = rolling(totals, 4);
  return [
    { values: all.map((v, i) => (i <= nowIdx ? v : null)), color: INK },
    { values: all.map((v, i) => (i >= nowIdx ? v : null)), color: INK, dash: '5 4' },
  ];
}
const AVG_LEGEND = [
  { color: INK, label: '4-week average, actual', line: true },
  { color: INK, label: '4-week average, planned', line: true, dash: true },
];

/** The Block's weeks as kilometers by heart-rate zone, in the colors the stock chart had (the owner,
 *  2026-10-03): run weeks filled, the plan's weeks split by its mix and drawn planned, this week's
 *  rest of its target on top of what was run, and the two four-week averages meeting at now. */
function runPlan(main, p, today) {
  const B = blockWeeks(DATA.activities, p, today), KM = [BELOW, ...MIX];
  if (!B.planned) return;
  const zk = new Map(B.columns.map((c) => [c.week, [0, 0, 0, 0, 0, 0]]));
  for (const a of DATA.activities) {
    const z = a.sport === 'run' && a.d <= plusDays(B.columns[B.now].week, 6) && zk.get(mondayOf(a.d));
    if (z) kmByZone(a).forEach((v, i) => { z[i] += v; });
  }
  const rows = B.columns.map((c, i) => {
    const z = zk.get(c.week), part = [z[5], z[0] + z[1], z[2], z[3] + z[4]];
    const seg = i > B.now ? [] : KM.map((m, k) => ({ v: part[k], color: m.color }));
    const rest = c.target != null ? c.target - c.km : 0, mix = c.mix || [100, 0, 0];
    if (rest > 0) MIX.forEach((m, k) => seg.push({ v: rest * mix[k] / 100, color: m.color, plan: true }));
    return { key: c.week, total: Math.max(c.km, c.target || 0), seg, part };
  });
  const marks = [{ i: B.now, label: markWord(1), after: true }];
  if (B.race) marks.push({ i: B.race.idx, label: B.race.name, race: true });
  const c = card('Running volume, past and planned',
    'Kilometers of running per week, walk breaks left out, each split by the heart-rate zone it was run in, as on the day charts: gray under the zone 1 floor, then easy, moderate and hard. Filled bars are what was run. Outlined, tinted bars are the plan’s weeks, split by its shares of easy, moderate and hard; this week’s sit on what was run so far, up to its target. The lines are the four-week averages, run and planned, meeting at now.');
  columnChart(c, {
    height: 210,
    rows,
    lines: avgLines(rows.map((r) => r.total), B.now),
    marks,
    minMax: Math.max(...rows.map((r) => r.total)) * 1.1,   // a tenth of headroom: the race's name above the tallest week
    tickFmt: (t) => f0(t),
    aria: 'Weekly running kilometers by heart-rate zone, run and planned',
    yLabel: 'km per week',
    tip: (r, i) => { const k = blockCard(B, i); delete k.say; if (i <= B.now) KM.forEach((m, j) => { if (r.part[j] >= 0.05) k.rows.push([m.label, kmU(r.part[j])]); }); return k; },
  });
  c.append(legend(KM.map((m) => ({ color: m.color, label: m.label })).concat({ color: INK, label: 'Planned', plan: true }, AVG_LEGEND)));
  c.append(help('One bar is one week, Monday to Sunday.'));
  tableToggle(c, 'runplan', () => table(['Week', 'Run km', 'Easy', 'Moderate', 'Hard', 'Below Z1', 'Plan'],
    B.columns.map((col, i) => [date(col.week), ...[col.km, ...[1, 2, 3, 0].map((k) => rows[i].part[k])].map((v) => (i > B.now ? '–' : f1(v))), col.range || (col.target != null ? f0(col.target) : '–')])));
  main.append(c);
}

/** The weeks of the Block as load: every sport counts, so a ride in place of a run keeps the bar up
 *  where the kilometers would have dropped. Done is filled; the plan is drawn in outline. */
function horizonLoad(main, p, today) {
  const horizon = p.horizon || [];
  if (!horizon.length) return;
  const thisMon = mondayOf(today);
  const backWeeks = weeksBetween(plusDays(thisMon, -77), thisMon);
  const n = mixDef().length;
  const actual = new Map(backWeeks.map((k) => [k, { km: 0, load: new Array(n).fill(0), other: 0, sessions: 0 }]));
  for (const a of DATA.activities) {
    const w = actual.get(mondayOf(a.d));
    if (!w) continue;
    const lm = measureMix(a);
    for (let i = 0; i < lm.length; i++) w.load[i] += lm[i];
    w.sessions++;
    if (a.sport !== 'run') w.other += lm.reduce((x, v) => x + v, 0); else w.km += runKm(a);
  }
  const rate = loadPerKm(today);
  const MX = mixDef();
  // A planned week is its running kilometers at the block's rate, plus, from
  // the strength start, a typical strength session — both converted to the
  // same categories as the bars, so the plan reads as expected load.
  const st = (p.goal && p.goal.strength) || null;
  const gym = plannedStrength();
  const gymWeek = (w) => (st && st.from && w >= st.from ? (st.perWeek || 1) : 0);
  const plannedSeg = (km, mix, week) => {
    const run = km * rate, rs = plannedRunSplit(mix), g = gymWeek(week) * gym.total;
    return { total: run + g, gym: g, seg: MX.map((m, i) => ({ v: run * rs[i] + g * gym.split[i], color: m.color, plan: true })) };
  };
  const rows = backWeeks.map((k) => {
    const w = actual.get(k);
    const done = w.load.reduce((x, v) => x + v, 0);
    const seg = MX.map((m, i) => ({ v: w.load[i], color: m.color }));
    const planned = k === thisMon ? (p.weeks || []).find((x) => x.start === k) : null;
    const h = k === thisMon ? horizon.find((x) => x.w === k) : null;
    const mm = planned && String(planned.targetKm || '').match(/(\d+)\D+(\d+)/);
    const target = mm ? (+mm[1] + +mm[2]) / 2 : h ? h.km : null;
    const est = target != null ? plannedSeg(target, null, k).total : null;
    if (est != null && est > done) seg.push({ v: est - done, color: MX[0].color, plan: true });
    return { key: k, total: Math.max(done, est || 0), seg, w, done, est };
  });
  for (const h of horizon) {
    if (h.w <= thisMon) continue;
    const pl = plannedSeg(h.km, h.mix, h.w);
    rows.push({ key: h.w, total: pl.total, seg: pl.seg, h, est: pl.total, gym: pl.gym });
  }
  const raceIdx = rows.findIndex((r) => r.h && r.h.kind === 'race');
  const marks = [{ i: backWeeks.length - 1, label: markWord(1), after: true }];
  if (raceIdx >= 0 && p.goal && p.goal.race) marks.push({ i: raceIdx, label: p.goal.race.name, race: true });
  const paceNote = `this block’s ${isLoad() ? `rate of about ${f0(rate)} load` : isMuscle() ? `rate of about ${u(f1(rate), 'kJ/kg')}` : `pace of about ${u(f1(rate), 'min')}`} per kilometer run`;
  const lc = isSport()
    ? card('Time in training, past and planned',
      `Minutes of training per week, every sport in its own color, the whole session, warm-up and walk breaks included. Outlined bars are the plan: the kilometers at ${paceNote}${st && st.from ? `, plus a strength session of about ${u(f0(gym.total), 'min')} a week from ${dayMon(st.from)}` : ''}.`)
    : isMuscle()
    ? card('Muscle load, past and planned',
      `Mechanical work by the muscles each week in kJ per kg of body mass, every sport counted: the work of moving on the level plus the meters climbed and descended, with the lengthening (eccentric) part weighted for strain, ×3 on descents and ×5 for lifting. Strength is taken as full body. Outlined bars are the plan’s kilometers at ${paceNote}.`)
    : isLoad()
    ? card('Training load, past and planned',
      `Zone load per week, minutes in each heart-rate zone weighted 1 to 5, across every sport, split by intensity. Filled bars are what was done, outlined bars the plan’s kilometers at ${paceNote}. Where a ride or other session stands in for a run, this stays up while the Block’s kilometers dip.`)
    : card('Time in zone, past and planned',
      `Minutes in heart-rate zones 1 to 5 per week across every sport, split by intensity; time under the zone 1 floor is left out as no training. Filled bars are what was done, outlined bars the plan’s kilometers at ${paceNote}. Where a ride or other session stands in for a run, this stays up while the Block’s kilometers dip.`);
  lc.append(unitChips());
  const unit = unitWord();
  columnChart(lc, {
    height: 210,
    rows,
    lines: avgLines(rows.map((r) => r.total), backWeeks.length - 1),
    marks,
    aria: `Weekly ${unitName()}, actual and planned`,
    yLabel: unitAxis('week'),
    tip: (r) => (r.h
      ? { place: `Week of ${date(r.key)}, planned`, value: f0(r.est), unit, rows: [['Estimate', 'from the plan’s kilometers'], ['Running', `${f0(r.est - (r.gym || 0))} from ${u(f0(r.h.km), 'km')}`], ...(r.gym ? [['Strength', f0(r.gym)]] : []), ['Kind', r.h.kind]] }
      : { place: `Week of ${date(r.key)}${r.est != null ? ', so far' : ''}`, value: f0(r.done), unit,
        rows: [['Sessions', String(r.w.sessions)], ...(r.w.other > 0 && !isSport() ? [['Other sports', f0(r.w.other)]] : []),
          ...MX.map((m, i) => (r.w.load[i] > 0.5 ? [mixWord(i), f0(r.w.load[i])] : null)).filter(Boolean),
          ...(r.est != null ? [['Plan', `about ${f0(r.est)}`]] : [])] }),
  });
  lc.append(legend(MX.map((m) => ({ color: m.color, label: m.label })).concat({ color: INK, label: 'Planned', plan: true }, AVG_LEGEND)));
  main.append(lc);
}

/** Kilometers per day over this week and next, split by heart-rate zone: what
 *  was run filled in its zone colors, what is planned in outline. */
function dayChart(main, p, today, mode = 'km') {
  const weeks = p.weeks || [];
  if (!weeks.length) return;
  const asLoad = mode === 'load';
  const rate = asLoad ? loadPerKm(today) : 1;
  const start = weeks[0].start;
  const days = [];
  for (let n = 0; n < 7 * weeks.length; n++) days.push(plusDays(start, n));
  const end = days[days.length - 1];
  const plannedByDay = new Map();
  for (const w of weeks) for (const s of w.sessions || []) plannedByDay.set(s.date, s);
  const done = new Map();
  for (const a of DATA.activities) {
    if (a.d < start || a.d > end || (!asLoad && a.sport !== 'run')) continue;
    if (!done.has(a.d)) done.set(a.d, []);
    done.get(a.d).push(a);
  }
  const midKm = (txt) => { const m = String(txt || '').match(/(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/); return m ? (m[2] ? (+m[1] + +m[2]) / 2 : +m[1]) : 0; };
  const rows = days.map((d) => {
    const acts = done.get(d) || [];
    const pl = plannedByDay.get(d);
    const seg = [];
    let total = 0;
    if (acts.length) {
      const zk = [0, 0, 0, 0, 0];
      let km = 0;
      let below = 0;
      const comp = new Array(mixDef().length).fill(0);
      for (const a of acts) {
        if (asLoad && (isMuscle() || isSport())) { const mm = measureMix(a); for (let i = 0; i < mm.length; i++) comp[i] += mm[i]; km += measure(a); }
        else if (asLoad) { for (let i = 0; i < 5; i++) zk[i] += (a.z[i] / 60) * (isLoad() ? i + 1 : 1); km += measure(a); }
        else { km += runKm(a); const k = kmByZone(a); for (let i = 0; i < 5; i++) zk[i] += k[i]; below += k[5]; }
      }
      if (asLoad && (isMuscle() || isSport())) mixDef().forEach((m, i) => seg.push({ v: comp[i], color: m.color }));
      else {
        if (below > 0) seg.push({ v: below, color: BELOW.color });
        ZONES.forEach((zn, i) => seg.push({ v: zk[i], color: zn.color }));
      }
      total = km;
    } else if (pl && pl.kind === 'strength' && d >= today && asLoad) {
      // A planned gym day: a typical strength session, split as the past ones were.
      const g = plannedStrength();
      if (isMuscle() || isSport()) mixDef().forEach((m, i) => seg.push({ v: g.total * g.split[i], color: m.color, plan: true }));
      else seg.push({ v: g.total, color: ZONES[1].color, plan: true });
      total = g.total;
    } else if (pl && pl.km && d >= today) {
      const km = midKm(pl.km) * rate;
      if (asLoad && isMuscle()) seg.push({ v: km, color: MUSCLE_MIX[0].color, plan: true });
      else if (asLoad && isSport()) seg.push({ v: km, color: SPORTS[0].color, plan: true });
      else {
        const zs = pl.zones || [100, 0, 0, 0, 0];
        const tot = zs.reduce((s, v) => s + v, 0) || 1;
        ZONES.forEach((zn, i) => seg.push({ v: km * zs[i] / tot, color: zn.color, plan: true }));
      }
      total = km;
    }
    return { key: d, total, seg, acts, pl, missed: !acts.length && pl && pl.kind !== 'rest' && d < today };
  });
  const todayIdx = days.indexOf(today);
  const marks = [];
  if (todayIdx >= 0) marks.push({ i: todayIdx, label: markWord(), after: true });
  if (weeks.length > 1) marks.push({ i: 6, label: '', after: true });

  const c = asLoad
    ? (isSport()
      ? card('Day by day, as time in training',
        `The same days as minutes of training, each sport in its own color, the whole session counted. Outlined bars are the plan at about ${u(f1(rate), 'min')} per kilometer run, and a typical strength session on a gym day.`)
      : isMuscle()
      ? card('Day by day, as muscle load',
        `The same days as muscle work in kJ/kg, concentric and eccentric weighted for strain, every sport counted. Outlined bars convert the planned kilometers at about ${u(f1(rate), 'kJ/kg')} per kilometer.`)
      : isLoad()
      ? card('Day by day, as load',
        `The same days as zone load, minutes in each zone weighted 1 to 5, with every sport counted, so a ride or a gym session shows where a run would have been. Outlined bars convert the planned kilometers at about ${f0(rate)} load per kilometer.`)
      : card('Day by day, as time in zone',
        `The same days as minutes in heart-rate zones 1 to 5, every sport counted, so a ride or a gym session shows where a run would have been; time under zone 1 is left out. Outlined bars convert the planned kilometers at about ${u(f1(rate), 'min')} per kilometer.`))
    : card('Day by day, planned and run',
      'Kilometers of running per day over this week and next. Filled bars are sessions that were run, split into the kilometers covered in each heart-rate zone, every second of the run credited to the zone it was in, with any meters run before the heart rate reached zone 1 in gray; outlined bars are planned sessions with their intended zone split.');
  if (asLoad) c.append(unitChips());
  const unit = asLoad ? unitWord() : 'km';
  columnChart(c, {
    height: 190,
    rows,
    marks,
    minMax: asLoad ? (loadUnit === 'time' ? 30 : 40) : 5,
    xLabel: (r) => dowDay(r.key),
    aria: asLoad ? `${unitName()} per day, planned and done` : 'Kilometers per day by heart-rate zone, planned and run',
    yLabel: asLoad ? unitAxis('day') : 'km per day',
    tip: (r) => {
      const place = `${dowDate(r.key)} ${r.key.slice(0, 4)}`, plan = r.pl ? [['Planned', si(r.pl.what)]] : [];
      if (r.acts.length && asLoad) return { place, value: f0(r.total), unit,
        rows: [...r.acts.map((a) => [sportWord(a), `${u(f0(measure(a)), unit)}${a.km > 0.2 ? `, ${kmU(a.sport === 'run' ? runKm(a) : a.km)}` : ''}${a.hr ? `, ${u(a.hr, 'bpm')}` : ''}`]), ...plan] };
      if (r.acts.length) {
        const zk = [0, 0, 0, 0, 0, 0];
        for (const a of r.acts) { const k = kmByZone(a); for (let i = 0; i < 6; i++) zk[i] += k[i]; }
        return { place, value: f1(r.total), unit,
          rows: [...r.acts.map((a) => ['Run', `${kmU(runKm(a))}, ${perKm(runMin(a) / runKm(a))}, ${u(hasSplit(a) ? runHr(a) : a.hr || '–', 'bpm')}`]),
            ...zk.map((v, i) => (v >= 0.05 ? [i < 5 ? `Z${i + 1}` : 'Below Z1', kmU(v)] : null)).filter(Boolean), ...plan] };
      }
      if (r.pl) return { place, value: r.pl.km ? si(r.pl.km) : '–', unit: r.pl.km ? 'km' : '',
        rows: [[r.missed ? 'Missed' : 'Planned', si(r.pl.what)], ...(asLoad && r.pl.km ? [['Estimate', `about ${u(f0(midKm(r.pl.km) * rate), unit)}`]] : []),
          ...(r.pl.pace ? [['Pace', u(r.pl.pace, '/km')]] : []), ...(r.pl.hr ? [['Heart rate', u(r.pl.hr, 'bpm')]] : [])] };
      return { place, value: '–', rows: [['Plan', 'nothing planned']] };
    },
  });
  c.append(legend((asLoad ? (isSport() ? SPORTS : isMuscle() ? MUSCLE_MIX : ZONES) : [BELOW].concat(ZONES)).map((z) => ({ color: z.color, label: z.label })).concat({ color: INK, label: 'Planned', plan: true })));
  const ranKm = rows.filter((r) => r.acts.length).reduce((s, r) => s + r.total, 0);
  const planKm = rows.filter((r) => !r.acts.length && r.pl && r.key >= today).reduce((s, r) => s + r.total, 0);
  howTo(c, asLoad
    ? `${u(f0(ranKm), unit)} done so far across the two weeks, about ${u(f0(planKm), unit)} still planned.`
    : `${kmU(ranKm)} run so far across the two weeks, ${kmU(planKm)} still planned. The list below has the same days with the reasoning behind each.`);
  main.append(c);
}

/** One week of the plan: what was run, what is planned, day by day. */
function weekCard(w, today) {
  const start = w.start;
  const end = plusDays(start, 6);
  const c = card(`${w.label}, ${dayMon(start)} to ${dayMon(end)}`);
  c.classList.add('plan');

  const done = DATA.activities.filter((a) => a.d >= start && a.d <= end && a.d <= today);
  const runs = done.filter((a) => a.sport === 'run');
  const t = facts();
  if (start <= today) {
    const km = runs.reduce((s, a) => s + runKm(a), 0);
    const hard = runs.filter((a) => a.z[3] + a.z[4] >= 300).length;
    t.append(tile('So far', f1(km), `in ${plural(runs.length, 'run')}${done.length > runs.length ? `, ${done.length - runs.length} other` : ''}${hard ? `, ${hard} hard` : ''}`, 'km'));
  }
  if (w.targetKm) t.append(tile('Volume', si(w.targetKm)));
  if (w.intensity) t.append(tile('Intensity', si(w.intensity)));
  c.append(t);

  // Merge by day: what was actually done takes the row; a planned session on a
  // day nothing was logged is shown as planned (future) or missed (past).
  const list = el('div', 'sessions');
  const byDay = new Map();
  for (const a of done) { if (!byDay.has(a.d)) byDay.set(a.d, []); byDay.get(a.d).push(a); }
  const plannedByDay = new Map((w.sessions || []).map((s) => [s.date, s]));
  for (let k = 0; k < 7; k++) {
    const d = plusDays(start, k);
    const acts = byDay.get(d) || [];
    const pl = plannedByDay.get(d);
    for (const a of acts) list.append(actualRow(a, pl && acts[0] === a ? pl : null));
    if (!acts.length && pl) list.append(plannedRow(pl, d < today && pl.kind !== 'rest'));
  }
  c.append(list);
  return c;
}

/** A small zone bar: time in each zone, filled when done, outlined when planned. */
function zoneBar(values, planned) {
  const tot = values.reduce((s, v) => s + v, 0);
  const bar = el('div', `zbar mini${planned ? ' plan' : ''}`);
  if (!tot) { bar.classList.add('empty'); return bar; }
  ZONES.forEach((z, i) => {
    if (values[i] > 0) {
      const seg = el('span');
      seg.style.flex = `${values[i]} 0 0`;
      seg.style.setProperty('--c', z.color);
      bar.append(seg);
    }
  });
  return bar;
}
/** A week row's head: the day, the session in words and its kind, the stats, the zone bar. */
function rowHead(day, what, kind, stats, bar, kindInk) {
  const s = el('summary'), body = el('div', 'sbody'), w = el('div', 'swhat');
  w.append(el('span', 'said', what), ' ', el('span', kindInk ? 'skind ink' : 'skind', kind));
  body.append(w);
  if (stats.length) body.append(el('div', 'sstats', stats.join(', ')));
  if (bar) body.append(bar);
  s.append(el('div', 'sday', dowDay(day)), body);
  return s;
}

/** A session that was run: stats and zone time in the header, the note and laps beneath. */
function actualRow(a, planned) {
  const isRun = a.sport === 'run';
  const d = el('details', 'srow');
  const stats = [];
  if (a.km > 0.2) stats.push(kmU(isRun ? runKm(a) : a.km));
  if (isRun && a.km > 0.2) stats.push(perKm(runMin(a) / runKm(a)));
  else stats.push(span(a.min));
  if (a.hr) stats.push(u(isRun && hasSplit(a) ? runHr(a) : a.hr, 'bpm'));
  if (a.dt && a.dt.te != null) stats.push(`TE ${f1(a.dt.te)}`);
  const hard = a.z[3] + a.z[4];
  if (hard >= 60) stats.push(`${span(hard / 60)} hard`);
  d.append(rowHead(a.d, sportWord(a), a.note ? a.note.verdict : 'done', stats, zoneBar(a.z), !a.note));
  const x = el('div', 'sx');
  if (planned) x.append(el('p', 'cap', `Planned: ${si(planned.what)}.`));
  if (a.note) for (const para of a.note.body || []) x.append(el('p', 'said', para));
  else x.append(el('p', 'cap', 'No evaluation written for this session yet.'));
  if (a.laps && a.laps.length > 1 && isRun) {
    const laps = a.laps.filter((l) => l[0] >= 200).map((l) => `${l[0] >= 950 ? kmU(l[0] / 1000) : u(f0(l[0]), 'm')} at ${perKm((l[1] / 60) / (l[0] / 1000))}${l[3] ? `, ${u(l[3], 'bpm')}` : ''}`);
    if (laps.length) x.append(el('p', 'cap', `Laps: ${laps.join('; ')}`));
  }
  if (a.stream) {
    const spark = el('div', 'spark');
    x.append(spark);
    loadStream(a.id).then((s) => {
      if (!s) return;
      streamChart(spark, s, { height: 56, mini: true, xMode: 'time', value: (i) => s.hr[i], color: (i, v) => zoneColor(v), aria: 'Heart rate through the session',
        tip: (i) => ({ place: `${mmss(s.t[i])} in, ${kmU(s.d[i])}`, value: s.hr[i] ? String(s.hr[i]) : '–', unit: 'bpm', rows: s.p[i] ? [['Pace', perKm(s.p[i])]] : [] }) });
      spark.append(help('Heart rate through the session, by zone.'));
    });
  }
  const b = el('button', 'textkey', 'Open in Sessions');
  b.onclick = (ev) => { ev.preventDefault(); state.activity = a.id; applyPreset('all'); syncRanges(); choose('sessions'); };
  x.append(b);
  d.append(x);
  return d;
}

/** A session still to come (or missed): the targets in the header, the reason beneath. */
function plannedRow(s, missed) {
  const d = el('details', 'srow plan');
  const stats = [];
  if (s.km && s.km !== '0') stats.push(u(s.km, 'km'));
  if (s.pace) stats.push(u(s.pace, '/km'));
  if (s.hr) stats.push(u(s.hr, 'bpm'));
  d.append(rowHead(s.date, si(s.what), missed ? 'missed' : KIND_WORD[s.kind] || s.kind || 'planned', stats, s.zones ? zoneBar(s.zones, true) : null, missed));
  const x = el('div', 'sx said');
  if (s.why) x.append(el('p', null, s.why));
  if (s.alt && !missed) x.append(el('p', null, s.alt));
  if (missed) x.append(el('p', 'cap', 'Nothing was logged on this day. Dropped, not moved.'));
  d.append(x);
  return d;
}

/* --- Running ------------------------------------------------------------ */

const weekPlace = (k) => `Week of ${date(k)}`;
function paneRunning(main) {
  const acts = selected().filter((a) => a.sport === 'run');
  const rows = weekRows(acts);
  const kms = rows.map((r) => r.runKm);
  const avg4 = rolling(kms, 4);
  const anyWalk = rows.some((r) => r.walkKm > 0.05);

  const c1 = card('Weekly running volume',
    'Bars are kilometers actually run each week: the watch’s run/walk detection strips walk breaks out of a session, so a run-walk counts only its running. The line is the trailing four-week average, the number that describes what the legs are used to.');
  columnChart(c1, {
    height: 200,
    rows: rows.map((r) => ({ ...r, total: r.runKm, seg: [{ v: r.runKm, color: AMOUNT }] })),
    lines: [{ values: avg4, color: INK }],
    tickFmt: (t) => f0(t),
    aria: 'Weekly running kilometers with a four-week average line',
    yLabel: 'km per week',
    tip: (r, i) => ({ place: weekPlace(r.key), value: f1(r.runKm), unit: 'km', rows: [['Runs', String(r.runs)],
      ...(r.walkKm > 0.05 ? [['Walked', kmU(r.walkKm)]] : []), ['4-week average', kmU(avg4[i])], ...(r.longRun ? [['Longest', kmU(r.longRun)]] : [])] }),
  });
  c1.append(legend([{ color: AMOUNT, label: 'Week total, running only' }, { color: INK, label: '4-week average', line: true }]));
  c1.append(help('One bar is one week, Monday to Sunday.'));
  tableToggle(c1, 'runweeks', () => table(
    anyWalk ? ['Week of', 'Run km', 'Walked km', 'Runs', 'Longest', '4-week average'] : ['Week of', 'Run km', 'Runs', 'Longest', '4-week average'],
    rows.map((r, i) => anyWalk
      ? [date(r.key), f1(r.runKm), f1(r.walkKm), String(r.runs), f1(r.longRun), f1(avg4[i])]
      : [date(r.key), f1(r.runKm), String(r.runs), f1(r.longRun), f1(avg4[i])])
  ));
  main.append(c1);

  // volume progression, as a ratio rather than a percentage change: a week
  // measured against the base underneath it is bounded and comparable, where a
  // week-on-week percentage explodes every time you restart from nothing.
  const ratio = rows.map((r, i) => (avg4[i] >= 1 ? Math.min(3, r.runKm / avg4[i]) : null));
  const pctChange = rows.map((r, i) => (i > 0 && rows[i - 1].runKm >= 1 ? ((r.runKm / rows[i - 1].runKm) - 1) * 100 : null));
  const c2 = card('Ramp rate: the week against its own base',
    'Each week’s running divided by the four-week average it sits on. Around 1.0 means holding steady; the shaded band, 0.8 to 1.3, is where load can keep climbing without outrunning what the tissue has adapted to. Past about 1.5 a week is a spike, and spikes are what injuries follow. Values above 3 are drawn at 3.');
  columnChart(c2, {
    height: 190,
    rows: rows.map((r, i) => ({ ...r, total: ratio[i] || 0, seg: ratio[i] == null ? [] : [{ v: ratio[i], color: AMOUNT }] })),
    band: { lo: rows.map(() => 0.8), hi: rows.map(() => 1.3), color: INK, opacity: 0.07 },
    rules: [{ at: 1.5, label: '1.5, a spike' }],
    minMax: 2,
    aria: 'Weekly running distance as a ratio of its four-week base',
    yLabel: 'week divided by its 4-week base',
    tip: (r, i) => ({ place: weekPlace(r.key), value: ratio[i] == null ? '–' : f1(ratio[i]), rows: [['Ran', `${kmU(r.runKm)} on a ${kmU(avg4[i])} base`],
      ...(pctChange[i] == null ? [] : [['Against last week', u(signed(pctChange[i]), '%')]])] }),
  });
  c2.append(legend([
    { color: AMOUNT, label: 'Week divided by its 4-week base' },
    { color: 'color-mix(in srgb, var(--ink) 7%, transparent)', label: '0.8 to 1.3, sustainable' },
    { color: 'var(--ink-2)', label: '1.5, a spike', line: true, dash: true },
  ]));
  tableToggle(c2, 'ramp', () => table(
    ['Week of', 'Run km', '4-week base', 'Ratio', 'Against last week'],
    rows.map((r, i) => [date(r.key), f1(r.runKm), f1(avg4[i]),
      ratio[i] == null ? '–' : f1(ratio[i]),
      pctChange[i] == null ? '–' : u(signed(pctChange[i]), '%')])
  ));
  main.append(c2);

  // shape of the week: two charts rather than one with two scales
  const c3 = card('The shape of the week',
    'Sessions above, the single longest run below. The same distance spread over five days and packed into one long run are not the same load, and these two together say which it was.');
  columnChart(c3, {
    height: 140,
    rows: rows.map((r) => ({ ...r, total: r.runs, seg: [{ v: r.runs, color: AMOUNT }] })),
    aria: 'Runs per week',
    yLabel: 'runs per week',
    tip: (r) => ({ place: weekPlace(r.key), value: String(r.runs), unit: r.runs === 1 ? 'run' : 'runs', rows: [['With 5\u202Fmin in Z4 or above', String(r.quality)]] }),
  });
  c3.append(help('Running sessions in the week.'));
  columnChart(c3, {
    height: 140,
    rows: rows.map((r) => ({ ...r, total: r.longRun, seg: [{ v: r.longRun, color: AMOUNT }] })),
    aria: 'Longest run each week',
    yLabel: 'longest run, km',
    tip: (r) => ({ place: weekPlace(r.key), value: f1(r.longRun), unit: 'km', rows: r.runKm > 0 ? [['Share of the week', pct((r.longRun / r.runKm) * 100)]] : [] }),
  });
  c3.append(help('The longest run in the week, running only.'));
  tableToggle(c3, 'shape', () => table(
    ['Week of', 'Runs', 'Longest km', 'Share of week', 'Runs with 5\u202Fmin in Z4 or above'],
    rows.map((r) => [date(r.key), String(r.runs), f1(r.longRun),
      r.runKm > 0 ? pct((r.longRun / r.runKm) * 100) : '–', String(r.quality)])
  ));
  main.append(c3);
}

/* --- Load --------------------------------------------------------------- */

const statusWord = (s) => (s || '').replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase();
function paneLoad(main) {
  const acts = selected();
  const rows = weekRows(acts);
  const val = (r) => (isSport() ? r.min : isMuscle() ? r.muscle : isLoad() ? r.trimp : r.zmin);
  const bySport = (r) => (isSport() ? r.bySportDur : isMuscle() ? r.bySportMuscle : isLoad() ? r.bySport : r.bySportMin);
  const totals = rows.map(val);
  const avg4 = rolling(totals, 4);
  const shown = SPORTS.filter((s) => state.sport === 'all' || s.key === state.sport);
  const unit = unitWord();

  const c1 = isSport()
    ? card('Weekly time in training, by sport',
      'One bar per week of minutes in training, stacked by sport, the whole session counted: warm-up, walk breaks and standstills included. The line is the trailing four-week average.')
    : isMuscle()
    ? card('Weekly muscle load, by sport',
      'One bar per week of mechanical work by the muscles, kJ per kg of body mass, stacked by sport: level locomotion from the biomechanics literature, meters climbed and descended, the eccentric part weighted for strain, cycling from power or calories, strength as full body from time. The line is the trailing four-week average.')
    : isLoad()
    ? card('Weekly load, by sport',
      'One bar per week, stacked by what produced the load. Load here is minutes in each heart-rate zone weighted 1 to 5, so an easy hour and a hard hour are not counted the same. The line is the trailing four-week average.')
    : card('Weekly time in zone, by sport',
      'One bar per week of minutes in heart-rate zones 1 to 5, stacked by sport; time under the zone 1 floor is left out as no training. The line is the trailing four-week average.');
  c1.append(unitChips());
  columnChart(c1, {
    height: 210,
    rows: rows.map((r) => ({ ...r, total: val(r), seg: shown.map((s) => ({ v: bySport(r)[s.key] || 0, color: s.color })) })),
    lines: [{ values: avg4, color: INK }],
    aria: `Weekly ${unitName()} stacked by sport`,
    yLabel: unitAxis('week'),
    tip: (r, i) => ({ place: weekPlace(r.key), value: f0(val(r)), unit, rows: [['In total', span(r.min)],
      ...shown.filter((s) => (bySport(r)[s.key] || 0) > 0).map((s) => [s.label, f0(bySport(r)[s.key])]), ['4-week average', f0(avg4[i])]] }),
  });
  c1.append(legend([...shown.map((s) => ({ color: s.color, label: s.label })), { color: INK, label: '4-week average', line: true }]));
  tableToggle(c1, 'loadweeks', () => table(
    ['Week of', isSport() ? 'Minutes' : isMuscle() ? 'Muscle, kJ/kg' : isLoad() ? 'Load' : 'Zone minutes', 'Hours', 'Sessions', '4-week average'],
    rows.map((r, i) => [date(r.key), f0(val(r)), f1(r.min / 60), String(r.sessions), f0(avg4[i])])
  ));
  main.append(c1);

  // Garmin acute vs optimal
  const [start, end] = windowRange();
  const gl = (DATA.garminLoad || []).filter((d) => d.d >= start && d.d <= end);
  const c2 = card('Garmin load: current against optimal',
    'Garmin’s own acute load, a rolling seven-day sum of its per-activity training load, against the range it considers optimal for the current chronic load. Below the band means the body is being asked for less than it can take; above it means the week is running ahead of the base underneath it.');
  if (gl.length < 2) {
    c2.append(el('p', 'empty', 'Garmin publishes this series only from the day it started recording it for your account. Widen the window to see it.'));
  } else {
    // every day of the window on the axis, so this chart lines up with the others
    const byDay = new Map(gl.map((d) => [d.d, d]));
    const days = dayGrid(start, end);
    const at = (d, k) => (d ? d[k] : null);
    columnChart(c2, {
      height: 200,
      rows: days.map((k) => ({ key: k, total: 0, seg: [] })),
      lines: [
        { values: days.map((k) => at(byDay.get(k), 'atl')), color: 'var(--series-2)' },
        { values: days.map((k) => at(byDay.get(k), 'ctl')), color: AMOUNT },
      ],
      band: { lo: days.map((k) => (byDay.get(k) ? byDay.get(k).ctl * 0.8 : null)), hi: days.map((k) => (byDay.get(k) ? byDay.get(k).ctl * 1.5 : null)), color: AMOUNT },
      aria: 'Garmin acute load against its optimal range',
      yLabel: 'Garmin load',
      tip: (r, i) => {
        const d = byDay.get(days[i]);
        if (!d) return { place: date(days[i]), value: '–', rows: [['Garmin load', 'none that day']] };
        return { place: date(d.d), value: f0(d.atl), rows: [['Acute', f0(d.atl)], ['Chronic', f0(d.ctl)], ['Optimal', `${f0(d.ctl * 0.8)}–${f0(d.ctl * 1.5)}`], ['Status', statusWord(d.status)]] };
      },
    });
    c2.append(legend([
      { color: 'var(--series-2)', label: 'Acute load (7 days)', line: true },
      { color: AMOUNT, label: 'Chronic load', line: true },
      { color: 'color-mix(in srgb, var(--amount) 16%, transparent)', label: 'Optimal band' },
    ]));
    c2.append(help('One point is one day.'));
    tableToggle(c2, 'garminload', () => table(
      ['Date', 'Acute', 'Chronic', 'Optimal', 'Status'],
      gl.slice().reverse().map((d) => [date(d.d), f0(d.atl), f0(d.ctl), `${f0(d.ctl * 0.8)}–${f0(d.ctl * 1.5)}`, statusWord(d.status)])
    ));
  }
  main.append(c2);

  // status through time: one strip, a color per day
  if (gl.length >= 2) {
    const c3 = card('Garmin training status through time',
      'Each day colored by the status Garmin gave it, over the same window as the chart above. Garmin flips status often, so the useful reading is the color that dominates a month, not the one it shows this morning.');
    statusStrip(c3, gl, start, end);
    main.append(c3);
  }
}

/* Garmin's status families, in the order of its own scale from too little to too much (ART.md section 2). */
const STATUS_COLOR = {
  DETRAINING: { label: 'Detraining', color: 'var(--series-8)' },
  RECOVERY: { label: 'Recovery', color: 'var(--series-1)' },
  MAINTAINING: { label: 'Maintaining', color: 'var(--series-4)' },
  PRODUCTIVE: { label: 'Productive', color: 'var(--zone-3)' },
  PEAKING: { label: 'Peaking', color: 'var(--series-6)' },
  UNPRODUCTIVE: { label: 'Unproductive', color: 'var(--zone-4)' },
  STRAINED: { label: 'Strained', color: 'var(--series-5)' },
  OVERREACHING: { label: 'Overreaching', color: 'var(--zone-5)' },
  PAUSED: { label: 'Paused', color: 'var(--zone-1)' },
  NO_STATUS: { label: 'No status', color: 'var(--zone-0)' },
};
const statusFamily = (d) => (d.status || 'NO_STATUS').replace(/_\d+$/, '');
const statusInfo = (fam) => STATUS_COLOR[fam] || { label: fam.charAt(0) + fam.slice(1).toLowerCase().replace(/_/g, ' '), color: 'var(--zone-1)' };

/** One horizontal strip across the window, each day a block of its status color. */
function statusStrip(host, gl, start, end) {
  const wrap = el('div', 'chartwrap');
  host.append(wrap);
  const byDay = new Map(gl.map((d) => [d.d, d]));
  const t0 = parse(start).getTime();
  const n = Math.round((parse(end).getTime() - t0) / DAY) + 1;
  const dayAt = (i) => iso(new Date(t0 + i * DAY));

  function draw() {
    const W = Math.max(260, wrap.clientWidth || 320);
    const padL = 8, padR = 8, top = 8, barH = 26, H = top + barH + 26;
    const iw = W - padL - padR;
    const x = (i) => padL + (i / n) * iw;
    wrap.querySelectorAll('svg').forEach((e) => e.remove());
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Garmin training status per day' });
    svg.append(svgEl('rect', { x: padL, y: top, width: iw, height: barH, fill: 'var(--line)' }));
    // one rect per run of equal status, so the strip stays crisp at any width
    let i = 0;
    while (i < n) {
      const d = byDay.get(dayAt(i));
      if (!d) { i++; continue; }
      const fam = statusFamily(d);
      let j = i + 1;
      while (j < n && byDay.get(dayAt(j)) && statusFamily(byDay.get(dayAt(j))) === fam) j++;
      svg.append(svgEl('rect', { x: r1(x(i)), y: top, width: r1(x(j) - x(i)), height: barH, fill: statusInfo(fam).color }));
      i = j;
    }
    // month labels, thinned so they never collide
    let lastPx = -Infinity;
    for (let k = 0; k < n; k++) {
      const day = dayAt(k);
      if (!day.endsWith('-01')) continue;
      const px = x(k);
      if (px - lastPx < 44 || px > W - padR - 20) continue;
      svg.append(svgEl('line', { x1: r1(px), x2: r1(px), y1: top + barH, y2: top + barH + 4, class: 'base' }));
      svg.append(svgText({ x: r1(px), y: H - 6, 'text-anchor': 'middle', class: 'tk' }, month(day, lastPx < 0 || day.slice(5, 7) === '01')));
      lastPx = px;
    }
    const cursor = svgEl('rect', { x: 0, y: top - 3, width: 2, height: barH + 6, fill: INK, opacity: 0 });
    svg.append(cursor);
    const hit = svgEl('rect', { x: padL, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const k = Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - box.left) * scale - padL) / (iw / n))));
      const d = byDay.get(dayAt(k));
      cursor.setAttribute('x', r1(x(k) + (iw / n) / 2 - 1));
      cursor.setAttribute('opacity', 1);
      showCard(wrap, { place: date(dayAt(k)), value: d ? statusInfo(statusFamily(d)).label : 'No data', rows: d ? [['Acute', f0(d.atl)], ['Chronic', f0(d.ctl)]] : [] }, x(k) / scale);
    };
    const leave = () => { hideCard(wrap); cursor.setAttribute('opacity', 0); };
    readout(hit, wrap, move, leave);
  }
  draw();
  new ResizeObserver(() => draw()).observe(wrap);

  // legend with the day count of each status, most common first
  const counts = {};
  for (const d of gl) counts[statusFamily(d)] = (counts[statusFamily(d)] || 0) + 1;
  const order = Object.keys(STATUS_COLOR);
  host.append(legend(Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([fam, v]) => ({ color: statusInfo(fam).color, label: `${statusInfo(fam).label}, ${u(v, 'd')}` }))));
  host.append(help('One sliver is one day; a gap is a day Garmin gave no status.'));
  return wrap;
}

/* --- Heart rate --------------------------------------------------------- */

function paneHeart(main) {
  const acts = selected();
  const rows = weekRows(acts);

  const c1 = card('Time in heart-rate zone, per week',
    `Zones come from the saved profile: Z1 from ${u(DATA.athlete.zoneFloors[0], 'bpm')} up to Z5 from ${u(DATA.athlete.zoneFloors[4], 'bpm')}, against a maximum of ${DATA.athlete.maxHr}, in Garmin’s own zone colors fitted to this page. Garmin applies a different zone table to some indoor sports, so a cycling session’s zone 3 is not the same effort as a run’s.`);
  c1.append(words('Zone unit', [['pct', 'Share of time'], ['min', 'Minutes']], state.zoneUnit, (key) => { state.zoneUnit = key; remember(); render(); }));
  const zRows = rows.map((r) => {
    const tot = r.z.reduce((a, b) => a + b, 0);
    return {
      ...r, _tot: tot,
      total: state.zoneUnit === 'pct' ? (tot ? 100 : 0) : tot / 60,
      seg: ZONES.map((z, i) => ({ v: tot === 0 ? 0 : (state.zoneUnit === 'pct' ? (r.z[i] / tot) * 100 : r.z[i] / 60), color: z.color })),
    };
  });
  columnChart(c1, {
    height: 210,
    rows: zRows,
    minMax: state.zoneUnit === 'pct' ? 100 : 0,
    tickFmt: (t) => (state.zoneUnit === 'pct' ? pct(t) : f0(t)),
    padL: 42,
    aria: 'Weekly time in heart-rate zone',
    yLabel: state.zoneUnit === 'pct' ? '% of recorded time' : 'min per week',
    tip: (r) => ({ place: weekPlace(r.key), value: span(r._tot / 60), rows: ZONES.map((z, i) => [z.label, `${span(r.z[i] / 60)}${r._tot ? `, ${pct((r.z[i] / r._tot) * 100)}` : ''}`]) }),
  });
  c1.append(legend(ZONES.map((z) => ({ color: z.color, label: z.label }))));
  tableToggle(c1, 'zones', () => table(
    ['Week of', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Total'],
    rows.map((r) => [date(r.key), ...r.z.map((s) => span(s / 60)), span(r.z.reduce((a, b) => a + b, 0) / 60)])
  ));
  main.append(c1);

  // distribution
  const zt = [0, 0, 0, 0, 0];
  for (const r of rows) for (let i = 0; i < 5; i++) zt[i] += r.z[i];
  const tot = zt.reduce((a, b) => a + b, 0);
  const t = facts();
  t.append(tile('Easy (Z1–2)', tot ? pct(((zt[0] + zt[1]) / tot) * 100) : '–', span((zt[0] + zt[1]) / 60)));
  t.append(tile('Moderate (Z3)', tot ? pct((zt[2] / tot) * 100) : '–', span(zt[2] / 60)));
  t.append(tile('Hard (Z4–5)', tot ? pct(((zt[3] + zt[4]) / tot) * 100) : '–', span((zt[3] + zt[4]) / 60)));
  const lastHard = [...DATA.activities].reverse().find((a) => a.z[3] + a.z[4] >= 300);
  t.append(tile('Last hard session', lastHard ? dayMon(lastHard.d) : 'none',
    lastHard ? `${plural(ago(lastHard.d, phoneIso()), 'day')} ago` : 'no session with 5\u202Fmin in Z4 or above'));
  main.append(t);

  // HR vs pace: outdoor runs, running portion only
  const c2 = card('Heart rate against pace',
    'One dot per outdoor run with at least fifteen minutes of running. Pace and heart rate cover the running only, walk breaks stripped out, and the treadmill is left out because its pace is whatever the belt claims. Dots drifting right and down mean the same pace is costing more beats; left and up is the shape of getting fitter. The equipment filter above narrows the dots.');
  c2.append(words('Dot colors', [['stroller', 'Color by stroller'], ['shoe', 'Color by shoe']], state.scatterBy, (key) => { state.scatterBy = key; remember(); render(); }));

  const runs = selected({ sportFilter: false }).filter((a) =>
    a.sport === 'run' && !a.indoor && runHr(a) && runKm(a) > 1.5 && runMin(a) >= 15);
  const cats = scatterCategories(runs);
  const points = runs.map((a) => {
    const p = runMin(a) / runKm(a);
    const cat = cats.of(a);
    return {
      x: runHr(a), y: p, color: cat.color,
      tip: { place: date(a.d), value: perKm(p), rows: [['Ran', kmU(runKm(a))], ['Heart rate', u(runHr(a), 'bpm')],
        ...(walkKm(a) > 0.05 ? [['Walked', kmU(walkKm(a))]] : []), [cats.title, cat.label], ...(a.g && a.g.length ? [['Gear', a.g.map(gearName).join(', ')]] : [])] },
    };
  });
  scatterChart(c2, {
    points, height: 230,
    xLabel: 'Average heart rate while running, bpm',
    yLabel: 'pace, min/km',
    yFmt: (v) => pace(v),
    xFmt: (v) => f0(v),
    aria: 'Scatter of running heart rate against running pace for outdoor runs',
  });
  c2.append(legend(cats.list.map((c) => ({ color: c.color, label: c.label }))));
  c2.append(help('One dot is one run.'));
  tableToggle(c2, 'hrpace', () => table(
    ['Date', 'Run km', 'Pace', 'Run HR', cats.title],
    runs.slice().reverse().map((a) => [date(a.d), f1(runKm(a)), perKm(runMin(a) / runKm(a)), String(runHr(a)), cats.of(a).label])
  ));
  main.append(c2);

  // aerobic efficiency
  const easy = DATA.activities.filter((a) => {
    const tz = a.z.reduce((x, y) => x + y, 0);
    return a.sport === 'run' && !a.indoor && runHr(a) && runKm(a) > 2 && runMin(a) >= 15 && tz > 0 &&
      (a.z[0] + a.z[1]) / tz >= 0.75 && gearMatchIfShown(a);
  });
  const byMonth = new Map();
  for (const a of easy) {
    const m = a.d.slice(0, 7) + '-01';
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(a);
  }
  const [wStart, wEnd] = windowRange();
  const effRows = [...byMonth.entries()].filter(([m]) => m >= wStart.slice(0, 7) + '-01' && m <= wEnd).sort()
    .map(([m, list]) => ({ key: m, total: list.reduce((s, a) => s + runHr(a) * (runMin(a) / runKm(a)), 0) / list.length, n: list.length }));
  const c3 = card('Aerobic efficiency on easy runs',
    'Running heart rate multiplied by running pace, for outdoor runs spent mostly in zones 1 and 2. Lower is better: it means fewer beats per kilometer. It is a crude index and it moves with terrain, heat and how disciplined the easy days are; read the direction over months, never a single point.');
  if (effRows.length < 2) {
    c3.append(el('p', 'empty', 'Not enough easy outdoor runs in this window.'));
  } else {
    const vals = effRows.map((r) => r.total);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const padv = Math.max(20, (hi - lo) * 0.2);
    const avg3 = rolling(vals, 3);
    columnChart(c3, {
      height: 180,
      rows: effRows.map((r) => ({ ...r, total: 0, seg: [] })),
      lines: [{ values: vals, color: AMOUNT }, { values: avg3, color: INK }],
      yMin: Math.floor((lo - padv) / 10) * 10,
      yMax: Math.ceil((hi + padv) / 10) * 10,
      aria: 'Monthly aerobic efficiency index',
      yLabel: 'heartbeats per km, lower is better',
      tip: (r, i) => ({ place: month(r.key), value: f0(r.total), unit: 'beats per km', rows: [['From', plural(r.n, 'easy run')], ['3-month average', f0(avg3[i])]] }),
    });
    c3.append(legend([{ color: AMOUNT, label: 'Month index, lower is better', line: true }, { color: INK, label: '3-month average', line: true }]));
    tableToggle(c3, 'eff', () => table(['Month', 'Index', 'Runs'], effRows.slice().reverse().map((r) => [month(r.key), f0(r.total), String(r.n)])));
  }
  main.append(c3);
}

function gearMatchIfShown(a) {
  return (PANE_FILTERS[state.tab] || []).includes('gear') ? gearMatch(a) : true;
}

function gearName(code) {
  const g = DATA.gear.find((x) => x.code === code);
  return g ? g.name : code;
}
function isShoe(g) {
  return g.code !== 'STROLLER' && (!g.type || /shoe/i.test(g.type));
}
// Every shoe keeps the same color whatever the filter shows, so a dot's
// color means the same thing on every visit: slot = position in the
// catalog, which the snapshot keeps stable.
function shoeColor(code) {
  const i = DATA.gear.filter(isShoe).findIndex((g) => g.code === code);
  return i < 0 ? 'var(--zone-0)' : `var(--series-${(i % SHOE_SLOTS) + 1})`;
}

function scatterCategories(runs) {
  if (state.scatterBy === 'shoe') {
    const present = new Set();
    for (const a of runs) for (const g of a.g || []) if (g !== 'STROLLER') present.add(g);
    const list = DATA.gear.filter(isShoe).filter((g) => present.has(g.code))
      .map((g) => ({ key: g.code, label: g.name, color: shoeColor(g.code) }));
    const none = { key: 'none', label: 'Other or none', color: 'var(--zone-0)' };
    const showNone = runs.some((a) => !(a.g || []).some((g) => g !== 'STROLLER' && present.has(g)));
    return {
      list: showNone ? [...list, none] : list,
      title: 'Shoe',
      of: (a) => list.find((c) => (a.g || []).includes(c.key)) || none,
    };
  }
  const list = [
    { key: 'yes', label: 'With stroller', color: 'var(--series-2)' },
    { key: 'no', label: 'Without stroller', color: 'var(--series-1)' },
  ];
  return { list, title: 'Stroller', of: (a) => ((a.g || []).includes('STROLLER') ? list[0] : list[1]) };
}

/* --- Fitness readouts (VO₂ max trend, race predictions) ------------------ */

// On Health, under the window: the VO₂ max series is short (Garmin publishes it
// from the day it started recording it for the account).
function vo2Card(main) {
  const [start, end] = windowRange();
  const weekly = windowIsWeekly(start, end);
  // The history series lists the days Garmin recomputed the estimate; the
  // daily load series carries a value too and covers the days before the
  // history was first pulled.
  const src = (DATA.vo2 && DATA.vo2.length ? DATA.vo2 : (DATA.garminLoad || []).filter((d) => d.vo2 != null).map((d) => ({ d: d.d, v: d.vo2 })))
    .filter((d) => d.d >= start && d.d <= end);
  if (src.length < 2) return;
  const buckets = healthBuckets(src, weekly, start, end);
  // carried forward between recomputes, as Garmin's own trend chart does
  let last = null;
  const measured = buckets.map((b) => (b.days.length ? meanOf(b.days, 'v') : null));
  const vals = measured.map((v) => { if (v != null) last = v; return last; });
  const [lo, hi] = minMax(vals);
  const c3 = card('VO₂ max estimate', 'Garmin recomputes this after runs and smooths it hard, so it lags real change by weeks. Between recomputes the last value is carried forward, as in Garmin Connect. Direction over a month or two is the only part worth reading.');
  columnChart(c3, {
    height: 165,
    rows: buckets.map((b) => ({ key: b.key, total: 0, seg: [] })),
    lines: [{ values: vals, color: AMOUNT }],
    yMin: Math.floor(lo - 1),
    yMax: Math.ceil(hi + 1),
    tickFmt: (t) => f1(t),
    aria: 'VO₂ max estimate over time',
    yLabel: 'VO₂ max, ml/kg/min',
    tip: (r, i) => ({ place: weekly ? weekPlace(buckets[i].key) : date(buckets[i].key), value: vals[i] == null ? '–' : f1(vals[i]), unit: vals[i] == null ? '' : 'ml/kg/min',
      rows: vals[i] == null ? [['Estimate', 'none yet']] : measured[i] == null ? [['Estimate', 'carried forward']] : [] }),
  });
  howTo(c3, `${plural(src.length, 'recompute')}, ${date(src[0].d)} to ${date(src[src.length - 1].d)}: ${f1(lo)} to ${f1(hi)}. The axis starts below the lowest reading rather than at zero, which is legitimate for a line and would not be for bars.`);
  tableToggle(c3, 'vo2', () => table(['Date', 'VO₂ max'], src.slice().reverse().map((d) => [date(d.d), f1(d.v)])));
  main.append(c3);
}

function toSec(t) {
  if (!t) return null;
  return String(t).split(':').map(Number).reduce((acc, v) => acc * 60 + v, 0);
}
/** "1:54:00" to "1:54", so a range of two half-marathon times fits a phone-width column. */
const short = (t) => String(t).replace(/^(\d+:\d{2}):00$/, '$1');

/** Race predictions: Garmin's figure beside the agent's, per distance. The table is
 *  the point of the section; the reasoning folds away under it. */
function raceCard(main, gn) {
  const rc = DATA.racecast;
  const garmin = gn.racePredictions || {};
  if (!rc && !Object.keys(garmin).length) return;
  const c = card(rc ? 'Race predictions: Garmin and the agent' : 'Garmin race predictions');
  const rows = rc ? rc.predictions : [['5K', `5${NB}km`], ['10K', `10${NB}km`], ['half', 'Half marathon'], ['marathon', 'Marathon']].map(([key, label]) => ({ key, label }));
  const t = table(rc ? ['Distance', 'Garmin', 'Agent', 'Difference'] : ['Distance', 'Garmin'], []);
  t.className = 'racetable';
  const tb = t.tBodies[0];
  for (const p of rows) {
    const g = garmin[p.key];
    const tr = el('tr');
    tr.append(el('td', null, si(p.label)), el('td', null, g || '–'));
    if (rc) {
      const d = g && p.mine ? toSec(p.mine) - toSec(g) : null;
      const agent = el('td', 'agent');
      agent.append(el('b', null, p.mine || 'no basis'), el('small', null, p.low && p.high ? `${short(p.low)}–${short(p.high)}` : p.confidence === 'none' ? 'nothing to go on' : ''));
      tr.append(agent, el('td', null, d == null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${mmss(Math.abs(d))}`));
    }
    tb.append(tr);
  }
  c.append(t);
  if (!rc) {
    howTo(c, 'Derived from the VO₂ max estimate rather than from any race you actually ran, so treat them as a fitness index with time units, not a plan.');
    main.append(c); return;
  }

  const b = rc.basis || {};
  c.append(help('A plus is the agent slower than Garmin.'));

  // the method sentence opens the fold (HOUSE 11.1 rule 9); the card keeps its one short label
  const more = el('details', 'fold');
  more.append(el('summary', null, 'Why the numbers differ'));
  const body = el('div', 'section said');
  body.append(el('p', null, `Garmin’s times come from its VO₂ max estimate and assume the training to use it. The agent’s are anchored on your actual races and capped by the current base. ` +
    `The agent’s estimate is from ${date(rc.updated)}${rc.kind === 'nudge' ? ' (nudged, not re-analyzed)' : ''}, on VO₂ max ${f1(b.vo2)}, ` +
    `${kmU(b.runKm28)} run in the previous 28 days and a longest run of ${kmU(b.longestRunKm90)} in three months; it moves only when the evidence does.`));
  if (rc.summary) body.append(el('p', null, rc.summary));
  for (const p of rc.predictions) {
    if (!p.why) continue;
    body.append(el('h3', null, `${si(p.label)}: ${p.mine || 'no prediction'}, ${p.confidence === 'none' ? 'no basis' : `${p.confidence} confidence`}`), el('p', null, p.why));
  }
  if (rc.outlook) {
    const o = rc.outlook;
    body.append(el('h3', null, `In ${o.horizon || 'a few weeks'}`), el('p', null, `${o.condition ? `${o.condition.charAt(0).toUpperCase()}${o.condition.slice(1)}: ` : ''}` +
      ['5K', '10K', 'half', 'marathon'].filter((k) => o[k]).map((k) => `${{ '5K': `5${NB}km`, '10K': `10${NB}km`, half: 'half', marathon: 'marathon' }[k]} ${o[k]}`).join(', ')));
  }
  if (rc.anchors && rc.anchors.length) {
    body.append(el('h3', null, 'What the agent anchors on'));
    for (const a of rc.anchors) {
      const p = el('p');
      p.append(el('b', null, `${date(a.date)}, ${a.event}, ${a.time} (${u(a.pace, '/km')}).`), ` ${a.note}`);
      body.append(p);
    }
  }
  if (rc.method && rc.method.length) {
    const ul = el('ul');
    for (const m of rc.method) ul.append(el('li', null, m));
    body.append(el('h3', null, 'How the agent makes the number'), ul);
  }
  more.append(body);
  c.append(more);
  main.append(c);
}

/* --- Sessions ----------------------------------------------------------- */

const SPORT_WORD = { run: 'Run', bike: 'Ride', strength: 'Strength', elliptical: 'Elliptical', walk: 'Hike or walk', row: 'Row', swim: 'Swim', other: 'Other' };
const TE_WORD = {
  RECOVERY: 'Recovery', AEROBIC_BASE: 'Aerobic base', TEMPO: 'Tempo', LACTATE_THRESHOLD: 'Lactate threshold',
  VO2MAX: 'VO₂ max', ANAEROBIC_CAPACITY: 'Anaerobic capacity', SPEED: 'Speed', UNKNOWN: 'Too short to rate',
};
const LAP_KIND = {
  W: { label: 'Warm-up', color: 'var(--series-4)' },
  A: { label: 'Work', color: 'var(--series-1)' },
  R: { label: 'Recovery', color: 'var(--zone-1)' },
  C: { label: 'Cool-down', color: 'var(--series-4)' },
};
const FEEL_WORD = { 0: 'very weak', 25: 'weak', 50: 'normal', 75: 'strong', 100: 'very strong' };

function sportWord(a) {
  return (SPORT_WORD[a.sport] || 'Other') + (a.indoor && a.sport !== 'strength' ? ' (indoor)' : '');
}
function zoneOf(bpm) {
  const f = DATA.athlete.zoneFloors;
  let z = 0;
  for (let i = 0; i < 5; i++) if (bpm >= f[i]) z = i + 1;
  return z; // 0 = below zone 1
}
/** Every zone token stands at 3:1 on the page (ART.md section 2), so lines and bars share it. */
function zoneColor(bpm) {
  const z = zoneOf(bpm);
  return z ? `var(--zone-${z})` : 'var(--zone-0)';
}
const zoneText = (bpm) => (zoneOf(bpm) ? `zone ${zoneOf(bpm)}` : 'below zone 1');
const LINE_LEGEND = [BELOW, ...ZONES];

function paneSessions(main) {
  const list = selected().slice().reverse(); // newest first
  const c = card('Pick a session',
    `Every session in the window, newest first. Full detail (laps, running dynamics, training effect) is kept for sessions since ${date(DATA.detailSince || DATA.activities[0].d)}; older ones show the summary the weekly charts are built from. The filters above narrow the list.`);
  if (!list.length) {
    c.append(el('p', 'empty', 'No sessions match this window and filter.'));
    main.append(c);
    return;
  }
  if (!list.some((a) => a.id === state.activity)) state.activity = list[0].id;

  const year = phoneIso().slice(0, 4);
  const box = el('div', 'sesslist');
  const rows = new Map();
  for (const a of list) {
    const b = el('button', 'sess');
    b.setAttribute('aria-current', String(a.id === state.activity));
    const sport = SPORTS.find((s) => s.key === sportKey(a));
    const when = el('span', 's-date', dowDate(a.d));
    if (!a.d.startsWith(year)) when.append(el('small', null, a.d.slice(0, 4)));
    const name = el('b', 'said');
    const dot = el('i', 'dot');
    dot.style.setProperty('--c', sport ? sport.color : 'var(--series-5)');
    name.append(dot, a.name || sportWord(a));
    const main_ = el('span', 's-main');
    main_.append(name, el('small', null, [sportWord(a), span(a.min), a.hr ? u(a.hr, 'bpm') : null, a.race ? 'race' : null].filter(Boolean).join(', ')));
    const side = el('span', 's-side', a.km > 0.2 ? kmU(runKm(a)) : span(a.min));
    side.append(el('small', null, a.dt ? (TE_WORD[a.dt.teLabel] || '') : 'summary'));
    b.append(when, main_, side);
    b.onclick = () => {
      state.activity = a.id;
      remember();
      for (const [id, node] of rows) node.setAttribute('aria-current', String(id === a.id));
      detail.replaceChildren();
      renderSession(detail, a);
      const m = $('main'), f = $('filters');   // below the filters as they stand once the scroll has tucked them
      m.scrollTo({ top: m.scrollTop + detail.getBoundingClientRect().top - m.getBoundingClientRect().top - 8 - f.offsetHeight + $('picksRow').offsetHeight, behavior: reduced.matches ? 'auto' : 'smooth' });
    };
    rows.set(a.id, b);
    box.append(b);
  }
  c.append(box);
  main.append(c);

  const detail = el('div', 'sessdetail');
  main.append(detail);
  renderSession(detail, list.find((a) => a.id === state.activity));
  const sel = rows.get(state.activity);
  if (sel) box.scrollTop = Math.max(0, sel.offsetTop - box.offsetTop - box.clientHeight / 2);
}

function renderSession(host, a) {
  const dt = a.dt || {};
  const hasDist = a.km > 0.2;
  const isRun = a.sport === 'run' || a.sport === 'walk';

  const h = card(a.name || sportWord(a));
  const gear = (a.g || []).map(gearName);
  h.append(el('p', 'cap', [`${dowDate(a.d)} ${a.d.slice(0, 4)}${a.t ? `, ${a.t}` : ''}`, sportWord(a), a.race ? 'race' : null, ...gear].filter(Boolean).join(', ')));
  if (hasDist) figure(h, hasSplit(a) ? 'Running' : 'Distance', kmU(isRun ? runKm(a) : a.km), `${span(a.min)}${isRun ? `, ${perKm(runMin(a) / runKm(a))}` : a.sport === 'bike' ? `, ${u(f1(a.km / (a.min / 60)), 'km/h')}` : ''}`);
  else figure(h, 'Time', span(a.min), a.hr ? u(a.hr, 'bpm') : '');

  const t = facts();
  if (hasDist) {
    if (hasSplit(a)) t.append(tile('Running', f1(runKm(a)), walkKm(a) >= 0.05 ? `plus ${kmU(walkKm(a))} walked` : 'no walk breaks', 'km'));
    else t.append(tile('Distance', f1(a.km), a.indoor ? 'as the machine reports it' : '', 'km'));
  }
  t.append(tile('Time', span(a.min), dt.mov && span(dt.mov / 60) !== span(a.min) ? `moving ${span(dt.mov / 60)}` : ''));
  if (hasDist && isRun) {
    t.append(tile('Pace', pace(runMin(a) / runKm(a)), hasSplit(a) ? 'running portion' : 'whole session', '/km'));
  } else if (hasDist && a.sport === 'bike') {
    t.append(tile('Speed', f1(a.km / (a.min / 60)), dt.maxSpd ? `max ${u(f1(dt.maxSpd * 3.6), 'km/h')}` : '', 'km/h'));
  }
  if (a.hr) t.append(tile('Heart rate', String(hasSplit(a) ? runHr(a) : a.hr), `max ${a.hrMax || '–'}${dt.minHr ? `, min ${dt.minHr}` : ''}`, 'bpm'));
  if (dt.te != null) t.append(tile('Training effect', f1(dt.te), [TE_WORD[dt.teLabel], dt.anTe ? `anaerobic ${f1(dt.anTe)}` : null].filter(Boolean).join(', ')));
  if (dt.load != null) t.append(tile('Garmin load', f0(dt.load), `own zone load ${f0(trimp(a.z))}`));
  else t.append(tile('Zone load', f0(trimp(a.z)), 'minutes in zone, weighted 1 to 5'));
  if (!a.indoor && (a.elev || dt.elevLoss)) t.append(tile('Climb', f0(a.elev), dt.elevLoss != null ? `${u(f0(dt.elevLoss), 'm')} down` : '', 'm'));
  if (dt.cad && isRun) t.append(tile('Cadence', f0(dt.cad), dt.stride ? `stride ${u(f0(dt.stride), 'cm')}` : '', 'spm'));
  if (dt.pwr) t.append(tile('Power', f0(dt.pwr), dt.np ? `normalized ${u(f0(dt.np), 'W')}` : '', 'W'));
  if (dt.gct) t.append(tile('Ground contact', f0(dt.gct), dt.vo ? `oscillation ${u(f1(dt.vo), 'cm')}` : '', 'ms'));
  if (dt.modMin != null || dt.vigMin != null) t.append(tile('Intensity minutes', f0((dt.modMin || 0) + 2 * (dt.vigMin || 0)), `${f0(dt.modMin || 0)} moderate, ${f0(dt.vigMin || 0)} vigorous`));
  {
    const m = muscleLoad(a);
    if (m.total > 0) t.append(tile('Muscle work', f1(m.total), `${f1(m.con)} concentric, ${f1(m.ecc)} eccentric, strain-weighted${m.kg ? `, pack ${u(f0(m.kg), 'kg')}` : ''}`, 'kJ/kg'));
  }
  if (a.cal) t.append(tile('Calories', f0(a.cal), ''));
  if (a.wx && a.wx.t != null) t.append(tile('Weather', f0(a.wx.t), [a.wx.desc ? a.wx.desc.toLowerCase() : null, a.wx.h != null ? `${pct(a.wx.h)} humidity` : null, wind(a.wx)].filter(Boolean).join(', '), '°C'));
  if (dt.bb != null) t.append(tile('Body battery change', signed(dt.bb), [dt.feel != null ? `felt ${FEEL_WORD[dt.feel] || dt.feel}` : null, dt.rpe ? `effort ${f0(dt.rpe / 10)} of 10` : null].filter(Boolean).join(', ')));
  h.append(t);
  host.append(h);
  if (a.stream && !a.indoor) host.append(mapCard(a));

  if (a.note) {
    const n = card(null);
    n.append(verdict(a.note.tone, '', `${a.note.verdict || 'Evaluation'}.`));
    for (const para of a.note.body || []) n.append(el('p', 'said', para));
    if (a.note.written) n.append(help(`Written ${date(a.note.written)}, on the refresh that first saw this session.`));
    host.append(n);
  } else if (a.dt) {
    h.append(help('No evaluation written for this session yet.'));
  }

  if (a.stream) host.append(streamCard(a, t));
  if (a.laps && a.laps.length) host.append(lapCard(a));
  host.append(zoneCard(a));
  if (!a.dt) host.append(card('Summary only', `This session is older than ${date(DATA.detailSince || a.d)}, so only the summary the weekly charts use is kept for it: distance, time, heart rate and zone time.`));
}

/* --- Session curves, from the per-second record stream ------------------- */

const streamCache = new Map();
function loadStream(id) {
  if (!streamCache.has(id)) {
    // Recent sessions ride inside the snapshot, which the Shortcut replaces on
    // every run; older ones are files in the app ZIP.
    const embedded = DATA.streams && DATA.streams[id];
    streamCache.set(id, embedded ? Promise.resolve(embedded)
      : fetch(`./data/streams/${id}.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return streamCache.get(id);
}

/** Line chart over a stream: x is elapsed time or distance, y is spec.value(i).
 *  Gaps where the value is null; the line takes spec.color per point, so a
 *  heart-rate trace can change color with the zone. A tap or a sideways slide reads a point. */
function streamChart(host, s, spec) {
  const wrap = el('div', 'chartwrap');
  host.append(wrap);
  const mini = !!spec.mini;

  function draw() {
    const W = Math.max(200, wrap.clientWidth || 320);
    const H = spec.height || 150;
    const padL = mini ? 2 : 40, padR = mini ? 2 : 8, padT = mini ? 3 : spec.yLabel ? 20 : 10, padB = mini ? 3 : 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    wrap.querySelectorAll('svg, .empty').forEach((e) => e.remove());
    const n = s.t.length;
    const xs = spec.xMode === 'dist' ? s.d : s.t;
    const xMax = xs[n - 1] || 1;
    const vals = [];
    for (let i = 0; i < n; i++) { const v = spec.value(i); vals.push(v != null && isFinite(v) ? v : null); }
    const finite = vals.filter((v) => v != null);
    if (finite.length < 2) { wrap.append(el('p', 'empty', spec.emptyText || 'Nothing recorded for this.')); return; }
    let lo = Math.min(...finite), hi = Math.max(...finite);
    if (spec.yMin != null) lo = Math.min(lo, spec.yMin);
    if (spec.yMax != null) hi = Math.max(hi, spec.yMax);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const ticks = mini ? [lo, hi] : ticksIn(lo, hi, 4);
    if (!mini) { lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]); }
    const y = (v) => (spec.invert ? padT + ((v - lo) / (hi - lo)) * ih : padT + ih - ((v - lo) / (hi - lo)) * ih);
    const x = (i) => padL + (xs[i] / xMax) * iw;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'session curve' });
    if (!mini) {
      yCaption(svg, spec.yLabel, padL);
      for (const t of ticks) {
        gridLine(svg, padL, W - padR, y(t));
        tickLabel(svg, padL - 5, r1(y(t) + 3.5), (spec.yFmt || f0)(t));
      }
      let ly = -99;   // a rule's word is left out within 12 px of the last one drawn
      for (const r of spec.rules || []) if (r.at >= lo && r.at <= hi) { const far = Math.abs(y(r.at) - ly) >= 12; ruleLine(svg, padL, W - padR, y(r.at), far && r.label); if (far) ly = y(r.at); }
      // x axis
      if (spec.xTicks) {
        const placed = spec.xTicks.map((tk) => ({ ...tk, px: padL + (tk.at / xMax) * iw }));
        for (const tk of placed) if (tk.grid) svg.append(svgEl('line', { x1: r1(tk.px), x2: r1(tk.px), y1: padT, y2: padT + ih, class: 'grid' }));
        // a 1 × 3 px tick at every mark, its label centered; one within 38 px of the last or off the chart is left out
        let lastPx = -Infinity;
        for (const { px } of placed) svg.append(svgEl('line', { x1: r1(px), x2: r1(px), y1: padT + ih, y2: padT + ih + 3, class: 'base' }));
        for (const tk of placed) if (tk.px - lastPx >= 38 && tk.px > padL + 14 && tk.px < W - 14) tickLabel(svg, r1(lastPx = tk.px), H - 8, tk.label, 'middle');
      } else if (spec.xMode === 'dist') {
        const step = [0.5, 1, 2, 5, 10, 20].find((st) => xMax / st <= 7) || 50;
        for (let k = step; k < xMax; k += step) tickLabel(svg, r1(padL + (k / xMax) * iw), H - 8, u(step < 1 ? f1(k) : f0(k), 'km'), 'middle');
      } else {
        const stepMin = [1, 2, 5, 10, 15, 20, 30, 60, 120].find((st) => xMax / 60 / st <= 6) || 240;
        for (let m = stepMin; m * 60 < xMax; m += stepMin) tickLabel(svg, r1(padL + (m * 60 / xMax) * iw), H - 8, u(f0(m), 'min'), 'middle');
      }
      gridLine(svg, padL, W - padR, padT + ih, true);
    }

    if (spec.area) {
      let d = '', open = false;
      const base = padT + ih;
      for (let i = 0; i < n; i++) {
        const v = vals[i];
        if (v == null) { if (open) { d += `L${r1(x(i - 1))},${base}Z`; open = false; } continue; }
        if (!open) { d += `M${r1(x(i))},${base}L`; open = true; }
        d += `${r1(x(i))},${r1(y(v))} `;
      }
      if (open) d += `L${r1(x(n - 1))},${base}Z`;
      svg.append(svgEl('path', { d, fill: typeof spec.color === 'string' ? spec.color : AMOUNT, opacity: 0.16 }));
    }

    // One path per run of the same color, each starting at the previous point
    // so the trace stays continuous where the color changes.
    let d = '', cur = null, prevPt = null;
    const sw = spec.width || (mini ? 1.5 : 2);
    const flush = () => { if (d) linePath(svg, d, cur, null, sw); d = ''; };
    for (let i = 0; i < n; i++) {
      const v = vals[i];
      if (v == null) { flush(); cur = null; prevPt = null; continue; }
      const c = typeof spec.color === 'function' ? spec.color(i, v) : (spec.color || AMOUNT);
      const pt = `${r1(x(i))},${r1(y(v))}`;
      if (c !== cur) { flush(); cur = c; d = prevPt ? `M${prevPt}L${pt}` : `M${pt}`; }
      else d += `L${pt}`;
      prevPt = pt;
    }
    flush();

    const cursor = svgEl('line', { x1: 0, x2: 0, y1: padT, y2: padT + ih, stroke: INK, 'stroke-width': 1, opacity: 0, 'pointer-events': 'none' });
    const dot = cursorDot(mini ? 2.5 : 3.5);
    svg.append(cursor, dot);
    const hit = svgEl('rect', { x: padL, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);
    if (!spec.tip) return;

    const show = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const xv = Math.max(0, Math.min(xMax, ((ev.clientX - box.left) * scale - padL) / iw * xMax));
      let i = 0;
      while (i < n - 1 && xs[i + 1] <= xv) i++;
      if (i < n - 1 && xs[i + 1] - xv < xv - xs[i]) i++;
      const px = x(i);
      cursor.setAttribute('x1', r1(px)); cursor.setAttribute('x2', r1(px)); cursor.setAttribute('opacity', 0.5);
      if (vals[i] != null) { dot.setAttribute('cx', r1(px)); dot.setAttribute('cy', r1(y(vals[i]))); dot.setAttribute('opacity', 1); }
      else dot.setAttribute('opacity', 0);
      showCard(wrap, spec.tip(i), px / scale, vals[i] != null ? y(vals[i]) / scale : null);
    };
    const hide = () => { hideCard(wrap); cursor.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); };
    readout(hit, wrap, show, hide);
  }
  draw();
  new ResizeObserver(() => draw()).observe(wrap);
}

/** Aerobic decoupling: speed per heartbeat in the second half of the running
 *  against the first. Positive means the heart rate drifted up for the same
 *  pace: the steadier the run, the smaller the number. */
function hrDrift(s) {
  const pts = [];
  const v = s.v || s.p.map((p) => (p ? 60 / p : null));
  for (let i = 0; i < s.t.length; i++) if (v[i] && s.hr[i]) pts.push({ t: s.t[i], v: v[i] / s.hr[i] });
  if (pts.length < 40) return null;
  const mid = pts[Math.floor(pts.length / 2)].t;
  const a = pts.filter((p) => p.t < mid), b = pts.filter((p) => p.t >= mid);
  const mean = (arr) => arr.reduce((x, p) => x + p.v, 0) / arr.length;
  const e1 = mean(a), e2 = mean(b);
  return { pct: ((e1 - e2) / e1) * 100, minutes: (s.t[s.t.length - 1] - s.t[0]) / 60 };
}

/* ------------------------------------------------------------------ route map */

let mapColor = 'hr';
const TILE_CREDIT = { kartverket: '© Kartverket', usgs: 'USGS The National Map', osm: '© OpenStreetMap contributors', test: 'test tiles' };
// The template's own sessions (ids `demo-…`, the generator's rule) follow course shapes derived from
// OpenStreetMap, whose ODbL asks for the credit wherever they are drawn (TILES.md); a pull's own never do.
const OSM = (a) => String(a.id).startsWith('demo-');

/** A color on the theme's route ramp (js/palette.js) for a value in [lo, hi]. */
function rampColor(v, lo, hi) {
  const R = RAMP[darkMQ.matches ? 'dark' : 'light'];
  const t = hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0.5;
  const k = t * (R.length - 1), i = Math.min(R.length - 2, Math.floor(k)), f = k - i;
  const hex = (c) => [1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16));
  const a = hex(R[i]), b = hex(R[i + 1]);
  return `rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * f)).join(',')})`;
}
/** A point of a stream as the readout card: the place in time and distance, the figure, the rest. */
function streamPoint(s, i, bike, key, byDist) {
  const p = s.p[i], v = s.v ? s.v[i] : null, hr = s.hr[i];
  const at = byDist ? `${kmU(s.d[i])}, ${mmss(s.t[i])} in` : `${mmss(s.t[i])} into the session, ${kmU(s.d[i])}`;
  const fig = {
    hr: [hr ? String(hr) : '–', 'bpm'], pace: bike ? [v ? f1(v) : 'stopped', v ? 'km/h' : ''] : [p ? pace(p) : 'walking', p ? '/km' : ''],
    gap: [s.gap && s.gap[i] ? pace(s.gap[i]) : '–', '/km'], cap: [s.cap && s.cap[i] ? pace(s.cap[i]) : '–', '/km'],
    cad: [s.cad[i] ? String(s.cad[i]) : '–', bike ? 'rpm' : 'spm'], pw: [s.pw && s.pw[i] ? String(s.pw[i]) : '–', 'W'], alt: [s.alt[i] != null ? f0(s.alt[i]) : '–', 'm'],
  }[key];
  const rows = [];
  if (key !== 'hr' && hr) rows.push(['Heart rate', `${u(hr, 'bpm')}, ${zoneText(hr)}`]);
  if (key === 'hr' && hr) rows.push(['Zone', zoneText(hr).replace('zone ', '')]);
  if (key !== 'pace') rows.push(bike ? ['Speed', v ? u(f1(v), 'km/h') : 'stopped'] : ['Pace', p ? perKm(p) : 'walking']);
  if (!bike && key !== 'gap' && s.gap && s.gap[i]) rows.push(['Grade-adjusted', perKm(s.gap[i])]);
  if (!bike && key !== 'cap' && s.cap && s.cap[i]) rows.push(['Condition-adjusted', perKm(s.cap[i])]);
  if (key === 'cap' && s.head && s.head[i] != null) rows.push(['Wind along the route', u(signed(s.head[i], 1), 'm/s')]);
  if (key !== 'cad' && s.cad[i]) rows.push(['Cadence', u(s.cad[i], bike ? 'rpm' : 'spm')]);
  if (key !== 'pw' && s.pw && s.pw[i]) rows.push(['Power', u(s.pw[i], 'W')]);
  if (key !== 'alt' && s.alt[i] != null) rows.push(['Elevation', u(f0(s.alt[i]), 'm')]);
  return { place: at, value: fig[0], unit: fig[1], rows };
}

/** The route on a web-mercator canvas, colored per bin. Positions are the
 *  bin means from the record stream; the street tiles behind it are bundled
 *  in data/tiles by the pull (one zoom per session), so nothing is fetched
 *  from the network. */
function mapCard(a) {
  const c = card('Route');
  const holder = el('div');
  c.append(holder);
  loadStream(a.id).then((s) => {
    const has = (arr) => Array.isArray(arr) && arr.some((v) => v != null);
    if (!s || !has(s.lat) || !has(s.lon)) { c.remove(); return; }
    const bike = a.sport === 'bike';
    const paceCap = a.sport === 'walk' ? 25 : 8.5; // a hike is meant to be slow; a run this slow is a walk break
    const n = s.t.length;
    const pts = [];
    for (let i = 0; i < n; i++) if (s.lat[i] != null && s.lon[i] != null) pts.push(i);
    if (pts.length < 5) { c.remove(); return; }
    // Web mercator at zoom 0 (256 px world), refined to a fractional zoom below.
    const mx = (lon) => (lon + 180) / 360 * 256;
    const my = (lat) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 256; };
    const xs = pts.map((i) => mx(s.lon[i])), ys = pts.map((i) => my(s.lat[i]));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);

    const modes = [['hr', 'Heart-rate zone'], !bike && has(s.p) ? ['pace', 'Pace'] : null, bike && has(s.v) ? ['speed', 'Speed'] : null,
      has(s.cad) ? ['cad', 'Cadence'] : null, has(s.pw) ? ['pw', 'Power'] : null, has(s.alt) ? ['alt', 'Elevation'] : null].filter(Boolean);
    if (!modes.some((m) => m[0] === mapColor)) mapColor = 'hr';
    const chips = el('div');
    const wrap = el('div', 'mapwrap chartwrap');
    const legendHost = el('div');
    const sub = howTo(c, '');   // how to read the map, in the section's fold
    // OpenStreetMap's credit stays under a map its data drew, one line at its foot (HOUSE 4.15 exception 1)
    const mapcredit = el('p', 'mapcredit');
    mapcredit.setAttribute('translate', 'no');
    // Distance window: two thumbs on one track, indexes into the positioned bins.
    let lo = 0, hi = pts.length - 1;
    const rangeRow = el('div', 'maprange');
    const rangeLabel = el('p', 'range-label');
    const dual = el('div', 'dual');
    const track = el('div', 'dual-track');
    const fill = el('div', 'dual-fill');
    track.append(fill);
    const fromR = el('input'), toR = el('input');
    for (const [r, label] of [[fromR, 'Start of the shown track'], [toR, 'End of the shown track']]) {
      r.type = 'range'; r.min = '0'; r.max = String(pts.length - 1); r.step = '1'; r.setAttribute('aria-label', label);
    }
    fromR.value = '0'; toR.value = String(pts.length - 1);
    dual.append(track, fromR, toR);
    // Elevation profile on the same x axis as the thumbs, so the window can be
    // set by the terrain: the shown stretch is drawn strong, the rest muted.
    // Its marker follows the map readout, and a finger on it scrubs the map.
    let mark = () => {}, unmark = () => {};
    const altAt = pts.map((i) => s.alt[i]);
    const hasAlt = altAt.some((v) => v != null);
    const smoothAlt = altAt.map((_, k) => { const w = altAt.slice(Math.max(0, k - 2), k + 3).filter((v) => v != null); return w.length ? w.reduce((x, v) => x + v, 0) / w.length : null; });
    const climb = (p, q) => { let up = 0, down = 0; for (let k = p + 1; k <= q; k++) { if (smoothAlt[k] == null || smoothAlt[k - 1] == null) continue; const dz = smoothAlt[k] - smoothAlt[k - 1]; if (dz > 0) up += dz; else down -= dz; } return [up, down]; };
    const profile = el('div', 'profile');
    if (hasAlt) {
      const N = pts.length - 1;
      const vals = altAt.filter((v) => v != null);
      const zlo = Math.min(...vals), zhi = Math.max(...vals);
      const span_ = Math.max(zhi - zlo, 10);
      const py = (v) => r1(100 - ((v - zlo) / span_) * 88 - 6);
      const seg = (p, q) => { let d = ''; for (let k = p; k <= q; k++) { if (altAt[k] == null) continue; d += `${d ? 'L' : 'M'}${k},${py(altAt[k])}`; } return d; };
      const area = (p, q) => { const d = seg(p, q); return d ? `${d}L${q},100L${p},100Z` : ''; };
      const profSvg = svgEl('svg', { viewBox: `0 0 ${N} 100`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Elevation profile of the session' });
      const muteA = svgEl('path', { d: area(0, N), fill: 'var(--line)' });
      const muteL = svgEl('path', { d: seg(0, N), fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', opacity: 0.6 });
      const winA = svgEl('path', { fill: AMOUNT, opacity: 0.16 });
      const winL = svgEl('g');  // the window's line, in the same colors as the track on the map
      profSvg.append(muteA, muteL, winA, winL);
      const profDot = el('i', 'pdot');  // an HTML dot: the svg is stretched, so a circle in it would be an ellipse
      profDot.hidden = true;
      profile.append(profSvg, profDot, el('span', 'ymax', u(f0(zhi), 'm')), el('span', 'ymin', u(f0(zlo), 'm')));
      profile.colorAt = () => AMOUNT;
      profile.redraw = () => {
        winA.setAttribute('d', area(lo, hi));
        winL.replaceChildren();
        let d = '', cur = null, prev = null;
        const flush = () => { if (d) winL.append(svgEl('path', { d, fill: 'none', stroke: cur, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' })); d = ''; };
        for (let k = lo; k <= hi; k++) {
          if (altAt[k] == null) { flush(); cur = null; prev = null; continue; }
          const col = profile.colorAt(k);
          const pt = `${k},${py(altAt[k])}`;
          if (col !== cur) { flush(); cur = col; d = prev ? `M${prev}L${pt}` : `M${pt}`; }
          else d += `L${pt}`;
          prev = pt;
        }
        flush();
      };
      profile.redraw();
      // Scrub along the profile: x maps straight to the bin index.
      const showAt = (ev) => {
        const box = profSvg.getBoundingClientRect();
        mark(Math.max(lo, Math.min(hi, Math.round((ev.clientX - box.left) / box.width * N))));
      };
      readout(profSvg, wrap, showAt, () => unmark());
      profile.place = (k) => {
        if (k == null || altAt[k] == null) { profDot.hidden = true; return; }
        const f = k / N;
        profDot.style.left = `calc(22px + ${r1(f * 100)}% - ${r1(f * 44)}px)`;
        profDot.style.top = `${r1(py(altAt[k]) / 100 * 64)}px`;
        profDot.hidden = false;
      };
    }
    rangeRow.append(rangeLabel, profile, dual);
    const syncRange = () => {
      fromR.value = String(lo); toR.value = String(hi);
      const max = Math.max(1, pts.length - 1);
      fill.style.left = `${(lo / max) * 100}%`;
      fill.style.right = `${100 - (hi / max) * 100}%`;
      const [up, down] = hasAlt ? climb(lo, hi) : [0, 0];
      const terrain = hasAlt ? `, up ${u(f0(up), 'm')}, down ${u(f0(down), 'm')}` : '';
      rangeLabel.textContent = (lo === 0 && hi === pts.length - 1 ? `Whole session, ${kmU(s.d[pts[hi]])}` : `${f1(s.d[pts[lo]])} to ${kmU(s.d[pts[hi]])} of ${kmU(s.d[pts[pts.length - 1]])}`) + terrain;
      fromR.setAttribute('aria-valuetext', kmU(s.d[pts[lo]]));
      toR.setAttribute('aria-valuetext', kmU(s.d[pts[hi]]));
      if (profile.redraw) profile.redraw();
    };
    let drawTrack = () => {};
    fromR.oninput = () => { lo = +fromR.value; if (lo > hi) hi = lo; syncRange(); drawTrack(); };
    toR.oninput = () => { hi = +toR.value; if (hi < lo) lo = hi; syncRange(); drawTrack(); };
    syncRange();
    holder.append(chips, wrap, rangeRow, legendHost);

    const render = () => {
      chips.replaceChildren(words('Route colors', modes, mapColor, (key) => { mapColor = key; render(); }));

      const W = Math.max(200, wrap.clientWidth || 340);
      const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
      const H = Math.round(Math.max(200, Math.min(W * 0.95, W * spanY / spanX + 40)));
      wrap.style.height = `${H}px`;
      const zoom = Math.min(17.5, Math.log2(Math.min(W * 0.84 / spanX, (H - 24) * 0.84 / spanY)));
      const sc = Math.pow(2, zoom);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const px = (i) => (mx(s.lon[i]) - cx) * sc + W / 2;
      const py = (i) => (my(s.lat[i]) - cy) * sc + H / 2;
      wrap.querySelectorAll('.tiles, svg').forEach((e) => e.remove());
      hideCard(wrap);

      // Street tiles: the inventory in the snapshot says which tiles the app
      // ZIP holds. The zoom fitted to this session goes on top; the two coarser
      // zooms and the next finer one go underneath, scaled, so a route in a
      // known area has a map even before its own tiles have reached the phone.
      const inventory = Array.isArray(DATA.tiles) && DATA.tiles.length ? new Set(DATA.tiles) : null;
      const m = s.map;
      const sources = new Set(m && m.src ? m.src : []);
      let drawn = 0;
      if (m || inventory) {
        const layer = el('div', darkMQ.matches ? 'tiles dark' : 'tiles');
        const ox = W / 2 - cx * sc, oy = H / 2 - cy * sc; // screen position of the world's origin
        const zTop = m ? m.z : Math.min(18, Math.floor(zoom) + 1);
        // Coarsest first; a finer zoom scaled down beats a coarser one scaled up,
        // so it sits just under the exact zoom.
        for (const z of [zTop - 2, zTop - 1, zTop + 1, zTop]) {
          if (z < 1 || z > 18) continue;
          const tsz = 256 * Math.pow(2, zoom - z);        // one tile of this zoom, in px on screen
          for (let tx = Math.floor(-ox / tsz); tx * tsz + ox < W; tx++) {
            for (let ty = Math.floor(-oy / tsz); ty * tsz + oy < H; ty++) {
              const inFit = m && z === m.z && tx >= m.x0 && tx <= m.x1 && ty >= m.y0 && ty <= m.y1;
              if (inventory ? !inventory.has(`${z}/${tx}/${ty}`) : !inFit) continue;
              const img = el('img');
              img.src = `./data/tiles/${z}/${tx}/${ty}.png`;
              img.alt = '';
              img.draggable = false;
              Object.assign(img.style, { left: `${r1(tx * tsz + ox)}px`, top: `${r1(ty * tsz + oy)}px`, width: `${tsz}px`, height: `${tsz}px` });
              img.onerror = () => img.remove();
              layer.append(img);
              drawn++;
            }
          }
        }
        if (drawn) { wrap.prepend(layer); if (!sources.size) sources.add('kartverket'); }
      }

      // Color per bin, this session's own 5th to 95th percentile, at least `min` apart (a display choice About names).
      let colorAt, legendEl;
      const cont = (arr, fmtv, invert, unit, min) => {
        const vals = pts.map((i) => arr[i]).filter((v) => v != null).sort((x, y) => x - y);
        if (vals.length < 2) return null;
        let p5 = vals[Math.floor(vals.length * 0.05)], p95 = vals[Math.floor(vals.length * 0.95)];
        if (p95 - p5 < min) { p5 = vals[Math.floor(vals.length / 2)] - min / 2; p95 = p5 + min; }
        const f = (i) => (arr[i] == null ? 'var(--ink-3)' : rampColor(invert ? -arr[i] : arr[i], invert ? -p95 : p5, invert ? -p5 : p95));
        const l = el('div', 'ramp');
        const bar = el('i');
        bar.style.background = `linear-gradient(90deg, ${RAMP[darkMQ.matches ? 'dark' : 'light'].join(', ')})`;
        l.append(el('span', null, invert ? `slower ≥ ${u(fmtv(p95), unit)}` : `≤ ${fmtv(p5)}`), bar, el('span', null, invert ? `faster ≤ ${u(fmtv(p5), unit)}` : `≥ ${u(fmtv(p95), unit)}`));
        return [f, l, invert ? u(min * 60, 's/km') : u(min, unit)];
      };
      let pair = null;
      if (mapColor === 'pace') pair = cont(s.p.map((v) => (v && v <= paceCap ? v : null)), pace, true, '/km', 0.75);
      else if (mapColor === 'speed') pair = cont(s.v, f1, false, 'km/h', 4);
      else if (mapColor === 'cad') pair = cont(s.cad, f0, false, bike ? 'rpm' : 'spm', 10);
      else if (mapColor === 'pw') pair = cont(s.pw, f0, false, 'W', 30);
      else if (mapColor === 'alt') pair = cont(s.alt, f0, false, 'm', 20);
      if (pair) { colorAt = pair[0]; legendEl = pair[1]; }
      else {
        colorAt = (i) => zoneColor(s.hr[i] || 0);
        const seen = new Set(pts.map((i) => zoneOf(s.hr[i] || 0)));
        legendEl = legend(LINE_LEGEND.filter((_, k) => seen.has(k)));
      }

      profile.colorAt = (k) => colorAt(pts[k]);
      if (profile.redraw) profile.redraw();
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Route map' });
      const P = pts.map((i) => `${r1(px(i))},${r1(py(i))}`);
      const dot = cursorDot(5);
      wrap.prepend(svg);
      if (drawn) svg.before(wrap.querySelector('.tiles'));
      // The track itself is redrawn when the distance window moves; the tiles,
      // the color scale and the legend stay as they are, so a partial track is
      // colored on the same scale as the whole session.
      drawTrack = () => {
        svg.replaceChildren();
        if (lo > 0 || hi < pts.length - 1) svg.append(svgEl('path', { d: 'M' + P.join('L'), class: 'route-out' }));
        svg.append(svgEl('path', { d: 'M' + P.slice(lo, hi + 1).join('L'), class: 'route-casing' }));
        let d = '', cur = null;
        const flush = () => { if (d) svg.append(svgEl('path', { d, fill: 'none', stroke: cur, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })); d = ''; };
        for (let k = lo; k <= hi; k++) {
          const col = colorAt(pts[k]);
          if (col !== cur) { flush(); cur = col; d = k > lo ? `M${P[k - 1]}L${P[k]}` : `M${P[k]}`; }
          else d += `L${P[k]}`;
        }
        flush();
        const [x0, y0] = P[lo].split(','), [x1, y1] = P[hi].split(',');
        svg.append(svgEl('circle', { cx: x1, cy: y1, r: 5, class: 'finish' }), svgEl('circle', { cx: x0, cy: y0, r: 4.5, class: 'start' }), dot);
        unmark();
      };
      drawTrack();
      legendHost.replaceChildren(legendEl);
      sub.textContent = `Start is the filled dot, finish the ring. Colored by ${modes.find((x) => x[0] === mapColor)[1].toLowerCase()}${pair ? ` between this session’s own 5th and 95th percentile, at least ${pair[2]} apart, whatever the slider shows` : ''}. Tap the map, or slide sideways, to read points along the track; the two thumbs narrow the shown distance.${s.map ? '' : ' The streets for this session are not bundled yet; they come with the next data pull.'}`;
      // the tiles' other sources (USGS The National Map, Kartverket) are credited in About, whose terms ask for the
      // credit, not for a place on the map (HOUSE 4.15)
      const osmRoute = OSM(a), osmTiles = drawn && sources.has('osm');
      mapcredit.textContent = osmRoute && osmTiles ? `Route and map: ${TILE_CREDIT.osm}, ODbL.` : osmRoute ? `Route: ${TILE_CREDIT.osm}, ODbL.` : osmTiles ? `Map: ${TILE_CREDIT.osm}, ODbL.` : '';
      if (mapcredit.textContent) wrap.after(mapcredit); else mapcredit.remove();   // no element when OpenStreetMap drew nothing

      unmark = () => { hideCard(wrap); dot.setAttribute('opacity', 0); if (profile.place) profile.place(null); };
      mark = (k) => {
        const box = svg.getBoundingClientRect();
        const i = pts[k];
        dot.setAttribute('cx', r1(px(i))); dot.setAttribute('cy', r1(py(i))); dot.setAttribute('opacity', 1);
        if (profile.place) profile.place(k);
        showCard(wrap, streamPoint(s, i, bike, 'pace'), px(i) * box.width / W, py(i) * box.height / H);
      };
      const show = (ev) => {
        const box = svg.getBoundingClientRect();
        const ex = (ev.clientX - box.left) * W / box.width, ey = (ev.clientY - box.top) * H / box.height;
        let best = -1, bd = Infinity;
        for (let k = lo; k <= hi; k++) { const dx = px(pts[k]) - ex, dy = py(pts[k]) - ey; const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = k; } }
        if (best < 0 || bd > 60 * 60) { unmark(); return; }
        mark(best);
      };
      readout(svg, wrap, show, unmark);
    };
    render();
    new ResizeObserver(() => { if (Math.abs((wrap.clientWidth || 0) - parseFloat(wrap.dataset.w || 0)) > 8) { wrap.dataset.w = wrap.clientWidth; render(); } }).observe(wrap);
  });
  return c;
}

/** One-line weather summary for a session's station reading. */
function wxLine(wx) {
  if (!wx) return 'no station reading';
  return `${u(f0(wx.t), '°C')}, ${wind(wx)}`;
}
/** The station's wind (km/h in the data) in m/s, as the headwind is. */
const wind = (wx) => `wind ${u(f1((wx.w || 0) / 3.6), 'm/s')}${wx.wc ? ` from ${wx.wc.toUpperCase()}` : ''}`;

let streamX = 'time';
let paceByZone = false;
function streamCard(a, tilesHost) {
  const bike = a.sport === 'bike';
  const c = card('Session curves');
  // how to read the curves lives in the section's fold (HOUSE 11.1 rule 9): what they are, then each long note
  const intro = howTo(c, 'From the watch’s record, averaged into bins of a few seconds. Tap to read a point; tap outside to release.');
  const notes = el('div');
  intro.after(notes);
  const holder = el('div');
  c.append(holder);
  loadStream(a.id).then((s) => {
    if (!s || !s.t || s.t.length < 10) { holder.append(el('p', 'cap', 'The record stream for this session is not on the phone yet. Recent sessions arrive with the next data refresh; older ones come with the app ZIP.')); return; }
    const has = (arr) => Array.isArray(arr) && arr.some((v) => v);
    const series = ['heart rate', has(s.v) ? (bike ? 'speed' : 'pace') : null, has(s.gap) ? 'grade-adjusted pace' : null, has(s.cap) ? 'condition-adjusted pace' : null, has(s.cad) ? 'cadence' : null, has(s.pw) ? 'power' : null, has(s.alt) ? 'elevation' : null].filter(Boolean);
    intro.textContent = `${series.join(', ').replace(/^./, (ch) => ch.toUpperCase())} from the watch’s record, averaged into bins of a few seconds${bike && !has(s.v) ? '; an indoor ride without sensors records only the heart rate' : ''}. Tap to read a point; tap outside to release.`;
    if (tilesHost && !bike) {
      const dr = hrDrift(s);
      if (dr) tilesHost.append(tile('Heart-rate drift', signed(dr.pct, 1),
        dr.minutes < 20 ? 'second half against the first; too short to mean much' : dr.pct < 5 ? 'second half against the first; steady' : 'second half against the first; drifting', '%'));
      if (s.cond) {
        const hw = s.cond.head || 0;
        tilesHost.append(tile('Headwind', signed(hw, 1),
          `${Math.abs(hw) < 0.3 ? 'about neutral along the route' : hw > 0 ? 'against you on average' : 'behind you on average'}${s.cond.heat ? `, heat +${pct(s.cond.heat)}` : ''}`, 'm/s'));
      }
    }
    const chips = el('div', 'wordrow');
    const area = el('div');
    const floors = DATA.athlete.zoneFloors;
    const hasDist = s.d[s.d.length - 1] > 0.2;
    if (!hasDist) streamX = 'time'; // an indoor ride without a speed sensor has no distance to plot against
    const render = () => {
      chips.replaceChildren(words('Curve axis', hasDist ? [['time', 'By time'], ['dist', 'By distance']] : [['time', 'By time']], streamX, (key) => { streamX = key; render(); }));
      if (has(s.v) && has(s.hr)) chips.append(toggleWord(`${bike ? 'Speed' : 'Pace'} by heart-rate zone`, paceByZone, () => { paceByZone = !paceByZone; render(); }));
      const tip = (key) => (i) => streamPoint(s, i, bike, key, streamX === 'dist');
      const paceColor = paceByZone ? (i) => zoneColor(s.hr[i] || 0) : AMOUNT;
      area.replaceChildren();
      const said = [];   // the long notes, into the fold in the curves' order
      const note = (text) => { if (text.length > 64) said.push(el('p', null, text)); else area.append(help(text)); };
      streamChart(area, s, {
        height: 170, xMode: streamX, value: (i) => s.hr[i], color: (i, v) => zoneColor(v),
        yMin: Math.max(60, floors[0] - 15),
        rules: [...floors.slice(1).map((f, k) => ({ at: f, label: `Z${k + 2}` })), { at: DATA.athlete.lthr, label: `threshold ${DATA.athlete.lthr}` }],
        aria: 'Heart rate through the session', yLabel: 'bpm', tip: tip('hr'),
      });
      note('Heart rate, colored by zone. Dashed lines are the zone floors and the lactate threshold.');
      if (bike) {
        if (has(s.v)) {
          streamChart(area, s, { height: 150, xMode: streamX, value: (i) => (s.v ? s.v[i] : null), color: paceColor, yMin: 0, aria: 'Speed through the ride', yLabel: 'km/h', tip: tip('pace') });
          note(`Speed in km/h${paceByZone ? ', colored by the heart-rate zone at that moment' : ''}. Stops are left as gaps.`);
        }
      } else {
        // Anything slower than 8:30 /km is a shuffle into or out of a walk break; as
        // a gap it keeps the axis on the running.
        const paceCap = a.sport === 'walk' ? 25 : 8.5;
        const paceOf = (arr) => (i) => (arr[i] && arr[i] <= paceCap ? arr[i] : null);
        const zoneNote = paceByZone ? ', colored by the heart-rate zone at that moment' : '';
        streamChart(area, s, { height: 150, xMode: streamX, value: paceOf(s.p), color: paceColor, invert: true, yFmt: pace, aria: 'Pace through the session', yLabel: 'min/km, faster is higher', tip: tip('pace'), emptyText: 'No running pace recorded.' });
        note(`Pace in min/km, faster is higher${zoneNote}. ${a.sport === 'walk' ? 'Standstills' : 'Walk breaks'} are left as gaps.`);
        if (has(s.gap)) {
          streamChart(area, s, { height: 150, xMode: streamX, value: paceOf(s.gap), color: paceColor, invert: true, yFmt: pace, aria: 'Grade-adjusted pace through the session', yLabel: 'grade-adjusted min/km', tip: tip('gap') });
          note(`Grade-adjusted pace: the flat-ground pace that would cost the same effort, from the slope of the smoothed altitude and the running-cost curve${zoneNote}.`);
        }
        if (has(s.cap)) {
          streamChart(area, s, { height: 150, xMode: streamX, value: paceOf(s.cap), color: paceColor, invert: true, yFmt: pace, aria: 'Condition-adjusted pace through the session', yLabel: 'condition-adjusted min/km', tip: tip('cap') });
          note(`Condition-adjusted pace: the same, then corrected for the wind along your direction of travel (one station reading at the start, ${wxLine(a.wx)}) and the day’s heat${zoneNote}. Read it as the flat, still-air, cool-day pace this effort would have bought.`);
        }
      }
      if (has(s.cad)) {
        streamChart(area, s, { height: 110, xMode: streamX, value: (i) => (s.cad[i] && (bike ? s.v && s.v[i] : s.p[i]) ? s.cad[i] : null), color: AMOUNT, aria: 'Cadence', yLabel: bike ? 'rpm' : 'steps per minute', tip: tip('cad') });
        note(bike ? 'Cadence in rpm, while moving.' : 'Cadence in steps per minute, running only.');
      }
      if (has(s.pw)) {
        streamChart(area, s, { height: 120, xMode: streamX, value: (i) => s.pw[i] || null, color: AMOUNT, yMin: 0, aria: 'Power', yLabel: 'watts', tip: tip('pw') });
        note(bike ? 'Power in watts.' : 'Running power in watts, as the watch estimates it.');
      }
      if (has(s.alt)) {
        streamChart(area, s, { height: 100, xMode: streamX, value: (i) => s.alt[i], color: AMOUNT, area: true, aria: 'Elevation', yLabel: 'meters above sea level', tip: tip('alt') });
        note('Elevation in meters.');
      }
      notes.replaceChildren(...said);
    };
    render();
    holder.append(chips, area);
  });
  return c;
}

function lapCard(a) {
  const L = a.laps.map((r, i) => ({
    n: i + 1, dist: r[0] || 0, dur: r[1] || 0, mov: r[2], hr: r[3], maxHr: r[4], cad: r[5], pwr: r[6],
    gain: r[7], loss: r[8], maxSpd: r[9], kind: r[10],
  }));
  const structured = L.some((l) => l.kind);
  const isBike = a.sport === 'bike';
  const c = card('Laps',
    structured
      ? 'Bar width is lap duration, so the shape of the workout is the shape of the chart: work in the running tone, warm-up and cool-down in ocher; recoveries are left out of the pace chart and drawn by zone on the heart-rate one. Tap a bar to pin its numbers.'
      : 'Auto-laps, one per kilometer; bar width is lap duration. Tap a bar to pin its numbers.');
  const colorKind = (l) => (l.kind && LAP_KIND[l.kind] ? LAP_KIND[l.kind].color : AMOUNT);
  const paceOf = (l) => (l.dist >= 100 && l.dur > 0 ? (l.dur / 60) / (l.dist / 1000) : null);
  const speedOf = (l) => (l.dist >= 100 && l.dur > 0 ? (l.dist / 1000) / (l.dur / 3600) : null);
  // Recovery laps are jogs or standstills; their pace would stretch the axis
  // and say nothing, so the pace chart leaves them as gaps (HR keeps them).
  const paceBar = (l) => (l.kind === 'R' ? null : paceOf(l));
  const speedBar = (l) => (l.kind === 'R' ? null : speedOf(l));
  const distText = (l) => (l.dist >= 1000 ? kmU(l.dist / 1000) : u(f0(l.dist), 'm'));
  const tipOf = (l) => ({
    place: `Lap ${l.n}${l.kind && LAP_KIND[l.kind] ? `, ${LAP_KIND[l.kind].label.toLowerCase()}` : ''}`,
    value: paceOf(l) ? (isBike ? f1(speedOf(l)) : pace(paceOf(l))) : '–', unit: paceOf(l) ? (isBike ? 'km/h' : '/km') : '',
    rows: [['Distance', `${distText(l)} in ${span(l.dur / 60)}`], ...(l.hr ? [['Heart rate', `${u(l.hr, 'bpm')}, max ${l.maxHr || '–'}`]] : []),
      ...(l.cad ? [['Cadence', f0(l.cad)]] : []), ...(l.pwr ? [['Power', u(f0(l.pwr), 'W')]] : []),
      ...(l.gain || l.loss ? [['Climb', `up ${u(f0(l.gain || 0), 'm')}, down ${u(f0(l.loss || 0), 'm')}`]] : [])],
  });

  if (a.km > 0.2) {
    lapChart(c, L, {
      height: 160,
      value: isBike ? speedBar : paceBar,
      color: colorKind,
      tickFmt: isBike ? (t) => f0(t) : (t) => pace(t),
      aria: isBike ? 'Speed per lap' : 'Pace per lap',
      yLabel: isBike ? 'km/h' : 'min/km, taller is slower',
      tip: tipOf,
      emptyText: 'No lap long enough to have a pace.',
    });
  }
  lapChart(c, L, {
    height: 150,
    value: (l) => l.hr || null,
    color: (l) => (l.hr ? zoneColor(l.hr) : 'var(--line)'),
    rules: [{ at: DATA.athlete.lthr, label: `threshold ${DATA.athlete.lthr}` }],
    aria: 'Average heart rate per lap',
    yLabel: 'bpm',
    tip: tipOf,
    emptyText: 'No heart rate on these laps.',
  });
  c.append(help('Average heart rate per lap, colored by zone.'));
  c.append(legend([
    ...(structured ? [['A', 'Work'], ['R', 'Recovery'], ['W', 'Warm-up or cool-down']].map(([k, label]) => ({ color: LAP_KIND[k].color, label })) : []),
    ...ZONES.map((z) => ({ color: z.color, label: z.label })),
  ]));
  tableToggle(c, 'laps-' + a.id, () => table(
    ['Lap', 'Distance', 'Time', isBike ? 'km/h' : 'Pace', 'Avg HR', 'Max HR', 'Cadence', 'W', 'Climb, m'],
    L.map((l) => [
      `${l.n}${l.kind && LAP_KIND[l.kind] ? ` ${LAP_KIND[l.kind].label.toLowerCase()}` : ''}`,
      distText(l),
      span(l.dur / 60),
      paceOf(l) ? (isBike ? f1(speedOf(l)) : pace(paceOf(l))) : '–',
      l.hr ? String(l.hr) : '–', l.maxHr ? String(l.maxHr) : '–',
      l.cad ? f0(l.cad) : '–', l.pwr ? f0(l.pwr) : '–',
      l.gain || l.loss ? `+${f0(l.gain || 0)}, ${signed(-(l.loss || 0))}` : '–',
    ])
  ));
  return c;
}

function zoneCard(a) {
  const tot = a.z.reduce((s, v) => s + v, 0);
  const c = card('Time in heart-rate zone');
  c.append(help(tot ? `${span(tot / 60)} of heart-rate data in this session.` : 'No heart-rate data for this session.'));
  if (tot) {
    const bar = zoneBar(a.z);
    bar.classList.remove('mini');
    c.append(bar);
    c.append(legend(ZONES.map((z, i) => ({ color: z.color, label: `${z.label}, ${span(a.z[i] / 60)}, ${pct((a.z[i] / tot) * 100)}` }))));
  }
  return c;
}

/* --- Health ------------------------------------------------------------- */

// Every history chart on the pane shares one x axis: each day of the window
// for windows up to sixteen weeks, each week beyond that (so a two-year window
// is a hundred bars rather than seven hundred). A bucket with no data leaves a
// gap rather than moving its neighbors closer together.
const windowIsWeekly = (start, end) => Math.round((parse(end) - parse(start)) / DAY) + 1 > 112;
function dayGrid(start, end) {
  const out = [];
  for (let t = parse(start).getTime(); t <= parse(end).getTime(); t += DAY) out.push(iso(new Date(t)));
  return out;
}
function healthBuckets(rows, weekly, start, end) {
  const byKey = new Map();
  for (const r of rows) {
    const k = weekly ? mondayOf(r.d) : r.d;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  const out = [];
  const step = weekly ? 7 * DAY : DAY;
  for (let t = parse(weekly ? mondayOf(start) : start).getTime(); t <= parse(end).getTime(); t += step) {
    const k = iso(new Date(t));
    out.push({ key: k, days: byKey.get(k) || [] });
  }
  return out;
}
const meanOf = (days, k) => {
  const v = days.map((d) => d[k]).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const sumOf = (days, k) => {
  const v = days.map((d) => d[k]).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const have = (vals) => vals.filter((v) => v != null).length;
const minMax = (vals) => { const v = vals.filter((x) => x != null); return [Math.min(...v), Math.max(...v)]; };
/** Rolling mean over the last n buckets that have a value; null where none do. */
function rollingSparse(vals, n) {
  return vals.map((_, i) => {
    const w = vals.slice(Math.max(0, i - n + 1), i + 1).filter((v) => v != null);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  });
}

function paneHealth(main) {
  groupHead(main, 'Today');
  paneToday(main);
  groupHead(main, 'Recovery and trends');
  const [start, end] = windowRange();
  const daily = (DATA.daily || []).filter((r) => r.d >= start && r.d <= end);
  const weight = (DATA.weight || []).filter((w) => w.d >= start && w.d <= end);
  const allWeight = DATA.weight || [];
  const gn = DATA.garminNow || {};
  const weekly = windowIsWeekly(start, end);
  const avgWord = weekly ? '4-week average' : '7-day average';
  const smooth = (vals) => rollingSparse(vals, weekly ? 4 : 7);
  const spanNote = weekly ? 'Each bar is one week, shown as its average day. ' : '';
  const one = weekly ? 'One bar is one week, as its average day.' : 'One bar is one day.';

  // Garmin's readiness readouts, the last seven days, and the newest weigh-in.
  const last7 = (DATA.daily || []).slice(-7);
  const sleepAll = DATA.sleep || [];
  const recent = sleepAll.slice(-7);
  const rd = gn.readiness || {};
  const t = facts();
  t.append(tile('Readiness', rd.score != null ? f0(rd.score) : '–', (rd.level || '').toLowerCase().replace(/_/g, ' ')));
  t.append(tile('Sleep, last 7 nights', recent.length ? f1(recent.reduce((s, x) => s + (x.h || 0), 0) / recent.length) : '–',
    recent.length ? `per night, score ${f0(recent.reduce((s, x) => s + (x.score || 0), 0) / recent.length)}` : '', 'h'));
  t.append(tile('HRV, 7 nights', rd.hrvWeeklyAvg != null ? f0(rd.hrvWeeklyAvg) : '–', (rd.hrvFeedback || '').replace(/_/g, ' ').toLowerCase(), 'ms'));
  const stepsAvg = meanOf(last7, 'steps');
  const goalAvg = meanOf(last7, 'goal');
  const met = last7.filter((d) => d.steps != null && d.goal != null && d.steps >= d.goal).length;
  t.append(tile('Steps, last 7 days', stepsAvg != null ? f0(stepsAvg) : '–',
    stepsAvg != null ? `per day, goal met ${met} of ${last7.length}${goalAvg ? ` (about ${f0(goalAvg)})` : ''}` : 'no daily summaries yet'));
  const lastW = allWeight[allWeight.length - 1];
  const firstW = weight[0];
  const wNote = lastW
    ? (firstW && firstW.d !== lastW.d ? `${u(signed(lastW.kg - firstW.kg, 1), 'kg')} since ${dayMon(firstW.d)}` : `weighed ${dayMon(lastW.d)}`)
    : 'no weigh-ins';
  t.append(tile('Weight', lastW ? f1(lastW.kg) : '–', wNote, lastW ? 'kg' : undefined));
  const rhrAvg = meanOf(last7, 'rhr');
  const fa = gn.fitnessAge;
  if (fa && fa.age != null) {
    t.append(tile('Fitness age', f1(fa.age), `${fa.chronological != null ? `against ${f0(fa.chronological)}, ` : ''}resting heart rate ${rhrAvg != null ? f0(rhrAvg) : '–'}`, 'years'));
  } else {
    const rhrs = last7.map((d) => d.rhr).filter((v) => v != null);
    t.append(tile('Resting heart rate, 7 days', rhrAvg != null ? f0(rhrAvg) : '–',
      rhrs.length ? `${u(`${f0(Math.min(...rhrs))}–${f0(Math.max(...rhrs))}`, 'bpm')} across the week` : '', 'bpm'));
  }
  main.append(t);

  // The shared axis and the helpers every chart below uses.
  const sleep = sleepAll.filter((x) => x.d >= start && x.d <= end);
  const sb = healthBuckets(sleep, weekly, start, end);
  const db = healthBuckets(daily, weekly, start, end);
  const grid = db.map((b) => ({ key: b.key }));
  const place = (i) => (weekly ? weekPlace(grid[i].key) : date(grid[i].key));
  const flat = grid.map((g) => ({ ...g, total: 0, seg: [] }));
  const bars = (vals) => grid.map((g, i) => ({ ...g, total: vals[i] || 0, seg: vals[i] == null ? [] : [{ v: vals[i], color: AMOUNT }] }));
  const sVal = (k) => sb.map((b) => (b.days.length ? meanOf(b.days, k) : null));
  const dVal = (k) => db.map((b) => (b.days.length ? meanOf(b.days, k) : null));
  const gap = (i) => ({ place: place(i), value: '–', rows: [['Data', 'none']] });
  const avgLegend = (label) => legend([{ color: AMOUNT, label }, { color: INK, label: avgWord, line: true }]);

  // Sleep and overnight HRV come from the sleep record, which has its own history.
  {
    const hrs = sVal('h');
    if (have(hrs) >= 2) {
      const sm = smooth(hrs);
      const c1 = card('Sleep', `${spanNote}Hours per night, with the ${weekly ? 'four-week' : 'seven-night'} average on top. Sleep is the cheapest recovery there is and the first thing that quietly disappears when life gets busy.`);
      columnChart(c1, {
        height: 180, rows: bars(hrs), lines: [{ values: sm, color: INK }],
        rules: [{ at: 7, label: u(7, 'h') }],
        tickFmt: (v) => f1(v),
        aria: 'Sleep hours per night',
        yLabel: 'hours per night',
        tip: (r, i) => (hrs[i] == null ? gap(i) : { place: place(i), value: f1(hrs[i]), unit: 'h', rows: [['Score', f0(meanOf(sb[i].days, 'score') || 0)],
          ['Deep', pct(meanOf(sb[i].days, 'deep') || 0)], ['REM', pct(meanOf(sb[i].days, 'rem') || 0)],
          ...(meanOf(sb[i].days, 'hrv') ? [['Overnight HRV', u(f0(meanOf(sb[i].days, 'hrv')), 'ms')]] : []), [avgWord, u(f1(sm[i]), 'h')]] }),
      });
      c1.append(avgLegend('Hours slept'), help(weekly ? 'One bar is one week, as its average night.' : 'One bar is one night.'));
      tableToggle(c1, 'sleep', () => table(['Night', 'Hours', 'Score', 'Deep %', 'REM %', 'HRV'],
        sleep.slice().reverse().map((x) => [date(x.d), f1(x.h), f0(x.score), f0(x.deep), f0(x.rem), x.hrv ? f0(x.hrv) : '–'])));
      main.append(c1);
    }
    const hv = sVal('hrv');
    if (have(hv) >= 3) {
      const c2 = card('Overnight heart-rate variability',
        `${spanNote}A single night says almost nothing; a baseline that slides down over two weeks is the signal worth acting on.`);
      const sm = smooth(hv);
      columnChart(c2, {
        height: 165, rows: bars(hv), lines: [{ values: sm, color: INK }],
        tickFmt: (v) => f0(v),
        aria: 'Overnight heart-rate variability',
        yLabel: 'HRV, ms',
        tip: (r, i) => (hv[i] == null ? gap(i) : { place: place(i), value: f0(hv[i]), unit: 'ms', rows: [[avgWord, u(f0(sm[i]), 'ms')]] }),
      });
      c2.append(avgLegend('Nightly HRV'));
      main.append(c2);
    }
  }

  if (daily.length < 2) {
    const c = card('Daily summaries');
    c.append(el('p', null, (DATA.daily || []).length
      ? 'No daily summaries inside this window yet. The hourly data pull fills the history in, sixty days at a time, so widen the window later.'
      : 'No daily summaries in this snapshot yet. The hourly data pull adds them: the last two days every hour, and sixty days of history per run until the record is complete.'));
    main.append(c);
    vo2Card(main);
    weightCard(main, weight, grid, weekly);
    return;
  }

  // Steps
  {
    const vals = dVal('steps');
    const goal = meanOf(daily, 'goal');
    const sm = smooth(vals);
    const c = card('Steps', `${spanNote}Steps per day with the ${avgWord} on top. The dashed line is the watch’s own step goal, which it moves with what you have been doing lately, so it is a floor to keep, not a target to chase.`);
    columnChart(c, {
      height: 190, rows: bars(vals), lines: [{ values: sm, color: INK }],
      rules: goal ? [{ at: goal, label: `goal about ${f0(goal)}` }] : [],
      tickFmt: (v) => f0(v), padL: 46,
      aria: 'Steps per day',
      yLabel: 'steps per day',
      tip: (r, i) => (vals[i] == null ? gap(i) : { place: place(i), value: f0(vals[i]), unit: weekly ? 'steps a day' : 'steps',
        rows: weekly ? [['Week total', f0(sumOf(db[i].days, 'steps'))], ['Days', String(db[i].days.length)]] : [['Goal', f0(db[i].days[0].goal || 0)]] }),
    });
    c.append(avgLegend('Steps per day'), help(one));
    tableToggle(c, 'steps', () => table([weekly ? 'Week' : 'Day', 'Steps', 'Goal', 'Floors up', 'Active min'],
      db.filter((b) => b.days.length).reverse().map((b) => [date(b.key), f0(meanOf(b.days, 'steps') || 0), f0(meanOf(b.days, 'goal') || 0), f0(meanOf(b.days, 'up') || 0), f0(meanOf(b.days, 'activeMin') || 0)])));
    main.append(c);
  }

  // Floors
  {
    const vals = dVal('up');
    const c = card('Floors climbed', `${spanNote}Floors ascended per day as the watch counts them from its barometer, one floor being about three meters. Stairs, hills and hikes all land here; an elevator does not.`);
    columnChart(c, {
      height: 170, rows: bars(vals), lines: [{ values: smooth(vals), color: INK }],
      tickFmt: (v) => f0(v),
      aria: 'Floors climbed per day',
      yLabel: 'floors up per day',
      tip: (r, i) => (vals[i] == null ? gap(i) : { place: place(i), value: f1(vals[i]), unit: weekly ? 'floors up a day' : 'floors up', rows: [['Down', f1(meanOf(db[i].days, 'down') || 0)]] }),
    });
    c.append(avgLegend('Floors up'));
    main.append(c);
  }

  // Intensity minutes, always per week: that is how the guideline is written.
  {
    const wk = healthBuckets(daily, true, start, end);
    const mod = wk.map((b) => (b.days.length ? sumOf(b.days, 'mod') : null));
    const vig = wk.map((b) => (b.days.length ? sumOf(b.days, 'vig') : null));
    const c = card('Intensity minutes', 'Minutes per week in Garmin’s moderate and vigorous heart-rate bands, counted from all-day heart rate rather than from sessions. The WHO guideline is 150 moderate minutes a week, with a vigorous minute worth two; Garmin’s own weekly goal counts the same way.');
    columnChart(c, {
      height: 180,
      rows: wk.map((b, i) => ({ key: b.key, total: (mod[i] || 0) + (vig[i] || 0), seg: mod[i] == null ? [] : [{ v: mod[i], color: 'var(--zone-3)' }, { v: vig[i] || 0, color: 'var(--zone-4)' }] })),
      rules: [{ at: 150, label: u(150, 'min') }],
      minMax: 160,
      tickFmt: (v) => f0(v),
      aria: 'Intensity minutes per week',
      yLabel: 'min per week',
      tip: (r, i) => (mod[i] == null ? { place: weekPlace(wk[i].key), value: '–', rows: [['Data', 'none']] }
        : { place: weekPlace(wk[i].key), value: f0(mod[i] + vig[i]), unit: 'min', rows: [['Moderate-equivalent', u(f0(mod[i] + 2 * vig[i]), 'min')], ['Moderate', u(f0(mod[i]), 'min')], ['Vigorous', u(f0(vig[i]), 'min')]] }),
    });
    c.append(legend([{ color: 'var(--zone-3)', label: 'Moderate' }, { color: 'var(--zone-4)', label: 'Vigorous' }]), help('One bar is one week.'));
    main.append(c);
  }

  // Resting heart rate
  {
    const vals = dVal('rhr');
    if (have(vals) >= 3) {
      const [lo, hi] = minMax(vals);
      const c = card('Resting heart rate', `${spanNote}The watch’s overnight resting heart rate, with the ${avgWord}. It drifts down as fitness builds and jumps up a few beats when you are ill, short on sleep or carrying a hard block; a single high morning means little.`);
      columnChart(c, {
        height: 170, rows: flat, lines: [{ values: vals, color: AMOUNT }, { values: smooth(vals), color: INK }],
        yMin: Math.floor(lo - 2), yMax: Math.ceil(hi + 2),
        tickFmt: (v) => f0(v),
        aria: 'Resting heart rate per day',
        yLabel: 'bpm',
        tip: (r, i) => (vals[i] == null ? gap(i) : { place: place(i), value: f0(vals[i]), unit: 'bpm',
          rows: weekly ? [] : [['Day range', u(`${f0(db[i].days[0].minHr || 0)}–${f0(db[i].days[0].maxHr || 0)}`, 'bpm')]] }),
      });
      c.append(legend([{ color: AMOUNT, label: 'Resting heart rate', line: true }, { color: INK, label: avgWord, line: true }]));
      main.append(c);
    }
  }

  vo2Card(main);

  // Stress and body battery share a 0 to 100 scale, so they sit on one chart.
  {
    const st = dVal('stress');
    const lo = dVal('bbLow'), hi = dVal('bbHigh');
    if (have(st) >= 3 || have(hi) >= 3) {
      const c = card('Stress and body battery', `${spanNote}Garmin’s all-day stress (0 to 100, from heart-rate variability) as a line, and the day’s body-battery range as a band: where it charged to overnight and where it drained to by evening. A band that no longer reaches the top is the earliest sign of not recovering.`);
      columnChart(c, {
        height: 190, rows: flat,
        band: { lo, hi, color: AMOUNT },
        lines: [{ values: st, color: 'var(--series-2)' }],
        yMin: 0, yMax: 100,
        tickFmt: (v) => f0(v),
        aria: 'Average stress and body-battery range per day',
        yLabel: '0 to 100',
        tip: (r, i) => (st[i] == null && hi[i] == null ? gap(i) : { place: place(i), value: f0(st[i] || 0), rows: [['Stress', stressWord(st[i] || 0)], ['Body battery', `${f0(lo[i] || 0)} to ${f0(hi[i] || 0)}`]] }),
      });
      c.append(legend([{ color: 'color-mix(in srgb, var(--amount) 16%, transparent)', label: 'Body battery, low to high' }, { color: 'var(--series-2)', label: 'Average stress', line: true }]));
      main.append(c);
    }
  }

  weightCard(main, weight, grid, weekly);

  // Blood oxygen
  {
    const vals = dVal('spo2');
    if (have(vals) >= 3) {
      const [lo] = minMax(vals);
      const c = card('Blood oxygen', `${spanNote}Average overnight pulse oximetry. Healthy sleep sits at 95\u202F% and above; the watch reads a little low, so a night or two at 93 to 94 is noise, a run of them is worth noticing.`);
      columnChart(c, {
        height: 150, rows: flat, lines: [{ values: vals, color: AMOUNT }],
        rules: [{ at: 95, label: pct(95) }],
        yMin: Math.min(88, Math.floor(lo - 1)), yMax: 100,
        tickFmt: (v) => f0(v),
        aria: 'Average blood oxygen per day',
        yLabel: 'SpO₂, %',
        tip: (r, i) => (vals[i] == null ? gap(i) : { place: place(i), value: f0(vals[i]), unit: '%', rows: weekly ? [] : [['Lowest', pct(db[i].days[0].spo2Low || 0)]] }),
      });
      main.append(c);
    }
  }

  // Active energy
  {
    const vals = dVal('active');
    if (have(vals) >= 2) {
      const c = card('Active calories', `${spanNote}Calories above the resting metabolism, per day: everything from the walk to the shop to the long run. It is the watch’s estimate, good for the shape of the week, not for a food plan.`);
      columnChart(c, {
        height: 160, rows: bars(vals), lines: [{ values: smooth(vals), color: INK }],
        tickFmt: (v) => f0(v),
        aria: 'Active calories per day',
        yLabel: 'kcal per day',
        tip: (r, i) => (vals[i] == null ? gap(i) : { place: place(i), value: f0(vals[i]), unit: 'kcal', rows: [['Total', u(f0(meanOf(db[i].days, 'kcal') || 0), 'kcal')], ['Active time', span(meanOf(db[i].days, 'activeMin') || 0)]] }),
      });
      c.append(avgLegend('Active kcal'));
      main.append(c);
    }
  }
}

/** Weigh-ins on the shared axis: a line interpolated between measurements, so a
 *  monthly habit still reads as a trend. With fewer than two in the window, the
 *  last twelve are shown on their own axis instead, and the section says so. */
function weightCard(main, weight, grid, weekly) {
  const all = DATA.weight || [];
  const inWindow = weight.length >= 2;
  const rows = inWindow ? weight : all.slice(-12);
  if (rows.length < 2) return;
  const kg = rows.map((w) => w.kg);
  const lo = Math.min(...kg), hi = Math.max(...kg);
  const c = card('Weight',
    'Every weigh-in Garmin Connect holds, manual or from a scale, joined by a line. Weight swings a kilo or two with water and glycogen from one day to the next, so read the direction over months, not the last point.');
  let chartRows, values, tip;
  if (inWindow) {
    const ts = rows.map((w) => parse(w.d).getTime());
    const byKey = new Map(rows.map((w) => [weekly ? mondayOf(w.d) : w.d, w]));
    values = grid.map((g) => {
      const t = parse(g.key).getTime() + (weekly ? 3 * DAY : 0);
      if (t < ts[0] || t > ts[ts.length - 1]) return null;
      let j = 0;
      while (j < ts.length - 1 && ts[j + 1] < t) j++;
      if (j >= ts.length - 1) return kg[ts.length - 1];
      const f = (t - ts[j]) / (ts[j + 1] - ts[j] || 1);
      return kg[j] + f * (kg[j + 1] - kg[j]);
    });
    chartRows = grid.map((g) => ({ ...g, total: 0, seg: [] }));
    tip = (r, i) => {
      const w = byKey.get(grid[i].key), place = weekly ? weekPlace(grid[i].key) : date(grid[i].key);
      if (w) return { place, value: f1(w.kg), unit: 'kg', rows: [['Weighed', dayMon(w.d)], ...(w.bmi ? [['BMI', f1(w.bmi)]] : [])] };
      return values[i] == null ? { place, value: '–', rows: [['Weigh-in', 'none']] } : { place, value: f1(values[i]), unit: 'kg', rows: [['Between weigh-ins', 'drawn on the line']] };
    };
  } else {
    chartRows = rows.map((w) => ({ key: w.d, total: 0, seg: [] }));
    values = kg;
    tip = (r, i) => ({ place: date(rows[i].d), value: f1(rows[i].kg), unit: 'kg', rows: rows[i].bmi ? [['BMI', f1(rows[i].bmi)]] : [] });
  }
  columnChart(c, {
    height: 170,
    rows: chartRows,
    lines: [{ values, color: AMOUNT }],
    yMin: Math.floor(lo - 1), yMax: Math.ceil(hi + 1),
    tickFmt: (v) => f1(v),
    aria: 'Body weight per weigh-in',
    yLabel: 'kg',
    tip,
  });
  howTo(c, `${inWindow ? '' : 'Fewer than two weigh-ins in this window, so the last '}${plural(rows.length, 'weigh-in')}, ${dayMon(rows[0].d)} to ${dayMon(rows[rows.length - 1].d)}: ${u(f1(kg[0]), 'kg')} to ${u(f1(kg[kg.length - 1]), 'kg')}.`);
  tableToggle(c, 'weight', () => table(['Date', 'kg', 'BMI'], rows.slice().reverse().map((w) => [date(w.d), f1(w.kg), w.bmi ? f1(w.bmi) : '–'])));
  main.append(c);
}

/* --- About (HOUSE 4.8) ------------------------------------------------------ */

function aboutList() {
  const dl = $('about-list');
  dl.replaceChildren();
  const add = (k, v) => { if (v) dl.append(el('dt', null, `${k}:`), el('dd', null, v)); };
  const gen = Date.parse(DATA.generatedAt), acts = DATA.activities, hr = DATA.intraday && DATA.intraday.hr;
  const on = (o) => (o && o.updated ? date(o.updated) : null);
  add('Updated', full(pulledMs()));
  if (DATA.pulledAt) add('Snapshot built', full(gen));
  if (hr && hr.length) add('Watch last synced', full(hr[hr.length - 1][0] * 1000));
  add('Sessions', `${acts.length}, ${spanDates(acts[0].d, acts[acts.length - 1].d)}`);
  add('Full detail kept since', DATA.detailSince && date(DATA.detailSince));
  add('Evaluation written', on(DATA.assessment));
  add('Plan written', on(DATA.plan));
  add('Race forecast written', on(DATA.racecast));
  add('Map tiles on this phone', String((DATA.tiles || []).length));
  add('Stale after', u(48, 'hours'));
  $('about-plan').textContent = on(DATA.plan) || 'the date under This data';
  $('about-routes').hidden = !DATA.activities.some((a) => a.stream && OSM(a));
}
let aboutFrom = null;
function about(open) {
  $('about').hidden = !open;
  for (const id of ['head', 'main']) $(id).inert = open;
  if (open) { aboutFrom = document.activeElement; $('about-close').focus(); } else if (aboutFrom) aboutFrom.focus();
}
$('stamp').onclick = () => about(true);
$('about-close').onclick = $('about-close-2').onclick = () => about(false);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('about').hidden) about(false); });

// An empty touchstart listener, passive, so iOS draws :active (a key or a word pressed; plan 0011's owed item).
document.addEventListener('touchstart', () => {}, { passive: true });

// The test hook (tools/shoot.mjs): inert, nothing in the app calls it.
window.__rd = {
  ready: () => !!DATA && $('pane').children.length > 0,
  pane: () => state.tab,
  card: () => (openCard ? openCard.card : null),
  block: () => lastBlock && {
    columns: lastBlock.B.columns.map(({ week, runs, target, low, kind }) => ({ week, runs, target, low, kind })),
    scale: lastBlock.scale, now: lastBlock.B.now, topKm: lastBlock.L.topKm, base: lastBlock.L.base,
    points: lastBlock.L.points.map((p) => p.slice(0, 4)), outlines: lastBlock.L.outlines.map((p) => p.slice(0, 4)), tints: lastBlock.L.tints.map((p) => p.slice(0, 4)),
  },
};

load();
