// Coordinates.
//
// On disk everything is absolute EPSG:25833 (ETRS89 / UTM 33N) metres. In the three.js scene
// everything is metres relative to manifest.origin, with Y up:
//
//   scene.x =  (x25833 - origin.x)
//   scene.y =  z_metres * verticalExaggeration
//   scene.z = -(y25833 - origin.y)          // +Z is south, so -Z is north
//
// The subtraction happens once, in float64, before anything reaches a Float32Array. Northings
// here are 6.8e6; in float32 that is a 0.5 m quantum, which is the difference between terrain
// that looks right and terrain that shimmers.

import { DEG, RAD } from './util.js';

// Krüger series to 4th order, parameters from manifest.wgs84. Verified in the fixture against
// pyproj 3.8.0 on nine checkpoints to 5.3 mm, so the app ships no projection library.
export function utmToWgs84(x, y, w) {
  const a = w.ellipsoid.a, f = 1 / w.ellipsoid.invF, n = f / (2 - f), k0 = w.k0;
  const A = a / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64);
  const b = [n / 2 - 2 * n ** 2 / 3 + 37 * n ** 3 / 96 - n ** 4 / 360,
    n ** 2 / 48 + n ** 3 / 15 - 437 * n ** 4 / 1440,
    17 * n ** 3 / 480 - 37 * n ** 4 / 840,
    4397 * n ** 4 / 161280];
  const d = [2 * n - 2 * n ** 2 / 3 - 2 * n ** 3, 7 * n ** 2 / 3 - 8 * n ** 3 / 5,
    56 * n ** 3 / 15, 4279 * n ** 4 / 630];
  const xi = (y - w.falseNorthing) / (k0 * A), eta = (x - w.falseEasting) / (k0 * A);
  let xip = xi, etap = eta;
  for (let j = 1; j <= 4; j++) {
    xip -= b[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etap -= b[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xip) / Math.cosh(etap));
  let lat = chi;
  for (let j = 1; j <= 4; j++) lat += d[j - 1] * Math.sin(2 * j * chi);
  const lon0 = (6 * w.zone - 183) * DEG;
  return [(lon0 + Math.atan2(Math.sinh(etap), Math.cos(xip))) * RAD, lat * RAD];
}

// Grid convergence: the angle from grid north to true north, positive when true north lies
// east of grid north. West of the central meridian (we are, at 8.7 E in a zone centred on
// 15 E) that is about -5.5 degrees, so a true bearing becomes a grid bearing by SUBTRACTING it.
// Ignoring this would put every bearing, and the sun, five and a half degrees out.
export function convergenceDeg(lon, lat, w) {
  const lon0 = 6 * w.zone - 183;
  return Math.atan(Math.tan((lon - lon0) * DEG) * Math.sin(lat * DEG)) * RAD;
}

export class Frame {
  constructor(manifest) {
    this.m = manifest;
    this.ox = manifest.origin.x;
    this.oy = manifest.origin.y;
    this.core = manifest.core;
    this.shell = manifest.shell;
    const cx = (this.core.x0 + this.core.x1) / 2, cy = (this.core.y0 + this.core.y1) / 2;
    const [lon, lat] = utmToWgs84(cx, cy, manifest.wgs84);
    this.centreLon = lon;
    this.centreLat = lat;
    // One convergence for the whole model: it varies by 0.09 degrees across the 20 km core,
    // which is far below anything the app claims.
    this.convergence = convergenceDeg(lon, lat, manifest.wgs84);
  }
  sx(x) { return x - this.ox; }
  sz(y) { return -(y - this.oy); }
  wx(sx) { return sx + this.ox; }
  wy(sz) { return this.oy - sz; }
  lonLat(x, y) { return utmToWgs84(x, y, this.m.wgs84); }
  // True bearing (clockwise from true north) of the direction from a to b, in UTM metres.
  trueBearing(ax, ay, bx, by) {
    const grid = Math.atan2(bx - ax, by - ay) * RAD;
    return (((grid + this.convergence) % 360) + 360) % 360;
  }
  // A true azimuth expressed in grid terms, for anything that walks the UTM raster.
  gridFromTrue(deg) { return deg - this.convergence; }
  // Verify the manifest's own checkpoints. Returns the worst error in millimetres.
  checkProjection() {
    let worst = 0;
    for (const c of (this.m.wgs84.checkpoints || [])) {
      const [lon, lat] = utmToWgs84(c.x, c.y, this.m.wgs84);
      // Degrees to metres, roughly, at this latitude: 111320 m per degree of latitude.
      const dy = (lat - c.lat) * 111320;
      const dx = (lon - c.lon) * 111320 * Math.cos(lat * DEG);
      worst = Math.max(worst, Math.hypot(dx, dy) * 1000);
    }
    return worst;
  }
}

// Degrees and decimal minutes, the form a paper map in Norway is gridded in.
export function fmtLonLat(lon, lat) {
  const one = (v, pos, neg) => {
    const h = v >= 0 ? pos : neg, a = Math.abs(v);
    const d = Math.floor(a), m = (a - d) * 60;
    return `${d}° ${m.toFixed(3)}′ ${h}`;
  };
  return `${one(lat, 'N', 'S')}  ${one(lon, 'E', 'W')}`;
}
