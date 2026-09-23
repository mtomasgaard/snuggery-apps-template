// Which way each body faces: the IAU rotation model from physical.json (CONTRACT.md section 3).
//
// physical.json carries, per body, the pole and prime-meridian polynomials of NAIF's pck00011
// (IAU WGCCRE 2015) exactly as the kernel gives them, and at the top level the nutation/
// precession angles of each planetary system:
//
//   T = Julian centuries TDB from J2000, d = days TDB from J2000
//   alpha = a0 + a1 T + a2 T^2 + sum_k nut_ra[k]  sin(theta_k)
//   delta = d0 + d1 T + d2 T^2 + sum_k nut_dec[k] cos(theta_k)
//   W     = W0 + W1 d + W2 d^2 + sum_k nut_pm[k]  sin(theta_k)
//   theta_k = sum_j nut_prec_angles[system][k][j] T^j            (all in degrees)
//
// and the body-fixed frame is Rz(W) Rx(90 deg - delta) Rz(90 deg + alpha) applied to an ICRF
// vector, where Rz/Rx are FRAME rotations (SPICE's convention): Rz(t) = [[c, s, 0], [-s, c, 0],
// [0, 0, 1]], Rx(t) = [[1, 0, 0], [0, c, s], [0, -s, c]]. This is what CSPICE's tipbod / pxform
// ('J2000' -> 'IAU_<BODY>') compute from the same kernel, and tools/test_rotation.mjs checks it
// against them. Row 2 of the matrix is the IAU north pole; row 0 points at the prime meridian.
//
// Bodies without a model in pck00011 (Hyperion, Nereid) have pole = null: bodyFrame returns null.
//
// Two ways in: bodyFrame(body, jd) on a physical.json body object (after linkRotation(physical),
// or with the system's angle list as a third argument), or loadRotation(base, physical) /
// buildRotation(physical), which return { bodyFrame(key, jd), poleAngles, spinAxis, has } keyed
// by the body names of physical.json ('mars', 'io', ...).

const DEG = Math.PI / 180;

// Give every body in physical.json a reference to its system's angle list, so bodyFrame(body, jd)
// needs nothing else. Returns the same object.
export function linkRotation(physical) {
  for (const b of Object.values(physical.bodies)) {
    if (b.pole && b.pole.system) {
      Object.defineProperty(b.pole, 'angles', {
        value: physical.nut_prec_angles[b.pole.system], enumerable: false, configurable: true,
      });
    }
  }
  return physical;
}

// Pole right ascension, declination and prime meridian W, in degrees, at jd (TDB).
export function poleAngles(body, jd, angles = null) {
  const p = body.pole;
  if (!p) return null;
  const d = jd - 2451545.0, T = d / 36525;
  let ra = p.ra[0] + p.ra[1] * T + p.ra[2] * T * T;
  let dec = p.dec[0] + p.dec[1] * T + p.dec[2] * T * T;
  let W = p.pm[0] + p.pm[1] * d + p.pm[2] * d * d;
  const th = angles || p.angles;
  const n = Math.max(p.nut_ra.length, p.nut_dec.length, p.nut_pm.length);
  if (n) {
    if (!th) throw new Error(`rotation: ${body.name} needs nut_prec_angles (call linkRotation)`);
    for (let k = 0; k < n; k++) {
      const c = th[k];
      let theta = 0;
      for (let j = c.length - 1; j >= 0; j--) theta = theta * T + c[j];
      theta *= DEG;
      if (k < p.nut_ra.length) ra += p.nut_ra[k] * Math.sin(theta);
      if (k < p.nut_dec.length) dec += p.nut_dec[k] * Math.cos(theta);
      if (k < p.nut_pm.length) W += p.nut_pm[k] * Math.sin(theta);
    }
  }
  W %= 360;
  if (W < 0) W += 360;
  return { ra, dec, W };
}

// ICRF -> body-fixed rotation at jd, 3x3 row-major.
export function bodyFrame(body, jd, angles = null, out = new Float64Array(9)) {
  const a = poleAngles(body, jd, angles);
  if (!a) return null;
  const phi = (90 + a.ra) * DEG, eps = (90 - a.dec) * DEG, w = a.W * DEG;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const ce = Math.cos(eps), se = Math.sin(eps);
  const cw = Math.cos(w), sw = Math.sin(w);
  // Rz(w) * Rx(eps) * Rz(phi), frame rotations
  out[0] = cw * cp - sw * ce * sp;  out[1] = cw * sp + sw * ce * cp;  out[2] = sw * se;
  out[3] = -sw * cp - cw * ce * sp; out[4] = -sw * sp + cw * ce * cp; out[5] = cw * se;
  out[6] = se * sp;                 out[7] = -se * cp;                out[8] = ce;
  return out;
}

// The spin axis (unit vector, ICRF): the IAU pole, reversed when W runs backwards (Venus, Uranus,
// Pluto, ...), so that the body turns counter-clockwise about it.
export function spinAxis(body, jd, angles = null) {
  const a = poleAngles(body, jd, angles);
  if (!a) return null;
  const s = body.pole.pm[1] < 0 ? -1 : 1;
  const ra = a.ra * DEG, dec = a.dec * DEG;
  return [s * Math.cos(dec) * Math.cos(ra), s * Math.cos(dec) * Math.sin(ra), s * Math.sin(dec)];
}

// Keyed access for the app: rotation.bodyFrame('mars', jd) etc., from physical.json. `physical`
// may be passed in when the caller already has it; otherwise it is fetched from `base`.
export async function loadRotation(base = 'data/', physical = null) {
  if (!physical) {
    const r = await fetch(base + 'physical.json');
    if (!r.ok) throw new Error(`${base}physical.json: HTTP ${r.status}`);
    physical = await r.json();
  }
  return buildRotation(physical);
}

export function buildRotation(physical) {
  linkRotation(physical);
  const body = (key) => physical.bodies[key] || null;
  return {
    has: (key) => !!(body(key) && body(key).pole),
    bodyFrame: (key, jd, out) => (body(key) ? bodyFrame(body(key), jd, null, out) : null),
    poleAngles: (key, jd) => (body(key) ? poleAngles(body(key), jd) : null),
    spinAxis: (key, jd) => (body(key) ? spinAxis(body(key), jd) : null),
  };
}
