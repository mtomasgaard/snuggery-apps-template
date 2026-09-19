/* Running Dashboard — Snuggery mini-app.
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
 *   // activities[].zk: kilometres run in Z1–Z5, then below the Z1 floor (six values)
 *   "dataThrough": "2026-09-13",          // date of the newest activity
 *
 *   "athlete": {
 *     "maxHr": 190, "lthr": 170, "restingHr": 48,
 *     "zoneFloors": [114,133,152,162,171],// lower bpm bound of zones 1..5
 *     "vo2maxRunning": 54.0, "weightKg": 70, "heightCm": 180
 *   },
 *
 *   "gear": [                             // catalogue; `code` keys activities.
 *     {"code":"RSA","name":"Road shoes A","type":"Shoes",
 *      "since":"2026-02-15","km":412.5,"activities":38,"maxKm":800}
 *   ],                                    // order is stable: it fixes shoe colours
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
 *            // per lap: [metres, seconds, moving seconds, avg HR, max HR,
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

const SPORTS = [
  { key: 'run', label: 'Running', color: 'var(--series-1)' },
  { key: 'bike', label: 'Cycling', color: 'var(--series-2)' },
  { key: 'strength', label: 'Strength', color: 'var(--series-3)' },
  { key: 'elliptical', label: 'Elliptical', color: 'var(--series-4)' },
  { key: 'walk', label: 'Hike / walk', color: 'var(--series-6)' },
  { key: 'other', label: 'Other', color: 'var(--series-5)' },
];
const SPORT_FALLBACK = { row: 'other', swim: 'other', other: 'other' };
const ZONES = [1, 2, 3, 4, 5].map((n) => ({
  key: 'z' + n,
  label: 'Zone ' + n,
  color: `var(--zone-${n})`,
}));
const SHOE_SLOTS = 8; // categorical colour slots in style.css

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

/* ------------------------------------------------------------------ dates */

const iso = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(s + 'T00:00:00Z');

/** Today by the device's clock (local date), never earlier than the newest
 *  data: the plan's "today" line and the recent-window arithmetic follow the
 *  calendar, not the date of the last session. */
function todayIso() {
  const d = new Date();
  const local = iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
  return DATA.dataThrough && DATA.dataThrough > local ? DATA.dataThrough : local;
}

function mondayOf(dateStr) {
  const d = parse(dateStr);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return iso(new Date(d.getTime() - dow * DAY));
}
function weeksBetween(a, b) {
  const out = [];
  for (let t = parse(a).getTime(); t <= parse(b).getTime(); t += 7 * DAY) out.push(iso(new Date(t)));
  return out;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(s) {
  const d = parse(s);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
function longDate(s) {
  const d = parse(s);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function midDate(s) {
  const d = parse(s);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}
function ago(fromStr, toStr) {
  return Math.round((parse(toStr) - parse(fromStr)) / DAY);
}

/* -------------------------------------------------------------- formatting */

const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });
const fmt0 = (n) => Math.round(n).toLocaleString('en-GB');
function pace(minPerKm) {
  if (!isFinite(minPerKm) || minPerKm <= 0) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}
function hhmm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
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

/** Wire hover, drag-to-scrub and tap-to-pin onto a chart's hit layer. */
function readout(hit, wrap, show, hide) {
  let down = false;
  hit.addEventListener('pointerdown', (ev) => { down = true; show(ev); pinTo(wrap, hide); });
  hit.addEventListener('pointermove', (ev) => { if (down || !isPinned(wrap)) show(ev); });
  const up = () => { down = false; };
  hit.addEventListener('pointerup', up);
  hit.addEventListener('pointercancel', up);
  hit.addEventListener('pointerleave', () => { down = false; if (!isPinned(wrap)) hide(); });
}

/* ------------------------------------------------------------------ loading */

async function load() {
  let raw;
  try {
    const res = await fetch('./data/snapshot.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`the file could not be read (HTTP ${res.status})`);
    raw = await res.text();
  } catch (err) {
    return fail('Cannot read data/snapshot.json', String(err.message || err),
      'The app is installed but its data file is missing or unreadable. Run the shortcut again.');
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return fail('data/snapshot.json is not valid JSON', raw.slice(0, 400),
      'Something wrote a non-JSON body over the data file.');
  }

  const problems = validate(json);
  if (problems.length) {
    return fail('data/snapshot.json is not the shape this app expects',
      problems.join('\n') + '\n\nfile begins:\n' + raw.slice(0, 240),
      'This is what a dead GitHub token looks like: 404 Not Found is valid JSON, and the shortcut ' +
      'writes it straight over the good data. Check the token before the address.');
  }

  DATA = json;
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

function fail(title, detail, hint) {
  document.getElementById('stamp').textContent = 'No usable data';
  document.getElementById('stamp').className = 'stamp stale';
  document.getElementById('tabs').hidden = true;
  document.getElementById('filters').hidden = true;
  const main = document.getElementById('main');
  main.innerHTML = '';
  const box = el('div', 'problem');
  box.append(el('h2', null, esc(title)));
  if (hint) box.append(el('p', null, esc(hint)));
  box.append(el('code', null, esc(detail)));
  main.append(box);
}

/* ------------------------------------------------------------------- boot */

function boot() {
  const acts = DATA.activities;
  const first = mondayOf(acts[0].d);
  const last = mondayOf(acts[acts.length - 1].d);
  const firstBoot = state.weeks.length === 0;
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

  if (firstBoot) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) load();
    });
  }
}

function stamp() {
  const node = document.getElementById('stamp');
  const gen = new Date(DATA.generatedAt);
  const hours = (Date.now() - gen.getTime()) / 3600000;
  const stale = hours > 48;
  // Clock times for today, weekday and time for anything older.
  const today = new Date();
  const sameDay = (d) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  const hm = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const when = (d) => (sameDay(d) ? hm(d) : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${hm(d)}`);
  // The data pull's own time, not the daily evaluation's: the plan and the
  // assessment carry their own dates on their tabs.
  const pulled = DATA.pulledAt ? new Date(DATA.pulledAt) : gen;
  // One fact in the header; a tap opens the rest on a second line.
  const head = `Updated ${when(pulled)}`;
  const more = [];
  const hr = DATA.intraday && DATA.intraday.hr;
  if (hr && hr.length) more.push(`Watch sync ${when(new Date(hr[hr.length - 1][0] * 1000))}`); // the newest sample the watch has handed over
  if (DATA.dataThrough) more.push(`last session ${shortDate(DATA.dataThrough)}`);
  const draw = () => {
    const open = node.classList.contains('open');
    node.textContent = open && more.length ? `${head} · ${more.join(' · ')}` : head;
    if (more.length) node.append(el('span', 'chev', open ? '▴' : '▾'));
  };
  node.title = `Data pulled ${pulled.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}, snapshot built ${gen.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${stale ? ' — more than two days ago' : ''}`;
  node.className = stale ? 'stamp stale' : 'stamp';
  node.onclick = () => { node.classList.toggle('open'); draw(); };
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', 'When the data was last pulled; tap for the watch sync time and the last session');
  draw();
}

const TABS = [
  ['now', 'Now'],
  ['plan', 'Plan'],
  ['training', 'Training'],
  ['health', 'Health'],
  ['sessions', 'Sessions'],
];

function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  for (const [key, label] of TABS) {
    const b = el('button', null, esc(label));
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(state.tab === key));
    b.onclick = () => { state.tab = key; remember(); buildTabs(); render(); window.scrollTo({ top: 0 }); };
    nav.append(b);
  }
}

const PRESETS = [['3m', '3 m', 13], ['6m', '6 m', 26], ['1y', '1 yr', 52], ['all', 'All', Infinity]];

function applyPreset(key) {
  const n = (PRESETS.find((p) => p[0] === key) || PRESETS[3])[2];
  state.preset = key;
  state.to = state.weeks.length - 1;
  state.from = Math.max(0, state.weeks.length - (n === Infinity ? state.weeks.length : n));
}

function buildFilters() {
  const presets = document.getElementById('presets');
  presets.innerHTML = '';
  for (const [key, label] of PRESETS) {
    const b = el('button', state.preset === key ? 'on' : null, esc(label));
    b.onclick = () => { applyPreset(key); remember(); syncRanges(); render(); };
    presets.append(b);
  }

  // Two thumbs on one track. Dragging one past the other pushes it along, so
  // the pair can always be separated again from either end.
  const from = document.getElementById('fromRange');
  const to = document.getElementById('toRange');
  from.max = to.max = String(state.weeks.length - 1);
  from.oninput = () => {
    state.from = +from.value;
    if (state.from > state.to) state.to = state.from;
    state.preset = null;
    remember();
    syncRanges();
    render();
  };
  to.oninput = () => {
    state.to = +to.value;
    if (state.to < state.from) state.from = state.to;
    state.preset = null;
    remember();
    syncRanges();
    render();
  };
  syncRanges();

  const sport = document.getElementById('sportSelect');
  sport.innerHTML = '';
  for (const [v, label] of [['all', 'All sports'], ...SPORTS.map((s) => [s.key, s.label])]) {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    o.selected = state.sport === v;
    sport.append(o);
  }
  sport.onchange = () => { state.sport = sport.value; remember(); render(); };

  const sel = document.getElementById('gearSelect');
  sel.innerHTML = '';
  const opts = [['all', 'Any equipment']];
  for (const g of DATA.gear) opts.push([g.code, isShoe(g) ? `${g.name} — ${fmt0(g.km)} km` : g.name]);
  opts.push(['stroller-yes', 'With stroller'], ['stroller-no', 'Without stroller'], ['none', 'No gear logged']);
  for (const [v, label] of opts) {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    o.selected = state.gear === v;
    sel.append(o);
  }
  if (sel.selectedIndex < 0) { sel.selectedIndex = 0; state.gear = 'all'; }
  sel.onchange = () => { state.gear = sel.value; remember(); render(); };
}

function syncRanges() {
  const from = document.getElementById('fromRange');
  const to = document.getElementById('toRange');
  from.value = String(state.from);
  to.value = String(state.to);
  const max = Math.max(1, state.weeks.length - 1);
  const fill = document.getElementById('dualFill');
  fill.style.left = `${(state.from / max) * 100}%`;
  fill.style.right = `${100 - (state.to / max) * 100}%`;
  for (const [i, [key]] of PRESETS.entries()) {
    const b = document.getElementById('presets').children[i];
    if (b) b.classList.toggle('on', state.preset === key);
  }
  document.getElementById('fromLabel').textContent = midDate(state.weeks[state.from]);
  const endWeek = state.weeks[state.to];
  document.getElementById('toLabel').textContent = midDate(iso(new Date(parse(endWeek).getTime() + 6 * DAY)));
}

function syncFilterVisibility() {
  const f = PANE_FILTERS[state.tab] || [];
  const has = (k) => f.includes(k);
  document.getElementById('filters').hidden = f.length === 0;
  document.getElementById('timeRow').hidden = !has('time');
  document.getElementById('dual').hidden = !has('time');
  document.getElementById('sportSelect').hidden = !has('sport');
  document.getElementById('gearSelect').hidden = !has('gear');
  document.getElementById('picksRow').hidden = !(has('sport') || has('gear'));
}

/* -------------------------------------------------------------- filtering */

function windowRange() {
  const start = state.weeks[state.from];
  const end = iso(new Date(parse(state.weeks[state.to]).getTime() + 6 * DAY));
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
// on the Heart pane cannot silently thin out the Load pane.
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
    key: k, label: shortDate(k), runKm: 0, walkKm: 0, km: 0, min: 0, trimp: 0, zmin: 0, muscle: 0,
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

const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  return n;
};

function niceStep(span, count = 4) {
  const raw = Math.abs(span) / count || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
}
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const step = niceStep(max, count);
  const out = [];
  // Run to the first tick at or above max, so the top tick always covers the
  // tallest bar: stopping at the last tick below it clipped everything above.
  for (let v = 0; ; v += step) {
    out.push(+v.toFixed(6));
    if (v >= max - step * 0.001) break;
  }
  return out;
}
/** The y-axis caption: a small unit label set above the axis, left-aligned to the plot. */
function yCaption(svg, text, padL) {
  if (!text) return;
  svg.append(Object.assign(svgEl('text', {
    x: padL, y: 9, 'text-anchor': 'start', fill: 'var(--text-muted)', 'font-size': 9.5, 'font-weight': 560, class: 'ycap',
  }), { textContent: text }));
}
/** Ticks that sit inside an arbitrary [lo, hi] window rather than starting at 0. */
function ticksIn(lo, hi, count = 4) {
  const step = niceStep(hi - lo, count);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(6));
  return out.length ? out : [lo, hi];
}

/** Column chart: stacked bars, optional overlay lines, band, or diverging mode. */
function columnChart(host, spec) {
  const wrap = el('div', 'chartwrap');
  const tip = el('div', 'tip');
  wrap.append(tip);
  host.append(wrap);

  function draw() {
    const W = Math.max(260, wrap.clientWidth || host.clientWidth || 320);
    const H = spec.height || 190;
    const padL = spec.padL != null ? spec.padL : 36;
    const padR = 8, padT = spec.yLabel ? 20 : 10, padB = 26;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const rows = spec.rows;
    const n = rows.length;

    wrap.querySelectorAll('svg, .empty').forEach((s) => s.remove());
    if (!n) {
      wrap.append(el('div', 'empty', 'No sessions in this window.'));
      return;
    }

    const div = spec.diverging;
    let y, ticks;
    if (div) {
      const finite = div.values.filter((v) => v != null).map(Math.abs);
      const span = Math.max(div.minSpan || 30, ...(finite.length ? finite : [30]));
      const step = niceStep(span, 2);
      const lim = Math.ceil(span / step) * step;
      ticks = [];
      for (let v = -lim; v <= lim + 0.001; v += step) ticks.push(+v.toFixed(6));
      y = (v) => padT + ih / 2 - (v / lim) * (ih / 2);
    } else if (spec.yMin != null) {
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
    const tickText = spec.tickFmt || ((t) => (tickStep % 1 === 0 ? fmt0(t) : fmt1(t)));

    const slot = iw / n;
    const gap = Math.min(2, slot * 0.34);
    const bw = Math.max(1.2, slot - gap);
    const x = (i) => padL + i * slot + gap / 2;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    svg.setAttribute('aria-label', spec.aria || 'chart');
    yCaption(svg, spec.yLabel, padL);

    for (const t of ticks) {
      svg.append(svgEl('line', {
        x1: padL, x2: W - padR, y1: y(t), y2: y(t),
        stroke: div && t === 0 ? 'var(--hairline-strong)' : 'var(--hairline)', 'stroke-width': 1,
      }));
      svg.append(Object.assign(svgEl('text', {
        x: padL - 5, y: y(t) + 3.5, 'text-anchor': 'end',
        fill: 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: tickText(t) }));
    }

    if (spec.band) {
      // one closed shape per run of days that have both edges; gaps stay empty
      let d = '', run = [];
      const flush = () => {
        if (run.length) {
          d += run.map((i, k) => `${k ? 'L' : 'M'}${(x(i) + bw / 2).toFixed(1)},${y(spec.band.hi[i]).toFixed(1)}`).join('');
          for (let k = run.length - 1; k >= 0; k--) d += `L${(x(run[k]) + bw / 2).toFixed(1)},${y(spec.band.lo[run[k]]).toFixed(1)}`;
          d += 'Z';
        }
        run = [];
      };
      for (let i = 0; i < n; i++) { if (spec.band.hi[i] == null || spec.band.lo[i] == null) flush(); else run.push(i); }
      flush();
      if (d) svg.append(svgEl('path', { d, fill: spec.band.color, opacity: 0.16 }));
    }

    if (div) {
      div.values.forEach((v, i) => {
        if (v == null) return;
        const y0 = y(0), y1 = y(v);
        const h = Math.max(1, Math.abs(y1 - y0));
        const rr = Math.min(4, bw / 2, h);
        svg.append(svgEl('rect', {
          x: x(i).toFixed(2), y: Math.min(y0, y1).toFixed(2),
          width: bw.toFixed(2), height: h.toFixed(2), rx: rr, ry: rr,
          fill: v >= 0 ? div.pos : div.neg,
        }));
      });
    } else {
      rows.forEach((r, i) => {
        let acc = 0;
        const segs = (r.seg || []).filter((s) => s.v > 0);
        segs.forEach((s, si) => {
          const y0 = y(acc), y1 = y(acc + s.v);
          let h = y0 - y1;
          const isTop = si === segs.length - 1;
          if (!isTop) h = Math.max(0.5, h - 2); // 2px surface gap between segments
          const rr = isTop ? Math.min(4, bw / 2, h) : 0;
          svg.append(svgEl('rect', {
            x: x(i).toFixed(2), y: (y0 - h).toFixed(2), width: bw.toFixed(2),
            height: Math.max(0.6, h).toFixed(2), rx: rr, ry: rr, fill: s.color,
          }));
          acc += s.v;
        });
      });
    }

    for (const line of spec.lines || []) {
      let d = '', open = false;
      line.values.forEach((v, i) => {
        if (v == null) { open = false; return; }
        const px = x(i) + bw / 2, py = y(v);
        d += `${open ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
        open = true;
      });
      if (d) svg.append(svgEl('path', {
        d, fill: 'none', stroke: line.color, 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        ...(line.dash ? { 'stroke-dasharray': line.dash } : {}),
      }));
    }

    for (const m of spec.marks || []) {
      const px = m.after ? x(m.i) + bw + gap / 2 : x(m.i) + bw / 2;
      svg.append(svgEl('line', {
        x1: px, x2: px, y1: padT, y2: padT + ih,
        stroke: m.color || 'var(--hairline-strong)', 'stroke-width': 1, 'stroke-dasharray': '3 3',
      }));
      if (m.label) svg.append(Object.assign(svgEl('text', {
        x: m.after ? px - 3 : px + 3, y: padT + 9, 'text-anchor': m.after ? 'end' : 'start',
        fill: m.color || 'var(--text-muted)', 'font-size': 9.5, 'font-weight': 600,
      }), { textContent: m.label }));
    }

    for (const rule of spec.rules || []) {
      svg.append(svgEl('line', {
        x1: padL, x2: W - padR, y1: y(rule.at), y2: y(rule.at),
        stroke: rule.color || 'var(--hairline-strong)', 'stroke-width': 1,
      }));
      if (rule.label) svg.append(Object.assign(svgEl('text', {
        x: padL + 4, y: y(rule.at) - 4, 'text-anchor': 'start',
        fill: rule.color || 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: rule.label }));
    }

    // x labels — first of each month, thinned so they never collide, and never
    // allowed to run off the right edge. Thinning walks from the RIGHT so the
    // most recent month always survives; that is the end a reader looks at first.
    const minGap = spec.xLabel ? 30 : 42;
    const candidates = [];
    rows.forEach((r, i) => {
      if (spec.xLabel) {
        const t = spec.xLabel(r, i);
        if (t) candidates.push({ px: x(i) + bw / 2, text: t });
        return;
      }
      const d = parse(r.key);
      if (d.getUTCDate() > 7) return;
      candidates.push({ px: x(i) + bw / 2, text: `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
    });
    const chosen = [];
    for (let k = candidates.length - 1; k >= 0; k--) {
      const c = candidates[k];
      if (chosen.length && chosen[chosen.length - 1].px - c.px < minGap) continue;
      chosen.push(c);
    }
    for (const c of chosen) {
      const half = c.text.length * 2.9;
      let cx = c.px, anchor = 'middle';
      if (cx + half > W - 2) { cx = W - 2; anchor = 'end'; }
      else if (cx - half < 2) { cx = 2; anchor = 'start'; }
      svg.append(Object.assign(svgEl('text', {
        x: cx, y: H - 8, 'text-anchor': anchor,
        fill: 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: c.text }));
    }

    if (!div) svg.append(svgEl('line', {
      x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih,
      stroke: 'var(--hairline-strong)', 'stroke-width': 1,
    }));

    const cursor = svgEl('rect', {
      x: 0, y: padT, width: Math.max(bw, 6), height: ih,
      fill: 'var(--text-primary)', opacity: 0, 'pointer-events': 'none',
    });
    svg.append(cursor);

    const hit = svgEl('rect', { x: padL, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const cx = ev.clientX - box.left;
      const scale = W / box.width;
      const i = Math.max(0, Math.min(n - 1, Math.floor((cx * scale - padL) / slot)));
      const r = rows[i];
      cursor.setAttribute('x', (x(i) - gap / 2).toFixed(1));
      cursor.setAttribute('width', slot.toFixed(1));
      cursor.setAttribute('opacity', 0.07);
      tip.innerHTML = spec.tip(r, i);
      tip.classList.add('on');
      const tw = tip.offsetWidth;
      let left = (x(i) + bw / 2) / scale - tw / 2;
      left = Math.max(2, Math.min(box.width - tw - 2, left));
      tip.style.left = left + 'px';
      tip.style.top = '0px';
    };
    const leave = () => { tip.classList.remove('on'); cursor.setAttribute('opacity', 0); };
    readout(hit, wrap, move, leave);
  }

  draw();
  new ResizeObserver(() => draw()).observe(wrap);
  return wrap;
}

/** Scatter with a nearest-point hit layer. */
function scatterChart(host, spec) {
  const wrap = el('div', 'chartwrap');
  const tip = el('div', 'tip');
  wrap.append(tip);
  host.append(wrap);

  function draw() {
    const W = Math.max(260, wrap.clientWidth || 320);
    const H = spec.height || 220;
    const padL = 42, padR = 10, padT = spec.yLabel ? 20 : 10, padB = 34;
    const iw = W - padL - padR, ih = H - padT - padB;
    wrap.querySelectorAll('svg, .empty').forEach((s) => s.remove());
    const pts = spec.points;
    if (!pts.length) {
      wrap.append(el('div', 'empty', 'No sessions match this filter.'));
      return;
    }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const xPad = (x1 - x0) * 0.08 || 1, yPad = (y1 - y0) * 0.08 || 1;
    const sx = (v) => padL + ((v - (x0 - xPad)) / ((x1 + xPad) - (x0 - xPad))) * iw;
    const sy = (v) => padT + ih - ((v - (y0 - yPad)) / ((y1 + yPad) - (y0 - yPad))) * ih;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    svg.setAttribute('aria-label', spec.aria || 'scatter chart');
    yCaption(svg, spec.yLabel, padL);

    for (const t of ticksIn(y0 - yPad, y1 + yPad, 5)) {
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: sy(t), y2: sy(t), stroke: 'var(--hairline)', 'stroke-width': 1 }));
      svg.append(Object.assign(svgEl('text', {
        x: padL - 5, y: sy(t) + 3.5, 'text-anchor': 'end', fill: 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: spec.yFmt ? spec.yFmt(t) : fmt0(t) }));
    }
    for (const t of ticksIn(x0 - xPad, x1 + xPad, 4)) {
      svg.append(Object.assign(svgEl('text', {
        x: sx(t), y: H - 13, 'text-anchor': 'middle', fill: 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: spec.xFmt ? spec.xFmt(t) : fmt0(t) }));
    }
    svg.append(Object.assign(svgEl('text', {
      x: padL + iw / 2, y: H - 2, 'text-anchor': 'middle', fill: 'var(--text-muted)', 'font-size': 9.5,
    }), { textContent: spec.xLabel || '' }));

    for (const p of pts) {
      svg.append(svgEl('circle', {
        cx: sx(p.x).toFixed(1), cy: sy(p.y).toFixed(1), r: 4.5,
        fill: p.color, stroke: 'var(--surface-1)', 'stroke-width': 2, opacity: 0.9,
      }));
    }

    const hit = svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const cx = (ev.clientX - box.left) * scale, cy = (ev.clientY - box.top) * scale;
      let best = null, bd = 1e9;
      for (const p of pts) {
        const d = (sx(p.x) - cx) ** 2 + (sy(p.y) - cy) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (!best || bd > 40 * 40) { tip.classList.remove('on'); return; }
      tip.innerHTML = best.tip;
      tip.classList.add('on');
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(2, Math.min(box.width - tw - 2, sx(best.x) / scale - tw / 2)) + 'px';
      tip.style.top = Math.max(0, sy(best.y) / scale - 52) + 'px';
    };
    readout(hit, wrap, move, () => tip.classList.remove('on'));
  }

  draw();
  new ResizeObserver(() => draw()).observe(wrap);
}

/** Lap chart: one bar per lap, bar width proportional to lap duration, so an
 *  interval session looks like an interval session. */
function lapChart(host, laps, spec) {
  const wrap = el('div', 'chartwrap');
  const tip = el('div', 'tip');
  wrap.append(tip);
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
      wrap.append(el('div', 'empty', spec.emptyText || 'Nothing to plot for these laps.'));
      return;
    }
    const hi = Math.max(...finite, ...(spec.rules || []).map((r) => r.at));
    const ticks = niceTicks(hi, 4);
    const top = ticks[ticks.length - 1] || 1;
    const y = (v) => padT + ih - (v / top) * ih;
    const x = (t) => padL + (t / total) * iw;
    const tickText = spec.tickFmt || ((t) => fmt0(t));

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    svg.setAttribute('aria-label', spec.aria || 'lap chart');
    yCaption(svg, spec.yLabel, padL);
    for (const t of ticks) {
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), stroke: 'var(--hairline)', 'stroke-width': 1 }));
      svg.append(Object.assign(svgEl('text', {
        x: padL - 5, y: y(t) + 3.5, 'text-anchor': 'end', fill: 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: tickText(t) }));
    }
    const starts = [];
    let t0 = 0;
    laps.forEach((l, i) => {
      starts.push(t0);
      const v = vals[i];
      const x0 = x(t0), x1 = x(t0 + (l.dur || 0));
      if (v != null && isFinite(v) && v > 0) {
        const w = Math.max(1, x1 - x0 - 1);
        const h = Math.max(0.6, ih - (y(v) - padT));
        svg.append(svgEl('rect', {
          x: (x0 + 0.5).toFixed(2), y: y(v).toFixed(2), width: w.toFixed(2), height: h.toFixed(2),
          rx: Math.min(3, w / 2), ry: Math.min(3, w / 2), fill: spec.color(l, i),
        }));
      }
      t0 += l.dur || 0;
    });
    for (const rule of spec.rules || []) {
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: y(rule.at), y2: y(rule.at), stroke: rule.color || 'var(--hairline-strong)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      if (rule.label) svg.append(Object.assign(svgEl('text', {
        x: W - padR - 2, y: y(rule.at) - 4, 'text-anchor': 'end', fill: rule.color || 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: rule.label }));
    }
    // time axis in minutes
    const stepMin = [1, 2, 5, 10, 15, 20, 30, 60, 120].find((st) => total / 60 / st <= 6) || 240;
    for (let m = stepMin; m * 60 < total; m += stepMin) {
      svg.append(Object.assign(svgEl('text', {
        x: x(m * 60), y: H - 8, 'text-anchor': 'middle', fill: 'var(--text-muted)', 'font-size': 9.5,
      }), { textContent: `${fmt0(m)} min` }));
    }
    svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih, stroke: 'var(--hairline-strong)', 'stroke-width': 1 }));

    const cursor = svgEl('rect', { x: 0, y: padT, width: 4, height: ih, fill: 'var(--text-primary)', opacity: 0, 'pointer-events': 'none' });
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
      cursor.setAttribute('x', x(starts[i]).toFixed(1));
      cursor.setAttribute('width', Math.max(2, x(starts[i] + (l.dur || 0)) - x(starts[i])).toFixed(1));
      cursor.setAttribute('opacity', 0.1);
      tip.innerHTML = spec.tip(l, i);
      tip.classList.add('on');
      const tw = tip.offsetWidth;
      let left = (x(starts[i] + (l.dur || 0) / 2)) / scale - tw / 2;
      left = Math.max(2, Math.min(box.width - tw - 2, left));
      tip.style.left = left + 'px';
      tip.style.top = '0px';
    };
    const hide = () => { tip.classList.remove('on'); cursor.setAttribute('opacity', 0); };
    readout(hit, wrap, show, hide);
  }

  draw();
  new ResizeObserver(() => draw()).observe(wrap);
}

/* ---------------------------------------------------------------- widgets */

function card(title, sub) {
  const c = el('div', 'card');
  c.append(el('h2', null, esc(title)));
  if (sub) c.append(help(sub));
  return c;
}

/* Explanations of a chart are folded away behind a small ⓘ in the card's
 * heading, so the panes stay clean; the numbers themselves stay visible. */
function help(text) {
  const p = el('p', 'sub help', text);
  queueMicrotask(() => { const c = p.closest('.card'); if (c) ensureInfo(c); });
  return p;
}
function ensureInfo(c) {
  const h = c.querySelector(':scope > h2');
  if (!h || h.querySelector('.info')) return;
  const b = el('button', 'info', 'i');
  b.type = 'button';
  b.setAttribute('aria-label', 'Explain this chart');
  b.onclick = (ev) => { ev.stopPropagation(); c.classList.toggle('help'); b.setAttribute('aria-expanded', c.classList.contains('help')); };
  h.append(b);
}

function legend(items) {
  const l = el('div', 'legend');
  for (const it of items) {
    const style = `background:${it.color}` + (it.faint ? ';opacity:.28' : '');
    l.append(el('span', null,
      `<i class="${it.line ? 'line' : ''}" style="${style}"></i>${esc(it.label)}`));
  }
  return l;
}

function tableToggle(host, id, build) {
  const b = el('button', 'tablebtn', state.tables.has(id) ? 'Hide table' : 'Table view');
  const box = el('div', 'tableview');
  box.hidden = !state.tables.has(id);
  if (state.tables.has(id)) box.append(build());
  b.onclick = () => {
    if (state.tables.has(id)) { state.tables.delete(id); box.hidden = true; box.innerHTML = ''; b.textContent = 'Table view'; }
    else { state.tables.add(id); box.innerHTML = ''; box.append(build()); box.hidden = false; b.textContent = 'Hide table'; }
  };
  host.append(b, box);
}

function table(headers, rows) {
  const t = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of headers) { const th = document.createElement('th'); th.textContent = h; hr.append(th); }
  thead.append(hr); t.append(thead);
  const tb = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const cell of r) { const td = document.createElement('td'); td.textContent = cell; tr.append(td); }
    tb.append(tr);
  }
  t.append(tb);
  return t;
}

function tile(label, value, note, unit) {
  const t = el('div', 'tile');
  t.append(el('div', 'label', esc(label)));
  // A word (a Garmin status, a verdict) is set smaller than a number so it fits the cell.
  const wordy = /^[^\d]{7,}/.test(String(value));
  t.append(el('div', wordy ? 'value word' : 'value', esc(value) + (unit ? ` <small>${esc(unit)}</small>` : '')));
  if (note) t.append(el('div', 'note', esc(note)));
  return t;
}

/* ------------------------------------------------------------------ panes */

let shownTab = null;
function render() {
  const main = document.getElementById('main');
  // A filter or chip re-renders the whole pane; emptying it briefly shortens
  // the page and the browser clamps the scroll to the top. Keep the reader's
  // place on a same-pane re-render (tab switches scroll to the top themselves).
  const samePane = shownTab === state.tab;
  const keepY = samePane ? window.scrollY : 0;
  main.style.minHeight = samePane ? `${main.offsetHeight}px` : '';
  main.innerHTML = '';
  // The entrance animation (style.css) only plays when the pane changes, not
  // on every chip or filter re-render of the same pane.
  main.classList.toggle('enter', !samePane);
  shownTab = state.tab;
  syncFilterVisibility();
  ({ now: paneNow, plan: panePlan, training: paneTraining, health: paneHealth, sessions: paneSessions }[state.tab])(main);
  if (samePane) {
    window.scrollTo(0, keepY);
    main.style.minHeight = '';
    if (window.scrollY !== keepY) window.scrollTo(0, Math.min(keepY, document.documentElement.scrollHeight - window.innerHeight));
  }
}

/** A small heading between the groups of a long pane. */
function groupHead(main, text) {
  main.append(el('h2', 'group', esc(text)));
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

/* --- Now ---------------------------------------------------------------- */

function paneNow(main) {
  const acts = DATA.activities;
  const today = todayIso();
  const since = (days) => acts.filter((a) => ago(a.d, today) < days);

  const w1 = since(7), w4 = since(28), prev4 = acts.filter((a) => ago(a.d, today) >= 28 && ago(a.d, today) < 56);
  const runsIn = (list) => list.filter((a) => a.sport === 'run');
  const km = (list) => runsIn(list).reduce((s, a) => s + runKm(a), 0);
  const walked = (list) => runsIn(list).reduce((s, a) => s + walkKm(a), 0);
  const lastRun = [...acts].reverse().find((a) => a.sport === 'run');

  // A percentage against a near-zero base is arithmetic, not information — after
  // a lay-off it reads "+757%". Show the two numbers instead unless the previous
  // block was substantial enough for a ratio to mean something.
  const km4 = km(w4), kmPrev4 = km(prev4);
  const note28 = kmPrev4 >= 10
    ? `${km4 >= kmPrev4 ? '+' : ''}${fmt0(((km4 / kmPrev4) - 1) * 100)}% vs previous 28 days`
    : `previous 28 days: ${fmt1(kmPrev4)} km`;
  const walkNote = (list) => (walked(list) >= 0.2 ? ` · ${fmt1(walked(list))} km walked` : '');

  const tiles = el('div', 'tiles');
  tiles.append(tile('Run, last 7 days', fmt1(km(w1)), `${runsIn(w1).length} run${runsIn(w1).length === 1 ? '' : 's'}${walkNote(w1)}`, 'km'));
  tiles.append(tile('Run, last 28 days', fmt1(km4), note28 + walkNote(w4), 'km'));
  const gn = DATA.garminNow || {};
  tiles.append(tile('Garmin status', (gn.trainingStatus || '—').replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase(),
    `acute ${fmt0(gn.acuteLoad)} · chronic ${fmt0(gn.chronicLoad)}`));
  tiles.append(tile('VO₂ max', fmt1(gn.vo2max || DATA.athlete.vo2maxRunning || 0),
    lastRun ? `last run ${shortDate(lastRun.d)}` : ''));
  main.append(tiles);

  const a = DATA.assessment;
  if (!a) {
    const c = card('Evaluation');
    c.append(el('p', 'sub', 'No assessment in this snapshot. The refresh writes one on every run — if this stays empty, the scheduled job is not completing.'));
    main.append(c);
    planPointer(main);
    raceCard(main, gn);
    return;
  }

  // Order of the pane: the verdict, then what to do about it, then the numbers
  // behind it, then the reasoning — folded, because it is long and it is
  // meant to be read once a week, not every time the pane opens.
  const hero = el('div', 'hero');
  hero.append(el('div', `verdict pill ${a.tone || 'neutral'}`, esc(a.verdict || 'Assessment')));
  hero.append(el('p', 'headline', esc(a.headline || '')));
  main.append(hero);

  planPointer(main);

  if (a.metrics && a.metrics.length) {
    const mt = el('div', 'tiles');
    for (const m of a.metrics) mt.append(tile(m.label, m.value, m.note));
    main.append(mt);
  }

  raceCard(main, gn);

  const ev = card('The full evaluation', a.summary ? esc(a.summary) : null);
  for (const s of a.sections || []) {
    const d = document.createElement('details');
    d.className = 'fold';
    d.innerHTML = `<summary>${esc(s.title)}${s.tone ? ` <span class="pill ${esc(s.tone)}">${esc(toneWord(s.tone))}</span>` : ''}</summary>`;
    const sec = el('div', 'section');
    for (const p of s.body || []) sec.append(el('p', null, esc(p)));
    if (s.bullets && s.bullets.length) {
      const ul = document.createElement('ul');
      for (const b of s.bullets) ul.append(el('li', null, esc(b)));
      sec.append(ul);
    }
    d.append(sec);
    ev.append(d);
  }
  ev.append(el('p', 'sub wrote',
    `Written ${a.updated ? longDate(a.updated) : 'with this snapshot'}, from the full history, and regenerated on every refresh so it moves with the training rather than describing one good week.`));
  main.append(ev);

}

const KIND_WORD = { rest: 'rest', easy: 'easy', long: 'long', quality: 'hard', race: 'race', strength: 'strength', done: 'done', missed: 'missed' };
const MIX = [
  { label: 'Easy (Z1–2)', color: 'var(--zone-2)' },
  { label: 'Moderate (Z3)', color: 'var(--zone-3)' },
  { label: 'Hard (Z4–5)', color: 'var(--zone-4)' },
];
const faint = (c) => `color-mix(in srgb, ${c} 38%, var(--surface-1))`;

/** On the Now pane: the plan's headline and a way into the Plan tab. */
function planPointer(main) {
  const p = DATA.plan;
  if (!p) return;
  const c = el('div', 'card pointer');
  c.append(el('h2', null, `What to do next <span class="pill ${esc(p.tone || 'neutral')}">${esc(toneWord(p.tone || 'neutral'))}</span>`));
  c.append(el('p', 'planhead', esc(p.headline || '')));
  if (p.goal && p.goal.race) c.append(el('p', 'sub', `Planned around ${esc(p.goal.race.name)}, ${esc(longDate(p.goal.race.date))}.`));
  const b = el('button', 'tablebtn', 'Open the plan');
  b.onclick = () => { state.tab = 'plan'; remember(); buildTabs(); render(); window.scrollTo(0, 0); };
  c.append(b);
  main.append(c);
}

/* --- Today: the last 24 hours from the hourly pull ------------------------ */

const clock = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

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

/** Centred running mean over k samples, never reaching across a gap (null). */
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
  const pulled = it.pulledAt ? new Date(it.pulledAt) : null;
  const ageMin = pulled ? Math.round((Date.now() - pulled.getTime()) / 60000) : null;

  const tiles = el('div', 'tiles');
  tiles.append(tile('Heart rate', lastHr ? String(lastHr[1]) : '—', lastHr ? `at ${clock(lastHr[0])}${it.restingHr ? ` · resting ${it.restingHr}` : ''}` : '', 'bpm'));
  tiles.append(tile('Body battery', lastBb ? String(lastBb[1]) : '—', lastBb ? `at ${clock(lastBb[0])}` : 'not recorded'));
  tiles.append(tile('Stress', lastSt ? String(lastSt[1]) : '—', lastSt ? (lastSt[1] < 26 ? 'rest' : lastSt[1] < 51 ? 'low' : lastSt[1] < 76 ? 'medium' : 'high') + ` at ${clock(lastSt[0])}` : 'not recorded'));
  const hrs = hr.map((p) => p[1]);
  tiles.append(tile('24 h range', `${Math.min(...hrs)}–${Math.max(...hrs)}`, `${hr.length} samples`, 'bpm'));
  main.append(tiles);

  const hourTicks = [];
  const firstHour = Math.ceil(t0 / 3600) * 3600;
  for (let t = firstHour; t <= tEnd; t += 3600) {
    const h = new Date(t * 1000).getHours();
    if (h % 3 === 0) hourTicks.push({ at: t - t0, label: `${String(h).padStart(2, '0')}:00`, grid: h === 0 });
  }
  const floors = DATA.athlete.zoneFloors;

  const c1 = card('Heart rate, last 24 hours',
    `Every couple of minutes from the watch, coloured by zone; gaps are where it was off the wrist. Samples to ${clock(tEnd)}${ageMin != null ? `, pulled ${ageMin < 2 ? 'just now' : ageMin < 60 ? `${ageMin} min ago` : `${Math.round(ageMin / 60)} h ago`}` : ''}. Tap and hold to read a point.`);
  const chips = el('div', 'chips');
  for (const [key, label] of [[false, 'Every sample'], [true, 'Smoothed, 10 min']]) {
    const b = el('button', todaySmooth === key ? 'on' : null, label);
    b.onclick = () => { todaySmooth = key; render(); };
    chips.append(b);
  }
  c1.append(chips);
  const area1 = el('div');
  c1.append(area1);
  c1.append(legend(LINE_LEGEND));
  main.append(c1);
  const sHrRaw = daySeries(hr, t0, 15 * 60);
  const drawHr = () => {
    area1.innerHTML = '';
    const sHr = todaySmooth ? smoothed(sHrRaw, 5) : sHrRaw;
    streamChart(area1, sHr, {
      height: 200, xMode: 'time', value: (i) => sHr.v[i], color: (i, v) => zoneLineColor(v), width: 1.4,
      yMin: Math.max(35, (it.restingHr || 50) - 10),
      rules: floors.slice(0, 4).map((f, k) => ({ at: f, color: 'var(--hairline-strong)', label: `Z${k + 1}` })),
      xTicks: hourTicks, aria: 'Heart rate over the last 24 hours', yLabel: 'bpm',
      tip: (i) => `<b>${clock(t0 + sHr.t[i])}</b>${sHr.v[i] != null ? `<br><span class="k">HR</span> ${Math.round(sHr.v[i])} · zone ${zoneOf(sHr.v[i]) || 'below 1'}${todaySmooth ? ' · 10-min mean' : ''}` : ''}`,
    });
  };
  let drawSt = () => {};
  const render = () => { chips.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', (k === 1) === todaySmooth)); drawHr(); drawSt(); };
  drawHr();

  if (bb.length > 1) {
    const c2 = card('Body battery', 'Garmin’s 0–100 energy estimate: it charges in sleep and rest, drains with stress and exercise. The morning level is the one that tells you something about the day.');
    const sBb = daySeries(bb, t0, 30 * 60);
    streamChart(c2, sBb, {
      height: 150, xMode: 'time', value: (i) => sBb.v[i], color: 'var(--series-3)', area: true, yMin: 0, yMax: 100, width: 1.6,
      xTicks: hourTicks, aria: 'Body battery over the last 24 hours', yLabel: 'body battery, 0–100',
      tip: (i) => `<b>${clock(t0 + sBb.t[i])}</b>${sBb.v[i] != null ? `<br><span class="k">body battery</span> ${sBb.v[i]}` : ''}`,
    });
    main.append(c2);
  }
  if (st.length > 1) {
    const c3 = card('Stress', 'Heart-rate variability read as stress, 0–100. Under 25 is rest, over 50 is worth noticing if it is not exercise. Samples during activity are left out. Follows the smoothing switch above.');
    const area3 = el('div');
    c3.append(area3);
    main.append(c3);
    const sStRaw = daySeries(st, t0, 30 * 60);
    drawSt = () => {
      area3.innerHTML = '';
      const sSt = todaySmooth ? smoothed(sStRaw, 5) : sStRaw;
      streamChart(area3, sSt, {
        height: 130, xMode: 'time', value: (i) => sSt.v[i], color: (i, v) => (v < 26 ? 'var(--zone-2)' : v < 51 ? 'var(--zone-3)' : v < 76 ? 'var(--zone-4)' : 'var(--zone-5)'), yMin: 0, yMax: 100, width: 1.4,
        xTicks: hourTicks, aria: 'Stress over the last 24 hours', yLabel: 'stress, 0–100',
        tip: (i) => `<b>${clock(t0 + sSt.t[i])}</b>${sSt.v[i] != null ? `<br><span class="k">stress</span> ${Math.round(sSt.v[i])}${todaySmooth ? ' · 15-min mean' : ''}` : ''}`,
      });
    };
    drawSt();
  }
  const foot = el('div', 'card');
  foot.append(el('p', 'sub', 'This pane is the live end of the app: the pull runs every hour and replaces these 24 hours each time, while the rest of the app changes only when a session is logged or the morning text is written.'));
  main.append(foot);
}

/* --- Plan --------------------------------------------------------------- */

function panePlan(main) {
  const p = DATA.plan;
  if (!p) {
    const c = card('Plan');
    c.append(el('p', 'sub', 'No plan in this snapshot. The refresh writes one on every run — if this stays empty, the scheduled job is not completing.'));
    main.append(c);
    return;
  }
  const today = todayIso();

  const hero = el('div', 'hero');
  hero.append(el('div', `verdict pill ${p.tone || 'neutral'}`, esc(toneWord(p.tone || 'neutral'))));
  hero.append(el('p', 'headline', esc(p.headline || '')));
  main.append(hero);

  if (p.goal && p.goal.race) {
    const g = p.goal;
    const c = card(`Goal: ${esc(g.race.name)}`);
    const t = el('div', 'tiles');
    t.append(tile('Race day', shortDate(g.race.date), `in ${ago(today, g.race.date)} days`));
    t.append(tile('Distance', fmt1(g.race.distanceKm), g.race.start ? `start ${g.race.start}` : '', 'km'));
    if (g.race.expect) t.append(tile('Expect', g.race.expect.split(' ')[0], g.race.expect.split(' ').slice(1).join(' ')));
    c.append(t);
    main.append(c);
  }

  horizonCard(main, p, today);
  dayChart(main, p, today);
  dayChart(main, p, today, 'load');

  for (const w of p.weeks || []) main.append(weekCard(w, today));

  // The reasoning, folded: the charts and the week are the plan; this is the why.
  const about = card('About this plan');
  const fold = (title, paras, open) => {
    const items = paras.filter(Boolean);
    if (!items.length) return;
    const d = document.createElement('details');
    d.className = 'more';
    if (open) d.open = true;
    d.append(el('summary', null, esc(title)));
    for (const t of items) d.append(typeof t === 'string' ? el('p', null, esc(t)) : t);
    about.append(d);
  };
  const g = p.goal || {};
  fold(g.race ? 'The goal' : 'Goal: general fitness', [g.text, g.preferences && g.preferences.length ? `Preferences: ${g.preferences.join('; ')}.` : null]);
  if (g.strength && g.strength.programme) {
    const ul = document.createElement('ul');
    for (const x of g.strength.programme) ul.append(el('li', null, esc(x)));
    fold(`Strength programme${g.strength.from ? `, from ${longDate(g.strength.from)}` : ''}`,
      [`${g.strength.perWeek || 1} session${(g.strength.perWeek || 1) === 1 ? '' : 's'} a week${g.strength.day ? `, ${g.strength.day} by default` : ''}.`, ul, g.strength.notes]);
  }
  fold('Why this shape', [p.why]);
  fold('After that', [p.after]);
  if (p.guardrails && p.guardrails.length) {
    const ul = document.createElement('ul');
    for (const x of p.guardrails) ul.append(el('li', null, esc(x)));
    fold('Stop signs', [ul], true);
  }
  main.append(about);
  const foot = el('div', 'card');
  foot.append(el('p', 'sub', `Plan written ${p.updated ? longDate(p.updated) : 'with this snapshot'} from the load, recovery, session notes and history, and the Garmin calendar. It is rewritten on every refresh; a race added to Garmin Connect reshapes it on the next one.`));
  main.append(foot);
}

/** Kilometres per heart-rate zone for one session. With the record stream
 *  (`zk`, runs pulled with their record stream) it is exact. Otherwise, with laps, each
 *  lap's distance goes to the zone of its average heart rate — so a fast kilometre
 *  at 173 is a zone 3 kilometre, not a share of the whole run. Without laps
 *  (older sessions) the run's kilometres are split by time in zone, which
 *  undercounts the fast zones because fast running covers more ground per
 *  minute. Scaled to the running-only distance either way. */
/** Kilometres run in each zone, six values: Z1–Z5, then the metres run with
 *  the heart rate still under the zone 1 floor (the start of a run, mostly),
 *  which count as distance but as no training zone. */
function kmByZone(a) {
  const out = [0, 0, 0, 0, 0, 0];
  const km = runKm(a);
  if (!(km > 0)) return out;
  if (a.zk) { // exact: every metre credited to the zone of that second's heart rate
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

/** Zone load per kilometre of running, from the last eight weeks with runs:
 *  what a planned kilometre is worth in load when only its distance is known. */
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
  const tot = a.z.reduce((s, v) => s + v, 0) || 1;
  const part = (idx) => idx.reduce((s, i) => s + (a.z[i] / 60) * (i + 1), 0);
  return t ? [part([0, 1]), part([2]), part([3, 4])] : [0, 0, 0];
}

const BELOW = { label: 'Below Z1', color: 'var(--zone-0)' };

/* ---- Muscle load -------------------------------------------------------
 * The heart-rate measures say what the aerobic system did. This estimates
 * what the muscles did, as mechanical work in kJ per kg of body mass, from
 * the biomechanics literature rather than points:
 *   running    total mechanical work on the level ≈ 1.0 + 0.3·v J/kg/m
 *              (external ≈ 1, internal rising with speed v in m/s: Cavagna &
 *              Kaneko 1977, Willems, Cavagna & Heglund 1995), half of it
 *              positive (concentric) and half negative (eccentric)
 *   walking    ≈ 0.7 J/kg/m on the level (same sources), split the same way
 *   height     g = 9.81 J/kg per metre climbed (concentric) or descended
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
 * The weights ×3 and ×5 are the one judgement call; everything else is a
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
 * shows training as something other than kilometres. Remembered on the device. */
const UNITS = [['time', 'Zone time'], ['load', 'Aerobic'], ['muscle', 'Muscle'], ['sport', 'Sport time']];
const UNIT_LONG = { time: 'time in zone', load: 'aerobic load', muscle: 'muscle load', sport: 'time in training by sport' };
let loadUnit = (() => { try { const v = localStorage.getItem('tl-loadunit'); return UNITS.some((u) => u[0] === v) ? v : 'time'; } catch (e) { return 'time'; } })();
const isLoad = () => loadUnit === 'load';
const isMuscle = () => loadUnit === 'muscle';
const isSport = () => loadUnit === 'sport';
const unitWord = () => (loadUnit === 'time' || loadUnit === 'sport' ? 'min' : loadUnit === 'muscle' ? 'kJ/kg' : 'load');
const unitName = () => UNIT_LONG[loadUnit];
const unitAxis = (per) => `${loadUnit === 'load' ? 'aerobic load' : unitWord()} per ${per}`;  // y-axis caption for the load charts
const mixDef = () => (isSport() ? SPORTS : isMuscle() ? MUSCLE_MIX : MIX);
function unitChips() {
  const chips = el('div', 'chips');
  for (const [key, label] of UNITS) {
    const b = el('button', loadUnit === key ? 'on' : null, label);
    b.onclick = () => { loadUnit = key; try { localStorage.setItem('tl-loadunit', key); } catch (e) { /* private mode */ } render(); };
    chips.append(b);
  }
  return chips;
}
/** One activity in the chosen unit, split three ways: easy / moderate / hard
 *  for the heart-rate units, impact / ascent / descent for muscle load. */
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
/** Where a planned running kilometre's value goes: by the plan's easy /
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
    { values: all.map((v, i) => (i <= nowIdx ? v : null)), color: 'var(--text-primary)' },
    { values: all.map((v, i) => (i >= nowIdx ? v : null)), color: 'var(--series-2)', dash: '5 4' },
  ];
}
const AVG_LEGEND = [
  { color: 'var(--text-primary)', label: '4-week average, actual', line: true },
  { color: 'var(--series-2)', label: '4-week average, planned', line: true },
];

/** Weekly running volume: the recent weeks as run, the next six months as planned. */
function horizonCard(main, p, today) {
  const horizon = p.horizon || [];
  if (!horizon.length) return;
  const thisMon = mondayOf(today);
  const backWeeks = weeksBetween(iso(new Date(parse(thisMon).getTime() - 11 * 7 * DAY)), thisMon);
  const actual = new Map(backWeeks.map((k) => [k, { km: 0, zk: [0, 0, 0, 0, 0, 0], runs: 0, long: 0, load: new Array(mixDef().length).fill(0), other: 0, sessions: 0 }]));
  for (const a of DATA.activities) {
    const w = actual.get(mondayOf(a.d));
    if (!w) continue;
    const lm = measureMix(a);
    for (let i = 0; i < lm.length; i++) w.load[i] += lm[i];
    w.sessions++;
    if (a.sport !== 'run') { w.other += lm[0] + lm[1] + lm[2]; continue; }
    w.km += runKm(a); w.runs++; w.long = Math.max(w.long, runKm(a));
    const zk = kmByZone(a);
    for (let i = 0; i < 6; i++) w.zk[i] += zk[i];
  }
  const perKm = loadPerKm(today);
  const rows = [];
  for (const k of backWeeks) {
    const w = actual.get(k);
    const seg = [
      { v: w.zk[5], color: BELOW.color },
      { v: w.zk[0] + w.zk[1], color: MIX[0].color },
      { v: w.zk[2], color: MIX[1].color },
      { v: w.zk[3] + w.zk[4], color: MIX[2].color },
    ];
    // The current week: what has been run, and the plan's remainder on top.
    const planned = k === thisMon ? (p.weeks || []).find((x) => x.start === k) : null;
    let target = null;
    if (planned) { const m = String(planned.targetKm || '').match(/(\d+)\D+(\d+)/); target = m ? (+m[1] + +m[2]) / 2 : null; }
    if (target != null && target > w.km) seg.push({ v: target - w.km, color: faint(MIX[0].color) });
    rows.push({ key: k, label: shortDate(k), total: Math.max(w.km, target || 0), seg, w, target, planned });
  }
  for (const h of horizon) {
    if (h.w <= thisMon) continue;
    const mix = h.mix || [100, 0, 0];
    rows.push({ key: h.w, label: shortDate(h.w), total: h.km, seg: MIX.map((m, i) => ({ v: h.km * mix[i] / 100, color: faint(m.color) })), h });
  }
  const kms = rows.map((r) => r.total);
  const raceIdx = rows.findIndex((r) => r.h && r.h.kind === 'race');
  const marks = [{ i: backWeeks.length - 1, label: 'now', color: 'var(--hairline-strong)', after: true }];
  if (raceIdx >= 0 && p.goal && p.goal.race) marks.push({ i: raceIdx, label: p.goal.race.name, color: 'var(--zone-5)' });

  const c = card('Running volume, past and planned',
    'Kilometres of running per week: solid bars are what was run, split into the kilometres covered at easy, moderate and hard heart rate, with the metres run before the heart rate reached zone 1 in grey at the bottom; faint bars are the plan, split by the share of time meant for each. The dark line is the four-week average as run, the dashed one the plan\u2019s.');
  columnChart(c, {
    height: 210,
    rows,
    lines: avgLines(kms, backWeeks.length - 1),
    marks,
    aria: 'Weekly running volume, actual and planned',
    yLabel: 'km per week',
    tip: (r) => r.h
      ? `<b>Week of ${esc(longDate(r.key))}</b> · planned<br>${fmt0(r.h.km)} km · ${esc(r.h.kind)}${r.h.mix ? ` · ${r.h.mix.map((v, i) => `${fmt0(v)}% ${['easy', 'mod', 'hard'][i]}`).join(', ')}` : ''}${r.h.note ? `<br>${esc(r.h.note)}` : ''}`
      : `<b>Week of ${esc(longDate(r.key))}</b>${r.target != null ? ' · so far' : ''}<br>${fmt1(r.w.km)} km run · ${r.w.runs} run${r.w.runs === 1 ? '' : 's'} · longest ${fmt1(r.w.long)} km${r.w.zk[5] >= 0.05 ? ` · ${fmt1(r.w.zk[5])} km below Z1` : ''}${r.planned ? `<br>target ${esc(String(r.planned.targetKm || ''))}` : ''}`,
  });
  c.append(legend([BELOW].concat(MIX).map((m) => ({ color: m.color, label: m.label })).concat(AVG_LEGEND)));
  const planned = horizon.filter((h) => h.w > thisMon);
  if (planned.length) {
    const peak = planned.reduce((m, h) => Math.max(m, h.km), 0);
    const downs = planned.filter((h) => h.kind === 'down').length;
    c.append(el('p', 'sub', `${planned.length} weeks planned, ${longDate(planned[0].w)} to ${longDate(planned[planned.length - 1].w)}: from ${fmt0(planned[0].km)} km to a peak of ${fmt0(peak)} km, with ${downs} down week${downs === 1 ? '' : 's'}.`));
  }
  tableToggle(c, 'horizon', () => table(['Week', 'km', 'Easy', 'Mod', 'Hard', 'Note'],
    planned.map((h) => [shortDate(h.w), fmt0(h.km), `${fmt0(h.mix[0])}%`, `${fmt0(h.mix[1])}%`, `${fmt0(h.mix[2])}%`, `${h.kind === 'down' ? 'down · ' : h.kind === 'race' ? 'race · ' : h.kind === 'hold' ? 'hold · ' : ''}${h.note || ''}`])));
  main.append(c);

  // The same weeks as load: every sport counts, so a ride in place of a run
  // keeps the bar up where the kilometres would have dropped.
  const MX = mixDef();
  // A planned week is its running kilometres at the block's rate, plus, from
  // the strength start, a typical strength session — both converted to the
  // same categories as the bars, so the plan reads as expected load.
  const st = (p.goal && p.goal.strength) || null;
  const gym = plannedStrength();
  const gymWeek = (w) => (st && st.from && w >= st.from ? (st.perWeek || 1) : 0);
  const plannedSeg = (km, mix, weeks) => {
    const run = km * perKm, rs = plannedRunSplit(mix), g = gymWeek(weeks) * gym.total;
    return { total: run + g, gym: g, seg: MX.map((m, i) => ({ v: run * rs[i] + g * gym.split[i], color: faint(m.color) })) };
  };
  const loadRows = rows.map((r) => {
    if (r.h) {
      const pl = plannedSeg(r.h.km, r.h.mix, r.h.w);
      return { key: r.key, label: r.label, total: pl.total, seg: pl.seg, h: r.h, est: pl.total, gym: pl.gym };
    }
    const w = r.w;
    const done = w.load.reduce((x, v) => x + v, 0);
    const seg = MX.map((m, i) => ({ v: w.load[i], color: m.color }));
    const est = r.target != null ? plannedSeg(r.target, null, r.key).total : null;
    if (est != null && est > done) seg.push({ v: est - done, color: faint(MX[0].color) });
    return { key: r.key, label: r.label, total: Math.max(done, est || 0), seg, w, done, est };
  });
  const lc = isSport()
    ? card('Time in training, past and planned',
      `Minutes of training per week, every sport in its own colour — the whole session, warm-up and walk breaks included. Faint bars are the plan: the kilometres at this block's pace of about ${fmt1(perKm)} min per kilometre run${st && st.from ? `, plus a strength session of about ${fmt0(gym.total)} min a week from ${shortDate(st.from)}` : ''}.`)
    : isMuscle()
    ? card('Muscle load, past and planned',
      `Mechanical work by the muscles each week in kJ per kg of body mass, every sport counted: the work of moving on the level plus the metres climbed and descended, with the lengthening (eccentric) part weighted for strain — ×3 on descents, ×5 for lifting. Strength is taken as full body. Faint bars are the plan's kilometres at this block's rate of about ${fmt1(perKm)} kJ/kg per kilometre run.`)
    : isLoad()
    ? card('Training load, past and planned',
      `Zone load per week — minutes in each heart-rate zone weighted 1 to 5 — across every sport, split by intensity. Solid bars are what was done, faint bars the plan's kilometres converted at this block's rate of about ${fmt0(perKm)} load per kilometre run. Where a ride or other session stands in for a run, this stays up while the kilometres above dip.`)
    : card('Time in zone, past and planned',
      `Minutes in heart-rate zones 1 to 5 per week across every sport, split by intensity; time under the zone 1 floor is left out as no training. Solid bars are what was done, faint bars the plan's kilometres at this block's pace of about ${fmt1(perKm)} min per kilometre run. Where a ride or other session stands in for a run, this stays up while the kilometres above dip.`);
  lc.append(unitChips());
  columnChart(lc, {
    height: 210,
    rows: loadRows,
    lines: avgLines(loadRows.map((r) => r.total), backWeeks.length - 1),
    marks,
    aria: `Weekly ${unitName()}, actual and planned`,
    yLabel: unitAxis('week'),
    tip: (r) => r.h
      ? `<b>Week of ${esc(longDate(r.key))}</b> · planned<br>≈ ${fmt0(r.est)} ${unitWord()}: ${fmt0(r.est - (r.gym || 0))} from ${fmt0(r.h.km)} km${r.gym ? ` + ${fmt0(r.gym)} strength` : ''} · ${esc(r.h.kind)}`
      : `<b>Week of ${esc(longDate(r.key))}</b>${r.est != null ? ' · so far' : ''}<br>${fmt0(r.done)} ${unitWord()} · ${r.w.sessions} session${r.w.sessions === 1 ? '' : 's'}${r.w.other > 0 && !isSport() ? ` · ${fmt0(r.w.other)} from other sports` : ''}<br>${MX.map((m, i) => (r.w.load[i] > 0.5 ? `${fmt0(r.w.load[i])} ${isSport() ? m.label.toLowerCase() : isMuscle() ? ['concentric', 'eccentric'][i] : ['easy', 'mod', 'hard'][i]}` : null)).filter(Boolean).join(' · ')}${r.est != null ? `<br>plan ≈ ${fmt0(r.est)}` : ''}`,
  });
  lc.append(legend(MX.map((m) => ({ color: m.color, label: m.label })).concat(AVG_LEGEND)));
  main.append(lc);
}

/** Kilometres per day over this week and next, split by heart-rate zone: what
 *  was run in solid zone colours, what is planned in faint ones. */
function dayChart(main, p, today, mode = 'km') {
  const weeks = p.weeks || [];
  if (!weeks.length) return;
  const asLoad = mode === 'load';
  const perKm = asLoad ? loadPerKm(today) : 1;
  const start = weeks[0].start;
  const days = [];
  for (let t = parse(start).getTime(), n = 0; n < 7 * weeks.length; t += DAY, n++) days.push(iso(new Date(t)));
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
      if (isMuscle() || isSport()) mixDef().forEach((m, i) => seg.push({ v: g.total * g.split[i], color: faint(m.color) }));
      else seg.push({ v: g.total, color: faint(ZONES[1].color) });
      total = g.total;
    } else if (pl && pl.km && d >= today) {
      const km = midKm(pl.km) * perKm;
      if (asLoad && isMuscle()) seg.push({ v: km, color: faint(MUSCLE_MIX[0].color) });
      else if (asLoad && isSport()) seg.push({ v: km, color: faint(SPORTS[0].color) });
      else {
        const zs = pl.zones || [100, 0, 0, 0, 0];
        const tot = zs.reduce((s, v) => s + v, 0) || 1;
        ZONES.forEach((zn, i) => seg.push({ v: km * zs[i] / tot, color: faint(zn.color) }));
      }
      total = km;
    }
    return { key: d, label: dayLabel(d), total, seg, acts, pl, missed: !acts.length && pl && pl.kind !== 'rest' && d < today };
  });
  const todayIdx = days.indexOf(today);
  const marks = [];
  if (todayIdx >= 0) marks.push({ i: todayIdx, label: 'today', color: 'var(--hairline-strong)', after: true });
  if (weeks.length > 1) marks.push({ i: 6, label: '', color: 'var(--hairline)', after: true });

  const c = asLoad
    ? (isSport()
      ? card('Day by day, as time in training',
        `The same days as minutes of training, each sport in its own colour, the whole session counted. Faint bars are the plan at about ${fmt1(perKm)} min per kilometre run, and a typical strength session on a gym day.`)
      : isMuscle()
      ? card('Day by day, as muscle load',
        `The same days as muscle work in kJ/kg — concentric, and eccentric weighted for strain — every sport counted. Faint bars convert the planned kilometres at about ${fmt1(perKm)} kJ/kg per kilometre.`)
      : isLoad()
      ? card('Day by day, as load',
        `The same days as zone load — minutes in each zone weighted 1 to 5 — with every sport counted, so a ride or a gym session shows where a run would have been. Faint bars convert the planned kilometres at about ${fmt0(perKm)} load per kilometre.`)
      : card('Day by day, as time in zone',
        `The same days as minutes in heart-rate zones 1 to 5, every sport counted, so a ride or a gym session shows where a run would have been; time under zone 1 is left out. Faint bars convert the planned kilometres at about ${fmt1(perKm)} min per kilometre.`))
    : card('Day by day, planned and run',
      'Kilometres of running per day over this week and next. Solid bars are sessions that were run, split into the kilometres covered in each heart-rate zone, every second of the run credited to the zone it was in, with any metres run before the heart rate reached zone 1 in grey; faint bars are planned sessions with their intended zone split. Tap a bar for the detail.');
  if (asLoad) c.append(unitChips());
  columnChart(c, {
    height: 190,
    rows,
    marks,
    minMax: asLoad ? (loadUnit === 'time' ? 30 : 40) : 5,
    xLabel: (r) => `${DOW[parse(r.key).getUTCDay()]} ${parse(r.key).getUTCDate()}`,
    aria: asLoad ? `${unitName()} per day, planned and done` : 'Kilometres per day by heart-rate zone, planned and run',
    yLabel: asLoad ? unitAxis('day') : 'km per day',
    tip: (r) => {
      const head = `<b>${esc(DOW[parse(r.key).getUTCDay()])} ${esc(longDate(r.key))}</b>`;
      if (r.acts.length && asLoad) {
        const lines = r.acts.map((a) => `${fmt0(measure(a))} ${unitWord()} · ${esc(sportWord(a))}${a.km > 0.2 ? ` · ${fmt1(a.sport === 'run' ? runKm(a) : a.km)} km` : ''}${a.hr ? ` · ${esc(a.hr)} bpm` : ''}`);
        return `${head}<br>${lines.join('<br>')}${r.pl ? `<br><i>planned: ${esc(r.pl.what)}</i>` : ''}`;
      }
      if (r.acts.length) {
        const lines = r.acts.map((a) => `${fmt1(runKm(a))} km · ${pace(runMin(a) / runKm(a))}/km · ${hasSplit(a) ? runHr(a) : a.hr || '—'} bpm`);
        const zk = [0, 0, 0, 0, 0, 0];
        for (const a of r.acts) { const k = kmByZone(a); for (let i = 0; i < 6; i++) zk[i] += k[i]; }
        const zt = zk.map((v, i) => (v >= 0.05 ? `${i < 5 ? `Z${i + 1}` : 'below Z1'} ${fmt1(v)} km` : null)).filter(Boolean).join(' · ');
        return `${head}<br>${lines.map(esc).join('<br>')}${zt ? `<br>${esc(zt)}` : ''}${r.pl ? `<br><i>planned: ${esc(r.pl.what)}</i>` : ''}`;
      }
      if (r.pl) return `${head}<br>${r.missed ? 'missed · ' : 'planned · '}${esc(r.pl.what)}${r.pl.km ? `<br>${esc(r.pl.km)} km${asLoad ? ` ≈ ${fmt0(midKm(r.pl.km) * perKm)} ${unitWord()}` : ''}${r.pl.pace ? ` · ${esc(r.pl.pace)}/km` : ''}${r.pl.hr ? ` · ${esc(r.pl.hr)} bpm` : ''}` : ''}`;
      return `${head}<br>nothing planned`;
    },
  });
  c.append(legend((asLoad ? (isSport() ? SPORTS : isMuscle() ? MUSCLE_MIX : ZONES) : [BELOW].concat(ZONES)).map((z) => ({ color: z.color, label: z.label }))));
  const ranKm = rows.filter((r) => r.acts.length).reduce((s, r) => s + r.total, 0);
  const planKm = rows.filter((r) => !r.acts.length && r.pl && r.key >= today).reduce((s, r) => s + r.total, 0);
  c.append(el('p', 'sub', asLoad
    ? `${fmt0(ranKm)} ${unitWord()} done so far across the two weeks, about ${fmt0(planKm)} still planned.`
    : `${fmt1(ranKm)} km run so far across the two weeks, ${fmt1(planKm)} km still planned. The list below has the same days with the reasoning behind each.`));
  main.append(c);
}

/** One week of the plan: what was run, what is planned, day by day. */
function weekCard(w, today) {
  const start = w.start;
  const end = iso(new Date(parse(start).getTime() + 6 * DAY));
  const c = el('div', 'card plan');
  c.append(el('h2', null, `${esc(w.label)} <small>${esc(shortDate(start))} – ${esc(shortDate(end))}</small>`));

  const done = DATA.activities.filter((a) => a.d >= start && a.d <= end && a.d <= today);
  const runs = done.filter((a) => a.sport === 'run');
  const facts = el('div', 'facts');
  if (start <= today) {
    const km = runs.reduce((s, a) => s + runKm(a), 0);
    const hard = runs.filter((a) => a.z[3] + a.z[4] >= 300).length;
    facts.append(el('div', null, `<span>So far</span>${fmt1(km)} km in ${runs.length} run${runs.length === 1 ? '' : 's'}${done.length > runs.length ? ` + ${done.length - runs.length} other` : ''}${hard ? ` · ${hard} hard` : ''}`));
  }
  if (w.targetKm) facts.append(el('div', null, `<span>Volume</span>${esc(w.targetKm)}`));
  if (w.intensity) facts.append(el('div', null, `<span>Intensity</span>${esc(w.intensity)}`));
  c.append(facts);

  // Merge by day: what was actually done takes the row; a planned session on a
  // day nothing was logged is shown as planned (future) or missed (past).
  const list = el('div', 'sessions');
  const byDay = new Map();
  for (const a of done) { if (!byDay.has(a.d)) byDay.set(a.d, []); byDay.get(a.d).push(a); }
  const plannedByDay = new Map((w.sessions || []).map((s) => [s.date, s]));
  for (let t = parse(start).getTime(); t <= parse(end).getTime(); t += DAY) {
    const d = iso(new Date(t));
    const acts = byDay.get(d) || [];
    const pl = plannedByDay.get(d);
    for (const a of acts) list.append(actualRow(a, pl && acts[0] === a ? pl : null));
    if (!acts.length && pl) list.append(plannedRow(pl, d < today && pl.kind !== 'rest'));
  }
  c.append(list);
  return c;
}

const dayLabel = (d) => `${DOW[parse(d).getUTCDay()]} ${parse(d).getUTCDate()}`;

function zoneBar(values, faintly) {
  const tot = values.reduce((s, v) => s + v, 0);
  const bar = el('div', 'zbar mini' + (faintly ? ' faint' : ''));
  if (!tot) { bar.classList.add('empty'); return bar; }
  ZONES.forEach((z, i) => {
    if (values[i] > 0) {
      const seg = el('span');
      seg.style.flex = `${values[i]} 0 0`;
      seg.style.background = z.color;
      bar.append(seg);
    }
  });
  return bar;
}

/** A session that was run: stats and zone time in the header, the note and laps beneath. */
function actualRow(a, planned) {
  const isRun = a.sport === 'run';
  const d = document.createElement('details');
  d.className = `srow done ${isRun ? '' : 'other'}`;
  const stats = [];
  if (a.km > 0.2) stats.push(`${fmt1(isRun ? runKm(a) : a.km)} km`);
  if (isRun && a.km > 0.2) stats.push(`${pace(runMin(a) / runKm(a))}/km`);
  else stats.push(hhmm(a.min));
  if (a.hr) stats.push(`${isRun && hasSplit(a) ? runHr(a) : a.hr} bpm`);
  if (a.dt && a.dt.te != null) stats.push(`TE ${fmt1(a.dt.te)}`);
  const hard = a.z[3] + a.z[4];
  if (hard >= 60) stats.push(`${hhmm(hard / 60)} hard`);
  d.innerHTML = `<summary>
    <div class="sday">${esc(dayLabel(a.d))}</div>
    <div class="sbody">
      <div class="swhat">${esc(sportWord(a))} <i class="skind">${a.note ? esc(a.note.verdict) : 'done'}</i></div>
      <div class="sstats">${esc(stats.join(' · '))}</div>
    </div></summary>`;
  d.querySelector('.sbody').append(zoneBar(a.z));
  const x = el('div', 'sx');
  if (planned) x.append(el('p', 'sub', `Planned: ${esc(planned.what)}.`));
  if (a.note) for (const para of a.note.body || []) x.append(el('p', null, esc(para)));
  else x.append(el('p', 'sub', 'No evaluation written for this session yet.'));
  if (a.laps && a.laps.length > 1 && isRun) {
    const laps = a.laps.filter((l) => l[0] >= 200).map((l) => `${l[0] >= 950 ? fmt1(l[0] / 1000) + ' km' : fmt0(l[0]) + ' m'} ${pace((l[1] / 60) / (l[0] / 1000))}${l[3] ? ` @${l[3]}` : ''}`);
    if (laps.length) x.append(el('p', 'sub laps', `Laps: ${esc(laps.join(' · '))}`));
  }
  if (a.stream) {
    const spark = el('div', 'spark');
    x.append(spark);
    loadStream(a.id).then((s) => {
      if (!s) return;
      streamChart(spark, s, { height: 56, mini: true, xMode: 'time', value: (i) => s.hr[i], color: (i, v) => zoneLineColor(v),
        tip: (i) => `<b>${mmss(s.t[i])}</b> · ${fmt1(s.d[i])} km${s.hr[i] ? `<br><span class="k">HR</span> ${s.hr[i]}` : ''}${s.p[i] ? `<br><span class="k">pace</span> ${pace(s.p[i])}/km` : ''}` });
      spark.append(help('Heart rate through the session, by zone.'));
    });
  }
  const b = el('button', 'tablebtn', 'Open in Sessions');
  b.onclick = (ev) => { ev.preventDefault(); state.tab = 'sessions'; state.activity = a.id; applyPreset('all'); remember(); syncRanges(); buildTabs(); render(); };
  x.append(b);
  d.append(x);
  return d;
}

/** A session still to come (or missed): the targets in the header, the reason beneath. */
function plannedRow(s, missed) {
  const d = document.createElement('details');
  d.className = `srow ${esc(s.kind || '')}${missed ? ' missed' : ''}`;
  const stats = [];
  if (s.km) stats.push(`${s.km} km`);
  if (s.pace) stats.push(`${s.pace}/km`);
  if (s.hr) stats.push(`${s.hr} bpm`);
  d.innerHTML = `<summary>
    <div class="sday">${esc(dayLabel(s.date))}</div>
    <div class="sbody">
      <div class="swhat">${esc(s.what)} <i class="skind">${esc(missed ? 'missed' : KIND_WORD[s.kind] || s.kind || 'planned')}</i></div>
      ${stats.length ? `<div class="sstats">${esc(stats.join(' · '))}</div>` : ''}
    </div></summary>`;
  if (s.zones) d.querySelector('.sbody').append(zoneBar(s.zones, true));
  const x = el('div', 'sx');
  if (s.why) x.append(el('p', null, esc(s.why)));
  if (s.alt && !missed) x.append(el('p', 'alt', esc(s.alt)));
  if (missed) x.append(el('p', 'sub', 'Nothing was logged on this day. Dropped, not moved.'));
  d.append(x);
  return d;
}

function toneWord(t) {
  return { good: 'on track', warning: 'watch', serious: 'act now', critical: 'stop', neutral: 'note' }[t] || t;
}

/* --- Running ------------------------------------------------------------ */

function paneRunning(main) {
  const acts = selected().filter((a) => a.sport === 'run');
  const rows = weekRows(acts);
  const kms = rows.map((r) => r.runKm);
  const avg4 = rolling(kms, 4);
  const anyWalk = rows.some((r) => r.walkKm > 0.05);

  const c1 = card('Weekly running volume',
    'Bars are kilometres actually run each week: the watch\'s run/walk detection strips walk breaks out of a session, so a run-walk counts only its running. The line is the trailing four-week average — the number that describes what the legs are used to.');
  columnChart(c1, {
    height: 200,
    rows: rows.map((r) => ({ ...r, total: r.runKm, seg: [{ v: r.runKm, color: 'var(--series-1)' }] })),
    lines: [{ values: avg4, color: 'var(--series-2)', label: '4-week average' }],
    tickFmt: (t) => fmt0(t),
    aria: 'Weekly running kilometres with a four-week average line',
    yLabel: 'km per week',
    tip: (r, i) => `<b>${esc(longDate(r.key))}</b><br>${fmt1(r.runKm)} km run · ${r.runs} session${r.runs === 1 ? '' : 's'}` +
      (r.walkKm > 0.05 ? `<br><span class="k">plus walking</span> ${fmt1(r.walkKm)} km` : '') +
      `<br><span class="k">4-week avg</span> ${fmt1(avg4[i])} km` +
      (r.longRun ? `<br><span class="k">longest</span> ${fmt1(r.longRun)} km` : ''),
  });
  c1.append(legend([
    { color: 'var(--series-1)', label: 'Week total, running only' },
    { color: 'var(--series-2)', label: '4-week average', line: true },
  ]));
  tableToggle(c1, 'runweeks', () => table(
    anyWalk ? ['Week of', 'Run km', 'Walked km', 'Sessions', 'Longest', '4wk avg'] : ['Week of', 'Run km', 'Sessions', 'Longest', '4wk avg'],
    rows.map((r, i) => anyWalk
      ? [longDate(r.key), fmt1(r.runKm), fmt1(r.walkKm), String(r.runs), fmt1(r.longRun), fmt1(avg4[i])]
      : [longDate(r.key), fmt1(r.runKm), String(r.runs), fmt1(r.longRun), fmt1(avg4[i])])
  ));
  main.append(c1);

  // volume progression, as a ratio rather than a percentage change: a week
  // measured against the base underneath it is bounded and comparable, where a
  // week-on-week percentage explodes every time you restart from nothing.
  const ratio = rows.map((r, i) => (avg4[i] >= 1 ? Math.min(3, r.runKm / avg4[i]) : null));
  const pctChange = rows.map((r, i) => (i > 0 && rows[i - 1].runKm >= 1 ? ((r.runKm / rows[i - 1].runKm) - 1) * 100 : null));
  const c2 = card('Ramp rate: the week against its own base',
    'Each week\'s running divided by the four-week average it sits on. Around 1.0 means holding steady; the shaded band, roughly 0.8 to 1.3, is where load can keep climbing without outrunning what the tissue has adapted to. Past about 1.5 a week is a spike, and spikes are what injuries follow. Values above 3 are drawn at 3.');
  columnChart(c2, {
    height: 190,
    rows: rows.map((r, i) => ({ ...r, total: ratio[i] || 0, seg: ratio[i] == null ? [] : [{ v: ratio[i], color: 'var(--series-1)' }] })),
    band: { lo: rows.map(() => 0.8), hi: rows.map(() => 1.3), color: 'var(--good)' },
    rules: [{ at: 1.5, color: 'var(--serious)', label: '1.5 — spike' }],
    minMax: 2,
    aria: 'Weekly running distance as a ratio of its four-week base',
    yLabel: 'week ÷ 4-week base',
    tip: (r, i) => `<b>${esc(longDate(r.key))}</b><br>${fmt1(r.runKm)} km on a ${fmt1(avg4[i])} km base` +
      `<br><span class="k">ratio</span> ${ratio[i] == null ? 'no base yet' : fmt1(ratio[i])}` +
      (pctChange[i] == null ? '' : `<br><span class="k">vs last week</span> ${pctChange[i] >= 0 ? '+' : ''}${fmt0(pctChange[i])}%`),
  });
  c2.append(legend([
    { color: 'var(--series-1)', label: 'Week ÷ 4-week base' },
    { color: 'var(--good)', label: '0.8–1.3 sustainable', faint: true },
    { color: 'var(--serious)', label: '1.5 spike line', line: true },
  ]));
  tableToggle(c2, 'ramp', () => table(
    ['Week of', 'Run km', '4wk base', 'Ratio', 'vs last week'],
    rows.map((r, i) => [longDate(r.key), fmt1(r.runKm), fmt1(avg4[i]),
      ratio[i] == null ? '—' : fmt1(ratio[i]),
      pctChange[i] == null ? '—' : `${pctChange[i] >= 0 ? '+' : ''}${fmt0(pctChange[i])}%`])
  ));
  main.append(c2);

  // shape of the week — two charts rather than one with two scales
  const c3 = card('The shape of the week',
    'Sessions above, the single longest run below. The same distance spread over five days and packed into one long run are not the same load, and these two together say which it was.');
  columnChart(c3, {
    height: 140,
    rows: rows.map((r) => ({ ...r, total: r.runs, seg: [{ v: r.runs, color: 'var(--series-3)' }] })),
    aria: 'Runs per week',
    yLabel: 'runs per week',
    tip: (r) => `<b>${esc(longDate(r.key))}</b><br>${r.runs} session${r.runs === 1 ? '' : 's'}` +
      `<br><span class="k">with 5 min in Z4+</span> ${r.quality}`,
  });
  c3.append(help('Running sessions in the week'));
  columnChart(c3, {
    height: 140,
    rows: rows.map((r) => ({ ...r, total: r.longRun, seg: [{ v: r.longRun, color: 'var(--series-2)' }] })),
    aria: 'Longest run each week',
    yLabel: 'longest run, km',
    tip: (r) => `<b>${esc(longDate(r.key))}</b><br>longest ${fmt1(r.longRun)} km` +
      (r.runKm > 0 ? `<br><span class="k">share of the week</span> ${fmt0((r.longRun / r.runKm) * 100)}%` : ''),
  });
  c3.append(help('Longest run in the week (km, running only)'));
  tableToggle(c3, 'shape', () => table(
    ['Week of', 'Sessions', 'Longest km', 'Share of week', 'Sessions ≥5 min in Z4+'],
    rows.map((r) => [longDate(r.key), String(r.runs), fmt1(r.longRun),
      r.runKm > 0 ? `${fmt0((r.longRun / r.runKm) * 100)}%` : '—', String(r.quality)])
  ));
  main.append(c3);
}

/* --- Load --------------------------------------------------------------- */

function paneLoad(main) {
  const acts = selected();
  const rows = weekRows(acts);
  const val = (r) => (isSport() ? r.min : isMuscle() ? r.muscle : isLoad() ? r.trimp : r.zmin);
  const bySport = (r) => (isSport() ? r.bySportDur : isMuscle() ? r.bySportMuscle : isLoad() ? r.bySport : r.bySportMin);
  const totals = rows.map(val);
  const avg4 = rolling(totals, 4);
  const shown = SPORTS.filter((s) => state.sport === 'all' || s.key === state.sport);

  const c1 = isSport()
    ? card('Weekly time in training, by sport',
      'One bar per week of minutes in training, stacked by sport, the whole session counted — warm-up, walk breaks and standstills included. The line is the trailing four-week average.')
    : isMuscle()
    ? card('Weekly muscle load, by sport',
      'One bar per week of mechanical work by the muscles, kJ per kg of body mass, stacked by sport: level locomotion from the biomechanics literature, metres climbed and descended, the eccentric part weighted for strain, cycling from power or calories, strength as full body from time. The line is the trailing four-week average.')
    : isLoad()
    ? card('Weekly load, by sport',
      'One bar per week, stacked by what produced the load. Load here is minutes in each heart-rate zone weighted 1 to 5, so an easy hour and a hard hour are not counted the same. The line is the trailing four-week average.')
    : card('Weekly time in zone, by sport',
      'One bar per week of minutes in heart-rate zones 1 to 5, stacked by sport; time under the zone 1 floor is left out as no training. The line is the trailing four-week average.');
  c1.append(unitChips());
  columnChart(c1, {
    height: 210,
    rows: rows.map((r) => ({
      ...r,
      total: val(r),
      seg: shown.map((s) => ({ v: bySport(r)[s.key] || 0, color: s.color, label: s.label })),
    })),
    lines: [{ values: avg4, color: 'var(--text-primary)' }],
    aria: `Weekly ${unitName()} stacked by sport`,
    yLabel: unitAxis('week'),
    tip: (r, i) => `<b>${esc(longDate(r.key))}</b><br>${fmt0(val(r))} ${unitWord()} · ${hhmm(r.min)} in total` +
      shown.filter((s) => (bySport(r)[s.key] || 0) > 0).map((s) => `<br><span class="k">${esc(s.label)}</span> ${fmt0(bySport(r)[s.key])}`).join('') +
      `<br><span class="k">4-week avg</span> ${fmt0(avg4[i])}`,
  });
  c1.append(legend([
    ...shown.map((s) => ({ color: s.color, label: s.label })),
    { color: 'var(--text-primary)', label: '4-week average', line: true },
  ]));
  tableToggle(c1, 'loadweeks', () => table(
    ['Week of', isSport() ? 'Minutes' : isMuscle() ? 'Muscle' : isLoad() ? 'Load' : 'Zone min', 'Hours', 'Sessions', '4wk avg'],
    rows.map((r, i) => [longDate(r.key), fmt0(val(r)), fmt1(r.min / 60), String(r.sessions), fmt0(avg4[i])])
  ));
  main.append(c1);

  // Garmin acute vs optimal
  const [start, end] = windowRange();
  const gl = (DATA.garminLoad || []).filter((d) => d.d >= start && d.d <= end);
  const c2 = card('Garmin load: current against optimal',
    'Garmin\'s own acute load — a rolling seven-day sum of its per-activity training load — against the range it considers optimal for the current chronic load. Below the band means the body is being asked for less than it can take; above it means the week is running ahead of the base underneath it.');
  if (gl.length < 2) {
    c2.append(el('div', 'empty', 'Garmin publishes this series only from the day it started recording it for your account. Widen the window to see it.'));
  } else {
    // every day of the window on the axis, so this chart lines up with the others
    const byDay = new Map(gl.map((d) => [d.d, d]));
    const days = dayGrid(start, end);
    const at = (d, k) => (d ? d[k] : null);
    columnChart(c2, {
      height: 200,
      rows: days.map((k) => ({ key: k, label: shortDate(k), total: 0, seg: [] })),
      lines: [
        { values: days.map((k) => at(byDay.get(k), 'atl')), color: 'var(--series-2)' },
        { values: days.map((k) => at(byDay.get(k), 'ctl')), color: 'var(--series-1)' },
      ],
      band: {
        lo: days.map((k) => (byDay.get(k) ? byDay.get(k).ctl * 0.8 : null)),
        hi: days.map((k) => (byDay.get(k) ? byDay.get(k).ctl * 1.5 : null)),
        color: 'var(--series-1)',
      },
      aria: 'Garmin acute load against its optimal range',
      yLabel: 'Garmin load',
      tip: (r, i) => {
        const d = byDay.get(days[i]);
        if (!d) return `<b>${esc(longDate(days[i]))}</b><br>no Garmin load that day`;
        return `<b>${esc(longDate(d.d))}</b><br><span class="k">acute</span> ${fmt0(d.atl)}` +
          `<br><span class="k">chronic</span> ${fmt0(d.ctl)}` +
          `<br><span class="k">optimal</span> ${fmt0(d.ctl * 0.8)}–${fmt0(d.ctl * 1.5)}` +
          `<br><span class="k">status</span> ${esc((d.status || '').replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase())}`;
      },
    });
    c2.append(legend([
      { color: 'var(--series-2)', label: 'Acute load (7 days)', line: true },
      { color: 'var(--series-1)', label: 'Chronic load', line: true },
      { color: 'var(--series-1)', label: 'Optimal band' },
    ]));
    tableToggle(c2, 'garminload', () => table(
      ['Date', 'Acute', 'Chronic', 'Optimal', 'Status'],
      gl.slice().reverse().map((d) => [longDate(d.d), fmt0(d.atl), fmt0(d.ctl), `${fmt0(d.ctl * 0.8)}–${fmt0(d.ctl * 1.5)}`, (d.status || '').replace(/_/g, ' ')])
    ));
  }
  main.append(c2);

  // status through time: one strip, a colour per day
  if (gl.length >= 2) {
    const c3 = card('Garmin training status through time',
      'Each day coloured by the status Garmin gave it, over the same window as the chart above. Garmin flips status often, so the useful reading is the colour that dominates a month, not the one it shows this morning.');
    statusStrip(c3, gl, start, end);
    main.append(c3);
  }
}

/* Garmin's status families, in the order of its own scale from too little to too much. */
const STATUS_COLOR = {
  DETRAINING: { label: 'Detraining', color: 'var(--series-2)' },
  RECOVERY: { label: 'Recovery', color: 'var(--series-7)' },
  MAINTAINING: { label: 'Maintaining', color: 'var(--series-1)' },
  PRODUCTIVE: { label: 'Productive', color: 'var(--zone-3)' },
  PEAKING: { label: 'Peaking', color: 'var(--series-6)' },
  UNPRODUCTIVE: { label: 'Unproductive', color: 'var(--zone-4)' },
  STRAINED: { label: 'Strained', color: 'var(--zone-5)' },
  OVERREACHING: { label: 'Overreaching', color: 'var(--critical)' },
  PAUSED: { label: 'Paused', color: 'var(--zone-1)' },
  NO_STATUS: { label: 'No status', color: 'var(--zone-0)' },
};
const statusFamily = (d) => (d.status || 'NO_STATUS').replace(/_\d+$/, '');
const statusInfo = (fam) => STATUS_COLOR[fam] || { label: fam.charAt(0) + fam.slice(1).toLowerCase().replace(/_/g, ' '), color: 'var(--zone-1)' };

/** One horizontal strip across the window, each day a block of its status colour. */
function statusStrip(host, gl, start, end) {
  const wrap = el('div', 'chartwrap');
  const tip = el('div', 'tip');
  wrap.append(tip);
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
    const clipId = `strip${Math.random().toString(36).slice(2, 8)}`;
    const defs = svgEl('defs', {});
    const clip = svgEl('clipPath', { id: clipId });
    clip.append(svgEl('rect', { x: padL, y: top, width: iw, height: barH, rx: 6, ry: 6 }));
    defs.append(clip);
    svg.append(defs);
    const g = svgEl('g', { 'clip-path': `url(#${clipId})` });
    g.append(svgEl('rect', { x: padL, y: top, width: iw, height: barH, fill: 'var(--surface-2)' }));
    // one rect per run of equal status, so the strip stays crisp at any width
    let i = 0;
    while (i < n) {
      const d = byDay.get(dayAt(i));
      if (!d) { i++; continue; }
      const fam = statusFamily(d);
      let j = i + 1;
      while (j < n && byDay.get(dayAt(j)) && statusFamily(byDay.get(dayAt(j))) === fam) j++;
      g.append(svgEl('rect', { x: x(i).toFixed(2), y: top, width: (x(j) - x(i)).toFixed(2), height: barH, fill: statusInfo(fam).color }));
      i = j;
    }
    svg.append(g);
    // month labels, thinned so they never collide
    let lastPx = -Infinity;
    for (let k = 0; k < n; k++) {
      const d = parse(dayAt(k));
      if (d.getUTCDate() !== 1) continue;
      const px = x(k);
      if (px - lastPx < 44 || px > W - padR - 20) continue;
      svg.append(svgEl('line', { x1: px, x2: px, y1: top + barH, y2: top + barH + 4, stroke: 'var(--hairline-strong)', 'stroke-width': 1 }));
      svg.append(Object.assign(svgEl('text', { x: px, y: H - 6, 'text-anchor': k === 0 ? 'start' : 'middle', fill: 'var(--text-muted)', 'font-size': 9.5 }), { textContent: shortDate(dayAt(k)).replace(/^\d+ /, '') }));
      lastPx = px;
    }
    const cursor = svgEl('rect', { x: 0, y: top - 3, width: 2, height: barH + 6, fill: 'var(--text-primary)', opacity: 0, rx: 1 });
    svg.append(cursor);
    const hit = svgEl('rect', { x: padL, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    wrap.append(svg);

    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const scale = W / box.width;
      const k = Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - box.left) * scale - padL) / (iw / n))));
      const d = byDay.get(dayAt(k));
      cursor.setAttribute('x', (x(k) + (iw / n) / 2 - 1).toFixed(1));
      cursor.setAttribute('opacity', 0.8);
      tip.innerHTML = `<b>${esc(longDate(dayAt(k)))}</b><br>${d ? esc(statusInfo(statusFamily(d)).label) : 'no data'}` +
        (d ? `<br><span class="k">acute</span> ${fmt0(d.atl)} <span class="k">chronic</span> ${fmt0(d.ctl)}` : '');
      tip.classList.add('on');
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(2, Math.min(box.width - tw - 2, x(k) / scale - tw / 2)) + 'px';
      tip.style.top = (top + barH + 4) + 'px';
    };
    const leave = () => { tip.classList.remove('on'); cursor.setAttribute('opacity', 0); };
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
    .map(([fam, v]) => ({ color: statusInfo(fam).color, label: `${statusInfo(fam).label} · ${v} d` }))));
  return wrap;
}

/* --- Heart rate --------------------------------------------------------- */

function paneHeart(main) {
  const acts = selected();
  const rows = weekRows(acts);

  const toggle = el('div', 'chips');
  for (const [key, label] of [['pct', 'Share of time'], ['min', 'Minutes']]) {
    const b = el('button', state.zoneUnit === key ? 'on' : null, esc(label));
    b.onclick = () => { state.zoneUnit = key; remember(); render(); };
    toggle.append(b);
  }

  const c1 = card('Time in heart-rate zone, per week',
    `Zones come from the saved profile: Z1 from ${DATA.athlete.zoneFloors[0]} bpm up to Z5 from ${DATA.athlete.zoneFloors[4]} bpm, against a maximum of ${DATA.athlete.maxHr}, in Garmin's own zone colours. Garmin applies a different zone table to some indoor sports, so a cycling session's "zone 3" is not the same effort as a run's.`);
  c1.append(toggle);
  const zRows = rows.map((r) => {
    const tot = r.z.reduce((a, b) => a + b, 0);
    return {
      ...r,
      _tot: tot,
      total: state.zoneUnit === 'pct' ? (tot ? 100 : 0) : tot / 60,
      seg: ZONES.map((z, i) => ({
        v: tot === 0 ? 0 : (state.zoneUnit === 'pct' ? (r.z[i] / tot) * 100 : r.z[i] / 60),
        color: z.color, label: z.label,
      })),
    };
  });
  columnChart(c1, {
    height: 210,
    rows: zRows,
    minMax: state.zoneUnit === 'pct' ? 100 : 0,
    tickFmt: (t) => (state.zoneUnit === 'pct' ? `${fmt0(t)}%` : fmt0(t)),
    aria: 'Weekly time in heart-rate zone',
    yLabel: state.zoneUnit === 'pct' ? '% of recorded time' : 'min per week',
    tip: (r) => `<b>${esc(longDate(r.key))}</b><br>${hhmm(r._tot / 60)} recorded` +
      ZONES.map((z, i) => `<br><span class="k">${esc(z.label)}</span> ${hhmm(r.z[i] / 60)}` +
        (r._tot ? ` (${fmt0((r.z[i] / r._tot) * 100)}%)` : '')).join(''),
  });
  c1.append(legend(ZONES.map((z) => ({ color: z.color, label: z.label }))));
  tableToggle(c1, 'zones', () => table(
    ['Week of', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Total'],
    rows.map((r) => [longDate(r.key), ...r.z.map((s) => hhmm(s / 60)), hhmm(r.z.reduce((a, b) => a + b, 0) / 60)])
  ));
  main.append(c1);

  // distribution tiles
  const zt = [0, 0, 0, 0, 0];
  for (const r of rows) for (let i = 0; i < 5; i++) zt[i] += r.z[i];
  const tot = zt.reduce((a, b) => a + b, 0);
  const tiles = el('div', 'tiles');
  tiles.append(tile('Easy (Z1–2)', tot ? `${fmt0(((zt[0] + zt[1]) / tot) * 100)}%` : '—', hhmm((zt[0] + zt[1]) / 60)));
  tiles.append(tile('Moderate (Z3)', tot ? `${fmt0((zt[2] / tot) * 100)}%` : '—', hhmm(zt[2] / 60)));
  tiles.append(tile('Hard (Z4–5)', tot ? `${fmt0(((zt[3] + zt[4]) / tot) * 100)}%` : '—', hhmm((zt[3] + zt[4]) / 60)));
  const lastHard = [...DATA.activities].reverse().find((a) => a.z[3] + a.z[4] >= 300);
  tiles.append(tile('Last hard session', lastHard ? shortDate(lastHard.d) : 'none',
    lastHard ? `${ago(lastHard.d, todayIso())} days ago` : 'no session with 5 min in Z4+'));
  main.append(tiles);

  // HR vs pace — outdoor runs, running portion only
  const c2 = card('Heart rate against pace',
    'One dot per outdoor run with at least fifteen minutes of running. Pace and heart rate cover the running only — walk breaks are stripped out — and the treadmill is left out because its pace is whatever the belt claims. Dots drifting right and down mean the same pace is costing more beats; left and up is the shape of getting fitter. The equipment filter above narrows the dots.');
  const by = el('div', 'chips');
  for (const [key, label] of [['stroller', 'Colour by stroller'], ['shoe', 'Colour by shoe']]) {
    const b = el('button', state.scatterBy === key ? 'on' : null, esc(label));
    b.onclick = () => { state.scatterBy = key; remember(); render(); };
    by.append(b);
  }
  c2.append(by);

  const runs = selected({ sportFilter: false }).filter((a) =>
    a.sport === 'run' && !a.indoor && runHr(a) && runKm(a) > 1.5 && runMin(a) >= 15);
  const cats = scatterCategories(runs);
  const points = runs.map((a) => {
    const p = runMin(a) / runKm(a);
    const cat = cats.of(a);
    return {
      x: runHr(a), y: p, color: cat.color,
      tip: `<b>${esc(longDate(a.d))}</b><br>${fmt1(runKm(a))} km run · ${pace(p)}/km · ${runHr(a)} bpm` +
        (walkKm(a) > 0.05 ? `<br><span class="k">plus walking</span> ${fmt1(walkKm(a))} km` : '') +
        `<br><span class="k">${esc(cat.label)}</span>` +
        (a.g && a.g.length ? `<br><span class="k">gear</span> ${esc(a.g.map(gearName).join(', '))}` : ''),
    };
  });
  scatterChart(c2, {
    points, height: 230,
    xLabel: 'Average heart rate while running (bpm)',
    yLabel: 'pace, min/km',
    yFmt: (v) => pace(v),
    xFmt: (v) => fmt0(v),
    aria: 'Scatter of running heart rate against running pace for outdoor runs',
  });
  c2.append(legend(cats.list.map((c) => ({ color: c.color, label: c.label }))));
  tableToggle(c2, 'hrpace', () => table(
    ['Date', 'Run km', 'Pace', 'Run HR', cats.title],
    runs.slice().reverse().map((a) => [longDate(a.d), fmt1(runKm(a)), pace(runMin(a) / runKm(a)) + '/km', String(runHr(a)), cats.of(a).label])
  ));
  main.append(c2);

  // aerobic efficiency
  const easy = DATA.activities.filter((a) => {
    const t = a.z.reduce((x, y) => x + y, 0);
    return a.sport === 'run' && !a.indoor && runHr(a) && runKm(a) > 2 && runMin(a) >= 15 && t > 0 &&
      (a.z[0] + a.z[1]) / t >= 0.75 && gearMatchIfShown(a);
  });
  const byMonth = new Map();
  for (const a of easy) {
    const m = a.d.slice(0, 7) + '-01';
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(a);
  }
  const [wStart, wEnd] = windowRange();
  const effRows = [...byMonth.entries()].filter(([m]) => m >= wStart.slice(0, 7) + '-01' && m <= wEnd).sort()
    .map(([m, list]) => {
      const idx = list.reduce((s, a) => s + runHr(a) * (runMin(a) / runKm(a)), 0) / list.length;
      return { key: m, label: shortDate(m), total: idx, n: list.length, seg: [{ v: idx, color: 'var(--series-1)' }] };
    });
  const c3 = card('Aerobic efficiency on easy runs',
    'Running heart rate multiplied by running pace, for outdoor runs spent mostly in zones 1 and 2. Lower is better: it means fewer beats per kilometre. It is a crude index and it moves with terrain, heat and how disciplined the easy days are — read the direction over months, never a single point.');
  if (effRows.length < 2) {
    c3.append(el('div', 'empty', 'Not enough easy outdoor runs in this window.'));
  } else {
    const vals = effRows.map((r) => r.total);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const padv = Math.max(20, (hi - lo) * 0.2);
    columnChart(c3, {
      height: 180,
      rows: effRows.map((r) => ({ ...r, total: 0, seg: [] })),
      lines: [
        { values: vals, color: 'var(--series-1)' },
        { values: rolling(vals, 3), color: 'var(--series-2)' },
      ],
      yMin: Math.floor((lo - padv) / 10) * 10,
      yMax: Math.ceil((hi + padv) / 10) * 10,
      aria: 'Monthly aerobic efficiency index',
      yLabel: 'heartbeats per km, lower is better',
      tip: (r) => `<b>${esc(longDate(r.key)).replace(/^\d+ /, '')}</b><br>index ${fmt0(r.total)}<br><span class="k">from</span> ${r.n} easy run${r.n === 1 ? '' : 's'}`,
    });
    c3.append(legend([
      { color: 'var(--series-1)', label: 'Month index (lower is better)', line: true },
      { color: 'var(--series-2)', label: '3-month average', line: true },
    ]));
    tableToggle(c3, 'eff', () => table(['Month', 'Index', 'Runs'],
      effRows.slice().reverse().map((r) => [longDate(r.key).replace(/^\d+ /, ''), fmt0(r.total), String(r.n)])));
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
// Every shoe keeps the same colour whatever the filter shows, so a dot's
// colour means the same thing on every visit: slot = position in the
// catalogue, which the snapshot keeps stable.
function shoeColor(code) {
  const i = DATA.gear.filter(isShoe).findIndex((g) => g.code === code);
  return i < 0 ? 'var(--text-muted)' : `var(--series-${(i % SHOE_SLOTS) + 1})`;
}

function scatterCategories(runs) {
  if (state.scatterBy === 'shoe') {
    const present = new Set();
    for (const a of runs) for (const g of a.g || []) if (g !== 'STROLLER') present.add(g);
    const list = DATA.gear.filter(isShoe).filter((g) => present.has(g.code))
      .map((g) => ({ key: g.code, label: g.name, color: shoeColor(g.code) }));
    const none = { key: 'none', label: 'Other or none', color: 'var(--text-muted)' };
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

/* --- Fitness readouts (VO2 max trend, race predictions) ------------------ */

// Lives on the Now pane, which has no time filter: the VO2 series is short
// (Garmin publishes it from the day it started recording it for the account) and the whole of it is the
// context a reader wants next to today's number.
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
    rows: buckets.map((b) => ({ key: b.key, label: b.label, total: 0, seg: [] })),
    lines: [{ values: vals, color: 'var(--series-1)' }],
    yMin: Math.floor(lo - 1),
    yMax: Math.ceil(hi + 1),
    tickFmt: (t) => fmt1(t),
    aria: 'VO2 max estimate over time',
    yLabel: 'VO₂ max, ml/kg/min',
    tip: (r, i) => `<b>${weekly ? `Week of ${esc(longDate(buckets[i].key))}` : esc(longDate(buckets[i].key))}</b><br>${vals[i] == null ? 'no estimate yet' : `VO₂ max ${fmt1(vals[i])}${measured[i] == null ? ' <span class="k">carried forward</span>' : ''}`}`,
  });
  c3.append(el('p', 'sub', `${src.length} recomputes, ${longDate(src[0].d)} to ${longDate(src[src.length - 1].d)}: ${fmt1(lo)} to ${fmt1(hi)}. The axis starts below the lowest reading rather than at zero, which is legitimate for a line and would not be for bars.`));
  tableToggle(c3, 'vo2', () => table(['Date', 'VO₂ max'], src.slice().reverse().map((d) => [longDate(d.d), fmt1(d.v)])));
  main.append(c3);
}

function toSec(t) {
  if (!t) return null;
  const p = String(t).split(':').map(Number);
  return p.reduce((acc, v) => acc * 60 + v, 0);
}
/** "1:54:00" → "1:54" so a range of two half-marathon times fits a phone-width column. */
const short = (t) => String(t).replace(/^(\d+:\d{2}):00$/, '$1');
function fromSec(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Race predictions: Garmin's figure beside the agent's, per distance. The table is
 *  the point of the card; the reasoning folds away under it. */
function raceCard(main, gn) {
  const rc = DATA.racecast;
  const garmin = gn.racePredictions || {};
  if (!rc && !Object.keys(garmin).length) return;
  const c = card(rc ? 'Race predictions: Garmin vs the agent' : 'Garmin race predictions');
  const rows = rc ? rc.predictions : [['5K', '5 km'], ['10K', '10 km'], ['half', 'Half marathon'], ['marathon', 'Marathon']].map(([key, label]) => ({ key, label }));
  const t = document.createElement('table');
  t.className = 'racetable';
  t.innerHTML = `<thead><tr><th></th><th>Garmin</th>${rc ? '<th>Agent</th><th>Δ</th>' : ''}</tr></thead>`;
  const tb = document.createElement('tbody');
  for (const p of rows) {
    const g = garmin[p.key];
    const tr = document.createElement('tr');
    let cells = `<td>${esc(p.label)}</td><td>${esc(g || '—')}</td>`;
    if (rc) {
      const d = g && p.mine ? toSec(p.mine) - toSec(g) : null;
      const conf = p.confidence === 'moderate' ? 'good' : p.confidence === 'low' ? 'warning' : 'neutral';
      cells += `<td class="agent"><b>${esc(p.mine || 'no basis')}</b>` +
        (p.low && p.high ? `<small>${esc(short(p.low))}–${esc(short(p.high))}</small>` : `<small class="${conf}">${esc(p.confidence === 'none' ? 'nothing to go on' : '')}</small>`) +
        `</td><td class="${d == null ? '' : d > 0 ? 'slower' : 'faster'}">${d == null ? '—' : `${d > 0 ? '+' : '−'}${fromSec(Math.abs(d))}`}</td>`;
    }
    tr.innerHTML = cells;
    tb.append(tr);
  }
  t.append(tb);
  c.append(t);
  if (!rc) {
    c.append(help('Derived from the VO₂ max estimate rather than from any race you actually ran, so treat them as a fitness index with time units, not a plan.'));
    main.append(c); return;
  }

  const b = rc.basis || {};
  c.append(el('p', 'sub racesum',
    `Garmin's times come from its VO₂ max estimate and assume the training to use it. The agent's are anchored on your actual races and capped by the current base. ` +
    `The agent's estimate is from ${esc(longDate(rc.updated))}${rc.kind === 'nudge' ? ' (nudged, not re-analysed)' : ''}, on VO₂ max ${fmt1(b.vo2)}, ` +
    `${fmt1(b.runKm28)} km run in the previous 28 days and a longest run of ${fmt1(b.longestRunKm90)} km in three months; it moves only when the evidence does.`));

  const more = document.createElement('details');
  more.className = 'more';
  more.innerHTML = '<summary>Why the numbers differ</summary>';
  if (rc.summary) more.append(el('p', 'sub', esc(rc.summary)));
  for (const p of rc.predictions) {
    if (!p.why) continue;
    const sec = el('div', 'section');
    sec.append(el('h3', null, `${esc(p.label)}: ${esc(p.mine || 'no prediction')} <span class="pill ${p.confidence === 'moderate' ? 'good' : p.confidence === 'low' ? 'warning' : 'neutral'}">${esc(p.confidence === 'none' ? 'no basis' : p.confidence + ' confidence')}</span>`));
    sec.append(el('p', null, esc(p.why)));
    more.append(sec);
  }
  if (rc.outlook) {
    const o = rc.outlook;
    const sec = el('div', 'section');
    sec.append(el('h3', null, `In ${esc(o.horizon || 'a few weeks')}`));
    sec.append(el('p', null, esc(`${o.condition ? o.condition.charAt(0).toUpperCase() + o.condition.slice(1) + ': ' : ''}`) +
      ['5K', '10K', 'half', 'marathon'].filter((k) => o[k]).map((k) => `${esc({ '5K': '5 km', '10K': '10 km', half: 'half', marathon: 'marathon' }[k])} ${esc(o[k])}`).join(' · ')));
    more.append(sec);
  }
  if (rc.anchors && rc.anchors.length) {
    const sec = el('div', 'section');
    sec.append(el('h3', null, 'What the agent anchors on'));
    for (const a of rc.anchors) sec.append(el('p', null, `<b>${esc(longDate(a.date))} — ${esc(a.event)}, ${esc(a.time)} (${esc(a.pace)}/km).</b> ${esc(a.note)}`));
    more.append(sec);
  }
  if (rc.method && rc.method.length) {
    const sec = el('div', 'section');
    sec.append(el('h3', null, 'How the agent makes the number'));
    const ul = document.createElement('ul');
    for (const m of rc.method) ul.append(el('li', null, esc(m)));
    sec.append(ul);
    more.append(sec);
  }
  c.append(more);
  main.append(c);
}

/* --- Sessions ----------------------------------------------------------- */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dowDate(s) {
  const d = parse(s);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
const SPORT_WORD = { run: 'Run', bike: 'Ride', strength: 'Strength', elliptical: 'Elliptical', walk: 'Hike / walk', row: 'Row', swim: 'Swim', other: 'Other' };
const TE_WORD = {
  RECOVERY: 'Recovery', AEROBIC_BASE: 'Aerobic base', TEMPO: 'Tempo', LACTATE_THRESHOLD: 'Lactate threshold',
  VO2MAX: 'VO₂ max', ANAEROBIC_CAPACITY: 'Anaerobic capacity', SPEED: 'Speed', UNKNOWN: 'Too short to rate',
};
const LAP_KIND = {
  W: { label: 'Warm-up', color: 'var(--series-4)' },
  A: { label: 'Work', color: 'var(--series-1)' },
  R: { label: 'Recovery', color: 'var(--hairline-strong)' },
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
function zoneColor(bpm) {
  const z = zoneOf(bpm);
  return z ? `var(--zone-${z})` : 'var(--zone-0)';
}
/** For a heart-rate LINE: below zone 1 is most of a day and must stay visible,
 *  and zone 1's light grey needs darkening to read as a stroke. Bars keep zoneColor. */
function zoneLineColor(bpm) {
  const z = zoneOf(bpm);
  if (!z) return 'var(--zone-0)'; // pale: no training zone
  if (z === 1) return 'color-mix(in srgb, var(--zone-1) 55%, var(--text-primary))';
  return `var(--zone-${z})`;
}
const LINE_LEGEND = [{ color: 'var(--zone-0)', label: 'Below Z1' },
  ...ZONES.map((z, i) => ({ color: i === 0 ? 'color-mix(in srgb, var(--zone-1) 55%, var(--text-primary))' : z.color, label: z.label }))];

function paneSessions(main) {
  const list = selected().slice().reverse(); // newest first
  const c = card('Pick a session',
    `Every session in the window, newest first. Full detail — laps, running dynamics, training effect — is kept for sessions since ${longDate(DATA.detailSince || DATA.activities[0].d)}; older ones show the summary the weekly panes are built from. The filters above narrow the list.`);
  if (!list.length) {
    c.append(el('div', 'empty', 'No sessions match this window and filter.'));
    main.append(c);
    return;
  }
  if (!list.some((a) => a.id === state.activity)) state.activity = list[0].id;

  const box = el('div', 'sesslist');
  const rows = new Map();
  for (const a of list) {
    const b = el('button', 'sess' + (a.id === state.activity ? ' on' : ''));
    b.type = 'button';
    const sport = SPORTS.find((s) => s.key === sportKey(a));
    const dist = a.km > 0.2 ? `${fmt1(runKm(a))} km` : hhmm(a.min);
    b.innerHTML =
      `<span class="s-date">${esc(dowDate(a.d))}<small>${esc(String(parse(a.d).getUTCFullYear()))}</small></span>` +
      `<span class="s-main"><b><i class="dot" style="background:${sport ? sport.color : 'var(--series-5)'}"></i>${esc(a.name || sportWord(a))}</b>` +
      `<small>${esc(sportWord(a))} · ${esc(hhmm(a.min))}${a.hr ? ` · ${esc(a.hr)} bpm` : ''}${a.race ? ' · race' : ''}</small></span>` +
      `<span class="s-side">${esc(dist)}<small>${a.dt ? esc(TE_WORD[a.dt.teLabel] || '') : 'summary'}</small></span>`;
    b.onclick = () => {
      state.activity = a.id;
      remember();
      for (const [id, node] of rows) node.classList.toggle('on', id === a.id);
      detail.innerHTML = '';
      renderSession(detail, a);
      const topbar = document.querySelector('.topbar').getBoundingClientRect().height;
      window.scrollTo({ top: detail.getBoundingClientRect().top + window.scrollY - topbar - 8, behavior: 'smooth' });
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
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function renderSession(host, a) {
  const dt = a.dt || {};
  const hasDist = a.km > 0.2;
  const isRun = a.sport === 'run' || a.sport === 'walk';

  const h = el('div', 'card');
  h.append(el('h2', null, esc(a.name || sportWord(a))));
  const gear = (a.g || []).map(gearName);
  h.append(el('p', 'sub',
    `${esc(dowDate(a.d))} ${parse(a.d).getUTCFullYear()}${a.t ? `, ${esc(a.t)}` : ''} · ${esc(sportWord(a))}` +
    (a.race ? ' · race' : '') + (gear.length ? ` · ${esc(gear.join(', '))}` : '')));

  const t = el('div', 'tiles');
  if (hasDist) {
    if (hasSplit(a)) t.append(tile('Running', fmt1(runKm(a)), walkKm(a) >= 0.05 ? `plus ${fmt1(walkKm(a))} km walked` : 'no walk breaks', 'km'));
    else t.append(tile('Distance', fmt1(a.km), a.indoor ? 'as the machine reports it' : '', 'km'));
  }
  t.append(tile('Time', hhmm(a.min), dt.mov && hhmm(dt.mov / 60) !== hhmm(a.min) ? `moving ${hhmm(dt.mov / 60)}` : ''));
  if (hasDist && isRun) {
    t.append(tile('Pace', pace(runMin(a) / runKm(a)), hasSplit(a) ? 'running portion' : 'whole session', '/km'));
  } else if (hasDist && a.sport === 'bike') {
    t.append(tile('Speed', fmt1(a.km / (a.min / 60)), dt.maxSpd ? `max ${fmt1(dt.maxSpd * 3.6)} km/h` : '', 'km/h'));
  }
  if (a.hr) t.append(tile('Heart rate', String(hasSplit(a) ? runHr(a) : a.hr), `max ${a.hrMax || '—'}${dt.minHr ? ` · min ${dt.minHr}` : ''}`, 'bpm'));
  if (dt.te != null) t.append(tile('Training effect', fmt1(dt.te), `${TE_WORD[dt.teLabel] || ''}${dt.anTe ? ` · anaerobic ${fmt1(dt.anTe)}` : ''}`));
  if (dt.load != null) t.append(tile('Garmin load', fmt0(dt.load), `own zone load ${fmt0(trimp(a.z))}`));
  else t.append(tile('Zone load', fmt0(trimp(a.z)), 'minutes in zone, weighted 1–5'));
  if (!a.indoor && (a.elev || dt.elevLoss)) t.append(tile('Climb', fmt0(a.elev), dt.elevLoss != null ? `−${fmt0(dt.elevLoss)} m descent` : '', 'm'));
  if (dt.cad && isRun) t.append(tile('Cadence', fmt0(dt.cad), dt.stride ? `stride ${fmt0(dt.stride)} cm` : '', 'spm'));
  if (dt.pwr) t.append(tile('Power', fmt0(dt.pwr), dt.np ? `normalised ${fmt0(dt.np)} W` : '', 'W'));
  if (dt.gct) t.append(tile('Ground contact', fmt0(dt.gct), dt.vo ? `oscillation ${fmt1(dt.vo)} cm` : '', 'ms'));
  if (dt.modMin != null || dt.vigMin != null) t.append(tile('Intensity minutes', fmt0((dt.modMin || 0) + 2 * (dt.vigMin || 0)), `${fmt0(dt.modMin || 0)} moderate · ${fmt0(dt.vigMin || 0)} vigorous`));
  {
    const m = muscleLoad(a);
    if (m.total > 0) t.append(tile('Muscle work', fmt1(m.total), `${fmt1(m.con)} concentric · ${fmt1(m.ecc)} eccentric, strain-weighted${m.kg ? ` · pack ${fmt0(m.kg)} kg` : ''}`, 'kJ/kg'));
  }
  if (a.cal) t.append(tile('Calories', fmt0(a.cal), ''));
  if (a.wx && a.wx.t != null) t.append(tile('Weather', fmt0(a.wx.t), `${a.wx.desc ? esc(a.wx.desc.toLowerCase()) + ' · ' : ''}${a.wx.h != null ? `${fmt0(a.wx.h)} % humidity · ` : ''}wind ${fmt0(a.wx.w || 0)} km/h${a.wx.wc ? ` from ${esc(a.wx.wc.toUpperCase())}` : ''}`, '°C'));
  if (dt.bb != null) t.append(tile('Body battery', (dt.bb > 0 ? '+' : '') + fmt0(dt.bb), (dt.feel != null ? `felt ${FEEL_WORD[dt.feel] || dt.feel}` : '') + (dt.rpe ? ` · effort ${fmt0(dt.rpe / 10)}/10` : '')));
  h.append(t);
  host.append(h);
  if (a.stream && !a.indoor) host.append(mapCard(a));

  if (a.note) {
    const n = el('div', 'card');
    const sec = el('div', 'section');
    sec.append(el('h3', null, `${esc(a.note.verdict || 'Evaluation')} <span class="pill ${esc(a.note.tone || 'neutral')}">${esc(toneWord(a.note.tone || 'neutral'))}</span>`));
    for (const para of a.note.body || []) sec.append(el('p', null, esc(para)));
    if (a.note.written) sec.append(el('p', 'sub', `Written ${esc(longDate(a.note.written))}, on the refresh that first saw this session.`));
    n.append(sec);
    host.append(n);
  } else if (a.dt) {
    h.append(el('p', 'sub', 'No evaluation was written for this session; they are written for sessions logged after the notes began.'));
  }

  if (a.stream) host.append(streamCard(a, t));
  if (a.laps && a.laps.length) host.append(lapCard(a));
  host.append(zoneCard(a));
  if (!a.dt) {
    const n = card('Summary only', `This session is older than ${longDate(DATA.detailSince || a.d)}, so only the weekly-pane summary is kept for it: distance, time, heart rate and zone time.`);
    host.append(n);
  }
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

function mmss(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Line chart over a stream: x is elapsed time or distance, y is spec.value(i).
 *  Gaps where the value is null; the line takes spec.color per point, so a
 *  heart-rate trace can change colour with the zone. Tap and hold reads a point. */
function streamChart(host, s, spec) {
  const wrap = el('div', 'chartwrap');
  const tip = el('div', 'tip');
  wrap.append(tip);
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
    if (finite.length < 2) { wrap.append(el('div', 'empty', spec.emptyText || 'Nothing recorded for this.')); return; }
    let lo = Math.min(...finite), hi = Math.max(...finite);
    if (spec.yMin != null) lo = Math.min(lo, spec.yMin);
    if (spec.yMax != null) hi = Math.max(hi, spec.yMax);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const ticks = mini ? [lo, hi] : ticksIn(lo, hi, 4);
    if (!mini) { lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]); }
    const y = (v) => (spec.invert ? padT + ((v - lo) / (hi - lo)) * ih : padT + ih - ((v - lo) / (hi - lo)) * ih);
    const x = (i) => padL + (xs[i] / xMax) * iw;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    svg.setAttribute('aria-label', spec.aria || 'session curve');
    if (!mini) {
      yCaption(svg, spec.yLabel, padL);
      for (const t of ticks) {
        svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), stroke: 'var(--hairline)', 'stroke-width': 1 }));
        svg.append(Object.assign(svgEl('text', { x: padL - 5, y: y(t) + 3.5, 'text-anchor': 'end', fill: 'var(--text-muted)', 'font-size': 9.5 }),
          { textContent: (spec.yFmt || fmt0)(t) }));
      }
      for (const r of spec.rules || []) {
        if (r.at < lo || r.at > hi) continue;
        svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: y(r.at), y2: y(r.at), stroke: r.color || 'var(--hairline-strong)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
        if (r.label) svg.append(Object.assign(svgEl('text', { x: W - padR - 2, y: y(r.at) - 3, 'text-anchor': 'end', fill: r.color || 'var(--text-muted)', 'font-size': 9 }), { textContent: r.label }));
      }
      // x axis
      if (spec.xTicks) {
        const placed = spec.xTicks.map((tk) => ({ ...tk, px: padL + (tk.at / xMax) * iw }));
        for (const tk of placed) {
          if (tk.grid) svg.append(svgEl('line', { x1: tk.px, x2: tk.px, y1: padT, y2: padT + ih, stroke: 'var(--hairline)', 'stroke-width': 1 }));
        }
        // Labels: a tick within 38 px of the one before it is dropped, and the
        // edge-most labels are anchored inward so nothing runs off the chart.
        let lastPx = -Infinity;
        placed.forEach((tk, k) => {
          const isLast = k === placed.length - 1;
          const next = placed[k + 1];
          if (tk.px - lastPx < 38) return;
          if (!isLast && next && next.px - tk.px < 38 && next.px > W - padR - 16) return; // let the last one win
          const anchor = tk.px > W - padR - 16 ? 'end' : tk.px < padL + 16 ? 'start' : 'middle';
          svg.append(Object.assign(svgEl('text', { x: tk.px, y: H - 8, 'text-anchor': anchor, fill: 'var(--text-muted)', 'font-size': 9.5 }), { textContent: tk.label }));
          lastPx = tk.px;
        });
      } else if (spec.xMode === 'dist') {
        const step = [0.5, 1, 2, 5, 10, 20].find((st) => xMax / st <= 7) || 50;
        for (let k = step; k < xMax; k += step) {
          const px = padL + (k / xMax) * iw;
          svg.append(Object.assign(svgEl('text', { x: px, y: H - 8, 'text-anchor': 'middle', fill: 'var(--text-muted)', 'font-size': 9.5 }), { textContent: `${fmt1(k)} km` }));
        }
      } else {
        const stepMin = [1, 2, 5, 10, 15, 20, 30, 60, 120].find((st) => xMax / 60 / st <= 6) || 240;
        for (let m = stepMin; m * 60 < xMax; m += stepMin) {
          const px = padL + (m * 60 / xMax) * iw;
          svg.append(Object.assign(svgEl('text', { x: px, y: H - 8, 'text-anchor': 'middle', fill: 'var(--text-muted)', 'font-size': 9.5 }), { textContent: `${fmt0(m)} min` }));
        }
      }
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih, stroke: 'var(--hairline-strong)', 'stroke-width': 1 }));
    }

    if (spec.area) {
      let d = '', open = false, startX = null;
      const base = padT + ih;
      for (let i = 0; i < n; i++) {
        const v = vals[i];
        if (v == null) { if (open) { d += `L${x(i - 1).toFixed(1)},${base}Z`; open = false; } continue; }
        if (!open) { startX = x(i); d += `M${startX.toFixed(1)},${base}L`; open = true; }
        d += `${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      }
      if (open) d += `L${x(n - 1).toFixed(1)},${base}Z`;
      svg.append(svgEl('path', { d, fill: typeof spec.color === 'string' ? spec.color : 'var(--series-1)', opacity: 0.15 }));
    }

    // One path per run of the same colour, each starting at the previous point
    // so the trace stays continuous where the colour changes.
    let d = '', cur = null, prevPt = null;
    const sw = spec.width || (mini ? 1.5 : 2);
    const flush = () => { if (d) svg.append(svgEl('path', { d, fill: 'none', stroke: cur, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })); d = ''; };
    for (let i = 0; i < n; i++) {
      const v = vals[i];
      if (v == null) { flush(); cur = null; prevPt = null; continue; }
      const c = typeof spec.color === 'function' ? spec.color(i, v) : (spec.color || 'var(--series-1)');
      const pt = `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      if (c !== cur) { flush(); cur = c; d = prevPt ? `M${prevPt}L${pt}` : `M${pt}`; }
      else d += `L${pt}`;
      prevPt = pt;
    }
    flush();

    const cursor = svgEl('line', { x1: 0, x2: 0, y1: padT, y2: padT + ih, stroke: 'var(--text-primary)', 'stroke-width': 1, opacity: 0, 'pointer-events': 'none' });
    const dot = svgEl('circle', { r: mini ? 2.5 : 3.5, fill: 'var(--surface-1)', stroke: 'var(--text-primary)', 'stroke-width': 1.5, opacity: 0, 'pointer-events': 'none' });
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
      cursor.setAttribute('x1', px.toFixed(1)); cursor.setAttribute('x2', px.toFixed(1)); cursor.setAttribute('opacity', 0.5);
      if (vals[i] != null) { dot.setAttribute('cx', px.toFixed(1)); dot.setAttribute('cy', y(vals[i]).toFixed(1)); dot.setAttribute('opacity', 1); }
      else dot.setAttribute('opacity', 0);
      tip.innerHTML = spec.tip(i);
      tip.classList.add('on');
      const tw = tip.offsetWidth;
      let left = px / scale - tw / 2;
      left = Math.max(2, Math.min(box.width - tw - 2, left));
      tip.style.left = left + 'px';
      tip.style.top = '0px';
    };
    const hide = () => { tip.classList.remove('on'); cursor.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); };
    readout(hit, wrap, show, hide);
  }
  draw();
  new ResizeObserver(() => draw()).observe(wrap);
}

/** Aerobic decoupling: speed per heartbeat in the second half of the running
 *  against the first. Positive means the heart rate drifted up for the same
 *  pace — the steadier the run, the smaller the number. */
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
const RAMP = ['#3b4cc0', '#6f8ff0', '#b3c3ff', '#f2d5c4', '#f4a582', '#d6604d', '#b2182b'];

/** A colour from the cool-to-warm ramp for a value in [lo, hi]. */
function rampColor(v, lo, hi) {
  const t = hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0.5;
  const k = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(k)), f = k - i;
  const hex = (c) => [1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16));
  const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
  return `rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * f)).join(',')})`;
}

function darkMode() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The route on a web-mercator canvas, coloured per bin. Positions are the
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

    const modes = [['hr', 'HR zone'], !bike && has(s.p) ? ['pace', 'Pace'] : null, bike && has(s.v) ? ['speed', 'Speed'] : null,
      has(s.cad) ? ['cad', 'Cadence'] : null, has(s.pw) ? ['pw', 'Power'] : null, has(s.alt) ? ['alt', 'Elevation'] : null].filter(Boolean);
    if (!modes.some((m) => m[0] === mapColor)) mapColor = 'hr';
    const chips = el('div', 'chips');
    const wrap = el('div', 'mapwrap');
    const legendHost = el('div');
    const sub = help('');
    // Distance window: two thumbs on one track, indexes into the positioned bins.
    let lo = 0, hi = pts.length - 1;
    const rangeRow = el('div', 'maprange');
    const rangeLabel = el('span', 'range-label');
    const dual = el('div', 'dual');
    const track = el('div', 'dual-track');
    const fill = el('div', 'dual-fill');
    track.append(fill);
    const fromR = document.createElement('input'), toR = document.createElement('input');
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
    const climb = (a, b) => { let up = 0, down = 0; for (let k = a + 1; k <= b; k++) { if (smoothAlt[k] == null || smoothAlt[k - 1] == null) continue; const dz = smoothAlt[k] - smoothAlt[k - 1]; if (dz > 0) up += dz; else down -= dz; } return [up, down]; };
    const profile = el('div', 'profile');
    let profSvg = null, profDot = null;
    if (hasAlt) {
      const N = pts.length - 1;
      const vals = altAt.filter((v) => v != null);
      const zlo = Math.min(...vals), zhi = Math.max(...vals);
      const span = Math.max(zhi - zlo, 10);
      const py = (v) => (100 - ((v - zlo) / span) * 88 - 6).toFixed(1);
      const seg = (a, b) => { let d = ''; for (let k = a; k <= b; k++) { if (altAt[k] == null) continue; d += `${d ? 'L' : 'M'}${k},${py(altAt[k])}`; } return d; };
      const area = (a, b) => { const d = seg(a, b); return d ? `${d}L${b},100L${a},100Z` : ''; };
      profSvg = svgEl('svg', { viewBox: `0 0 ${N} 100`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Elevation profile of the session' });
      const muteA = svgEl('path', { d: area(0, N), fill: 'var(--surface-2)' });
      const muteL = svgEl('path', { d: seg(0, N), fill: 'none', stroke: 'var(--text-muted)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', opacity: 0.6 });
      const winA = svgEl('path', { fill: 'color-mix(in srgb, var(--series-8) 28%, var(--surface-1))' });
      const winL = svgEl('g');  // the window's line, in the same colours as the track on the map
      profSvg.append(muteA, muteL, winA, winL);
      profDot = el('i', 'pdot');  // an HTML dot: the svg is stretched, so a circle in it would be an ellipse
      profDot.hidden = true;
      profile.append(profSvg, profDot);
      profile.dataset.min = fmt0(zlo); profile.dataset.max = fmt0(zhi);
      profile.append(el('span', 'ymax', `${fmt0(zhi)} m`), el('span', 'ymin', `${fmt0(zlo)} m`));
      profile.colorAt = () => 'var(--series-8)';
      profile.redraw = () => {
        winA.setAttribute('d', area(lo, hi));
        winL.innerHTML = '';
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
        const k = Math.max(lo, Math.min(hi, Math.round((ev.clientX - box.left) / box.width * N)));
        mark(k);
      };
      readout(profSvg, wrap, showAt, () => unmark());
      profile.place = (k) => {
        if (k == null || altAt[k] == null) { profDot.hidden = true; return; }
        const f = k / N;
        profDot.style.left = `calc(11px + ${(f * 100).toFixed(2)}% - ${(f * 22).toFixed(1)}px)`;
        profDot.style.top = `${(py(altAt[k]) / 100 * 64).toFixed(1)}px`;
        profDot.hidden = false;
      };
    }
    rangeRow.append(rangeLabel, profile, dual);
    const syncRange = () => {
      fromR.value = String(lo); toR.value = String(hi);
      const max = Math.max(1, pts.length - 1);
      fill.style.left = `${(lo / max) * 100}%`;
      fill.style.right = `${100 - (hi / max) * 100}%`;
      const whole = lo === 0 && hi === pts.length - 1;
      const [up, down] = hasAlt ? climb(lo, hi) : [0, 0];
      const terrain = hasAlt ? ` · ↑ ${esc(fmt0(up))} m ↓ ${esc(fmt0(down))} m` : '';
      rangeLabel.innerHTML = (whole ? `<b>Whole session</b> · ${esc(fmt1(s.d[pts[hi]]))} km` : `<b>${esc(fmt1(s.d[pts[lo]]))}</b> – <b>${esc(fmt1(s.d[pts[hi]]))}</b> km of ${esc(fmt1(s.d[pts[pts.length - 1]]))}`) + terrain;
      if (profile.redraw) profile.redraw();
    };
    let drawTrack = () => {};
    fromR.oninput = () => { lo = +fromR.value; if (lo > hi) hi = lo; syncRange(); drawTrack(); };
    toR.oninput = () => { hi = +toR.value; if (hi < lo) lo = hi; syncRange(); drawTrack(); };
    syncRange();
    holder.append(chips, wrap, rangeRow, legendHost, sub);

    const render = () => {
      chips.innerHTML = '';
      for (const [key, label] of modes) {
        const b = el('button', mapColor === key ? 'on' : null, label);
        b.onclick = () => { mapColor = key; render(); };
        chips.append(b);
      }

      const W = Math.max(200, wrap.clientWidth || 340);
      const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
      const H = Math.round(Math.max(200, Math.min(W * 0.95, W * spanY / spanX + 40)));
      wrap.style.height = H + 'px';
      const zoom = Math.min(17.5, Math.log2(Math.min(W * 0.84 / spanX, (H - 24) * 0.84 / spanY)));
      const sc = Math.pow(2, zoom);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const px = (i) => (mx(s.lon[i]) - cx) * sc + W / 2;
      const py = (i) => (my(s.lat[i]) - cy) * sc + H / 2;
      wrap.innerHTML = '';

      // Street tiles: the inventory in the snapshot says which tiles the app
      // ZIP holds. The zoom fitted to this session goes on top; the two coarser
      // zooms and the next finer one go underneath, scaled, so a route in a
      // known area has a map even before its own tiles have reached the phone.
      const inventory = Array.isArray(DATA.tiles) && DATA.tiles.length ? new Set(DATA.tiles) : null;
      const m = s.map;
      if (m || inventory) {
        const layer = el('div', darkMode() ? 'tiles dark' : 'tiles');
        const ox = W / 2 - cx * sc, oy = H / 2 - cy * sc; // screen position of the world's origin
        const zTop = m ? m.z : Math.min(18, Math.floor(zoom) + 1);
        let drawn = 0;
        const sources = new Set(m && m.src ? m.src : []);
        // Coarsest first; a finer zoom scaled down beats a coarser one scaled up,
        // so it sits just under the exact zoom.
        for (const z of [zTop - 2, zTop - 1, zTop + 1, zTop]) {
          if (z < 1 || z > 18) continue;
          const tsz = 256 * Math.pow(2, zoom - z);        // one tile of this zoom, in px on screen
          for (let tx = Math.floor(-ox / tsz); tx * tsz + ox < W; tx++) {
            for (let ty = Math.floor(-oy / tsz); ty * tsz + oy < H; ty++) {
              const inFit = m && z === m.z && tx >= m.x0 && tx <= m.x1 && ty >= m.y0 && ty <= m.y1;
              if (inventory ? !inventory.has(`${z}/${tx}/${ty}`) : !inFit) continue;
              const img = document.createElement('img');
              img.src = `./data/tiles/${z}/${tx}/${ty}.png`;
              img.alt = '';
              img.draggable = false;
              img.style.cssText = `left:${(tx * tsz + ox).toFixed(1)}px;top:${(ty * tsz + oy).toFixed(1)}px;width:${tsz.toFixed(2)}px;height:${tsz.toFixed(2)}px`;
              img.onerror = () => img.remove();
              layer.append(img);
              drawn++;
            }
          }
        }
        if (drawn) {
          wrap.append(layer);
          if (!sources.size) sources.add('kartverket');
          wrap.append(el('div', 'attr', [...sources].map((k) => TILE_CREDIT[k] || k).join(' · ')));
        }
      }

      // Colour per bin.
      let colorAt, legendEl;
      const cont = (arr, fmtv, invert, unit) => {
        const vals = pts.map((i) => arr[i]).filter((v) => v != null).sort((x, y) => x - y);
        if (vals.length < 2) return null;
        const lo = vals[Math.floor(vals.length * 0.05)], hi = vals[Math.floor(vals.length * 0.95)];
        const f = (i) => (arr[i] == null ? 'var(--text-muted)' : rampColor(invert ? -arr[i] : arr[i], invert ? -hi : lo, invert ? -lo : hi));
        const l = el('div', 'ramp');
        l.append(el('span', null, esc(`${invert ? 'slower' : 'low'} ${fmtv(invert ? hi : lo)}${unit}`)), el('i'), el('span', null, esc(`${fmtv(invert ? lo : hi)}${unit} ${invert ? 'faster' : 'high'}`)));
        return [f, l];
      };
      let pair = null;
      if (mapColor === 'pace') pair = cont(s.p.map((v) => (v && v <= paceCap ? v : null)), pace, true, '/km');
      else if (mapColor === 'speed') pair = cont(s.v, fmt1, false, ' km/h');
      else if (mapColor === 'cad') pair = cont(s.cad, fmt0, false, bike ? ' rpm' : ' spm');
      else if (mapColor === 'pw') pair = cont(s.pw, fmt0, false, ' W');
      else if (mapColor === 'alt') pair = cont(s.alt, fmt0, false, ' m');
      if (pair) { colorAt = pair[0]; legendEl = pair[1]; }
      else {
        colorAt = (i) => zoneLineColor(s.hr[i] || 0);
        const seen = new Set(pts.map((i) => zoneOf(s.hr[i] || 0)));
        legendEl = legend(LINE_LEGEND.filter((_, k) => seen.has(k)));
      }

      profile.colorAt = (k) => colorAt(pts[k]);
      if (profile.redraw) profile.redraw();
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Route map' });
      const P = pts.map((i) => `${px(i).toFixed(1)},${py(i).toFixed(1)}`);
      const dot = svgEl('circle', { r: 5, fill: 'var(--surface-1)', stroke: 'var(--text-primary)', 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' });
      const tip = el('div', 'tip');
      wrap.append(svg, tip);
      // The track itself is redrawn when the distance window moves; the tiles,
      // the colour scale and the legend stay as they are, so a partial track is
      // coloured on the same scale as the whole session.
      drawTrack = () => {
        svg.innerHTML = '';
        if (lo > 0 || hi < pts.length - 1) {
          svg.append(svgEl('path', { d: 'M' + P.join('L'), fill: 'none', stroke: 'var(--text-muted)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.45 }));
        }
        svg.append(svgEl('path', { d: 'M' + P.slice(lo, hi + 1).join('L'), fill: 'none', stroke: 'var(--surface-1)', 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.9 }));
        let d = '', cur = null;
        const flush = () => { if (d) svg.append(svgEl('path', { d, fill: 'none', stroke: cur, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })); d = ''; };
        for (let k = lo; k <= hi; k++) {
          const col = colorAt(pts[k]);
          if (col !== cur) { flush(); cur = col; d = k > lo ? `M${P[k - 1]}L${P[k]}` : `M${P[k]}`; }
          else d += `L${P[k]}`;
        }
        flush();
        const [x0, y0] = P[lo].split(','), [x1, y1] = P[hi].split(',');
        svg.append(svgEl('circle', { cx: x1, cy: y1, r: 6, fill: 'var(--surface-1)', stroke: 'var(--text-primary)', 'stroke-width': 2 }));
        svg.append(svgEl('circle', { cx: x0, cy: y0, r: 5.5, fill: 'var(--text-primary)', stroke: 'var(--surface-1)', 'stroke-width': 1.5 }));
        svg.append(dot);
        unmark();
      };
      drawTrack();
      legendHost.innerHTML = '';
      legendHost.append(legendEl);
      sub.textContent = `Start is the filled dot, finish the ring. Coloured by ${modes.find((m) => m[0] === mapColor)[1].toLowerCase()}${pair ? ' between the 5th and 95th percentile of the whole session, whatever the slider shows' : ''}. Touch the map and slide to read points along the track; the two thumbs narrow the shown distance.${s.map ? '' : ' The streets for this session are not bundled yet; they come with the next data pull.'}`;

      unmark = () => { tip.classList.remove('on'); dot.setAttribute('opacity', 0); if (profile.place) profile.place(null); };
      mark = (k) => {
        const box = svg.getBoundingClientRect();
        const i = pts[k];
        dot.setAttribute('cx', px(i).toFixed(1)); dot.setAttribute('cy', py(i).toFixed(1)); dot.setAttribute('opacity', 1);
        if (profile.place) profile.place(k);
        tip.innerHTML = `<b>${mmss(s.t[i])}</b> · ${fmt1(s.d[i])} km` +
          (s.hr[i] ? `<br><span class="k">HR</span> ${s.hr[i]} · zone ${zoneOf(s.hr[i]) || '–'}` : '') +
          (bike ? (s.v && s.v[i] ? `<br><span class="k">speed</span> ${fmt1(s.v[i])} km/h` : '') : (s.p[i] ? `<br><span class="k">pace</span> ${pace(s.p[i])}/km` : '<br><span class="k">pace</span> walking')) +
          (s.cad[i] ? `<br><span class="k">cadence</span> ${s.cad[i]}${bike ? ' rpm' : ''}` : '') +
          (s.alt[i] != null ? `<br><span class="k">elevation</span> ${fmt0(s.alt[i])} m` : '');
        tip.classList.add('on');
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        const sx = px(i) * box.width / W, sy = py(i) * box.height / H;
        tip.style.left = Math.max(2, Math.min(box.width - tw - 2, sx - tw / 2)) + 'px';
        tip.style.top = (sy > th + 20 ? sy - th - 14 : sy + 14) + 'px';
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
  return `${fmt0(wx.t)} °C, wind ${fmt0(wx.w || 0)} km/h${wx.wc ? ` from ${wx.wc.toUpperCase()}` : ''}`;
}

let streamX = 'time';
let paceByZone = false;
function streamCard(a, tilesHost) {
  const bike = a.sport === 'bike';
  const c = card('Session curves');
  const intro = help('From the watch’s record, averaged into bins of a few seconds. Tap and hold to read a point; tap outside to release.');
  const holder = el('div');
  c.append(intro, holder);
  loadStream(a.id).then((s) => {
    if (!s || !s.t || s.t.length < 10) { holder.append(el('p', 'sub', 'The record stream for this session is not on the phone yet. Recent sessions arrive with the next data refresh; older ones come with the app ZIP.')); return; }
    const has = (arr) => Array.isArray(arr) && arr.some((v) => v);
    const series = ['heart rate', has(s.v) ? (bike ? 'speed' : 'pace') : null, has(s.gap) ? 'grade-adjusted pace' : null, has(s.cap) ? 'condition-adjusted pace' : null, has(s.cad) ? 'cadence' : null, has(s.pw) ? 'power' : null, has(s.alt) ? 'elevation' : null].filter(Boolean);
    intro.textContent = `${series.join(', ').replace(/^./, (ch) => ch.toUpperCase())} from the watch’s record, averaged into bins of a few seconds${bike && !has(s.v) ? ' — an indoor ride without sensors records only the heart rate' : ''}. Tap and hold to read a point; tap outside to release.`;
    if (tilesHost && !bike) {
      const dr = hrDrift(s);
      if (dr) tilesHost.append(tile('HR drift', `${dr.pct >= 0 ? '+' : '−'}${fmt1(Math.abs(dr.pct))}`,
        dr.minutes < 20 ? 'second half vs first; too short to mean much' : dr.pct < 5 ? 'second half vs first; steady' : 'second half vs first; drifting', '%'));
      if (s.cond) {
        const hw = s.cond.head || 0;
        tilesHost.append(tile('Headwind', `${hw > 0 ? '+' : hw < 0 ? '−' : ''}${fmt1(Math.abs(hw))}`,
          `${Math.abs(hw) < 0.3 ? 'about neutral along the route' : hw > 0 ? 'against you on average' : 'behind you on average'}${s.cond.heat ? ` · heat +${fmt1(s.cond.heat)} %` : ''}`, 'm/s'));
      }
    }
    const chips = el('div', 'chips');
    const area = el('div');
    const floors = DATA.athlete.zoneFloors;
    const tipAt = (i) => {
      const hr = s.hr[i], p = s.p[i], v = s.v ? s.v[i] : null;
      return `<b>${streamX === 'time' ? mmss(s.t[i]) : fmt1(s.d[i]) + ' km'}</b> · ${streamX === 'time' ? fmt1(s.d[i]) + ' km' : mmss(s.t[i])}` +
        (hr ? `<br><span class="k">HR</span> ${hr} · zone ${zoneOf(hr) || '–'}` : '') +
        (bike ? `<br><span class="k">speed</span> ${v ? fmt1(v) + ' km/h' : 'stopped'}` : `<br><span class="k">pace</span> ${p ? pace(p) + '/km' : 'walking'}`) +
        (!bike && s.gap && s.gap[i] ? `<br><span class="k">grade-adj.</span> ${pace(s.gap[i])}/km` : '') +
        (!bike && s.cap && s.cap[i] ? `<br><span class="k">cond-adj.</span> ${pace(s.cap[i])}/km${s.head && s.head[i] != null ? ` · wind ${s.head[i] > 0 ? '+' : ''}${fmt1(s.head[i])} m/s` : ''}` : '') +
        (s.cad[i] ? `<br><span class="k">cadence</span> ${s.cad[i]}${bike ? ' rpm' : ''}` : '') +
        (s.pw && s.pw[i] ? `<br><span class="k">power</span> ${s.pw[i]} W` : '') +
        (s.alt[i] != null ? `<br><span class="k">elevation</span> ${fmt0(s.alt[i])} m` : '');
    };
    const hasDist = s.d[s.d.length - 1] > 0.2;
    if (!hasDist) streamX = 'time'; // an indoor ride without a speed sensor has no distance to plot against
    const render = () => {
      chips.innerHTML = '';
      for (const [key, label] of (hasDist ? [['time', 'By time'], ['dist', 'By distance']] : [['time', 'By time']])) {
        const b = el('button', streamX === key ? 'on' : null, label);
        b.onclick = () => { streamX = key; render(); };
        chips.append(b);
      }
      if (has(s.v) && has(s.hr)) {
        const b = el('button', paceByZone ? 'on' : null, `${bike ? 'Speed' : 'Pace'} by HR zone`);
        b.onclick = () => { paceByZone = !paceByZone; render(); };
        chips.append(b);
      }
      const paceColor = paceByZone ? (i) => zoneLineColor(s.hr[i] || 0) : 'var(--series-1)';
      area.innerHTML = '';
      streamChart(area, s, {
        height: 170, xMode: streamX, value: (i) => s.hr[i], color: (i, v) => zoneLineColor(v),
        yMin: Math.max(60, floors[0] - 15),
        rules: [...floors.slice(1).map((f, k) => ({ at: f, color: 'var(--hairline-strong)', label: `Z${k + 2}` })),
          { at: DATA.athlete.lthr, color: 'var(--text-muted)', label: `threshold ${DATA.athlete.lthr}` }],
        aria: 'Heart rate through the session', yLabel: 'bpm', tip: tipAt,
      });
      area.append(help('Heart rate, coloured by zone. Dashed lines are the zone floors and the lactate threshold.'));
      if (bike) {
        if (has(s.v)) {
          streamChart(area, s, { height: 150, xMode: streamX, value: (i) => (s.v ? s.v[i] : null), color: paceColor, yMin: 0, aria: 'Speed through the ride', yLabel: 'km/h', tip: tipAt });
          area.append(help(`Speed in km/h${paceByZone ? ', coloured by the heart-rate zone at that moment' : ''}. Stops are left as gaps.`));
        }
      } else {
        // Anything slower than 8:30/km is a shuffle into or out of a walk break; as
        // a gap it keeps the axis on the running.
        const paceCap = a.sport === 'walk' ? 25 : 8.5;
        const paceOf = (arr) => (i) => (arr[i] && arr[i] <= paceCap ? arr[i] : null);
        const zoneNote = paceByZone ? ', coloured by the heart-rate zone at that moment' : '';
        streamChart(area, s, { height: 150, xMode: streamX, value: paceOf(s.p), color: paceColor, invert: true, yFmt: pace, aria: 'Pace through the session', yLabel: 'min/km, faster is higher', tip: tipAt, emptyText: 'No running pace recorded.' });
        area.append(help(`Pace in min/km, faster is higher${zoneNote}. ${a.sport === 'walk' ? 'Standstills' : 'Walk breaks'} are left as gaps.`));
        if (has(s.gap)) {
          streamChart(area, s, { height: 150, xMode: streamX, value: paceOf(s.gap), color: paceColor, invert: true, yFmt: pace, aria: 'Grade-adjusted pace through the session', yLabel: 'grade-adjusted min/km', tip: tipAt });
          area.append(help(`Grade-adjusted pace: the flat-ground pace that would cost the same effort, from the slope of the smoothed altitude and the running-cost curve${zoneNote}.`));
        }
        if (has(s.cap)) {
          streamChart(area, s, { height: 150, xMode: streamX, value: paceOf(s.cap), color: paceColor, invert: true, yFmt: pace, aria: 'Condition-adjusted pace through the session', yLabel: 'condition-adjusted min/km', tip: tipAt });
          area.append(help(`Condition-adjusted pace: the same, then corrected for the wind along your direction of travel (one station reading at the start, ${wxLine(a.wx)}) and the day's heat${zoneNote}. Read it as the flat, still-air, cool-day pace this effort would have bought.`));
        }
      }
      if (has(s.cad)) {
        streamChart(area, s, { height: 110, xMode: streamX, value: (i) => (s.cad[i] && (bike ? s.v && s.v[i] : s.p[i]) ? s.cad[i] : null), color: 'var(--series-3)', aria: 'Cadence', yLabel: bike ? 'rpm' : 'steps per minute', tip: tipAt });
        area.append(help(bike ? 'Cadence in rpm, while moving.' : 'Cadence in steps per minute, running only.'));
      }
      if (has(s.pw)) {
        streamChart(area, s, { height: 120, xMode: streamX, value: (i) => s.pw[i] || null, color: 'var(--series-4)', yMin: 0, aria: 'Power', yLabel: 'watts', tip: tipAt });
        area.append(help(bike ? 'Power in watts.' : 'Running power in watts, as the watch estimates it.'));
      }
      if (has(s.alt)) {
        streamChart(area, s, { height: 100, xMode: streamX, value: (i) => s.alt[i], color: 'var(--series-8)', area: true, aria: 'Elevation', yLabel: 'metres above sea level', tip: tipAt });
        area.append(help('Elevation, metres.'));
      }
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
      ? 'Bar width is lap duration, so the shape of the workout is the shape of the chart: work in blue, warm-up and cool-down amber; recoveries are left out of the pace chart and shown grey on the heart-rate one. Tap a bar to pin its numbers.'
      : 'Auto-laps, one per kilometre; bar width is lap duration. Tap a bar to pin its numbers.');
  const colorKind = (l) => (l.kind && LAP_KIND[l.kind] ? LAP_KIND[l.kind].color : 'var(--series-1)');
  const paceOf = (l) => (l.dist >= 100 && l.dur > 0 ? (l.dur / 60) / (l.dist / 1000) : null);
  const speedOf = (l) => (l.dist >= 100 && l.dur > 0 ? (l.dist / 1000) / (l.dur / 3600) : null);
  // Recovery laps are jogs or standstills; their pace would stretch the axis
  // and say nothing, so the pace chart leaves them as gaps (HR keeps them).
  const paceBar = (l) => (l.kind === 'R' ? null : paceOf(l));
  const speedBar = (l) => (l.kind === 'R' ? null : speedOf(l));
  const tipOf = (l) =>
    `<b>Lap ${l.n}${l.kind && LAP_KIND[l.kind] ? ` · ${LAP_KIND[l.kind].label}` : ''}</b>` +
    `<br>${l.dist >= 1000 ? fmt1(l.dist / 1000) + ' km' : fmt0(l.dist) + ' m'} · ${hhmm(l.dur / 60)}` +
    (paceOf(l) ? `<br><span class="k">${isBike ? 'speed' : 'pace'}</span> ${isBike ? fmt1(speedOf(l)) + ' km/h' : pace(paceOf(l)) + '/km'}` : '') +
    (l.hr ? `<br><span class="k">HR</span> ${l.hr} avg · ${l.maxHr || '—'} max` : '') +
    (l.cad ? `<br><span class="k">cadence</span> ${fmt0(l.cad)}` : '') +
    (l.pwr ? `<br><span class="k">power</span> ${fmt0(l.pwr)} W` : '') +
    (l.gain || l.loss ? `<br><span class="k">climb</span> +${fmt0(l.gain || 0)} / −${fmt0(l.loss || 0)} m` : '');

  if (a.km > 0.2) {
    lapChart(c, L, {
      height: 160,
      value: isBike ? speedBar : paceBar,
      color: colorKind,
      tickFmt: isBike ? (t) => fmt0(t) : (t) => pace(t),
      aria: isBike ? 'Speed per lap' : 'Pace per lap',
      yLabel: isBike ? 'km/h' : 'min/km, taller is slower',
      tip: tipOf,
      emptyText: 'No lap long enough to have a pace.',
    });
  }
  lapChart(c, L, {
    height: 150,
    value: (l) => l.hr || null,
    color: (l) => (l.hr ? zoneColor(l.hr) : 'var(--surface-2)'),
    rules: [{ at: DATA.athlete.lthr, color: 'var(--text-muted)', label: `threshold ${DATA.athlete.lthr}` }],
    aria: 'Average heart rate per lap',
    yLabel: 'bpm',
    tip: tipOf,
    emptyText: 'No heart rate on these laps.',
  });
  c.append(help('Average heart rate per lap, coloured by zone'));
  c.append(legend([
    ...(structured ? [['A', 'Work'], ['R', 'Recovery'], ['W', 'Warm-up / cool-down']].map(([k, label]) => ({ color: LAP_KIND[k].color, label })) : []),
    ...ZONES.map((z) => ({ color: z.color, label: z.label })),
  ]));
  tableToggle(c, 'laps-' + a.id, () => table(
    ['Lap', 'Dist', 'Time', isBike ? 'km/h' : 'Pace', 'Avg HR', 'Max HR', 'Cad', 'W', 'Climb'],
    L.map((l) => [
      `${l.n}${l.kind && LAP_KIND[l.kind] ? ' ' + LAP_KIND[l.kind].label[0] : ''}`,
      l.dist >= 1000 ? fmt1(l.dist / 1000) + ' km' : fmt0(l.dist) + ' m',
      hhmm(l.dur / 60),
      paceOf(l) ? (isBike ? fmt1(speedOf(l)) : pace(paceOf(l))) : '—',
      l.hr ? String(l.hr) : '—', l.maxHr ? String(l.maxHr) : '—',
      l.cad ? fmt0(l.cad) : '—', l.pwr ? fmt0(l.pwr) : '—',
      l.gain || l.loss ? `+${fmt0(l.gain || 0)}/−${fmt0(l.loss || 0)}` : '—',
    ])
  ));
  return c;
}

function zoneCard(a) {
  const tot = a.z.reduce((s, v) => s + v, 0);
  const c = card('Time in heart-rate zone', tot ? `${hhmm(tot / 60)} of heart-rate data in this session.` : 'No heart-rate data for this session.');
  if (tot) {
    const bar = el('div', 'zbar');
    ZONES.forEach((z, i) => {
      if (a.z[i] > 0) {
        const seg = el('span');
        seg.style.flex = `${a.z[i]} 0 0`;
        seg.style.background = z.color;
        seg.title = `${z.label}: ${hhmm(a.z[i] / 60)}`;
        bar.append(seg);
      }
    });
    c.append(bar);
    c.append(legend(ZONES.map((z, i) => ({ color: z.color, label: `${z.label} ${hhmm(a.z[i] / 60)} (${fmt0((a.z[i] / tot) * 100)}%)` }))));
  }
  return c;
}

/* --- Health ------------------------------------------------------------- */

// Every history chart on the pane shares one x axis: each day of the window
// for windows up to sixteen weeks, each week beyond that (so a two-year window
// is a hundred bars rather than seven hundred). A bucket with no data leaves a
// gap rather than moving its neighbours closer together.
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
    out.push({ key: k, label: shortDate(k), days: byKey.get(k) || [] });
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
const fmtK = (n) => (n >= 10000 ? `${fmt1(n / 1000)}k` : fmt0(n));

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
  const per = weekly ? 'week' : 'day';
  const avgWord = weekly ? '4-week average' : '7-day average';
  const smooth = (vals) => rollingSparse(vals, weekly ? 4 : 7);
  const spanNote = weekly ? 'Each bar is one week, shown as its average day. ' : '';

  // Tiles: Garmin's readiness readouts, the last seven days, and the newest weigh-in.
  const last7 = (DATA.daily || []).slice(-7);
  const sleepAll = DATA.sleep || [];
  const recent = sleepAll.slice(-7);
  const rd = gn.readiness || {};
  const tiles = el('div', 'tiles');
  tiles.append(tile('Readiness', rd.score != null ? fmt0(rd.score) : '—', (rd.level || '').toLowerCase().replace(/_/g, ' ')));
  tiles.append(tile('Sleep, last 7', recent.length ? fmt1(recent.reduce((t, x) => t + (x.h || 0), 0) / recent.length) : '—',
    recent.length ? `per night · score ${fmt0(recent.reduce((t, x) => t + (x.score || 0), 0) / recent.length)}` : '', 'h'));
  tiles.append(tile('HRV, 7-night', rd.hrvWeeklyAvg != null ? fmt0(rd.hrvWeeklyAvg) : '—', (rd.hrvFeedback || '').replace(/_/g, ' ').toLowerCase(), 'ms'));
  const stepsAvg = meanOf(last7, 'steps');
  const goalAvg = meanOf(last7, 'goal');
  const met = last7.filter((d) => d.steps != null && d.goal != null && d.steps >= d.goal).length;
  tiles.append(tile('Steps, last 7 days', stepsAvg != null ? fmtK(stepsAvg) : '—',
    stepsAvg != null ? `per day · goal met ${met} of ${last7.length}${goalAvg ? ` (≈ ${fmtK(goalAvg)})` : ''}` : 'no daily summaries yet'));
  const lastW = allWeight[allWeight.length - 1];
  const firstW = weight[0];
  const wNote = lastW
    ? (firstW && firstW.d !== lastW.d ? `${lastW.kg - firstW.kg >= 0 ? '+' : '−'}${fmt1(Math.abs(lastW.kg - firstW.kg))} kg since ${shortDate(firstW.d)}` : `weighed ${shortDate(lastW.d)}`)
    : 'no weigh-ins';
  tiles.append(tile('Weight', lastW ? fmt1(lastW.kg) : '—', wNote, lastW ? 'kg' : undefined));
  const rhrAvg = meanOf(last7, 'rhr');
  const fa = gn.fitnessAge;
  if (fa && fa.age != null) {
    tiles.append(tile('Fitness age', fmt1(fa.age), `${fa.chronological != null ? `against ${fmt0(fa.chronological)} · ` : ''}resting HR ${rhrAvg != null ? fmt0(rhrAvg) : '—'}`, 'yrs'));
  } else {
    const rhrs = last7.map((d) => d.rhr).filter((v) => v != null);
    tiles.append(tile('Resting HR, 7 days', rhrAvg != null ? fmt0(rhrAvg) : '—',
      rhrs.length ? `${fmt0(Math.min(...rhrs))}–${fmt0(Math.max(...rhrs))} bpm across the week` : '', 'bpm'));
  }
  main.append(tiles);

  // The shared axis and the helpers every chart below uses.
  const sleep = sleepAll.filter((x) => x.d >= start && x.d <= end);
  const sb = healthBuckets(sleep, weekly, start, end);
  const db = healthBuckets(daily, weekly, start, end);
  const grid = db.map((b) => ({ key: b.key, label: b.label }));
  const head = (i) => `<b>${weekly ? `Week of ${esc(longDate(grid[i].key))}` : esc(longDate(grid[i].key))}</b>`;
  const flat = grid.map((g) => ({ ...g, total: 0, seg: [] }));
  const bars = (vals, color) => grid.map((g, i) => ({ ...g, total: vals[i] || 0, seg: vals[i] == null ? [] : [{ v: vals[i], color }] }));
  const sVal = (k) => sb.map((b) => (b.days.length ? meanOf(b.days, k) : null));
  const dVal = (k) => db.map((b) => (b.days.length ? meanOf(b.days, k) : null));
  const gap = (i) => `${head(i)}<br>no data`;

  // Sleep and overnight HRV come from the sleep record, which has its own history.
  {
    const hrs = sVal('h');
    if (have(hrs) >= 2) {
      const c1 = card('Sleep', `${spanNote}Hours per night, with the ${weekly ? 'four-week' : 'seven-night'} average on top. Sleep is the cheapest recovery there is and the first thing that quietly disappears when life gets busy.`);
      columnChart(c1, {
        height: 180,
        rows: bars(hrs, 'var(--series-1)'),
        lines: [{ values: smooth(hrs), color: 'var(--series-2)' }],
        rules: [{ at: 7, color: 'var(--hairline-strong)', label: '7 h' }],
        tickFmt: (t) => fmt1(t),
        aria: 'Sleep hours per night',
        yLabel: 'hours per night',
        tip: (r, i) => (hrs[i] == null ? gap(i) : `${head(i)}<br>${fmt1(hrs[i])} h · score ${fmt0(meanOf(sb[i].days, 'score') || 0)}` +
          `<br><span class="k">deep</span> ${fmt0(meanOf(sb[i].days, 'deep') || 0)}% <span class="k">rem</span> ${fmt0(meanOf(sb[i].days, 'rem') || 0)}%` +
          (meanOf(sb[i].days, 'hrv') ? `<br><span class="k">overnight HRV</span> ${fmt0(meanOf(sb[i].days, 'hrv'))} ms` : '')),
      });
      c1.append(legend([
        { color: 'var(--series-1)', label: 'Hours slept' },
        { color: 'var(--series-2)', label: avgWord, line: true },
      ]));
      tableToggle(c1, 'sleep', () => table(['Night', 'Hours', 'Score', 'Deep %', 'REM %', 'HRV'],
        sleep.slice().reverse().map((x) => [longDate(x.d), fmt1(x.h), fmt0(x.score), fmt0(x.deep), fmt0(x.rem), x.hrv ? fmt0(x.hrv) : '—'])));
      main.append(c1);
    }
    const hv = sVal('hrv');
    if (have(hv) >= 3) {
      const c2 = card('Overnight heart-rate variability',
        `${spanNote}A single night says almost nothing; a baseline that slides down over a fortnight is the signal worth acting on.`);
      const sm = smooth(hv);
      columnChart(c2, {
        height: 165,
        rows: bars(hv, 'var(--series-3)'),
        lines: [{ values: sm, color: 'var(--text-primary)' }],
        tickFmt: (t) => fmt0(t),
        aria: 'Overnight heart-rate variability',
        yLabel: 'HRV, ms',
        tip: (r, i) => (hv[i] == null ? gap(i) : `${head(i)}<br>${fmt0(hv[i])} ms<br><span class="k">${avgWord}</span> ${fmt0(sm[i])} ms`),
      });
      c2.append(legend([
        { color: 'var(--series-3)', label: 'Nightly HRV' },
        { color: 'var(--text-primary)', label: avgWord, line: true },
      ]));
      main.append(c2);
    }
  }

  if (daily.length < 2) {
    const c = card('Daily summaries');
    c.append(el('p', 'sub', (DATA.daily || []).length
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
    const c = card('Steps', `${spanNote}Steps per day with the ${avgWord} on top. The dashed line is the watch's own step goal, which it moves with what you have been doing lately, so it is a floor to keep, not a target to chase.`);
    columnChart(c, {
      height: 190,
      rows: bars(vals, 'var(--series-1)'),
      lines: [{ values: smooth(vals), color: 'var(--series-2)' }],
      rules: goal ? [{ at: goal, color: 'var(--hairline-strong)', label: `goal ≈ ${fmtK(goal)}` }] : [],
      tickFmt: (t) => fmtK(t),
      aria: `Steps per ${per}`,
      yLabel: 'steps per day',
      tip: (r, i) => (vals[i] == null ? gap(i) : `${head(i)}<br>${fmt0(vals[i])} steps${weekly ? ' per day' : ''}` +
        (weekly ? `<br><span class="k">week total</span> ${fmtK(sumOf(db[i].days, 'steps'))} · ${db[i].days.length} days` : `<br><span class="k">goal</span> ${fmt0(db[i].days[0].goal || 0)}`)),
    });
    c.append(legend([{ color: 'var(--series-1)', label: `Steps per ${per}` }, { color: 'var(--series-2)', label: avgWord, line: true }]));
    tableToggle(c, 'steps', () => table([weekly ? 'Week' : 'Day', 'Steps', 'Goal', 'Floors up', 'Active min'],
      db.filter((b) => b.days.length).reverse().map((b) => [longDate(b.key), fmt0(meanOf(b.days, 'steps') || 0), fmt0(meanOf(b.days, 'goal') || 0), fmt0(meanOf(b.days, 'up') || 0), fmt0(meanOf(b.days, 'activeMin') || 0)])));
    main.append(c);
  }

  // Floors
  {
    const vals = dVal('up');
    const c = card('Floors climbed', `${spanNote}Floors ascended per day as the watch counts them from its barometer, one floor being about three metres. Stairs, hills and hikes all land here; a lift does not.`);
    columnChart(c, {
      height: 170,
      rows: bars(vals, 'var(--series-4)'),
      lines: [{ values: smooth(vals), color: 'var(--text-primary)' }],
      tickFmt: (t) => fmt0(t),
      aria: `Floors climbed per ${per}`,
      yLabel: 'floors up per day',
      tip: (r, i) => (vals[i] == null ? gap(i) : `${head(i)}<br>${fmt1(vals[i])} floors up${weekly ? ' per day' : ''}<br><span class="k">down</span> ${fmt1(meanOf(db[i].days, 'down') || 0)}`),
    });
    c.append(legend([{ color: 'var(--series-4)', label: 'Floors up' }, { color: 'var(--text-primary)', label: avgWord, line: true }]));
    main.append(c);
  }

  // Intensity minutes, always per week: that is how the guideline is written.
  {
    const wk = healthBuckets(daily, true, start, end);
    const mod = wk.map((b) => (b.days.length ? sumOf(b.days, 'mod') : null));
    const vig = wk.map((b) => (b.days.length ? sumOf(b.days, 'vig') : null));
    const c = card('Intensity minutes', 'Minutes per week in Garmin\'s moderate and vigorous heart-rate bands, counted from all-day heart rate rather than from sessions. The WHO guideline is 150 moderate minutes a week, with a vigorous minute worth two; Garmin\'s own weekly goal counts the same way.');
    columnChart(c, {
      height: 180,
      rows: wk.map((b, i) => ({ key: b.key, label: b.label, total: (mod[i] || 0) + (vig[i] || 0), seg: mod[i] == null ? [] : [{ v: mod[i], color: 'var(--series-3)' }, { v: vig[i] || 0, color: 'var(--series-2)' }] })),
      rules: [{ at: 150, color: 'var(--hairline-strong)', label: '150 min' }],
      minMax: 160,
      tickFmt: (t) => fmt0(t),
      aria: 'Intensity minutes per week',
      yLabel: 'min per week',
      tip: (r, i) => (mod[i] == null ? `<b>Week of ${esc(longDate(wk[i].key))}</b><br>no data` : `<b>Week of ${esc(longDate(wk[i].key))}</b><br>${fmt0(mod[i] + vig[i])} min · ${fmt0(mod[i] + 2 * vig[i])} moderate-equivalent` +
        `<br><span class="k">moderate</span> ${fmt0(mod[i])} <span class="k">vigorous</span> ${fmt0(vig[i])}`),
    });
    c.append(legend([{ color: 'var(--series-3)', label: 'Moderate' }, { color: 'var(--series-2)', label: 'Vigorous' }]));
    main.append(c);
  }

  // Resting heart rate
  {
    const vals = dVal('rhr');
    if (have(vals) >= 3) {
      const [lo, hi] = minMax(vals);
      const c = card('Resting heart rate', `${spanNote}The watch's overnight resting heart rate, with the ${avgWord}. It drifts down as fitness builds and jumps up a few beats when you are ill, short on sleep or carrying a hard block; a single high morning means little.`);
      columnChart(c, {
        height: 170,
        rows: flat,
        lines: [{ values: vals, color: 'var(--series-5)' }, { values: smooth(vals), color: 'var(--text-primary)' }],
        yMin: Math.floor(lo - 2), yMax: Math.ceil(hi + 2),
        tickFmt: (t) => fmt0(t),
        aria: 'Resting heart rate per day',
        yLabel: 'bpm',
        tip: (r, i) => (vals[i] == null ? gap(i) : `${head(i)}<br>${fmt0(vals[i])} bpm resting` +
          (weekly ? '' : `<br><span class="k">day range</span> ${fmt0(db[i].days[0].minHr || 0)}–${fmt0(db[i].days[0].maxHr || 0)}`)),
      });
      c.append(legend([{ color: 'var(--series-5)', label: 'Resting HR', line: true }, { color: 'var(--text-primary)', label: avgWord, line: true }]));
      main.append(c);
    }
  }

  vo2Card(main);

  // Stress and body battery share a 0–100 scale, so they sit on one chart.
  {
    const st = dVal('stress');
    const lo = dVal('bbLow'), hi = dVal('bbHigh');
    if (have(st) >= 3 || have(hi) >= 3) {
      const c = card('Stress and body battery', `${spanNote}Garmin's all-day stress (0–100, from heart-rate variability) as a line, and the day's body-battery range as a band: where it charged to overnight and where it drained to by evening. A band that no longer reaches the top is the earliest sign of not recovering.`);
      columnChart(c, {
        height: 190,
        rows: flat,
        band: { lo, hi, color: 'var(--series-3)' },
        lines: [{ values: st, color: 'var(--series-4)' }],
        yMin: 0, yMax: 100,
        tickFmt: (t) => fmt0(t),
        aria: 'Average stress and body-battery range per day',
        yLabel: '0–100',
        tip: (r, i) => (st[i] == null && hi[i] == null ? gap(i) : `${head(i)}<br>stress ${fmt0(st[i] || 0)}<br><span class="k">body battery</span> ${fmt0(lo[i] || 0)}–${fmt0(hi[i] || 0)}`),
      });
      c.append(legend([{ color: 'var(--series-3)', label: 'Body battery, low to high' }, { color: 'var(--series-4)', label: 'Average stress', line: true }]));
      main.append(c);
    }
  }

  weightCard(main, weight, grid, weekly);

  // Blood oxygen
  {
    const vals = dVal('spo2');
    if (have(vals) >= 3) {
      const [lo] = minMax(vals);
      const c = card('Blood oxygen', `${spanNote}Average overnight pulse oximetry. Healthy sleep sits at 95 % and above; the watch reads a little low, so a night or two at 93–94 is noise, a run of them is worth noticing.`);
      columnChart(c, {
        height: 150,
        rows: flat,
        lines: [{ values: vals, color: 'var(--series-7)' }],
        rules: [{ at: 95, color: 'var(--hairline-strong)', label: '95 %' }],
        yMin: Math.min(88, Math.floor(lo - 1)), yMax: 100,
        tickFmt: (t) => fmt0(t),
        aria: 'Average blood oxygen per day',
        yLabel: 'SpO₂, %',
        tip: (r, i) => (vals[i] == null ? gap(i) : `${head(i)}<br>${fmt0(vals[i])} % average` +
          (weekly ? '' : `<br><span class="k">lowest</span> ${fmt0(db[i].days[0].spo2Low || 0)} %`)),
      });
      main.append(c);
    }
  }

  // Active energy
  {
    const vals = dVal('active');
    if (have(vals) >= 2) {
      const c = card('Active calories', `${spanNote}Calories above the resting metabolism, per day: everything from the walk to the shop to the long run. It is the watch's estimate, good for the shape of the week, not for a food plan.`);
      columnChart(c, {
        height: 160,
        rows: bars(vals, 'var(--series-8)'),
        lines: [{ values: smooth(vals), color: 'var(--text-primary)' }],
        tickFmt: (t) => fmt0(t),
        aria: `Active calories per ${per}`,
        yLabel: 'kcal per day',
        tip: (r, i) => (vals[i] == null ? gap(i) : `${head(i)}<br>${fmt0(vals[i])} active kcal${weekly ? ' per day' : ''}` +
          `<br><span class="k">total</span> ${fmt0(meanOf(db[i].days, 'kcal') || 0)} <span class="k">active time</span> ${hhmm(meanOf(db[i].days, 'activeMin') || 0)}`),
      });
      c.append(legend([{ color: 'var(--series-8)', label: 'Active kcal' }, { color: 'var(--text-primary)', label: avgWord, line: true }]));
      main.append(c);
    }
  }
}

/** Weigh-ins on the shared axis: a line interpolated between measurements, so a
 *  monthly habit still reads as a trend. With fewer than two in the window, the
 *  last twelve are shown on their own axis instead, and the card says so. */
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
      const w = byKey.get(grid[i].key);
      const h = `<b>${weekly ? `Week of ${esc(longDate(grid[i].key))}` : esc(longDate(grid[i].key))}</b>`;
      if (w) return `${h}<br>${fmt1(w.kg)} kg weighed ${esc(shortDate(w.d))}${w.bmi ? `<br><span class="k">BMI</span> ${fmt1(w.bmi)}` : ''}`;
      return values[i] == null ? `${h}<br>no weigh-in` : `${h}<br>≈ ${fmt1(values[i])} kg <span class="k">between weigh-ins</span>`;
    };
  } else {
    chartRows = rows.map((w) => ({ key: w.d, label: shortDate(w.d), total: 0, seg: [] }));
    values = kg;
    tip = (r, i) => `<b>${esc(longDate(rows[i].d))}</b><br>${fmt1(rows[i].kg)} kg${rows[i].bmi ? `<br><span class="k">BMI</span> ${fmt1(rows[i].bmi)}` : ''}`;
  }
  columnChart(c, {
    height: 170,
    rows: chartRows,
    lines: [{ values, color: 'var(--series-6)' }],
    yMin: Math.floor(lo - 1), yMax: Math.ceil(hi + 1),
    tickFmt: (t) => fmt1(t),
    aria: 'Body weight per weigh-in',
    yLabel: 'kg',
    tip,
  });
  c.append(el('p', 'sub', `${inWindow ? '' : 'Fewer than two weigh-ins in this window, so the last '}${rows.length} weigh-ins, ${shortDate(rows[0].d)} to ${shortDate(rows[rows.length - 1].d)}: ${fmt1(kg[0])} kg to ${fmt1(kg[kg.length - 1])} kg.`));
  tableToggle(c, 'weight', () => table(['Date', 'kg', 'BMI'], rows.slice().reverse().map((w) => [longDate(w.d), fmt1(w.kg), w.bmi ? fmt1(w.bmi) : '—'])));
  main.append(c);
}

load();
