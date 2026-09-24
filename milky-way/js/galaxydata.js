// The galaxy layer's data: the frame it lives in, the measured tracers, the arm fits and the three
// face-on textures, decoded exactly as tools/50_galaxy.py wrote them (tools/CONTRACT.md section 8).
// No drawing here — js/galaxy.js draws; this module owns the numbers and how to read them.
//
// Files (under data/galaxy/):
//
//   galaxy.json                everything but the pixels. Coordinates are kiloparsecs in astropy's
//                              Galactocentric frame, parameter set "v4.0": origin at the Galactic
//                              centre, +x from the Sun towards the centre (the Sun at x = -8.122),
//                              +y towards Galactic longitude 90 deg, +z towards the North Galactic
//                              Pole. frame.to_icrs is a 4x4 row-major affine matrix taking those
//                              kpc to ICRS kpc centred on the Sun (the stars' and planets' axes).
//   young-gaiadr3-ob.png       Gaia overdensity maps of young stars, RGBA, one pixel per 0.1 kpc
//   young-poggio2021-ums.png   grid node: R = G = B = code, overdensity = lo + code/255 (hi - lo);
//                              A = 0 where the published grid holds no data (beyond ~4 kpc).
//   model.png                  8-bit gray face-on surface density of a MODEL (McMillan 2017 discs +
//                              Portail 2017 bar): Sigma = black (white/black)^(code/255) Msun/kpc^2,
//                              code 0 = at or below black.
//
// Every image is the view from the North Galactic Pole: column c (0 = left), row r (0 = top) of a
// W x H image with extent [x0, x1, y0, y1] covers x = x0 + (c + 0.5)(x1 - x0)/W,
// y = y1 - (r + 0.5)(y1 - y0)/H. A three.js PlaneGeometry of that extent in the x-y plane, with its
// default UVs and texture.flipY = true (the default), therefore shows it the right way round.
//
// Arms are two published FITS (Reid+2019 to masers, Drimmel+2024 to Cepheids), each only over the
// azimuths it was fitted to; the model texture is a model. Streams marked `approximate` have a
// constructed sky path or no measured distance track (see each stream's note).

// Load galaxy.json (the textures are for the renderer to load; their paths are in the result).
export async function loadGalaxyData(base = 'data/') {
  const r = await fetch(base + 'galaxy/galaxy.json');
  if (!r.ok) throw new Error(`galaxy.json: ${r.status}`);
  return buildGalaxyData(await r.json());
}

// The same from an already-parsed galaxy.json (Node tests).
export function buildGalaxyData(json) {
  return new GalaxyData(json);
}

export class GalaxyData {
  constructor(json) {
    this.meta = json;
    const f = json.frame;
    const M = Array.isArray(f.to_icrs[0]) ? f.to_icrs.flat() : f.to_icrs;
    this.toIcrsMatrix = Float64Array.from(M);            // row-major 4x4
    this.sun = Float64Array.from(f.sun_kpc);
    this.r0 = f.r0_kpc;
    this.globulars = json.globulars || [];
    this.satellites = json.satellites || [];
    this.streams = json.streams || [];
    this.armsReid = json.arms_reid2019 || [];
    this.armsDrimmel = json.arms_drimmel2024 || [];
    this.young = (json.young && json.young.files) || {};
    this.model = json.model || null;
  }

  // Galactocentric kpc -> ICRS kpc from the Sun. p, out: any 3-element arrays.
  toIcrs(p, out = new Float64Array(3)) {
    const M = this.toIcrsMatrix, x = p[0], y = p[1], z = p[2];
    out[0] = M[0] * x + M[1] * y + M[2] * z + M[3];
    out[1] = M[4] * x + M[5] * y + M[6] * z + M[7];
    out[2] = M[8] * x + M[9] * y + M[10] * z + M[11];
    return out;
  }

  // ICRS kpc from the Sun -> Galactocentric kpc (the rotation part is orthonormal: R^T (q - t)).
  fromIcrs(q, out = new Float64Array(3)) {
    const M = this.toIcrsMatrix;
    const a = q[0] - M[3], b = q[1] - M[7], c = q[2] - M[11];
    out[0] = M[0] * a + M[4] * b + M[8] * c;
    out[1] = M[1] * a + M[5] * b + M[9] * c;
    out[2] = M[2] * a + M[6] * b + M[10] * c;
    return out;
  }

  // Where a Galactocentric point is seen from the Sun: RA, Dec (deg, ICRS) and distance (kpc).
  raDecDist(p) {
    const q = this.toIcrs(p);
    const d = Math.hypot(q[0], q[1], q[2]);
    let ra = Math.atan2(q[1], q[0]) * 180 / Math.PI;
    if (ra < 0) ra += 360;
    return { ra, dec: Math.asin(q[2] / d) * 180 / Math.PI, dist: d };
  }

  // Image metadata by key: 'model' or a key of young.files ('gaiadr3_ob', 'poggio2021_ums').
  image(key) {
    const m = key === 'model' ? this.model : this.young[key];
    if (!m) throw new Error(`no galaxy image "${key}"`);
    const e = m.extent_kpc || this.meta.young.extent_kpc;
    return { file: m.file, width: m.width, height: m.height, extent: e, z: m.z_kpc || 0, meta: m };
  }

  // Centre of pixel (col, row) in Galactocentric kpc, [x, y].
  pixelCentre(key, col, row, out = [0, 0]) {
    const { width: W, height: H, extent: e } = this.image(key);
    out[0] = e[0] + (col + 0.5) * (e[1] - e[0]) / W;
    out[1] = e[3] - (row + 0.5) * (e[3] - e[2]) / H;
    return out;
  }

  // The pixel containing Galactocentric (x, y), or null outside the image.
  pixelAt(key, x, y) {
    const { width: W, height: H, extent: e } = this.image(key);
    const col = Math.floor((x - e[0]) / (e[1] - e[0]) * W), row = Math.floor((e[3] - y) / (e[3] - e[2]) * H);
    return col < 0 || col >= W || row < 0 || row >= H ? null : { col, row };
  }

  // three.js texture coordinate of Galactocentric (x, y) with flipY = true: u right, v = 1 at row 0.
  uv(key, x, y, out = [0, 0]) {
    const e = this.image(key).extent;
    out[0] = (x - e[0]) / (e[1] - e[0]);
    out[1] = (y - e[2]) / (e[3] - e[2]);
    return out;
  }

  // Overdensity of a young-star map pixel from its red channel and alpha; null where no data.
  youngValue(key, code, alpha = 255) {
    if (alpha === 0) return null;
    const enc = this.young[key].encoding;
    return enc.lo + code / 255 * (enc.hi - enc.lo);
  }

  // Model surface density (Msun/kpc^2) of a model.png code; 0 means "at or below black".
  modelSigma(code) {
    const s = this.model.stretch;
    return code <= 0 ? 0 : s.black_msun_kpc2 * Math.pow(s.white_msun_kpc2 / s.black_msun_kpc2, code / 255);
  }

  // A stream whose sky path is a constructed great circle or whose distance is not a measured track.
  streamApproximate(i) {
    const s = this.streams[i];
    return !!(s.approximate || s.quality !== 'track' || s.great_circle);
  }
}
