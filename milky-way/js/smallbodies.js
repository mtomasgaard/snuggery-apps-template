// Asteroids, trans-Neptunian objects and comets: where each one is on a given date, and its orbit.
//
// Two files, written by tools/20_smallbodies.py (tools/CONTRACT.md section 4):
//
//   smallbodies.bin   column arrays, little-endian, no header, each column contiguous, at the byte
//                     offsets smallbodies.json.columns gives:
//                       q      float32   perihelion distance (au)
//                       e      float32   eccentricity (e > 1: hyperbolic; e == 1: parabolic)
//                       tp     float64   time of perihelion, days from J2000.0 (JD 2451545.0) TDB
//                       P      3xfloat32 unit vector to perihelion, ICRF        [row][x, y, z]
//                       Q      3xfloat32 unit vector 90 deg ahead in the orbit  [row][x, y, z]
//                       H      float32   absolute magnitude (comets: the total-magnitude parameter)
//                       kind   uint8     index into json.kinds
//                       flags  uint8     bit 0 weak orbit, bit 1 no epoch (json.flag_bits)
//   smallbodies.json  names, kinds, the row range of each source, epochs, labelled rows, info for
//                     labelled rows, diameters, the constants (k) and the measured accuracy.
//
// Every orbit is a two-body (Kepler) orbit of the body's osculating elements at their epoch, with
// the Sun's GM from DE440: a = q/(1-e), n = k/|a|^1.5, M = n (jd - J2000 - tp), then Kepler's
// equation — elliptic E - e sin E = M, hyperbolic e sinh F - F = M, parabolic Barker's equation —
// and r = x P + y Q (au, ICRF, heliocentric). x and y are written in the forms that stay accurate
// near e = 1: x = q - 2a sin^2(E/2), y = sqrt(a q (1+e)) sin E (hyperbola: sinh, same shape).
// Planets do not perturb these orbits, so positions drift away from the epoch; the drift was
// measured against JPL Horizons and DE430 and is in json.epoch_note / json.accuracy (for the big
// main-belt asteroids: about 0.05 au at 5-10 years, 0.3 au at 50 years).
//
// All times are Julian Dates in TDB (TT for the MPC's comets; they differ by < 2 ms). Positions are
// computed on the CPU in float64 and handed out as float32 (positionsAt) or float64 (position).

const TWO_PI = 2 * Math.PI;
const J2000 = 2451545.0;
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const SIZE = { f32: 4, f64: 8, u8: 1 };
const CTOR = { f32: Float32Array, f64: Float64Array, u8: Uint8Array };

// A typed array over one column of the buffer (ArrayBuffer, typed array or Node Buffer); copied
// when the offset is not aligned for the type or the platform is big-endian.
function column(buf, col) {
  let ab = buf, base = 0;
  if (ArrayBuffer.isView(buf)) { ab = buf.buffer; base = buf.byteOffset; }
  const size = SIZE[col.type], at = base + col.offset, Ctor = CTOR[col.type];
  if (at % size === 0 && (LITTLE_ENDIAN || size === 1)) return new Ctor(ab, at, col.length);
  const dv = new DataView(ab, at, col.length * size), out = new Ctor(col.length);
  for (let i = 0; i < col.length; i++) {
    out[i] = col.type === 'f32' ? dv.getFloat32(i * 4, true) : col.type === 'f64' ? dv.getFloat64(i * 8, true) : dv.getUint8(i);
  }
  return out;
}

// x - sin x and sinh x - x without cancellation for small x (series to x^17; |x| <= 0.5).
function xMinusSin(x) {
  if (Math.abs(x) > 0.5) return x - Math.sin(x);
  const x2 = x * x;
  return x * x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156 * (1 - x2 / 210 * (1 - x2 / 272)))))));
}
function sinhMinusX(x) {
  if (Math.abs(x) > 0.5) return Math.sinh(x) - x;
  const x2 = x * x;
  return x * x2 / 6 * (1 + x2 / 20 * (1 + x2 / 42 * (1 + x2 / 72 * (1 + x2 / 110 * (1 + x2 / 156 * (1 + x2 / 210 * (1 + x2 / 272)))))));
}

// E - e sin E = M for 0 <= M <= pi, e < 1. Newton from E0 = min(M + e, pi): that start is never
// below the root and f is convex there, so the iteration falls monotonically onto the root for
// every e < 1. f is evaluated as (1-e) E + e (E - sin E) - M, so a nearly parabolic orbit (e
// within 1e-7 of 1, E - e sin E many orders below E) keeps its digits.
export function keplerElliptic(M, e) {
  const w = 1 - e;
  let E = Math.min(M + e, Math.PI);
  for (let k = 0; k < 100; k++) {
    const h = Math.sin(E / 2);
    const d = (w * E + e * xMinusSin(E) - M) / (w + 2 * e * h * h);
    E -= d;
    if (!(Math.abs(d) > 1e-15 * Math.max(1, E))) break;
  }
  return E;
}

// e sinh F - F = M for M >= 0, e > 1: Newton from ln(2M/e + 1.8); f is convex for F > 0, so after
// at most one step the iteration is above the root and falls onto it. Same cancellation-free form.
export function keplerHyperbolic(M, e) {
  const w = e - 1;
  let F = Math.log(2 * M / e + 1.8);
  for (let k = 0; k < 100; k++) {
    const h = Math.sinh(F / 2);
    const d = (w * F + e * sinhMinusX(F) - M) / (w + 2 * e * h * h);
    F -= d;
    if (!(Math.abs(d) > 1e-15 * Math.max(1, F))) break;
  }
  return F;
}

// In-plane coordinates (x toward perihelion, y 90 degrees ahead) at dt days after perihelion.
function planeXY(q, e, dt, k, out) {
  if (e < 1) {
    const a = q / (1 - e);
    let M = (k / (a * Math.sqrt(a))) * dt;
    M -= TWO_PI * Math.round(M / TWO_PI);                 // into [-pi, pi]
    const E = M < 0 ? -keplerElliptic(-M, e) : keplerElliptic(M, e);
    const s = Math.sin(E / 2);
    out[0] = q - 2 * a * s * s;
    out[1] = Math.sqrt(a * q * (1 + e)) * Math.sin(E);
  } else if (e > 1) {
    const a = q / (e - 1);
    const M = (k / (a * Math.sqrt(a))) * dt;
    const F = M < 0 ? -keplerHyperbolic(-M, e) : keplerHyperbolic(M, e);
    const s = Math.sinh(F / 2);
    out[0] = q - 2 * a * s * s;
    out[1] = Math.sqrt(a * q * (1 + e)) * Math.sinh(F);
  } else {
    // Barker: s = tan(nu/2) solves s^3 + 3s = 2w, w = 1.5 k sqrt(1/(2q^3)) dt.
    const w = 1.5 * k * Math.sqrt(1 / (2 * q * q * q)) * Math.abs(dt);
    const Y = Math.cbrt(w + Math.sqrt(w * w + 1));
    const s = (Y - 1 / Y) * (dt < 0 ? -1 : 1);
    out[0] = q * (1 - s * s);
    out[1] = 2 * q * s;
  }
  return out;
}

function ymd(jd) {
  // Gregorian calendar date of a JD (Meeus ch. 7), for info text only.
  const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const A = z < 2299161 ? z : z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C);
  const Ed = Math.floor((B - D) / 30.6001);
  const day = Math.floor(B - D - Math.floor(30.6001 * Ed) + f);
  const month = Ed < 14 ? Ed - 1 : Ed - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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

// Fetches smallbodies.json and smallbodies.bin under `base`.
export async function loadSmallBodies(base = 'data/') {
  const [json, buf] = await Promise.all([getJSON(base + 'smallbodies.json'), getBuffer(base + 'smallbodies.bin')]);
  return buildSmallBodies(json, buf);
}

// The same from already-loaded files (Node tests read them with fs).
export function buildSmallBodies(json, buf) {
  return new SmallBodies(json, buf);
}

// Open orbits and orbitPath(): the arc runs from `ARC_YEARS` before perihelion to as long after,
// widened so the date asked for is always on it.
const ARC_YEARS = 10;

export class SmallBodies {
  constructor(json, buf) {
    this.meta = json;
    this.count = json.count;
    this.k = json.k_gauss_au15_day;
    const col = {};
    for (const c of json.columns) col[c.name] = column(buf, c);
    for (const name of ['q', 'e', 'tp', 'P', 'Q', 'H', 'kind', 'flags']) {
      if (!col[name]) throw new Error(`smallbodies: column ${name} missing`);
    }
    this.q = col.q; this.e = col.e; this.tp = col.tp; this.P = col.P; this.Q = col.Q;
    this.Hs = col.H; this.kinds = col.kind; this.flagBits = col.flags;
    this.kindNames = [];
    for (const [code, key] of Object.entries(json.kinds)) this.kindNames[+code] = key;
    this.kindLabels = json.kind_labels || {};
    this.names = json.names;
    this.labelled = json.labelled.slice();
    this.sources = json.sources;
    this.srcOf = new Uint8Array(this.count);
    json.sources.forEach((s, si) => this.srcOf.fill(si, s.first, s.first + s.count));
    this.epochOf = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) this.epochOf[i] = json.sources[this.srcOf[i]].epoch_jd;
    for (const [jd, rows] of Object.entries(json.epochs)) for (const i of rows) this.epochOf[i] = +jd;
    for (let i = 0; i < this.count; i++) if (this.flagBits[i] & 2) this.epochOf[i] = NaN;
    this._xy = new Float64Array(2);
  }

  kind(i) { return this.kindNames[this.kinds[i]]; }
  kindCode(i) { return this.kinds[i]; }
  kindLabel(i) { const k = this.kind(i); return this.kindLabels[k] || k; }
  name(i) { return this.names[i]; }
  H(i) { return this.Hs[i]; }
  flags(i) { return this.flagBits[i]; }
  weakOrbit(i) { return (this.flagBits[i] & 1) !== 0; }
  source(i) { return this.sources[this.srcOf[i]]; }
  epoch(i) { const v = this.epochOf[i]; return Number.isNaN(v) ? null : v; }   // JD TDB, or null

  // Osculating elements as stored: q (au), e, a (au, negative for hyperbolae, Infinity for a
  // parabola), tp (JD TDB), P and Q (ICRF unit vectors), period in days (elliptic only).
  elements(i) {
    const q = this.q[i], e = this.e[i];
    const a = e === 1 ? Infinity : q / (1 - e);
    return {
      q, e, a, tp: this.tp[i] + J2000, epoch: this.epoch(i),
      P: [this.P[3 * i], this.P[3 * i + 1], this.P[3 * i + 2]],
      Q: [this.Q[3 * i], this.Q[3 * i + 1], this.Q[3 * i + 2]],
      period: e < 1 ? TWO_PI * Math.sqrt(a * a * a) / this.k : null,
    };
  }

  // Everything known about row i for an info card: H, diameter, albedo, rotation, SBDB class and
  // orbit id, the source and a note on how good the position is.
  info(i) {
    const m = this.meta, extra = (m.info && m.info[i]) || {};
    const out = Object.assign({}, extra);
    const H = this.Hs[i];
    if (Number.isFinite(H)) out.H = H;
    if (out.diameter_km == null && m.diameter_km && m.diameter_km[i] != null) out.diameter_km = m.diameter_km[i];
    out.kind = this.kind(i);
    out.kindLabel = this.kindLabel(i);
    const src = this.source(i), ep = this.epoch(i);
    out.epoch = ep;
    out.source = src.label + (out.orbit_id ? `; orbit ${out.orbit_id}` : '') + (out.orbit_ref ? `; ${out.orbit_ref}` : '')
      + (out.phys_ref ? `. Physical values — ${out.phys_ref}` : out.phys_from ? `. Size from ${out.phys_from}` : '');
    const notes = [];
    if (ep != null) notes.push(`Orbit elements for ${ymd(ep)}; the position is a two-body extrapolation from that date, less accurate the further from it.`);
    else notes.push('The source gives no epoch for these elements; the position is a two-body extrapolation.');
    if (this.weakOrbit(i)) notes.push('Poorly determined orbit (fitted at most twice by JPL, or an assumed near-circular one): where it is along its orbit may be far off.');
    if (out.kind === 'dwarf') notes.push(m.dwarf_note);
    out.note = notes.join(' ');
    return out;
  }

  // Heliocentric ICRF position of row i at jd (au, float64).
  position(i, jd, out = new Float64Array(3)) {
    const xy = planeXY(this.q[i], this.e[i], jd - J2000 - this.tp[i], this.k, this._xy);
    const P = this.P, Q = this.Q, j = 3 * i;
    out[0] = xy[0] * P[j] + xy[1] * Q[j];
    out[1] = xy[0] * P[j + 1] + xy[1] * Q[j + 1];
    out[2] = xy[0] * P[j + 2] + xy[1] * Q[j + 2];
    return out;
  }

  // Every row at jd into `out` (Float32Array or Float64Array of 3 x count, au, ICRF).
  positionsAt(jd, out = new Float32Array(this.count * 3)) {
    const q = this.q, e = this.e, tp = this.tp, P = this.P, Q = this.Q, k = this.k, xy = this._xy;
    const t = jd - J2000;
    for (let i = 0, j = 0; i < this.count; i++, j += 3) {
      planeXY(q[i], e[i], t - tp[i], k, xy);
      out[j] = xy[0] * P[j] + xy[1] * Q[j];
      out[j + 1] = xy[0] * P[j + 1] + xy[1] * Q[j + 1];
      out[j + 2] = xy[0] * P[j + 2] + xy[1] * Q[j + 2];
    }
    return out;
  }

  // The orbit of row i as a polyline, Float32Array of 3 x (segments + 1), au, ICRF heliocentric.
  // Ellipse: closed, starting and ending at the body's position at jdCentre, even steps in the
  // eccentric anomaly (dense near perihelion, where the orbit bends). Hyperbola / parabola: the arc
  // from max(ARC_YEARS, |jdCentre - tp| + 1 yr) before perihelion to as long after, even steps in
  // the hyperbolic anomaly (or in tan(nu/2)).
  orbitPath(i, jdCentre, segments = 256) {
    const q = this.q[i], e = this.e[i], k = this.k, j = 3 * i;
    const Px = this.P[j], Py = this.P[j + 1], Pz = this.P[j + 2];
    const Qx = this.Q[j], Qy = this.Q[j + 1], Qz = this.Q[j + 2];
    const out = new Float32Array(3 * (segments + 1));
    const put = (s, x, y) => {
      out[3 * s] = x * Px + y * Qx; out[3 * s + 1] = x * Py + y * Qy; out[3 * s + 2] = x * Pz + y * Qz;
    };
    const dt = jdCentre - J2000 - this.tp[i];
    if (e < 1) {
      const a = q / (1 - e), b = Math.sqrt(a * q * (1 + e));
      let M = (k / (a * Math.sqrt(a))) * dt;
      M -= TWO_PI * Math.round(M / TWO_PI);
      const E0 = M < 0 ? -keplerElliptic(-M, e) : keplerElliptic(M, e);
      for (let s = 0; s <= segments; s++) {
        const E = E0 + TWO_PI * (s === segments ? 0 : s / segments);
        const h = Math.sin(E / 2);
        put(s, q - 2 * a * h * h, b * Math.sin(E));
      }
      return out;
    }
    const span = Math.max(ARC_YEARS * 365.25, Math.abs(dt) + 365.25);
    if (e > 1) {
      const a = q / (e - 1), b = Math.sqrt(a * q * (1 + e));
      const F1 = keplerHyperbolic((k / (a * Math.sqrt(a))) * span, e);
      for (let s = 0; s <= segments; s++) {
        const F = -F1 + 2 * F1 * s / segments;
        const h = Math.sinh(F / 2);
        put(s, q - 2 * a * h * h, b * Math.sinh(F));
      }
      return out;
    }
    const xy = planeXY(q, e, span, k, this._xy);
    const s1 = xy[1] / (2 * q);
    for (let s = 0; s <= segments; s++) {
      const u = -s1 + 2 * s1 * s / segments;
      put(s, q * (1 - u * u), 2 * q * u);
    }
    return out;
  }
}
