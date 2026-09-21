/* Outdoor Window — Snuggery mini-app.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS APP READS
 * ---------------------------------------------------------------------------
 * Two files, both under ./data/, both re-read every time the app comes back
 * into view. Nothing else. No network: a mini-app in Snuggery cannot reach it,
 * and this one does not want to.
 *
 *   data/snapshot.json   the forecast. Rewritten by a Shortcut on the phone.
 *   data/rules.json      what counts as a good hour. Written by the person,
 *                        in Snuggery's ⋯ → App Files.
 *
 * ---------------------------------------------------------------------------
 * data/snapshot.json — THE RAW OPEN-METEO REPLY, AS IT ARRIVES
 * ---------------------------------------------------------------------------
 * This app is unusual in the template: it has no GitHub Action behind it. The
 * Shortcut asks the phone for its own location, fetches the forecast for that
 * spot, and hands the reply straight over. So the shape below is not ours to
 * choose — it is Open-Meteo's forecast response, written here unmodified:
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
 *   2. `current.time` — Open-Meteo's own "now", rounded to the quarter hour —
 *      read as local wall clock and shifted by `utc_offset_seconds`. This is
 *      why the fetch asks for `&current=`: without it the file carries no
 *      moment at all. Shown as "about HH:MM".
 *   3. `hourly.time[0]` shifted the same way: the first hour of the forecast.
 *      Shown as "forecast from HH:MM", because it is a lower bound on the age,
 *      not the age.
 * `generationtime_ms` is never used for this. It is a duration in
 * milliseconds — how long their server spent computing — and reading it as a
 * timestamp is the obvious wrong turn, so it is named here to close it off.
 *
 * WHAT ASK CAN AND CANNOT SEE. Snuggery's *Ask About This Data* reads one key:
 * a top-level `ask` array. The committed demo has one; a file delivered by the
 * Shortcut does not, because Shortcuts cannot build 48 scored rows without a
 * Repeat loop. The app itself never needs `ask` — it scores the hours below —
 * but Ask does. PROMPT.md says this plainly and gives the optional recipe.
 *
 * ---------------------------------------------------------------------------
 * data/rules.json — WHAT COUNTS AS A GOOD HOUR
 * ---------------------------------------------------------------------------
 * {
 *   "schema": 1,
 *   "activity": "A walk outside",     // the label in the header of the panes
 *   "maxRainChancePct": 30,           // hourly.precipitation_probability ≤ this
 *   "maxPrecipMm": 0.2,               // hourly.precipitation ≤ this
 *   "maxGustKmh": 35,                 // hourly.wind_gusts_10m ≤ this
 *   "temperatureC": { "min": 2, "max": 26 },
 *   "dewPointC":    { "min": -10, "max": 17 },
 *   "daylight": "daylight",           // "any" | "daylight" | "golden"
 *   "goldenHourMinutes": 75,          // the width of the golden band, each end
 *   "minWindowHours": 2               // shorter runs of good hours are not windows
 * }
 * Any rule may be left out; a missing rule is simply not applied. The numbers
 * are in whatever units the snapshot uses — the shipped fetch is °C and km/h.
 *
 * HOW AN HOUR IS SCORED. Each rule that applies yields two things: whether the
 * hour passes it, and a comfort between 0 and 1 — 1 at the most comfortable
 * value the rule allows, 0 exactly at the limit. A "no more than" rule scores
 * (limit − value) / limit; a band scores how near the middle of the band the
 * value sits; daylight scores 1 or 0. The hour's score is the mean comfort,
 * rounded to a percentage, and it passes only if every rule passes. So a
 * scraped pass scores low and reads as marginal, which is the honest picture.
 * `scripts/outdoor_window.py` mirrors this arithmetic to write the demo's
 * `ask` rows; change a formula in one and change it in the other.
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON SAFETY, since this file renders data somebody else's server wrote:
 * nothing from either JSON file ever reaches innerHTML. Every value goes in
 * through textContent, via the `el()` helper below. innerHTML appears three
 * times in this file and is assigned the empty string every time, to clear a
 * container before redrawing it. Keep it that way.
 * ---------------------------------------------------------------------------
 */

const SNAPSHOT_URL = './data/snapshot.json';
const RULES_URL = './data/rules.json';

/* The hourly variables the scoring needs. `cloud_cover` is shown, never
   scored, so it is not in this list — a file without it still works. */
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

const TABS = [
  { id: 'windows', label: 'Windows' },
  { id: 'hours', label: 'Hours' },
  { id: 'rules', label: 'Rules' }
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const state = { tab: 'windows', selected: null, model: null };

const main = document.getElementById('main');
const tabsNav = document.getElementById('tabs');
const stampNode = document.getElementById('stamp');
const placeNode = document.getElementById('place');

/* -------------------------------------------------------------- tiny helpers */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/* "2026-09-21T05:00" in a place that is `offset` seconds from UTC, as an
   instant. Parsed as UTC and then shifted back, which avoids handing a
   zone-less string to the engine's local-time guesswork. */
function localToEpoch(stamp, offset) {
  if (typeof stamp !== 'string') return NaN;
  const ms = Date.parse(stamp.slice(0, 16) + 'Z');
  return Number.isNaN(ms) ? NaN : ms - offset * 1000;
}

/* Formatting is always in the FORECAST's time zone, not the reader's — the
   weather happens where the weather is. The header stamp is the exception and
   says so. */
function atPlace(epoch, offset) {
  return new Date(epoch + offset * 1000);
}

function hhmm(epoch, offset) {
  const d = atPlace(epoch, offset);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function dayLabel(epoch, offset) {
  const d = atPlace(epoch, offset);
  return DAY_NAMES[d.getUTCDay()] + ' ' + d.getUTCDate();
}

function dayKey(epoch, offset) {
  return atPlace(epoch, offset).toISOString().slice(0, 10);
}

function num(value, digits = 0, suffix = '') {
  if (!isNumber(value)) return '—';
  return value.toFixed(digits) + suffix;
}

function plural(count, one, many) {
  return count + ' ' + (count === 1 ? one : many);
}

/* --------------------------------------------------------------- the scoring */

function maxRule(value, limit) {
  if (!isNumber(limit)) return null;                       // rule not in use
  if (!isNumber(value)) return { ok: false, comfort: 0 };  // no data is not a pass
  if (limit <= 0) return { ok: value <= 0, comfort: value <= 0 ? 1 : 0 };
  return { ok: value <= limit, comfort: clamp((limit - value) / limit) };
}

function bandRule(value, band) {
  if (!band || !isNumber(band.min) || !isNumber(band.max)) return null;
  if (!isNumber(value)) return { ok: false, comfort: 0 };
  const { min, max } = band;
  if (max <= min) return { ok: value === min, comfort: value === min ? 1 : 0 };
  const half = (max - min) / 2;
  const middle = (max + min) / 2;
  return { ok: value >= min && value <= max, comfort: clamp((half - Math.abs(value - middle)) / half) };
}

function sunTimes(snapshot, offset) {
  const daily = snapshot.daily || {};
  const days = Array.isArray(daily.time) ? daily.time : [];
  const table = new Map();
  days.forEach((day, index) => {
    const rise = Array.isArray(daily.sunrise) ? daily.sunrise[index] : null;
    const set = Array.isArray(daily.sunset) ? daily.sunset[index] : null;
    table.set(day, {
      rise: typeof rise === 'string' ? localToEpoch(rise, offset) : NaN,
      set: typeof set === 'string' ? localToEpoch(set, offset) : NaN
    });
  });
  return table;
}

function scoreHours(snapshot, rules) {
  const hourly = snapshot.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const offset = isNumber(snapshot.utc_offset_seconds) ? snapshot.utc_offset_seconds : 0;
  const sun = sunTimes(snapshot, offset);
  const wantLight = String(rules.daylight || 'any').toLowerCase();
  const goldenMinutes = isNumber(rules.goldenHourMinutes) ? rules.goldenHourMinutes : 0;

  return times.map((stamp, index) => {
    const at = (name) => {
      const series = hourly[name];
      return Array.isArray(series) && index < series.length ? series[index] : null;
    };

    const temp = at('temperature_2m');
    const rainPct = at('precipitation_probability');
    const precip = at('precipitation');
    const gust = at('wind_gusts_10m');
    const dew = at('dew_point_2m');
    const cloud = at('cloud_cover');
    const isDay = at('is_day');
    const epoch = localToEpoch(stamp, offset);

    // Golden hour: within `goldenHourMinutes` of sunrise or of sunset, on the
    // hour's own calendar day in the forecast's zone.
    let light = isDay === 1 ? 'day' : 'night';
    let golden = false;
    const today = sun.get(typeof stamp === 'string' ? stamp.slice(0, 10) : '');
    if (today && goldenMinutes > 0 && Number.isFinite(today.rise) && Number.isFinite(today.set)) {
      const span = goldenMinutes * 60000;
      golden = (epoch >= today.rise && epoch <= today.rise + span) ||
               (epoch >= today.set - span && epoch <= today.set);
    }
    if (golden) light = 'golden';

    const checks = [
      { label: 'rain chance', result: maxRule(rainPct, rules.maxRainChancePct) },
      { label: 'rainfall', result: maxRule(precip, rules.maxPrecipMm) },
      { label: 'gusts', result: maxRule(gust, rules.maxGustKmh) },
      { label: 'temperature', result: bandRule(temp, rules.temperatureC) },
      { label: 'dew point', result: bandRule(dew, rules.dewPointC) }
    ];
    if (wantLight === 'daylight') {
      checks.push({ label: 'daylight', result: { ok: isDay === 1, comfort: isDay === 1 ? 1 : 0 } });
    } else if (wantLight === 'golden') {
      checks.push({ label: 'golden hour', result: { ok: golden, comfort: golden ? 1 : 0 } });
    }

    const active = checks.filter((check) => check.result !== null);
    const comforts = active.map((check) => check.result.comfort);
    const blocked = active.filter((check) => !check.result.ok).map((check) => check.label);
    const score = comforts.length
      ? Math.round(100 * comforts.reduce((sum, c) => sum + c, 0) / comforts.length)
      : 0;

    return {
      index, stamp, epoch, score, light,
      pass: blocked.length === 0,
      blocked, temp, rainPct, precip, gust, dew, cloud
    };
  });
}

function findWindows(rows, minHours) {
  const need = isNumber(minHours) && minHours > 0 ? Math.ceil(minHours) : 1;
  const windows = [];
  let run = [];
  const flush = () => {
    if (run.length >= need) {
      const scores = run.map((r) => r.score);
      windows.push({
        rows: run,
        hours: run.length,
        start: run[0],
        end: run[run.length - 1],
        best: Math.max(...scores),
        mean: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      });
    }
    run = [];
  };
  for (const row of rows) {
    if (row.pass) run.push(row);
    else flush();
  }
  flush();
  return windows;
}

/* ------------------------------------------------------------- reading files */

/* `hint` is the sentence after "is not valid JSON", and it differs by file:
   the forecast is overwritten by a machine, the rules by a person, and the
   two make different mistakes. */
async function readJson(url, name, hint) {
  let response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch (error) {
    return { error: `${name} could not be read. The file is missing, or this page was opened straight off the filesystem rather than served.` };
  }
  if (!response.ok) return { error: `${name} returned ${response.status}.` };
  try {
    return { value: await response.json() };
  } catch (error) {
    return { error: `${name} is not valid JSON. ${hint}` };
  }
}

function validate(snapshot) {
  const problems = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return ['data/snapshot.json is not an object.'];
  }
  if (snapshot.error) {
    const reason = String(snapshot.reason || 'no reason given').replace(/\.\s*$/, '');
    problems.push(`The weather service refused the request: ${reason}. The address the Shortcut fetched is wrong — check the latitude and longitude variables.`);
    return problems;
  }
  const hourly = snapshot.hourly;
  if (!hourly || typeof hourly !== 'object' || !Array.isArray(hourly.time) || hourly.time.length === 0) {
    problems.push('There is no hourly.time array, so this is not a forecast reply at all.');
    return problems;
  }
  const hours = hourly.time.length;
  for (const name of REQUIRED_HOURLY) {
    const series = hourly[name];
    if (!Array.isArray(series)) {
      problems.push(`hourly.${name} is missing — add it to the &hourly= list in the address the Shortcut fetches.`);
    } else if (series.length !== hours) {
      problems.push(`hourly.${name} has ${series.length} values for ${hours} hours.`);
    }
  }
  if (!isNumber(snapshot.utc_offset_seconds)) {
    problems.push('utc_offset_seconds is missing, so the forecast’s local times cannot be placed on a clock. Add &timezone=auto to the address.');
  }
  return problems;
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

/* ------------------------------------------------------------------ chrome */

function renderStamp(model) {
  if (!model || !model.stamp) {
    stampNode.textContent = 'Undated file';
    stampNode.classList.add('stale');
    return;
  }
  const { ms, kind } = model.stamp;
  // The header stamp is in the READER's time zone, because it answers "how old
  // is what I am looking at" — a question about the reader's own clock.
  const clock = new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const prefix = kind === 'exact' ? 'Updated ' : kind === 'about' ? 'About ' : 'Forecast from ';
  const ageHours = (Date.now() - ms) / 3600000;
  let text = prefix + clock;
  if (ageHours >= 24) text += ` · ${Math.round(ageHours / 24)}d old`;
  else if (ageHours >= 2) text += ` · ${Math.round(ageHours)}h old`;
  stampNode.textContent = text;
  stampNode.classList.toggle('stale', ageHours >= 6);
}

function renderPlace(model) {
  if (!model) { placeNode.textContent = ''; return; }
  const bits = [];
  if (model.place) bits.push(model.place);
  else if (isNumber(model.lat) && isNumber(model.lon)) bits.push(`${model.lat.toFixed(2)}, ${model.lon.toFixed(2)}`);
  if (model.tz) bits.push(model.tz.replace(/_/g, ' '));
  bits.push(model.rules.activity || 'Outdoors');
  placeNode.textContent = bits.join(' · ');
}

function renderTabs() {
  tabsNav.innerHTML = '';
  for (const tab of TABS) {
    const button = el('button', 'tab', tab.label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(state.tab === tab.id));
    button.addEventListener('click', () => {
      if (state.tab === tab.id) return;
      state.tab = tab.id;
      renderTabs();
      draw();
      window.scrollTo(0, 0);
    });
    tabsNav.append(button);
  }
}

function problemCard(title, problems, hint) {
  const card = el('div', 'card problem');
  card.append(el('h2', null, title));
  const list = el('ul');
  for (const problem of problems) list.append(el('li', null, problem));
  card.append(list);
  if (hint) card.append(el('p', 'small muted', hint));
  return card;
}

/* --------------------------------------------------------------- the strip */

function strip(model) {
  const card = el('div', 'card');
  const wrap = el('div', 'strip-wrap');

  const bars = el('div', 'strip');
  bars.setAttribute('role', 'group');
  bars.setAttribute('aria-label', 'The next hours, each scored');
  let previousDay = null;
  model.rows.forEach((row) => {
    const button = el('button', 'bar');
    button.type = 'button';
    const key = dayKey(row.epoch, model.offset);
    if (previousDay && key !== previousDay) button.classList.add('daybreak');
    previousDay = key;
    if (row.pass) button.classList.add('good');
    else if (row.score >= 60) button.classList.add('near');
    const fill = el('div', 'fill');
    fill.style.height = Math.max(6, row.score) + '%';
    button.append(fill);
    button.setAttribute('aria-pressed', String(state.selected === row.index));
    button.setAttribute(
      'aria-label',
      `${dayLabel(row.epoch, model.offset)} ${hhmm(row.epoch, model.offset)}, ` +
      `${row.pass ? 'good' : 'not good'}, score ${row.score}` +
      (row.blocked.length ? `, held back by ${row.blocked.join(' and ')}` : '')
    );
    button.addEventListener('click', () => {
      state.selected = row.index;
      draw();
    });
    bars.append(button);
  });
  wrap.append(bars);

  const axis = el('div', 'axis');
  const first = model.rows[0];
  const last = model.rows[model.rows.length - 1];
  axis.append(el('span', null, `${dayLabel(first.epoch, model.offset)} ${hhmm(first.epoch, model.offset)}`));
  axis.append(el('span', null, `${dayLabel(last.epoch, model.offset)} ${hhmm(last.epoch, model.offset)}`));
  wrap.append(axis);

  const chosen = model.rows.find((row) => row.index === state.selected) || model.rows[0];
  const readout = el('div', 'readout');
  readout.append(el('b', null, `${dayLabel(chosen.epoch, model.offset)} ${hhmm(chosen.epoch, model.offset)}`));
  readout.append(el('span', 'verdict ' + (chosen.pass ? 'good' : 'bad'),
    chosen.pass ? `good · ${chosen.score}` : (chosen.blocked.length ? chosen.blocked.join(', ') : 'no')));
  readout.append(el('span', null, `${num(chosen.temp, 0, model.units.temp)}`));
  readout.append(el('span', null, `rain ${num(chosen.rainPct, 0, '%')}`));
  readout.append(el('span', null, `gust ${num(chosen.gust, 0, ' ' + model.units.gust)}`));
  readout.append(el('span', null, `dew ${num(chosen.dew, 0, model.units.temp)}`));
  if (isNumber(chosen.cloud)) readout.append(el('span', null, `cloud ${num(chosen.cloud, 0, '%')}`));
  readout.append(el('span', null, chosen.light));
  wrap.append(readout);

  card.append(wrap);
  return card;
}

/* -------------------------------------------------------------- the panes */

function windowsPane(model) {
  const nodes = [];
  nodes.push(strip(model));

  if (model.windows.length === 0) {
    const card = el('div', 'card');
    card.append(el('h2', null, 'No window in the next ' + plural(model.rows.length, 'hour', 'hours')));
    card.append(el('p', null,
      `Nothing here clears every rule for ${plural(Math.ceil(model.rules.minWindowHours || 1), 'hour', 'hours')} together.`));
    const best = model.rows.reduce((a, b) => (b.score > a.score ? b : a), model.rows[0]);
    card.append(el('p', 'small muted',
      `The closest is ${dayLabel(best.epoch, model.offset)} ${hhmm(best.epoch, model.offset)}, scoring ${best.score}` +
      (best.blocked.length ? `, held back by ${best.blocked.join(' and ')}.` : '.')));
    nodes.push(card);
  } else {
    const next = model.windows[0];
    const hero = el('div', 'card hero');
    // When every hour has already happened (a sample past its date, or a loop
    // that stopped) the best stretch in the file is not a "next" anything.
    hero.append(el('h2', null, model.ranOut
      ? (model.place ? 'Best window in this sample' : 'Best window in this file')
      : 'Next window'));
    hero.append(el('div', 'when',
      `${hhmm(next.start.epoch, model.offset)}–${hhmm(next.end.epoch + 3600000, model.offset)}`));
    hero.append(el('div', 'day', dayOf(next, model)));
    hero.append(el('span', 'length', plural(next.hours, 'hour', 'hours') + ` · best ${next.best}`));

    const stats = el('div', 'stats');
    stats.append(stat('warmest', num(maxOf(next.rows, 'temp'), 0, model.units.temp)));
    stats.append(stat('rain', num(maxOf(next.rows, 'rainPct'), 0, '%')));
    stats.append(stat('gust', num(maxOf(next.rows, 'gust'), 0)));
    stats.append(stat('dew', num(maxOf(next.rows, 'dew'), 0, model.units.temp)));
    hero.append(stats);
    nodes.push(hero);

    if (model.windows.length > 1) {
      const later = el('div', 'card');
      later.append(el('h2', null, 'After that'));
      const list = el('ul', 'rows');
      for (const window of model.windows.slice(1)) {
        const row = el('li');
        row.append(el('span', 'lead',
          `${dayOf(window, model)} ${hhmm(window.start.epoch, model.offset)}–${hhmm(window.end.epoch + 3600000, model.offset)}`));
        row.append(el('span', 'trail', `${plural(window.hours, 'hour', 'hours')} · best ${window.best}`));
        list.append(row);
      }
      later.append(list);
      nodes.push(later);
    }
  }

  // Which rule is actually costing you hours. This is the question a person
  // asks second, right after "when can I go out", and the reason the rules are
  // editable at all.
  const blockers = new Map();
  for (const row of model.rows) {
    for (const label of row.blocked) blockers.set(label, (blockers.get(label) || 0) + 1);
  }
  const ruled = el('div', 'card');
  ruled.append(el('h2', null, 'What ruled hours out'));
  if (blockers.size === 0) {
    ruled.append(el('p', null, 'Nothing. Every hour in the forecast clears every rule.'));
  } else {
    const list = el('ul', 'rows');
    [...blockers.entries()].sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
      const row = el('li');
      row.append(el('span', 'lead', label));
      row.append(el('span', 'trail', `${count} of ${model.rows.length} hours`));
      list.append(row);
    });
    ruled.append(list);
    ruled.append(el('p', 'small muted',
      'An hour can fail more than one rule, so these add up to more than the hours lost.'));
  }
  nodes.push(ruled);
  return nodes;
}

function dayOf(window, model) {
  const startDay = dayLabel(window.start.epoch, model.offset);
  const endDay = dayLabel(window.end.epoch, model.offset);
  const span = startDay === endDay ? startDay : `${startDay} – ${endDay}`;
  // "Mon 21" is enough for a forecast, and nowhere near enough for a file whose
  // hours are all in the past — which month, which year? Only then, and only
  // here, is the full date worth the width.
  return model.ranOut ? `${span} ${monthYear(window.end.epoch, model.offset)}` : span;
}

function monthYear(epoch, offset) {
  const d = atPlace(epoch, offset);
  return MONTH_NAMES[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

function maxOf(rows, key) {
  const values = rows.map((row) => row[key]).filter(isNumber);
  return values.length ? Math.max(...values) : null;
}

function stat(key, value) {
  const node = el('div', 'stat');
  node.append(el('span', 'k', key));
  node.append(el('span', 'v', value));
  return node;
}

function hoursPane(model) {
  const nodes = [strip(model)];
  const card = el('div', 'card table');
  const list = el('ul', 'hours');

  const head = el('li', 'head');
  ['time', '', model.units.temp.trim() || 'temp', 'rain', 'gust', 'dew'].forEach((label, i) => {
    head.append(el('span', i >= 2 ? 'n' : (i === 0 ? 't' : 'light'), label));
  });
  list.append(head);

  let previousDay = null;
  for (const row of model.rows) {
    const key = dayKey(row.epoch, model.offset);
    if (key !== previousDay) {
      list.append(el('li', 'daylabel', dayLabel(row.epoch, model.offset)));
      previousDay = key;
    }
    const item = el('li', 'hour' + (row.pass ? ' good' : ''));
    item.append(el('span', 't', hhmm(row.epoch, model.offset)));
    item.append(el('span', 'light', row.light === 'golden' ? 'golden' : row.light === 'day' ? 'day' : 'night'));
    item.append(el('span', 'n', num(row.temp, 0)));
    item.append(el('span', 'n', num(row.rainPct, 0, '%')));
    item.append(el('span', 'n', num(row.gust, 0)));
    item.append(el('span', 'n', num(row.dew, 0)));
    if (!row.pass && row.blocked.length) {
      item.append(el('span', 'why', row.blocked.join(' · ')));
    }
    list.append(item);
  }
  card.append(list);
  nodes.push(card);

  const legend = el('div', 'card');
  legend.append(el('h2', null, 'Reading this'));
  legend.append(el('p', 'small',
    `Highlighted hours clear every rule. The line under an hour names the rules it failed. ` +
    `Gust is ${model.units.gust}, rain is the chance of any rain in the hour, dew point is ${model.units.temp.trim() || 'degrees'} — ` +
    `above about 16 it feels muggy, below about −5 it feels sharp.`));
  nodes.push(legend);
  return nodes;
}

function rulesPane(model) {
  const nodes = [];
  const rules = model.rules;

  const card = el('div', 'card');
  card.append(el('h2', null, 'What counts as a good hour'));
  card.append(el('p', 'activity', rules.activity || 'Outdoors'));
  const dl = el('div', 'dl');

  const item = (name, value, note) => {
    const row = el('div', 'item');
    row.append(el('span', 'name', name));
    row.append(el('span', 'val', value));
    if (note) row.append(el('span', 'note', note));
    dl.append(row);
  };

  item('Rain chance', isNumber(rules.maxRainChancePct) ? `≤ ${rules.maxRainChancePct}%` : 'not used',
    'maxRainChancePct — the forecast chance of any rain in the hour');
  item('Rainfall', isNumber(rules.maxPrecipMm) ? `≤ ${rules.maxPrecipMm} mm` : 'not used',
    'maxPrecipMm — how much is expected to fall');
  item('Gusts', isNumber(rules.maxGustKmh) ? `≤ ${rules.maxGustKmh} ${model.units.gust}` : 'not used',
    'maxGustKmh — gusts, not the average wind, because gusts are what you feel');
  item('Temperature', rules.temperatureC && isNumber(rules.temperatureC.min)
    ? `${rules.temperatureC.min} to ${rules.temperatureC.max}${model.units.temp}` : 'not used', 'temperatureC');
  item('Dew point', rules.dewPointC && isNumber(rules.dewPointC.min)
    ? `${rules.dewPointC.min} to ${rules.dewPointC.max}${model.units.temp}` : 'not used',
    'dewPointC — muggy above, raw below; a better guide to comfort than temperature alone');
  item('Light', rules.daylight === 'golden' ? `golden hour, ${rules.goldenHourMinutes || 0} min`
    : rules.daylight === 'daylight' ? 'daylight only' : 'any hour',
    'daylight — "any", "daylight" or "golden"');
  item('Shortest window', plural(Math.ceil(rules.minWindowHours || 1), 'hour', 'hours'),
    'minWindowHours — a run of good hours shorter than this is not offered');
  card.append(dl);
  nodes.push(card);

  const how = el('div', 'card');
  how.append(el('h2', null, 'Changing them'));
  how.append(el('p', null, 'The rules are a file inside this app, not a setting buried in it.'));
  const steps = el('ul', 'rows');
  [
    ['In Snuggery: ⋯ → App Files', 'data/rules.json'],
    ['Edit the numbers, save', 'any rule you leave out is simply not applied'],
    ['Come back here', 'the app re-reads both files every time it comes into view']
  ].forEach(([lead, trail]) => {
    const row = el('li');
    row.append(el('span', 'lead', lead));
    row.append(el('span', 'trail', trail));
    steps.append(row);
  });
  how.append(steps);
  nodes.push(how);

  const data = el('div', 'card');
  data.append(el('h2', null, 'Where the forecast comes from'));
  data.append(el('p', null, model.place
    ? `This copy is showing ${model.place}.`
    : 'This copy is showing the coordinates in the file.'));
  data.append(el('p', 'small muted',
    'A Shortcut on the phone asks for your location, fetches the forecast for it and writes it into this app. ' +
    'Nothing here goes online, and the location is never written back to any repository. PROMPT.md has the recipe.'));
  data.append(el('p', 'small muted', model.hasAsk
    ? 'This file carries an ask table, so Snuggery’s Ask About This Data can answer questions about these hours.'
    : 'This file came straight from the weather service, so it has no ask table in it and Snuggery’s Ask has only the raw file to read. PROMPT.md explains what to add if you want that.'));
  nodes.push(data);

  const more = el('div', 'card');
  more.append(el('h2', null, 'Not built, on purpose'));
  more.append(el('p', 'small muted',
    'Air quality is the obvious next rule group — the same service has an air-quality endpoint with PM2.5, ' +
    'pollen and a European AQI, on the same shape of reply. It is left out so the app stays one fetch and one file. ' +
    'NOTES.md says what adding it would take: a second rule group, a second fetch in the Shortcut, and one more ' +
    'set of checks in the scorer.'));
  nodes.push(more);
  return nodes;
}

/* ---------------------------------------------------------------- drawing */

function draw() {
  const y = window.scrollY;
  main.innerHTML = '';
  const model = state.model;
  if (!model) return;

  // Both of these are reasons not to trust what follows, so they sit above
  // every pane rather than on whichever one happens to be open.
  // `demoPlace` is written only by the script that makes the shipped sample, so
  // its presence says "this is example data" — and it says so from the first
  // launch, not only once the forecast has expired. A fresh copy showing a
  // confident window over somewhere the reader has never been should say where
  // that came from while the window is still in the future.
  if (model.place) {
    main.append(el('div', 'notice', model.ranOut
      ? `This is the sample this app shipped with: a real 48 hours over ${model.place}, now in the past. ` +
        'Everything below is working — it is just showing a forecast that has expired. ' +
        'Build the shortcut in PROMPT.md and it will show where you are instead.'
      : `This is the sample this app shipped with: a real forecast for ${model.place}. ` +
        'Build the shortcut in PROMPT.md and it will show where you are instead.'));
  } else if (model.ranOut) {
    // No `demoPlace`, every hour in the past: this is somebody's own data, and
    // the loop that refreshes it has stopped. A different thing to say.
    main.append(el('div', 'notice',
      'Every hour in this file is already in the past, so what follows is history, not a forecast. Run the shortcut that refreshes this app.'));
  }
  if (model.rulesProblem) {
    main.append(el('div', 'notice',
      model.rulesProblem + ' The built-in rules are being used instead — the Rules pane shows which.'));
  }

  const pane = state.tab === 'hours' ? hoursPane(model)
    : state.tab === 'rules' ? rulesPane(model)
    : windowsPane(model);
  for (const node of pane) main.append(node);
  window.scrollTo(0, y);
}

function showProblem(title, problems, hint) {
  state.model = null;
  main.innerHTML = '';
  main.append(problemCard(title, problems, hint));
  stampNode.textContent = 'No data';
  stampNode.classList.add('stale');
  placeNode.textContent = '';
}

async function load() {
  const [snapshotRead, rulesRead] = await Promise.all([
    // By far the commonest cause of an unreadable snapshot, and worth naming:
    // a fetch that failed upstream still returns valid text, and the Shortcut
    // writes it here without complaint.
    readJson(SNAPSHOT_URL, 'data/snapshot.json',
      'Something replaced it with text — an error page from the weather service, most likely, which a Shortcut copies over good data without noticing.'),
    readJson(RULES_URL, 'data/rules.json',
      'A trailing comma or a missing quote will do it: JSON allows neither, nor comments.')
  ]);

  if (snapshotRead.error) {
    return showProblem('Could not read the forecast', [snapshotRead.error],
      'Open the file in Snuggery — ⋯ → App Files — and look at what is actually in it.');
  }

  const snapshot = snapshotRead.value;
  const problems = validate(snapshot);
  if (problems.length) {
    return showProblem('The forecast file is not the shape this app expects', problems,
      'An error reply is valid JSON too. The address the Shortcut fetches is in PROMPT.md; compare it with the one in the Shortcut.');
  }

  let rules = rulesRead.value;
  let rulesProblem = null;
  if (rulesRead.error || !rules || typeof rules !== 'object' || Array.isArray(rules)) {
    rulesProblem = rulesRead.error || 'data/rules.json is not an object.';
    rules = DEFAULT_RULES;
  }

  const offset = isNumber(snapshot.utc_offset_seconds) ? snapshot.utc_offset_seconds : 0;
  const units = {
    temp: (snapshot.hourly_units && snapshot.hourly_units.temperature_2m) || '°',
    gust: (snapshot.hourly_units && snapshot.hourly_units.wind_gusts_10m) || 'km/h'
  };

  const all = scoreHours(snapshot, rules);
  // Hours that have already happened are dropped: a file fetched at local
  // midnight carries the whole day, and a window that closed this morning is
  // not an answer to "when can I go out".
  const now = Date.now();
  let rows = all.filter((row) => Number.isFinite(row.epoch) && row.epoch + 3600000 > now);
  let ranOut = false;
  if (rows.length === 0) { rows = all; ranOut = true; }

  const model = {
    snapshot, rules, rulesProblem, offset, units, rows,
    windows: findWindows(rows, rules.minWindowHours),
    stamp: timestampOf(snapshot, offset),
    lat: snapshot.latitude, lon: snapshot.longitude,
    tz: typeof snapshot.timezone === 'string' ? snapshot.timezone : null,
    place: typeof snapshot.demoPlace === 'string' ? snapshot.demoPlace : null,
    hasAsk: Array.isArray(snapshot.ask) && snapshot.ask.length > 0,
    ranOut
  };
  if (state.selected === null || !model.rows.some((row) => row.index === state.selected)) {
    state.selected = model.windows.length ? model.windows[0].start.index : model.rows[0].index;
  }
  state.model = model;

  renderStamp(model);
  renderPlace(model);
  renderTabs();
  draw();
}

renderTabs();
load();

/* Reads come fresh off disk, so re-reading when the page comes back into view
   is what makes an app opened this morning show this morning's forecast.
   Snuggery fires the same event when a Shortcut delivers new data while the
   app is open — which is why this redraws in place, keeping the open pane and
   the scroll position, rather than rebuilding the page. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load();
});
