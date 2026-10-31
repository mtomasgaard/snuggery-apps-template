// Coordinates. Every tile this app reads (Kartverket's map, the trails, both height sources) is on
// the Web Mercator grid (EPSG:3857), so that is the app's one horizontal frame: X east and Y north
// in Mercator meters. Mercator is conformal, so north is up everywhere and a true bearing is a grid
// bearing; what it is not is equal-area: one Mercator meter is cos(latitude) meters on the ground,
// 0.53 at Lindesnes and 0.33 at Nordkapp.
//
// The three.js scene is Mercator meters around an origin, scaled by the cosine of the ORIGIN's
// latitude, so a scene unit is a ground meter at the origin, Y up, -Z north:
//
//   scene.x =  (X - X0) * c0
//   scene.z = -(Y - Y0) * c0
//   scene.y =  height_m * c0 / cos(lat)      the local Mercator stretch, applied per vertex
//
// Scaling heights by the same local stretch as the ground keeps every slope true wherever the
// camera is: the scene is a conformal map, isotropic at each point. The origin moves with the
// camera (Frame.rebase), so nothing near the camera is a large float32.

import { DEG, RAD } from './util.js';

export const R = 6378137;                 // the sphere Web Mercator is defined on
export const HALF = Math.PI * R;
export const WORLD = 2 * HALF;
export const EARTH = 6371000;             // mean radius, for the earth's curvature

export const mercX = (lon) => lon * DEG * R;
export const mercY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
export const lonOf = (X) => (X / R) * RAD;
export const latOf = (Y) => (2 * Math.atan(Math.exp(Y / R)) - Math.PI / 2) * RAD;
/** Ground meters per Mercator meter at Y: cos(latitude), which is 1 / cosh(Y / R). */
export const cosLat = (Y) => 1 / Math.cosh(Y / R);

export const tileSpan = (z) => WORLD / 2 ** z;
/** A tile's box in Mercator meters, y1 its northern edge. */
export function tileBox(z, x, y) {
  const s = tileSpan(z), x0 = -HALF + x * s, y1 = HALF - y * s;
  return { x0, x1: x0 + s, y0: y1 - s, y1, s };
}
export function tileOf(X, Y, z) {
  const s = tileSpan(z);
  return [Math.floor((X + HALF) / s), Math.floor((HALF - Y) / s)];
}
/** A number for a tile, exact for z up to 21 (2^21 columns): Map keys that are not strings. */
export const tkey = (z, x, y) => (z * 2097152 + x) * 2097152 + y;

/** Great-circle distance in meters on the mean sphere. */
export function haversine(lon1, lat1, lon2, lat2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dp = p2 - p1, dl = (lon2 - lon1) * DEG;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Initial true bearing from point 1 to point 2, degrees clockwise from north. */
export function bearing(lon1, lat1, lon2, lat2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * RAD) % 360 + 360) % 360;
}

/** Norway's box, with a margin of sea and border country, in degrees. */
export const NORWAY = { lon0: 3.2, lon1: 32.2, lat0: 57.6, lat1: 71.4 };

export class Frame {
  constructor(X0, Y0) { this.set(X0, Y0); }
  set(X0, Y0) { this.X0 = X0; this.Y0 = Y0; this.c0 = cosLat(Y0); }
  sx(X) { return (X - this.X0) * this.c0; }
  sz(Y) { return -(Y - this.Y0) * this.c0; }
  X(sx) { return sx / this.c0 + this.X0; }
  Y(sz) { return this.Y0 - sz / this.c0; }
  /** Scene units per meter of height at Mercator Y (the same as per ground meter there). */
  vs(Y) { return this.c0 / cosLat(Y); }
  /** Move the origin to (X1, Y1). Every scene point p becomes (p - o) * k with k = c1 / c0: the
   *  whole scene scales uniformly about the new origin, heights included, so a view is unchanged. */
  rebase(X1, Y1, points) {
    const ox = this.sx(X1), oz = this.sz(Y1), c1 = cosLat(Y1), k = c1 / this.c0;
    for (const p of points) { p.x = (p.x - ox) * k; p.y *= k; p.z = (p.z - oz) * k; }
    this.set(X1, Y1);
    return k;
  }
}
