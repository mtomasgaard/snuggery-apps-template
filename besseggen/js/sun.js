// Sun and shadow.
//
// Solar position is the NOAA Solar Calculator algorithm (Meeus, Astronomical Algorithms), written
// out in full rather than pulled from a library. NOAA states about +/- 1 minute on sunrise and
// sunset for latitudes inside +/- 72 degrees, which covers 61.5 N comfortably, and the position
// itself is good to a hundredth of a degree before the refraction model's own error.
//
// Three things are computed here:
//   solarPosition()  azimuth and altitude for an instant
//   dayEvents()      sunrise, sunset, golden hour and the twilights, found by sampling the day
//                    at one-minute steps and bisecting the crossings. At 61.5 N the sun can fail
//                    to cross a threshold at all for weeks at a time, and a sampler says so
//                    instead of returning NaN the way a closed-form hour angle does.
//   shadowMask()     a real cast-shadow raster, swept over the flat height grid in one pass

import { DEG, RAD, clamp } from './util.js';

// Norway keeps CET, and CEST from the last Sunday in March to the last Sunday in October. The
// rule is written out because the app must not depend on the phone's own time zone: Snuggery
// might be running in Oslo or in Auckland, and the answer is about Jotunheimen either way.
function lastSunday(year, month1) {
  const d = new Date(Date.UTC(year, month1, 0));      // last day of that month
  return d.getUTCDate() - d.getUTCDay();
}
export function tzOffsetHours(y, mo, d, minutes) {
  const t = Date.UTC(y, mo - 1, d) + minutes * 60000;
  const start = Date.UTC(y, 2, lastSunday(y, 3), 2, 0);
  const end = Date.UTC(y, 9, lastSunday(y, 10), 3, 0);
  return (t >= start && t < end) ? 2 : 1;
}
export function tzName(offset) { return offset === 2 ? 'CEST' : 'CET'; }

// Local wall-clock -> Julian Day and minutes past UTC midnight.
export function toUT(y, mo, d, minutes) {
  const off = tzOffsetHours(y, mo, d, minutes);
  const ms = Date.UTC(y, mo - 1, d) + minutes * 60000 - off * 3600000;
  return { jd: ms / 86400000 + 2440587.5, utcMin: (ms / 60000) % 1440, off };
}

export function solarPosition(jd, lat, lon) {
  const t = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * DEG) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * M * DEG) * (0.019993 - 0.000101 * t)
    + Math.sin(3 * M * DEG) * 0.000289;
  const trueLong = L0 + C;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * DEG);
  const meanObliq = 23 + (26 + ((21.448 - t * (46.815 + t * (0.00059 - t * 0.001813)))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos((125.04 - 1934.136 * t) * DEG);
  const decl = Math.asin(Math.sin(obliq * DEG) * Math.sin(appLong * DEG)) * RAD;
  const y = Math.tan(obliq / 2 * DEG) ** 2;
  const eqTime = 4 * RAD * (y * Math.sin(2 * L0 * DEG)
    - 2 * e * Math.sin(M * DEG)
    + 4 * e * y * Math.sin(M * DEG) * Math.cos(2 * L0 * DEG)
    - 0.5 * y * y * Math.sin(4 * L0 * DEG)
    - 1.25 * e * e * Math.sin(2 * M * DEG));

  // Minutes past UTC midnight for this jd.
  const utcMin = ((jd + 0.5) % 1) * 1440;
  let tst = (utcMin + eqTime + 4 * lon) % 1440;
  if (tst < 0) tst += 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;

  const cosZ = clamp(Math.sin(lat * DEG) * Math.sin(decl * DEG)
    + Math.cos(lat * DEG) * Math.cos(decl * DEG) * Math.cos(ha * DEG), -1, 1);
  const zenith = Math.acos(cosZ) * RAD;
  const elev = 90 - zenith;

  let az;
  const den = Math.cos(lat * DEG) * Math.sin(zenith * DEG);
  if (Math.abs(den) > 1e-9) {
    const c = clamp(((Math.sin(lat * DEG) * cosZ) - Math.sin(decl * DEG)) / den, -1, 1);
    const a = Math.acos(c) * RAD;
    az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
  } else az = 180;

  return { az, elev, elevApparent: elev + refraction(elev), decl, eqTime };
}

// NOAA's piecewise atmospheric refraction, in degrees.
function refraction(e) {
  if (e > 85) return 0;
  const te = Math.tan(e * DEG);
  let r;
  if (e > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (e > -0.575) r = 1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)));
  else r = -20.772 / te;
  return r / 3600;
}

export function sunAt(y, mo, d, minutes, lat, lon) {
  const { jd, off } = toUT(y, mo, d, minutes);
  const p = solarPosition(jd, lat, lon);
  p.tz = off;
  return p;
}

// Sample the whole local day at one-minute steps and read the events off the curve. Slower than
// the closed form and far more honest about a latitude where the sun sometimes does not set.
const THRESH = { sunrise: -0.833, civil: -6, nautical: -12, goldenLo: -4, goldenHi: 6 };
export function dayEvents(y, mo, d, lat, lon) {
  const N = 1441;
  const alt = new Float64Array(N);
  const az = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = sunAt(y, mo, d, i, lat, lon);
    alt[i] = s.elev; az[i] = s.az;
  }
  let noon = 0, mid = 0;
  for (let i = 1; i < N; i++) { if (alt[i] > alt[noon]) noon = i; if (alt[i] < alt[mid]) mid = i; }

  const cross = (level, rising) => {
    for (let i = 1; i < N; i++) {
      const a = alt[i - 1], b = alt[i];
      if (rising ? (a < level && b >= level) : (a >= level && b < level)) {
        let lo = i - 1, hi = i;
        for (let k = 0; k < 20; k++) {
          const m = (lo + hi) / 2;
          const v = sunAt(y, mo, d, m, lat, lon).elev;
          if (rising ? v < level : v >= level) lo = m; else hi = m;
        }
        return (lo + hi) / 2;
      }
    }
    return null;
  };

  const sunrise = cross(THRESH.sunrise, true);
  const sunset = cross(THRESH.sunrise, false);
  const dawn = cross(THRESH.civil, true);
  const dusk = cross(THRESH.civil, false);
  return {
    alt, az,
    maxAlt: alt[noon], minAlt: alt[mid],
    solarNoon: noon, solarMidnight: mid,
    sunrise, sunset, dawn, dusk,
    goldenMorning: sunrise == null ? null
      : [cross(THRESH.goldenLo, true), cross(THRESH.goldenHi, true)],
    goldenEvening: sunset == null ? null
      : [cross(THRESH.goldenHi, false), cross(THRESH.goldenLo, false)],
    // At this latitude these are the interesting cases, not edge cases.
    polarDay: alt[mid] > THRESH.sunrise,
    polarNight: alt[noon] < THRESH.sunrise,
    civilAllNight: alt[mid] > THRESH.civil && alt[mid] <= THRESH.sunrise,
    sunUpAllDay: alt[mid] > THRESH.sunrise,
  };
}

// A unit vector toward the sun in scene coordinates (+X east, +Y up, -Z north). The true azimuth
// is turned into a grid azimuth first: at 8.7 E in a zone centred on 15 E the two are 5.5 degrees
// apart, and skipping that would put every shadow 5.5 degrees out.
export function sunVector(azTrue, altDeg, convergenceDeg) {
  const g = (azTrue - convergenceDeg) * DEG, a = altDeg * DEG;
  return { x: Math.cos(a) * Math.sin(g), y: Math.sin(a), z: -Math.cos(a) * Math.cos(g), gridAz: azTrue - convergenceDeg };
}

// ---------------------------------------------------------------- cast shadows
//
// One sweep over the grid, away from the sun, carrying a "shadow envelope" per column:
//
//   E(q) = max over t>0 of ( h(q + t*d) - t*tan(alt) )      q is in shadow when h(q) < E(q)
//
// Marched along the dominant axis with linear interpolation across the other one, which is the
// standard line-sweep and makes the whole raster O(cells) instead of O(cells * ray length).
// Its approximation is cross-line: a very thin blocker exactly diagonal to the sweep can leak by
// up to half a cell. At 16 m that is 8 m of shadow edge on a 20 km model.
export function shadowMask(grid, sunGridAzDeg, sunAltDeg, out, seed) {
  const nx = grid.nx, ny = grid.ny, res = grid.res, h = grid.data;
  if (!out || out.length !== nx * ny) out = new Uint8Array(nx * ny);
  if (sunAltDeg <= 0) { out.fill(0); return out; }
  out.fill(255);
  const tanAlt = Math.tan(sunAltDeg * DEG);
  const a = sunGridAzDeg * DEG;
  const ux = Math.sin(a), uy = Math.cos(a);          // toward the sun, east and north
  // Grid axes: column increases east, row increases south. Sweeping AWAY from the sun.
  const dCol = -ux, dRow = uy;
  const eps = 0.5;                                    // decimetres of slack, 5 cm

  const E = new Float32Array(nx);
  const Eprev = new Float32Array(nx);
  const Hprev = new Float32Array(nx);

  if (Math.abs(dRow) >= Math.abs(dCol)) {
    const shift = dCol / Math.abs(dRow);               // columns moved per row step
    const stepM = res * Math.hypot(1, shift);
    const drop = stepM * tanAlt * 10;                  // decimetres
    const rowStep = dRow > 0 ? 1 : -1;
    const first = rowStep > 0 ? 0 : ny - 1;
    for (let k = 0; k < ny; k++) {
      const r = first + k * rowStep, base = r * nx;
      if (k === 0) {
        for (let c = 0; c < nx; c++) {
          E[c] = seed ? seed(c, r) : -1e9;
          Hprev[c] = h[base + c];
          out[base + c] = h[base + c] >= E[c] - eps ? 255 : 0;
          Eprev[c] = E[c];
        }
        continue;
      }
      for (let c = 0; c < nx; c++) {
        const s = c - shift;
        const i0 = s <= 0 ? 0 : (s >= nx - 1 ? nx - 2 : Math.floor(s));
        const f = clamp(s - i0, 0, 1);
        const ep = Eprev[i0] + (Eprev[i0 + 1] - Eprev[i0]) * f;
        const hp = Hprev[i0] + (Hprev[i0 + 1] - Hprev[i0]) * f;
        E[c] = Math.max(ep, hp) - drop;
      }
      for (let c = 0; c < nx; c++) {
        const hv = h[base + c];
        out[base + c] = hv >= E[c] - eps ? 255 : 0;
        Eprev[c] = E[c]; Hprev[c] = hv;
      }
    }
  } else {
    const shift = dRow / Math.abs(dCol);               // rows moved per column step
    const stepM = res * Math.hypot(1, shift);
    const drop = stepM * tanAlt * 10;
    const colStep = dCol > 0 ? 1 : -1;
    const first = colStep > 0 ? 0 : nx - 1;
    const E2 = new Float32Array(ny), Ep2 = new Float32Array(ny), Hp2 = new Float32Array(ny);
    for (let k = 0; k < nx; k++) {
      const c = first + k * colStep;
      if (k === 0) {
        for (let r = 0; r < ny; r++) {
          E2[r] = seed ? seed(c, r) : -1e9;
          Hp2[r] = h[r * nx + c];
          out[r * nx + c] = h[r * nx + c] >= E2[r] - eps ? 255 : 0;
          Ep2[r] = E2[r];
        }
        continue;
      }
      for (let r = 0; r < ny; r++) {
        const s = r - shift;
        const i0 = s <= 0 ? 0 : (s >= ny - 1 ? ny - 2 : Math.floor(s));
        const f = clamp(s - i0, 0, 1);
        const ep = Ep2[i0] + (Ep2[i0 + 1] - Ep2[i0]) * f;
        const hp = Hp2[i0] + (Hp2[i0 + 1] - Hp2[i0]) * f;
        E2[r] = Math.max(ep, hp) - drop;
      }
      for (let r = 0; r < ny; r++) {
        const hv = h[r * nx + c];
        out[r * nx + c] = hv >= E2[r] - eps ? 255 : 0;
        Ep2[r] = E2[r]; Hp2[r] = hv;
      }
    }
  }
  return out;
}

// The core's sweep starts at the core boundary with an empty envelope, so without this a peak
// outside the core would cast no shadow into it. Ray-marching the coarse shell grid outward from
// each cell of the first row seeds that envelope with what is really out there.
export function makeSeed(shellGrid, coreGrid, sampleShell, gridAzDeg, altDeg) {
  const a = gridAzDeg * DEG, tanAlt = Math.tan(altDeg * DEG);
  const ux = Math.sin(a), uy = Math.cos(a);
  const res = shellGrid.res;
  return (c, r) => {
    const x = coreGrid.x0 + c * coreGrid.res;
    const y = coreGrid.y1 - r * coreGrid.res;
    let best = -1e9;
    let t = res;
    while (t < 26000) {
      const hz = sampleShell(x + ux * t, y + uy * t) * 10 - t * tanAlt * 10;
      if (hz > best) best = hz;
      t += t < 2000 ? res : res * 2;
    }
    return best;
  };
}

// Is one point in direct sun? Ray-march the height field toward the sun. Used by the first and
// last direct sun tool, where the answer has to be right rather than smooth.
export function isSunlit(sampleH, x, y, z, gridAzDeg, altDeg, maxH, eye = 0.5) {
  if (altDeg <= 0) return false;
  const a = gridAzDeg * DEG, ux = Math.sin(a), uy = Math.cos(a);
  const tanAlt = Math.tan(altDeg * DEG);
  let t = 6, step = 6;
  const h0 = z + eye;
  while (t < 42000) {
    const rz = h0 + t * tanAlt;
    if (rz > maxH) return true;
    if (sampleH(x + ux * t, y + uy * t) > rz) return false;
    step = Math.min(220, step * 1.035);
    t += step;
  }
  return true;
}

// First and last direct sun on one point, for one day. Sampled every two minutes, then bisected
// to the minute — the same ray-march the shadow layer uses, so the two always agree.
export function directSunWindow(sampleH, x, y, z, y_, mo, d, lat, lon, convergence, maxH) {
  const lit = [];
  for (let m = 0; m <= 1440; m += 2) {
    const s = sunAt(y_, mo, d, m, lat, lon);
    const ok = s.elevApparent > 0
      && isSunlit(sampleH, x, y, z, s.az - convergence, s.elevApparent, maxH);
    lit.push(ok);
  }
  const at = (m) => {
    const s = sunAt(y_, mo, d, m, lat, lon);
    return s.elevApparent > 0 && isSunlit(sampleH, x, y, z, s.az - convergence, s.elevApparent, maxH);
  };
  const refine = (i0, i1) => {          // i0 unlit, i1 lit (indices into the 2-minute samples)
    let lo = i0 * 2, hi = i1 * 2;
    for (let k = 0; k < 8; k++) {
      const m = (lo + hi) / 2;
      if (at(m)) hi = m; else lo = m;
    }
    return hi;
  };
  let first = null, last = null, total = 0;
  for (let i = 0; i < lit.length; i++) {
    if (lit[i]) total += 2;
    if (lit[i] && first === null) first = i > 0 ? refine(i - 1, i) : 0;
    if (lit[i]) last = i;
  }
  if (last !== null && last < lit.length - 1) {
    let lo = last * 2, hi = (last + 1) * 2;
    for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; }
    last = lo;
  } else if (last !== null) last = 1440;
  // Gaps matter here: a point on a north face can be lit twice in a day with a ridge in between.
  const spans = [];
  let s = null;
  for (let i = 0; i < lit.length; i++) {
    if (lit[i] && s === null) s = i;
    if ((!lit[i] || i === lit.length - 1) && s !== null) { spans.push([s * 2, (lit[i] ? i : i - 1) * 2]); s = null; }
  }
  return { first, last, totalMinutes: Math.round(total), spans };
}
