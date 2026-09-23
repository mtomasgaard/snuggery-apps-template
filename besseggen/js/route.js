// The walk: the polyline, the distance axis, the waypoints, and how long it takes.
//
// route.geojson ships the geometry as [x, y, z] in EPSG:25833 with a cumulative distance array,
// kilometre marks and waypoints carried as INDICES into the coordinates, never as second copies
// of the geometry. Reading a direction backwards is this array read in reverse with the distance
// mirrored; there is no second dataset for the other way round.

import { clamp } from './util.js';

export class Route {
  constructor(geo, waypointsFile) {
    const feats = (geo.features || []);
    this.main = feats.find((f) => (f.properties || {}).role === 'main') || feats[0] || null;
    this.connectors = feats.filter((f) => f !== this.main);
    const p = (this.main && this.main.properties) || {};
    this.props = p;
    const co = (this.main && this.main.geometry && this.main.geometry.coordinates) || [];
    this.n = co.length;
    this.x = new Float64Array(this.n);
    this.y = new Float64Array(this.n);
    this.z = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.x[i] = co[i][0]; this.y[i] = co[i][1]; this.z[i] = co[i][2] ?? 0;
    }
    this.cum = new Float64Array(this.n);
    if (Array.isArray(p.cumM) && p.cumM.length === this.n) {
      for (let i = 0; i < this.n; i++) this.cum[i] = p.cumM[i];
    } else {
      for (let i = 1; i < this.n; i++) {
        this.cum[i] = this.cum[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.y[i] - this.y[i - 1]);
      }
    }
    this.length = this.n ? this.cum[this.n - 1] : 0;
    this.kmMarks = p.kmMarks || [];
    this.wpIndex = p.waypoints || [];
    this.setWaypointNames(waypointsFile);

    // Cumulative ascent and descent, measured on the shipped samples. The numbers the About
    // panel shows come from the file's own properties, because the pipeline states what its
    // sampling and smoothing did and this recomputation cannot know that.
    let up = 0, down = 0;
    this.ascentTo = new Float64Array(this.n);
    this.descentTo = new Float64Array(this.n);
    for (let i = 1; i < this.n; i++) {
      const d = this.z[i] - this.z[i - 1];
      if (d > 0) up += d; else down -= d;
      this.ascentTo[i] = up; this.descentTo[i] = down;
    }
    this.ascent = up; this.descent = down;
    this.highIdx = 0;
    for (let i = 1; i < this.n; i++) if (this.z[i] > this.z[this.highIdx]) this.highIdx = i;
  }

  setWaypointNames(file) {
    const byId = new Map();
    for (const w of ((file && file.waypoints) || [])) byId.set(w.id, w);
    this.waypoints = this.wpIndex.map((w) => {
      const meta = byId.get(w.id) || {};
      const i = clamp(w.i | 0, 0, Math.max(0, this.n - 1));
      return {
        id: w.id, i,
        name: meta.name || w.id,
        note: meta.note || '',
        source: meta.source || null,
        ssrId: meta.ssrId ?? null,
        elevM: this.n ? this.z[i] : (meta.elevM ?? 0),
        statedElevM: meta.elevM ?? null,
        x: this.n ? this.x[i] : meta.x, y: this.n ? this.y[i] : meta.y,
      };
    });
    // Anything in waypoints.json that the route does not index still deserves a pin.
    this.extraWaypoints = ((file && file.waypoints) || [])
      .filter((w) => !this.wpIndex.some((v) => v.id === w.id));
  }

  // Distance is always measured in the direction being walked, so every readout in the app
  // follows the direction switch without a second copy of anything.
  dirDist(i, reversed) { return reversed ? this.length - this.cum[i] : this.cum[i]; }
  indexAtDist(dist, reversed) {
    const target = reversed ? this.length - dist : dist;
    let lo = 0, hi = this.n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < target) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  nearestIndex(x, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const d = (this.x[i] - x) ** 2 + (this.y[i] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, dist: Math.sqrt(bd) };
  }
  // Gradient over a short window, so a single 25 m sample's noise does not read as a cliff.
  gradientAt(i, window = 3) {
    const a = clamp(i - window, 0, this.n - 1), b = clamp(i + window, 0, this.n - 1);
    const run = this.cum[b] - this.cum[a];
    return run > 0 ? (this.z[b] - this.z[a]) / run : 0;
  }
}

// ---------------------------------------------------------------- walking time
//
// Tobler's hiking function, 1993:  v = baseKmh * exp(-3.5 * |S + 0.05|), S = rise over run.
// The maximum is at S = -0.05, a gentle downhill, which is the point of the model.
//
// Naismith with Langmuir's corrections: a flat speed, an hour per so many metres of ascent, a
// bonus for gentle descent and a penalty for steep descent. The rates come from pace.json and
// are read literally as "metres of descent per hour of correction", so an unusual number in that
// file shows up as an unusual time rather than being silently clamped.
export function timeForSegments(route, i0, i1, pace) {
  const model = (pace && pace.model) === 'naismith' ? 'naismith' : 'tobler';
  const cfg = (pace && pace.models) || {};
  const fitness = Number(pace && pace.fitnessFactor) || 1;
  const restPerHour = Number(pace && pace.restMinutesPerHour) || 0;
  const a = Math.min(i0, i1), b = Math.max(i0, i1);
  let hours = 0, ascent = 0, descent = 0, gentleDesc = 0, steepDesc = 0, flat = 0;
  for (let i = a; i < b; i++) {
    const run = route.cum[i + 1] - route.cum[i];
    const rise = route.z[i + 1] - route.z[i];
    if (run <= 0 && rise === 0) continue;
    const slant = Math.hypot(run, rise);
    const s = run > 0 ? rise / run : (rise > 0 ? 9 : -9);
    flat += run;
    if (rise > 0) ascent += rise; else descent -= rise;
    if (model === 'tobler') {
      const base = Number(cfg.tobler && cfg.tobler.baseKmh) || 6;
      const v = base * Math.exp(-3.5 * Math.abs(s + 0.05));   // km/h along the ground
      hours += (slant / 1000) / Math.max(v, 0.15);
    } else {
      const deg = Math.atan2(-rise, run) * 180 / Math.PI;     // positive when descending
      if (rise < 0) { if (deg >= 5 && deg <= 12) gentleDesc -= rise; else if (deg > 12) steepDesc -= rise; }
    }
  }
  if (model === 'naismith') {
    const nm = cfg.naismith || {};
    const flatKmh = Number(nm.flatKmh) || 4.8;
    const perHour = Number(nm.ascentMPerHour) || 600;
    const lm = nm.langmuir || {};
    hours = (flat / 1000) / flatKmh + ascent / perHour;
    const bonusRate = Number(lm.gentleDescentBonusMPerHour) || 0;
    const penRate = Number(lm.steepDescentPenaltyMPerHour) || 0;
    if (bonusRate > 0) hours -= gentleDesc / bonusRate;
    if (penRate > 0) hours += steepDesc / penRate;
    hours = Math.max(hours, flat / 1000 / 12);      // never faster than a 12 km/h run
  }
  hours *= fitness;
  hours *= 1 + restPerHour / 60;
  return { hours, ascent, descent, flat, model, gentleDesc, steepDesc };
}

export function paceLabel(pace) {
  const model = (pace && pace.model) === 'naismith' ? 'naismith' : 'tobler';
  const cfg = (pace && pace.models) || {};
  if (model === 'tobler') {
    const base = Number(cfg.tobler && cfg.tobler.baseKmh) || 6;
    return `Tobler, ${base} km/h on the flat-ish`;
  }
  const nm = cfg.naismith || {};
  return `Naismith ${Number(nm.flatKmh) || 4.8} km/h, +1 h per ${Number(nm.ascentMPerHour) || 600} m`;
}

// Tell the user, in the panel, what the Langmuir rates in their file actually mean. The classic
// correction is ten minutes per 300 m, that is 1800 m per hour; a much smaller number in the file
// makes a much larger correction, and a walking time is not something to leave unexplained.
export function langmuirNote(pace) {
  const nm = ((pace && pace.models) || {}).naismith || {};
  const lm = nm.langmuir || {};
  const b = Number(lm.gentleDescentBonusMPerHour) || 0;
  const p = Number(lm.steepDescentPenaltyMPerHour) || 0;
  if (!b && !p) return null;
  const mins = (rate) => (rate > 0 ? Math.round(300 / rate * 60) : 0);
  return `Langmuir from data/pace.json: −${mins(b)} min per 300 m of gentle descent, `
    + `+${mins(p)} min per 300 m of steep descent. The classic figures are 10 and 10 `
    + `(that is 1800 m per hour in both fields).`;
}
