/* Power Hours — Snuggery mini-app.
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
 *   "generatedAt": "2026-09-21T09:24:24Z",  // ISO 8601 UTC — when the job ran
 *   "zone": "NO2", "zoneName": "Norway south-west",
 *   "timezone": "Europe/Oslo",              // the calendar the market settles on
 *   "unit": "EUR/MWh",                      // the source's unit, unconverted
 *   "resolutionMinutes": 15,                // length of one hours[] entry
 *   "source": {
 *     "name": "Energy-Charts, Fraunhofer ISE",
 *     "endpoint": "https://api.energy-charts.info/price",
 *     "licence": "CC BY 4.0 from Bundesnetzagentur | SMARD.de",
 *     "licenceInfo": "CC BY 4.0 (creativecommons.org/licenses/by/4.0) from …",
 *                                           // what the API said about THIS
 *                                           // answer; preferred over `licence`
 *                                           // in the footer, absent in --demo
 *     "publishable": true,                  // false ⇒ this zone is private use
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
 *
 *   "hours": [{"start":"2026-09-21T00:00:00+02:00","price":18.71}],
 *                                           // local ISO with offset, ascending.
 *                                           // One entry per MARKET INTERVAL —
 *                                           // resolutionMinutes says how long
 *                                           // that is. The European day-ahead
 *                                           // market settles in 15-minute
 *                                           // intervals, so a day is 96 entries
 *                                           // and not 24; an hourly zone gives
 *                                           // 24 and everything below still
 *                                           // works.
 *
 *   "lastGood": null,                       // or {"generatedAt","days","hours"}
 *                                           // when the job fetched NOTHING at
 *                                           // all: this app draws that curve
 *                                           // and stamps it stale, because a
 *                                           // day-old price is worth more than
 *                                           // an error where a price should be
 *
 *   "ask": [ ... ]                          // flat rows for Snuggery's Ask.
 *                                           // NEVER read by this app — it is a
 *                                           // table for questions in words, and
 *                                           // the numbers below are computed
 *                                           // here from hours[] instead.
 * }
 *
 * ---------------------------------------------------------------------------
 * SHAPE OF ./data/appliances.json — the file a person edits
 * ---------------------------------------------------------------------------
 *   {"schema": 1, "appliances": [{"name": "Dishwasher", "hours": 2}, ...]}
 *
 * Editable in Snuggery: the app's ⋯ menu → App Files. `hours` is how long the
 * appliance runs; fractions are fine. The refresh job never overwrites this
 * file, so an edit on the phone survives every data refresh.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DRAWS, AND AT WHAT RESOLUTION
 * ---------------------------------------------------------------------------
 * The chart shows one bar per CLOCK HOUR — the mean of the intervals inside it
 * — because 96 hairlines on a 390-point phone is a texture, not a chart. The
 * cheapest-window search runs at the market's own resolution, so a 90-minute
 * wash can start at a quarter past and the bracket under the chart says so.
 *
 * Prices are the day-ahead spot price only. The header states the unit; a
 * source in EUR/MWh is shown as euro-cents per kWh (÷10), which is the number
 * on a household tariff. Grid rent, tax and VAT are not in here and are usually
 * the larger half of a bill.
 */

/* ------------------------------------------------------------------ escape */

/** Nothing below sends a data value through innerHTML — values go through
 *  textContent, and the few interpolated templates go through here first. */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* ------------------------------------------------------------------- state */

const FALLBACK_APPLIANCES = [
  { name: 'Dishwasher', hours: 2 },
  { name: 'Washing machine', hours: 1.5 },
  { name: 'Car charging', hours: 4 },
  { name: 'Tumble dryer', hours: 2 },
];

const state = {
  day: null,        // the open tab's date, kept across a re-render
  appliance: 0,     // which appliance's window is highlighted
  hour: null,       // the inspected bar, or null
};

let DATA = null;
let APPLIANCES = FALLBACK_APPLIANCES;
let APPLIANCE_NOTE = '';

const stampEl = document.getElementById('stamp');
const zoneEl = document.getElementById('zone');
const tabsEl = document.getElementById('tabs');
const mainEl = document.getElementById('main');
const footEl = document.getElementById('foot');

/* ------------------------------------------------------------------ helpers */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const svgEl = (tag, attrs) => {
  // The only http:// string in this app. It is the SVG XML namespace, which is
  // an identifier and not an address: createElementNS compares it as a string
  // and nothing ever fetches it. There is no external URL in this app.
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  return node;
};

/** The source unit, and what to show instead. EUR/MWh is the market's unit and
 *  a meaningless number on a kitchen worktop; euro-cents per kWh is the one a
 *  tariff is quoted in. Anything else is shown exactly as it arrived. */
function units(data) {
  const raw = String(data.unit || '').replace(/\s+/g, '');
  if (/^EUR\/MWh$/i.test(raw)) return { factor: 0.1, label: 'c/kWh', source: 'EUR/MWh', digits: 1 };
  return { factor: 1, label: data.unit || '', source: data.unit || '', digits: 2 };
}

/** A price in the display unit, with a real minus sign — negative day-ahead
 *  prices are ordinary now, and a hyphen reads as a dash beside a range. */
const money = (value, u) => (value * u.factor).toFixed(u.digits).replace('-', '\u2212');

/* ---------------------------------------------------------------- validate */

/** Names what is wrong instead of drawing an empty chart. An expired token or
 *  a rate-limited API answers with something that is perfectly valid JSON, and
 *  the Shortcut writes it straight over this file. */
function validate(data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['The file is not a JSON object.'];
  }
  if (typeof data.generatedAt !== 'string' || Number.isNaN(Date.parse(data.generatedAt))) {
    problems.push('No usable `generatedAt` — the app cannot tell how old this is.');
  }
  const curve = curveOf(data);
  if (!curve.length) {
    problems.push('No prices: `hours` is empty and there is no `lastGood` curve to fall back on.');
  } else {
    const bad = curve.filter((h) => !h || typeof h.price !== 'number' || Number.isNaN(Date.parse(h.start)));
    if (bad.length) {
      problems.push(`${bad.length} of ${curve.length} price entries have no numeric \`price\` or no parseable \`start\`.`);
    }
  }
  if (data.schema !== undefined && data.schema !== 1) {
    problems.push(`This app reads schema 1; the file says schema ${esc(data.schema)}.`);
  }
  return problems;
}

/** The curve to draw: this run's, or the last good one the job kept. */
const curveOf = (data) => {
  const fresh = Array.isArray(data.hours) ? data.hours : [];
  if (fresh.length) return fresh;
  const kept = data.lastGood && Array.isArray(data.lastGood.hours) ? data.lastGood.hours : [];
  return kept;
};

const usingLastGood = (data) => !((Array.isArray(data.hours) && data.hours.length));

/* ------------------------------------------------------------------- model */

/* TIME, AND WHY THIS APP NEVER ASKS THE PHONE WHAT DAY IT IS.
 *
 * A bidding zone settles on its own calendar, and the phone reading this may
 * not be on it — a Norwegian in Lisbon still wants NO2's midnight-to-midnight
 * day. Every `start` in hours[] carries its own UTC offset, so the zone's wall
 * clock is read straight out of the string (`2026-09-21T00:00:00+02:00` is the
 * 21st at 00:00 in the zone, whatever the phone thinks), and Date is used only
 * where an absolute instant is the right comparison: is this the interval we
 * are inside now, has this hour already gone. The one deliberate exception is
 * the `Updated HH:MM` stamp, which is the READER's clock: it answers "how old
 * is this?", and that question is asked from wherever they are standing.
 */

const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/** One price interval: the zone's wall clock as fields, plus the instant. */
function toPoint(entry) {
  if (!entry || typeof entry.price !== 'number' || !Number.isFinite(entry.price)) return null;
  const parts = ISO_LOCAL.exec(String(entry.start));
  const at = new Date(entry.start);
  if (!parts || Number.isNaN(at.getTime())) return null;
  return {
    at,
    date: `${parts[1]}-${parts[2]}-${parts[3]}`,
    h: Number(parts[4]),
    mi: Number(parts[5]),
    price: entry.price,
  };
}

const pad2 = (n) => String(n).padStart(2, '0');
const clockOf = (point) => `${pad2(point.h)}:${pad2(point.mi)}`;

/** A wall-clock label `minutes` after a point, wrapping past midnight. */
function clockAfter(point, minutes) {
  const total = (point.h * 60 + point.mi + minutes) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** hours[] grouped by the ZONE's calendar day, each with its intervals, its
 *  hourly means, its mean and a cheapest-first rank per hour. */
function model(data) {
  const points = curveOf(data).map(toPoint).filter(Boolean).sort((a, b) => a.at - b.at);

  const stepMs = (() => {
    if (points.length < 2) return 3600000;
    const gaps = points.slice(1).map((p, i) => p.at - points[i].at).filter((g) => g > 0).sort((a, b) => a - b);
    return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 3600000;
  })();

  const byDate = new Map();
  for (const point of points) {
    if (!byDate.has(point.date)) byDate.set(point.date, []);
    byDate.get(point.date).push(point);
  }

  const meta = new Map((Array.isArray(data.days) ? data.days : []).map((d) => [d.date, d]));
  const days = [...byDate.entries()].map(([date, own]) => {
    const hours = hourlyMeans(own);
    const prices = own.map((p) => p.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const order = hours.map((_, i) => i).sort((a, b) => hours[a].price - hours[b].price);
    // min/max describe the bars, which are hourly means — quoting the extremes
    // of the 15-minute intervals beside an axis drawn from hourly ones puts two
    // different maxima on the same card.
    const drawn = hours.map((h) => h.price);
    return {
      date,
      label: (meta.get(date) || {}).label || weekday(date),
      sub: weekday(date),
      source: (meta.get(date) || {}).source || 'fetched',
      points: own, hours, mean, stepMs,
      rank: new Map(order.map((i, n) => [i, n + 1])),
      min: Math.min(...drawn), max: Math.max(...drawn),
    };
  });

  // A day the job knows about but has no prices for — tomorrow, before the
  // auction publishes. It gets a tab that says why, not a silent absence.
  for (const d of (Array.isArray(data.days) ? data.days : [])) {
    if (!byDate.has(d.date)) {
      days.push({
        date: d.date, label: d.label || weekday(d.date), sub: weekday(d.date),
        source: d.source || 'pending', note: d.note,
        points: [], hours: [], mean: 0, stepMs, rank: new Map(), min: 0, max: 0,
      });
    }
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { days, stepMs };
}

/** "Mon 21 Sep" for a plain YYYY-MM-DD, formatted without letting the phone's
 *  timezone move the date (noon UTC, read back as UTC). */
function weekday(date) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function hourlyMeans(points) {
  const buckets = new Map();
  for (const p of points) {
    if (!buckets.has(p.h)) buckets.set(p.h, []);
    buckets.get(p.h).push(p.price);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, prices]) => ({ hour, price: prices.reduce((a, b) => a + b, 0) / prices.length }));
}

/** The cheapest contiguous run of `runHours`, searched at the market's own
 *  resolution. Returns {startPoint, intervals, mean} or null when the day is
 *  shorter than the run. */
function cheapestWindow(points, stepMs, runHours) {
  const need = Math.max(1, Math.ceil((runHours * 3600000) / stepMs));
  if (points.length < need) return null;
  let running = 0;
  for (let i = 0; i < need; i += 1) running += points[i].price;
  let best = running;
  let at = 0;
  for (let i = 1; i <= points.length - need; i += 1) {
    running += points[i + need - 1].price - points[i - 1].price;
    if (running < best - 1e-9) { best = running; at = i; }
  }
  return { startPoint: points[at], lastPoint: points[at + need - 1], intervals: need, mean: best / need };
}

const windowLabel = (w, stepMs) => `${clockOf(w.startPoint)}–${clockAfter(w.lastPoint, stepMs / 60000)}`;

/** The stretch of the day a window may still start in. On the day we are
 *  inside, that is from the current interval onwards: the cheapest two hours
 *  of the day are no use if they ended before breakfast. On any other day it
 *  is the whole day. */
function plannable(day) {
  const now = Date.now();
  const index = day.points.findIndex((p) => now < p.at.getTime() + day.stepMs);
  if (index <= 0) return { points: day.points, fromNow: false };
  if (index >= day.points.length) return { points: [], fromNow: true };
  return { points: day.points.slice(index), fromNow: true };
}

/* ------------------------------------------------------------------- render */

function render() {
  const scroll = window.scrollY;
  mainEl.replaceChildren();
  footEl.replaceChildren();

  const problems = validate(DATA);
  if (problems.length) { renderProblem(problems); return; }

  const m = model(DATA);
  const u = units(DATA);

  if (!m.days.some((d) => d.date === state.day && d.points.length)) {
    const first = m.days.find((d) => d.points.length);
    state.day = first ? first.date : ((m.days[0] || {}).date || null);
  }
  const day = m.days.find((d) => d.date === state.day) || m.days[0];

  renderHeader(u);
  renderTabs(m);

  if (!day || !day.points.length) {
    renderPending(day);
    renderFoot();
    window.scrollTo(0, scroll);
    return;
  }

  if (usingLastGood(DATA)) {
    const kept = el('div', 'card warnbar');
    kept.textContent = 'The last refresh could not reach the price service, so this is the curve it kept '
      + 'from the run before. Nothing is wrong with the app — the numbers are simply older than they look.';
    mainEl.append(kept);
  } else if (day.source === 'carried') {
    const carried = el('div', 'card warnbar');
    carried.textContent = `${day.label}'s prices were kept from an earlier run; the last refresh did not get them.`;
    mainEl.append(carried);
  }

  const plan = plannable(day);
  const appliance = APPLIANCES[Math.min(state.appliance, APPLIANCES.length - 1)] || null;
  const chosen = appliance ? cheapestWindow(plan.points, day.stepMs, appliance.hours) : null;

  renderNow(day, u);
  renderChart(day, u, chosen, plan);
  renderAppliances(day, u, plan);
  renderNotes(u);
  renderFoot();

  window.scrollTo(0, scroll);
}

function renderHeader(u) {
  // When the job fetched nothing, the stamp should age the PRICES, not the
  // file: "updated two minutes ago" over a day-old curve is the one lie this
  // app must not tell.
  const stale = usingLastGood(DATA);
  const from = stale && DATA.lastGood && DATA.lastGood.generatedAt
    ? DATA.lastGood.generatedAt : DATA.generatedAt;
  const when = new Date(from);
  const ageHours = (Date.now() - when.getTime()) / 3600000;
  stampEl.textContent = Number.isNaN(when.getTime())
    ? 'Updated ?' : `Updated ${pad2(when.getHours())}:${pad2(when.getMinutes())}`;
  stampEl.className = 'stamp' + (stale || ageHours > 14 || ageHours < -1 ? ' stale' : '');
  stampEl.title = Number.isNaN(when.getTime()) ? '' : when.toLocaleString();

  const named = DATA.zoneName && DATA.zoneName !== DATA.zone ? ` · ${DATA.zoneName}` : '';
  zoneEl.textContent = `${DATA.zone || 'zone ?'}${named} · day-ahead spot, ${u.label}`;
}

function renderTabs(m) {
  tabsEl.replaceChildren();
  for (const day of m.days) {
    const button = el('button');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(day.date === state.day));
    button.append(document.createTextNode(day.label));
    if (day.points.length) {
      button.append(el('span', 'sub', day.sub));
      button.addEventListener('click', () => { state.day = day.date; state.hour = null; render(); });
    } else {
      button.disabled = true;
      button.append(el('span', 'sub', 'not published yet'));
    }
    tabsEl.append(button);
  }
}

function renderPending(day) {
  const card = el('div', 'card');
  card.append(el('h2', null, day ? day.label : 'No prices'));
  card.append(el('p', 'note', day && day.note
    ? `${day.note}. Tomorrow's curve is set by an auction that publishes in the early afternoon, `
      + 'so it appears on the refresh after that.'
    : 'No prices for this day yet.'));
  mainEl.append(card);
}

/* ---------------------------------------------------------------- right now */

/** The interval we are inside, by absolute instant — which is the one
 *  comparison that is right in every timezone. */
const currentPoint = (day) => day.points.find(
  (p) => Date.now() >= p.at.getTime() && Date.now() < p.at.getTime() + day.stepMs,
);

function renderNow(day, u) {
  const current = currentPoint(day);
  if (!current) return;
  const index = day.hours.findIndex((h) => h.hour === current.h);
  const rank = day.rank.get(index);

  const card = el('div', 'card');
  card.append(el('h2', null, 'Right now'));
  const line = el('div', 'now');
  line.append(el('span', 'big', money(current.price, u)));
  line.append(el('span', 'unit', u.label));
  if (rank) {
    const total = day.hours.length;
    const quarter = Math.ceil(total / 4);
    line.append(el('span', 'rank', `${ordinal(rank)} cheapest hour of ${total}`));
    const cheap = rank <= quarter;
    const dear = rank > total - quarter;
    line.append(el('span', 'badge' + (cheap ? ' cheap' : dear ? ' dear' : ''),
      cheap ? 'cheap' : dear ? 'expensive' : 'middling'));
  }
  card.append(line);
  card.append(el('p', 'note', `The day's mean is ${money(day.mean, u)} ${u.label}.`));
  mainEl.append(card);
}

const ordinal = (n) => {
  const tails = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (tails[(v - 20) % 10] || tails[v] || tails[0]);
};

/* -------------------------------------------------------------------- chart */

const W = 360, H = 132, PAD_L = 28, PAD_R = 6, PAD_T = 10, PAD_B = 19;

function renderChart(day, u, chosen, plan) {
  const card = el('div', 'card');
  const hours = day.hours;

  const head = el('div', 'chart-head');
  const readout = el('p', 'readout');
  const index = state.hour === null ? -1 : hours.findIndex((h) => h.hour === state.hour);
  if (index >= 0) {
    readout.append(document.createTextNode(`${pad2(hours[index].hour)}:00 · `));
    readout.append(el('b', null, `${money(hours[index].price, u)} ${u.label}`));
    readout.append(document.createTextNode(` · ${ordinal(day.rank.get(index))} cheapest`));
  } else {
    readout.textContent = 'Tap an hour to read it';
  }
  head.append(readout);
  head.append(el('span', 'note', `${money(day.min, u)}–${money(day.max, u)}`));
  card.append(head);

  const prices = hours.map((h) => h.price);
  const top = Math.max(...prices, day.mean);
  const bottom = Math.min(...prices, 0);
  const span = (top - bottom) || 1;
  const y = (value) => PAD_T + (H - PAD_T - PAD_B) * (1 - (value - bottom) / span);
  const plotW = W - PAD_L - PAD_R;
  const slot = plotW / hours.length;
  const barW = Math.max(3, slot - 2);           // a 2 px surface gap between bars

  // Slots are sized by how many hours there ARE, so everything is placed by an
  // hour's INDEX and never by (hour - first hour). A day is not always 24
  // contiguous hours: spring forward has no 02:00 in this zone, and an hour
  // whose prices were all null is dropped before it gets here. Mixing the two
  // measures pushes the last bar and its tap target off the right-hand edge on
  // exactly those days.
  const xOf = (index) => PAD_L + index * slot;

  /** A wall-clock time in this zone as a fractional slot index. */
  const posOf = (hour, minute) => {
    const i = hours.findIndex((h) => h.hour === hour);
    if (i >= 0) return i + (minute || 0) / 60;
    const after = hours.findIndex((h) => h.hour > hour);   // an hour the day lacks
    return after < 0 ? hours.length : after;
  };

  const svg = svgEl('svg', {
    class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `${day.label}: price per hour in ${u.label}, `
      + `from ${money(day.min, u)} to ${money(day.max, u)}, mean ${money(day.mean, u)}`,
  });

  const zeroY = y(0);
  if (bottom < 0) {
    svg.append(svgEl('line', { class: 'zeroline', x1: PAD_L - 3, x2: W - PAD_R, y1: zeroY, y2: zeroY }));
    svg.append(text(PAD_L - 5, zeroY + 3, '0', 'end', 'axis-y'));
  }
  const meanY = y(day.mean);
  svg.append(svgEl('line', { class: 'meanline', x1: PAD_L, x2: W - PAD_R, y1: meanY, y2: meanY }));
  svg.append(text(PAD_L - 5, meanY + 3, money(day.mean, u), 'end', 'axis-y'));
  if (Math.abs(meanY - y(top)) > 11) svg.append(text(PAD_L - 5, y(top) + 3, money(top, u), 'end', 'axis-y'));

  // Where the chosen window sits, in slot indices.
  let from = -1, to = -1;
  if (chosen) {
    from = posOf(chosen.startPoint.h, chosen.startPoint.mi);
    const endMinutes = chosen.lastPoint.h * 60 + chosen.lastPoint.mi + day.stepMs / 60000;
    to = endMinutes >= 1440
      ? hours.length                                       // it runs to midnight
      : posOf(Math.floor(endMinutes / 60), endMinutes % 60);
    if (to <= from) to = Math.min(hours.length, from + (chosen.intervals * day.stepMs) / 3600000);
  }

  hours.forEach((h, i) => {
    const left = i;
    const inWindow = chosen && left + 1 > from + 1e-9 && left < to - 1e-9;
    // Rounded at the data end only. A bar rounded at the baseline too floats
    // off its own axis, which is the one thing a bar must not do.
    svg.append(svgEl('path', {
      class: 'bar' + (inWindow ? ' win' : ''),
      d: barPath(xOf(left) + (slot - barW) / 2, y(h.price), barW, zeroY, Math.min(3, barW / 2.5)),
    }));
  });

  // The window is marked by a rule along the baseline and its own times, not
  // by a full-height band: a tall block behind three short bars reads as a
  // very tall bar, which is the opposite of what it means.
  if (chosen) {
    const ruleY = H - PAD_B + 3;
    svg.append(svgEl('rect', {
      class: 'window-rule', x: xOf(from), y: ruleY - 1.5,
      width: Math.max(3, (to - from) * slot), height: 3, rx: 1.5,
    }));
    const mid = xOf((from + to) / 2);
    const label = windowLabel(chosen, day.stepMs);
    svg.append(text(
      Math.max(PAD_L + 32, Math.min(W - PAD_R - 32, mid)), H - 4, label, 'middle', 'window-label',
    ));
  }

  // "now", where it falls inside this day — labelled, because an unexplained
  // vertical rule reads as an axis.
  const now = Date.now();
  const nowPoint = currentPoint(day);
  if (nowPoint) {
    const nx = xOf(posOf(nowPoint.h, nowPoint.mi) + (now - nowPoint.at.getTime()) / 3600000);
    svg.append(svgEl('line', { class: 'nowline', x1: nx, x2: nx, y1: PAD_T, y2: H - PAD_B }));
    svg.append(text(Math.min(nx + 3, W - PAD_R - 12), PAD_T + 4, 'now', 'start', 'nowlabel'));
  }

  for (const hour of [0, 6, 12, 18]) {
    const i = hours.findIndex((h) => h.hour === hour);
    if (i >= 0 && !(chosen && Math.abs(xOf(i) + slot / 2 - xOf((from + to) / 2)) < 22)) {
      svg.append(text(xOf(i) + slot / 2, H - 4, pad2(hour), 'middle'));
    }
  }

  // Full-height tap targets, comfortably larger than a 13 px bar.
  hours.forEach((h, i) => {
    const hit = svgEl('rect', {
      class: 'hit' + (state.hour === h.hour ? ' sel' : ''),
      x: xOf(i), y: 0, width: slot, height: H,
      role: 'button', tabindex: 0,
      'aria-label': `${pad2(h.hour)}:00, ${money(h.price, u)} ${u.label}`,
    });
    const pick = () => { state.hour = state.hour === h.hour ? null : h.hour; render(); };
    hit.addEventListener('click', pick);
    hit.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); }
    });
    svg.append(hit);
  });

  card.append(svg);

  const legend = el('div', 'legend');
  legend.append(swatch('', 'price each hour'));
  if (chosen) {
    legend.append(swatch('win', plan && plan.fromNow ? 'cheapest window from now' : 'cheapest window'));
  }
  legend.append(swatch('mean', `mean ${money(day.mean, u)}`));
  if (bottom < 0) legend.append(el('span', null, 'below the line: paid to use it'));
  card.append(legend);

  mainEl.append(card);
}

/** A bar anchored to `baseY`, rounded only at the end the data reaches. */
function barPath(x, valueY, width, baseY, radius) {
  const up = valueY <= baseY;
  const height = Math.max(1.5, Math.abs(valueY - baseY));
  const r = Math.min(radius, width / 2, height);
  const x2 = x + width;
  return up
    ? `M${x} ${baseY} V${baseY - height + r} Q${x} ${baseY - height} ${x + r} ${baseY - height} `
      + `H${x2 - r} Q${x2} ${baseY - height} ${x2} ${baseY - height + r} V${baseY} Z`
    : `M${x} ${baseY} V${baseY + height - r} Q${x} ${baseY + height} ${x + r} ${baseY + height} `
      + `H${x2 - r} Q${x2} ${baseY + height} ${x2} ${baseY + height - r} V${baseY} Z`;
}

function swatch(kind, label) {
  const span = el('span');
  const mark = el('span', 'swatch' + (kind && kind !== 'mean' ? ' ' + kind : ''));
  if (kind === 'mean') {
    mark.style.background = 'transparent';
    mark.style.height = '0';
    mark.style.borderTop = '1px dashed var(--text-muted)';
  }
  span.append(mark);
  span.append(document.createTextNode(label));
  return span;
}

function text(x, y, content, anchor, className) {
  const node = svgEl('text', { x, y, 'text-anchor': anchor || 'middle' });
  if (className) node.setAttribute('class', className);
  node.textContent = content;
  return node;
}

/* --------------------------------------------------------------- appliances */

function renderAppliances(day, u, plan) {
  const card = el('div', 'card');
  card.append(el('h2', null, plan.fromNow
    ? `Cheapest window · from ${plan.points.length ? clockOf(plan.points[0]) : 'now'}`
    : `Cheapest window · ${day.label}`));
  const rows = el('div', 'rows');

  APPLIANCES.forEach((appliance, index) => {
    const w = cheapestWindow(plan.points, day.stepMs, appliance.hours);
    const row = el('button', 'row');
    row.type = 'button';
    row.setAttribute('aria-pressed', String(index === state.appliance));

    row.append(el('div', 'name', appliance.name));
    row.append(el('div', 'win', w ? windowLabel(w, day.stepMs) : '—'));
    row.append(el('div', 'sub', `${runLength(appliance.hours)} run`));

    const price = el('div', 'price');
    if (w) {
      price.append(document.createTextNode(`${money(w.mean, u)} ${u.label} · `));
      // A percentage needs a positive denominator. Measured against a mean of
      // zero or below it inverts — cheaper reads as dearer — and a window whose
      // mean is below zero is not "160 % cheaper" in any sense a person would
      // use. Say the thing that is actually true instead.
      const saving = day.mean > 0 ? Math.round(((day.mean - w.mean) / day.mean) * 100) : null;
      price.append(el('b', null, w.mean < 0
        ? 'paid to run it'
        : saving === null
          ? 'the cheapest window there is'
          : `${saving >= 0 ? '\u2212' : '+'}${Math.abs(saving)}% vs mean`));
    } else {
      price.textContent = plan.fromNow ? 'not enough of the day left' : 'longer than the day';
    }
    row.append(price);

    row.addEventListener('click', () => { state.appliance = index; render(); });
    rows.append(row);
  });

  card.append(rows);
  if (APPLIANCE_NOTE) card.append(el('p', 'note', APPLIANCE_NOTE));
  card.append(el('p', 'note', plan.fromNow
    ? 'Windows are searched from now onwards — the cheapest hours of this morning are no help this '
      + 'afternoon. Switch to tomorrow to plan the whole day. Asking a question about this app\u2019s '
      + 'data reads a table written when the prices were fetched, which carries both: the whole day, '
      + 'and the stretch that was still ahead at that moment.'
    : 'Tap a row to draw its window on the chart.'));
  mainEl.append(card);
}

function runLength(hours) {
  if (Number.isInteger(hours)) return `${hours} h`;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return whole ? `${whole} h ${minutes} min` : `${minutes} min`;
}

/* -------------------------------------------------------------------- notes */

function renderNotes(u) {
  const card = el('div', 'card');
  card.append(el('h2', null, 'Reading these numbers'));
  card.append(el('p', 'note', u.factor === 0.1
    ? `The source quotes ${u.source}; this app divides by ten to show euro-cents per kWh, the unit a `
      + 'household tariff is written in. It is the spot price alone — grid rent, energy tax and VAT are on '
      + 'top, and together they are usually the larger half of a bill.'
    : `Prices are shown in ${u.source}, exactly as the source gives them. This is the spot price alone; `
      + 'grid rent, tax and VAT are on top.'));

  const editing = el('p', 'note');
  editing.append(document.createTextNode('The appliance list lives in '));
  editing.append(el('code', null, 'data/appliances.json'));
  editing.append(document.createTextNode(' — the ⋯ menu → '));
  editing.append(el('b', null, 'App Files'));
  editing.append(document.createTextNode('. Add a row or change a run length, and this page follows the next time it opens.'));
  card.append(editing);
  mainEl.append(card);
}

function renderFoot() {
  const source = (DATA && DATA.source) || {};
  // `licenceInfo` is what the API said about the answer these prices came
  // from, licence URI and all; `licence` is the job's own constant, which can
  // only be as fresh as the last time somebody read the terms.
  footEl.append(el('p', null,
    `${source.attribution || 'Day-ahead prices: Energy-Charts (Fraunhofer ISE)'} — `
    + `${source.licenceInfo || source.licence || 'see NOTES.md for the terms'}.`));
  if (source.publishable === false) {
    footEl.append(el('p', null,
      'This bidding zone’s prices are licensed for private and internal use only. Do not republish them.'));
  }
  footEl.append(el('p', null,
    'Day-ahead prices are set once a day, in an auction, for every interval of the following day.'));
}

/* ------------------------------------------------------------------ problem */

function renderProblem(problems) {
  const card = el('div', 'card problem');
  card.append(el('h2', null, 'This app cannot read its data'));
  const list = el('ul');
  for (const problem of problems) list.append(el('li', null, problem));
  card.append(list);
  card.append(el('p', 'hint',
    'Open the file in Snuggery — the ⋯ menu → App Files → data/snapshot.json — and look at '
    + 'what is actually in it. A fetch that failed upstream still returns perfectly valid JSON, and the '
    + 'Shortcut writes that over this file without complaining.'));
  mainEl.append(card);
  stampEl.textContent = 'No data';
  stampEl.className = 'stamp stale';
  zoneEl.textContent = '';
  tabsEl.replaceChildren();
}

/* --------------------------------------------------------------------- load */

/** The app's only network-shaped call, and it never leaves the package: the
 *  two callers below pass `./data/snapshot.json` and `./data/appliances.json`,
 *  and anything else is refused here rather than quietly fetched. */
async function readJson(path) {
  // Every segment needs a non-dot character: `[\w.-]+` would have admitted
  // `./data/..`, the package root itself.
  if (!/^\.\/data\/[\w-]+(\.[\w-]+)*$/.test(path)) throw new Error(`refusing to read ${path}`);
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function load() {
  try {
    DATA = await readJson('./data/snapshot.json');
  } catch (error) {
    DATA = null;
    mainEl.replaceChildren();
    footEl.replaceChildren();
    renderProblem([
      `Could not read data/snapshot.json — ${error.message}.`,
      'If this page was opened straight from the filesystem rather than through Snuggery, the browser '
      + 'blocks an app fetching its own data; serve the folder with `python3 -m http.server` instead.',
    ]);
    return;
  }

  try {
    const file = await readJson('./data/appliances.json');
    const rows = (Array.isArray(file) ? file : file.appliances) || [];
    const clean = rows
      .filter((r) => r && typeof r.name === 'string' && r.name.trim()
        && Number(r.hours) > 0 && Number(r.hours) <= 24)
      .map((r) => ({ name: r.name.trim().slice(0, 40), hours: Number(r.hours) }));
    if (clean.length) {
      APPLIANCES = clean;
      APPLIANCE_NOTE = rows.length > clean.length
        ? `${rows.length - clean.length} row(s) in appliances.json were skipped: each needs a name and a `
          + 'run length between 0 and 24 hours.'
        : '';
    } else {
      APPLIANCES = FALLBACK_APPLIANCES;
      APPLIANCE_NOTE = 'data/appliances.json holds no usable rows, so this is the built-in list. Each row '
        + 'needs a name and a run length in hours.';
    }
  } catch (error) {
    APPLIANCES = FALLBACK_APPLIANCES;
    APPLIANCE_NOTE = `data/appliances.json could not be read (${error.message}), so this is the built-in list.`;
  }

  render();
}

load();

// Reads are fresh from disk, so re-reading when the page comes back into view
// is what makes an app opened this morning show this morning's prices. Snuggery
// fires the same event when a Shortcut delivers new data while the app is open,
// so this re-renders in place: the open day tab, the chosen appliance, the
// inspected hour and the scroll position all survive it.
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
