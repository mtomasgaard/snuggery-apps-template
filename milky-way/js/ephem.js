// Where everything in the solar system is: the planets, the Moon, Pluto and the major moons.
//
// Four files, all written by tools/10_ephemeris.py and tools/11_moons.py (CONTRACT.md sections 1
// and 2), plus the leap-second table from physical.json:
//
//   ephem.json / ephem.bin   a float32 Chebyshev table refitted from JPL DE430, 1900-2100 TDB.
//                            Per body: `intervals` x 3 x (degree+1) coefficients, laid out
//                            [interval][x,y,z][coefficient], km, ICRF. Mercury ... Pluto and the
//                            Earth-Moon barycentre are heliocentric (Jupiter ... Pluto are system
//                            barycentres); the Moon is geocentric. Earth = EMB - Moon/(1+EMRAT).
//   moons.json / moons.bin   precessing Keplerian ellipses fitted to JPL's satellite ephemerides
//                            per window of W days, 1950-2050 TDB, nine float32 per window:
//                            a, e, varpi0, dvarpi, inc, Omega0, dOmega, lambda0, n (km, rad,
//                            rad/day). Each ellipse is the moon relative to its PLANET'S CENTRE in
//                            a fixed per-planet frame F (rows, ICRF -> fit frame); the planet's
//                            centre sits at -sum(mass_ratio_j * r_j) from the system barycentre,
//                            and moon() adds that so its answer is relative to the barycentre —
//                            the point helio() gives for the planet.
//
// Accuracy is measured by the pipeline and carried in the manifests (max_error_km); the worst
// planet is Pluto at about 290 km (the float32 floor at 40 AU), the Moon 2.6 km, and every moon is
// within 0.25 % of its orbit radius (Titania is the worst; most are within 0.06 %). All times are
// Julian Dates in TDB; jdFromDate() converts a
// JavaScript Date (UTC) with ERFA's leap seconds. TT is used for TDB: they differ by < 2 ms.
//
// Outside its range a table is not extrapolated: the time is clamped to the nearest end, and
// moon() returns false so the caller can hide the moon.

const TWO_PI = 2 * Math.PI;

// Leap seconds: [[jd_utc, tai_minus_utc], ...] from physical.json.constants, installed by
// buildEphemeris() or setTimeConstants().
let LEAPS = null;
let TT_MINUS_TAI = null;
let BEFORE_1972 = null;

export function setTimeConstants(constants) {
  LEAPS = constants.leap_seconds.map((r) => [r[0], r[1]]);
  TT_MINUS_TAI = constants.tt_minus_tai_s;
  BEFORE_1972 = constants.tai_minus_utc_before_1972_s;
}

function taiMinusUtc(jdUtc) {
  if (!LEAPS) throw new Error('ephem: leap seconds not loaded (physical.json)');
  if (jdUtc < LEAPS[0][0]) return BEFORE_1972;
  let v = LEAPS[0][1];
  for (let i = 0; i < LEAPS.length && LEAPS[i][0] <= jdUtc; i++) v = LEAPS[i][1];
  return v;
}

// UTC Date -> JD TDB (TT = UTC + (TAI - UTC) + 32.184 s).
export function jdFromDate(date) {
  const jdUtc = date.getTime() / 86400000 + 2440587.5;
  return jdUtc + (taiMinusUtc(jdUtc) + TT_MINUS_TAI) / 86400;
}

// JD TDB -> UTC Date, for display. The leap-second lookup is done on the UTC side, so a time
// inside an inserted leap second maps to the second before it.
export function dateFromJd(jd) {
  let jdUtc = jd - (TT_MINUS_TAI + taiMinusUtc(jd)) / 86400;
  jdUtc = jd - (TT_MINUS_TAI + taiMinusUtc(jdUtc)) / 86400;
  return new Date(Math.round((jdUtc - 2440587.5) * 86400000));
}

// A Float32Array over `bytes` bytes at `offset` of an ArrayBuffer (or typed array / Node Buffer).
function f32(buf, offset, count) {
  let ab = buf, base = 0;
  if (ArrayBuffer.isView(buf)) { ab = buf.buffer; base = buf.byteOffset; }
  const at = base + offset;
  if (at % 4 === 0 && LITTLE_ENDIAN) return new Float32Array(ab, at, count);
  const dv = new DataView(ab, at, count * 4), out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = dv.getFloat32(i * 4, true);
  return out;
}
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
async function getBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}

// Fetches ephem.json, ephem.bin, moons.json, moons.bin and (unless given) physical.json.
export async function loadEphemeris(base = 'data/', physical = null) {
  const [ej, eb, mj, mb, pj] = await Promise.all([
    getJSON(base + 'ephem.json'), getBuffer(base + 'ephem.bin'),
    getJSON(base + 'moons.json'), getBuffer(base + 'moons.bin'),
    physical ? Promise.resolve(physical) : getJSON(base + 'physical.json'),
  ]);
  return buildEphemeris(ej, eb, mj, mb, pj);
}

// The same from already-loaded files (Node tests read them with fs).
export function buildEphemeris(ephemJson, ephemBuf, moonsJson, moonsBuf, physicalJson) {
  if (physicalJson) setTimeConstants(physicalJson.constants);
  return new Ephemeris(ephemJson, ephemBuf, moonsJson, moonsBuf);
}

export class Ephemeris {
  constructor(ej, eb, mj, mb) {
    this.jd0 = ej.jd_start;
    this.jd1 = ej.jd_end;
    this.emrat = ej.emrat;
    this.maxErrorKm = ej.max_error_km;
    this.body = {};
    for (const b of ej.bodies) {
      const n = b.intervals * 3 * (b.degree + 1);
      this.body[b.name] = { L: b.interval_days, n: b.intervals, deg: b.degree, c: f32(eb, b.offset, n) };
    }
    this.mjd0 = mj.jd_start;
    this.mjd1 = mj.jd_end;
    this.frames = {};
    for (const [k, F] of Object.entries(mj.frames)) this.frames[k] = Float64Array.from(F.flat());
    this.moonList = [];
    this.moonByName = {};
    this.byParent = {};
    for (const m of mj.moons) {
      const rec = {
        name: m.name, naif: m.naif, parent: m.parent, aKm: m.a_km, W: m.window_days,
        nwin: m.windows, mu: m.mass_ratio, maxErrorKm: m.max_error_km,
        p: f32(mb, m.offset, m.windows * 9),
      };
      this.moonList.push(rec);
      this.moonByName[m.name.toLowerCase()] = rec;
      (this.byParent[m.parent] ||= []).push(rec);
    }
    this._t = new Float64Array(3);
    this._u = new Float64Array(3);
  }

  get range() { return { jdStart: this.jd0, jdEnd: this.jd1 }; }
  get moonRange() { return { jdStart: this.mjd0, jdEnd: this.mjd1 }; }

  // Clenshaw sum of one body's table at jd (clamped into the range).
  _cheb(name, jd, out) {
    const b = this.body[name];
    const t = Math.min(Math.max(jd, this.jd0), this.jd1);
    let i = Math.floor((t - this.jd0) / b.L);
    if (i < 0) i = 0; else if (i > b.n - 1) i = b.n - 1;
    const x = 2 * (t - (this.jd0 + i * b.L)) / b.L - 1, x2 = 2 * x;
    const m = b.deg + 1, c = b.c;
    for (let ax = 0; ax < 3; ax++) {
      const o = (i * 3 + ax) * m;
      let b1 = 0, b2 = 0;
      for (let k = m - 1; k >= 1; k--) { const b0 = c[o + k] + x2 * b1 - b2; b2 = b1; b1 = b0; }
      out[ax] = c[o] + x * b1 - b2;
    }
    return out;
  }

  // Heliocentric ICRF km. 'sun' is the origin; 'emb' is the Earth-Moon barycentre.
  helio(name, jd, out = new Float64Array(3)) {
    switch (name) {
      case 'sun': out[0] = out[1] = out[2] = 0; return out;
      case 'earth': case 'moon': {
        const g = this._cheb('moon', jd, this._t);
        this._cheb('emb', jd, out);
        const f = 1 / (1 + this.emrat);
        for (let i = 0; i < 3; i++) out[i] -= g[i] * f;
        if (name === 'moon') for (let i = 0; i < 3; i++) out[i] += g[i];
        return out;
      }
      default:
        if (!this.body[name] || name === 'moon') throw new Error(`ephem: no body '${name}'`);
        return this._cheb(name, jd, out);
    }
  }

  geoMoon(jd, out = new Float64Array(3)) { return this._cheb('moon', jd, out); }

  inRange(jd) { return jd >= this.jd0 && jd <= this.jd1; }

  moons(parent) {
    return (this.byParent[parent] || []).map((m) => ({ name: m.name, naif: m.naif, parent: m.parent, aKm: m.aKm }));
  }

  // One moon relative to its planet's centre, ICRF km (the fitted ellipse).
  _moonCentre(m, jd, out) {
    const t0 = Math.min(Math.max(jd, this.mjd0), this.mjd1);
    let k = Math.floor((t0 - this.mjd0) / m.W);
    if (k < 0) k = 0; else if (k > m.nwin - 1) k = m.nwin - 1;
    const t = t0 - (this.mjd0 + (k + 0.5) * m.W);
    const p = m.p, o = k * 9;
    const a = p[o], e = p[o + 1], inc = p[o + 4];
    const O = p[o + 5] + p[o + 6] * t;
    const varpi = p[o + 2] + p[o + 3] * t;
    const M = p[o + 7] + p[o + 8] * t - varpi;
    const E = kepler(M, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const w = varpi - O;
    const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
    const cw = Math.cos(w), sw = Math.sin(w);
    const X = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
    const Y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
    const Z = (sw * si) * xp + (cw * si) * yp;
    const F = this.frames[m.parent];          // rows: ICRF -> fit; r_ICRF = F^T r_fit
    out[0] = F[0] * X + F[3] * Y + F[6] * Z;
    out[1] = F[1] * X + F[4] * Y + F[7] * Z;
    out[2] = F[2] * X + F[5] * Y + F[8] * Z;
    return out;
  }

  // The planet's centre relative to its system barycentre (km, ICRF), rebuilt from its moons.
  planetCentre(parent, jd, out = new Float64Array(3)) {
    out[0] = out[1] = out[2] = 0;
    const list = this.byParent[parent];
    if (!list) return out;
    const r = this._u;
    for (const m of list) {
      if (!m.mu) continue;
      this._moonCentre(m, jd, r);
      out[0] -= m.mu * r[0]; out[1] -= m.mu * r[1]; out[2] -= m.mu * r[2];
    }
    return out;
  }

  // A moon relative to its planet's system barycentre (km, ICRF). False outside 1950-2050.
  moon(name, jd, out = new Float64Array(3)) {
    const m = this.moonByName[name.toLowerCase()];
    if (!m) throw new Error(`ephem: no moon '${name}'`);
    const c = this.planetCentre(m.parent, jd, this._t);
    this._moonCentre(m, jd, out);
    out[0] += c[0]; out[1] += c[1]; out[2] += c[2];
    return jd >= this.mjd0 && jd <= this.mjd1;
  }

  // A moon relative to its planet's centre (km, ICRF) — for drawing it around the globe.
  moonFromCentre(name, jd, out = new Float64Array(3)) {
    const m = this.moonByName[name.toLowerCase()];
    if (!m) throw new Error(`ephem: no moon '${name}'`);
    this._moonCentre(m, jd, out);
    return jd >= this.mjd0 && jd <= this.mjd1;
  }

  // The ellipse of the window that contains jd, frozen at jd: `segments`+1 points relative to the
  // planet's centre (km, ICRF), first = last. An orbit line, not a track: the fitted ellipse of
  // the moment, which is what the moon follows for the next few revolutions.
  moonOrbit(name, jd, segments = 128) {
    const m = this.moonByName[name.toLowerCase()];
    if (!m) throw new Error(`ephem: no moon '${name}'`);
    const t0 = Math.min(Math.max(jd, this.mjd0), this.mjd1);
    let k = Math.floor((t0 - this.mjd0) / m.W);
    if (k < 0) k = 0; else if (k > m.nwin - 1) k = m.nwin - 1;
    const t = t0 - (this.mjd0 + (k + 0.5) * m.W);
    const p = m.p, o = k * 9;
    const a = p[o], e = p[o + 1], inc = p[o + 4];
    const O = p[o + 5] + p[o + 6] * t, w = p[o + 2] + p[o + 3] * t - O;
    const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
    const cw = Math.cos(w), sw = Math.sin(w), F = this.frames[m.parent];
    const out = new Float64Array(3 * (segments + 1)), b = a * Math.sqrt(1 - e * e);
    for (let s = 0; s <= segments; s++) {
      const E = TWO_PI * s / segments;
      const xp = a * (Math.cos(E) - e), yp = b * Math.sin(E);
      const X = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
      const Y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
      const Z = (sw * si) * xp + (cw * si) * yp;
      out[3 * s] = F[0] * X + F[3] * Y + F[6] * Z;
      out[3 * s + 1] = F[1] * X + F[4] * Y + F[7] * Z;
      out[3 * s + 2] = F[2] * X + F[5] * Y + F[8] * Z;
    }
    return out;
  }
}

// E - e sin E = M: M reduced to [-pi, pi), Danby's starter, Newton to machine precision.
export function kepler(M, e) {
  const Mr = ((M + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  let E = Mr + 0.85 * e * Math.sign(Math.sin(Mr));
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-15) break;
  }
  return E + (M - Mr);
}
