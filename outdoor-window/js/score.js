/* The scorer (ART.md section 1; app.js's header comment has the shape of both data files). Pure: it runs
 * in Node, and tools/test_shutters.mjs compares it with the snapshot's `ask` rows and with a scorer written
 * in the test. It was moved out of app.js by the house-system pass with its arithmetic unchanged; each row
 * gained `checks`, one per rule in use, so the Shutters draw the scorer's own numbers.
 *
 * HOW AN HOUR IS SCORED. Each rule that applies yields two things: whether the
 * hour passes it, and a comfort between 0 and 1: 1 at the most comfortable
 * value the rule allows, 0 exactly at the limit. A "no more than" rule scores
 * (limit − value) / limit; a band scores how near the middle of the band the
 * value sits; daylight scores 1 or 0. The hour's score is the mean comfort,
 * rounded to a percentage, and it passes only if every rule passes. So a
 * scraped pass scores low and reads as marginal, which is the honest picture.
 * `scripts/outdoor_window.py` mirrors this arithmetic to write the demo's
 * `ask` rows; change a formula in one and change it in the other.
 */

export function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/* "2026-09-21T05:00" in a place that is `offset` seconds from UTC, as an
   instant. Parsed as UTC and then shifted back, which avoids handing a
   zone-less string to the engine's local-time guesswork. Right across a
   change of the clocks too: Open-Meteo keeps one offset per file (D-DST). */
export function localToEpoch(stamp, offset) {
  if (typeof stamp !== 'string') return NaN;
  const ms = Date.parse(stamp.slice(0, 16) + 'Z');
  return Number.isNaN(ms) ? NaN : ms - offset * 1000;
}

export function maxRule(value, limit) {
  if (!isNumber(limit)) return null;                       // rule not in use
  if (!isNumber(value)) return { ok: false, comfort: 0 };  // no data is not a pass
  if (limit <= 0) return { ok: value <= 0, comfort: value <= 0 ? 1 : 0 };
  return { ok: value <= limit, comfort: clamp((limit - value) / limit) };
}

export function bandRule(value, band) {
  if (!band || !isNumber(band.min) || !isNumber(band.max)) return null;
  if (!isNumber(value)) return { ok: false, comfort: 0 };
  const { min, max } = band;
  if (max <= min) return { ok: value === min, comfort: value === min ? 1 : 0 };
  const half = (max - min) / 2;
  const middle = (max + min) / 2;
  return { ok: value >= min && value <= max, comfort: clamp((half - Math.abs(value - middle)) / half) };
}

export function sunTimes(snapshot, offset) {
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

/* The light rule as the scorer reads it, ignoring case: 'daylight', 'golden' or anything else ('any'). */
export const lightRule = (rules) => String(rules.daylight || 'any').toLowerCase();

export function scoreHours(snapshot, rules) {
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
    const sunKnown = !!today && Number.isFinite(today.rise) && Number.isFinite(today.set);
    if (today && goldenMinutes > 0 && Number.isFinite(today.rise) && Number.isFinite(today.set)) {
      const span = goldenMinutes * 60000;
      golden = (epoch >= today.rise && epoch <= today.rise + span) ||
               (epoch >= today.set - span && epoch <= today.set);
    }
    if (golden) light = 'golden';

    // `key` and `value` are the house pass's: which rule, and whether the file had a value for it.
    const checks = [
      { key: 'rain', value: rainPct, label: 'rain chance', result: maxRule(rainPct, rules.maxRainChancePct) },
      { key: 'rainfall', value: precip, label: 'rainfall', result: maxRule(precip, rules.maxPrecipMm) },
      { key: 'gust', value: gust, label: 'gusts', result: maxRule(gust, rules.maxGustKmh) },
      { key: 'temp', value: temp, label: 'temperature', result: bandRule(temp, rules.temperatureC) },
      { key: 'dew', value: dew, label: 'dew point', result: bandRule(dew, rules.dewPointC) }
    ];
    if (wantLight === 'daylight') {
      checks.push({ key: 'light', value: isDay, label: 'daylight', result: { ok: isDay === 1, comfort: isDay === 1 ? 1 : 0 } });
    } else if (wantLight === 'golden') {
      checks.push({ key: 'light', value: sunKnown ? 1 : null, label: 'golden hour', result: { ok: golden, comfort: golden ? 1 : 0 } });
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
      blocked, temp, rainPct, precip, gust, dew, cloud,
      checks: active.map((check) => ({ key: check.key, label: check.label, ok: check.result.ok, comfort: check.result.comfort, missing: !isNumber(check.value) }))
    };
  });
}

export function findWindows(rows, minHours) {
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
