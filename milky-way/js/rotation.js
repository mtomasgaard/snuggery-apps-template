// Which way each body faces: the IAU rotation model from physical.json (CONTRACT.md section 3).
//
// physical.json carries NAIF pck00011's pole and prime-meridian polynomials per body and the
// nutation/precession angles per system; alpha, delta and W are evaluated as the kernel defines them
// and the body-fixed frame is Rz(W) Rx(90 deg - delta) Rz(90 deg + alpha) on an ICRF vector (SPICE's
// frame rotations, what CSPICE's tipbod/pxform compute; tools/test_rotation.mjs checks it against
// them). Row 2 is the north pole, row 0 the prime meridian. Hyperion and Nereid have no model:
// bodyFrame returns null. Ways in: bodyFrame(body, jd) after linkRotation(physical), or
// loadRotation/buildRotation, which return { bodyFrame(key, jd), poleAngles, spinAxis, has }.

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
