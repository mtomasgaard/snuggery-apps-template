// Web Mercator (EPSG:3857), the projection the tiles are cut in. Pure: runs in Node.
// Positions are "world units": the whole world is 0 to 1 across and 0 to 1 down, north at 0. At a
// zoom z the world is 256 * 2^z CSS pixels wide, so one tile at level z is 1 / 2^z world units.

export const R = 6378137;                       // the sphere Web Mercator uses, in meters
export const LAT_MAX = 85.0511287798066;        // where the square world ends
const DEG = Math.PI / 180;

export const lonToX = (lon) => (lon + 180) / 360;
export function latToY(lat) {
  const s = Math.sin(Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)) * DEG);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
/** x wraps around the world, so a longitude is always in −180 to 180. */
export function xToLon(x) {
  const w = x - Math.floor(x);
  return w * 360 - 180;
}
export const yToLat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / DEG);
export const worldPx = (z) => 256 * 2 ** z;
/** Ground meters in one CSS pixel at a latitude and zoom: the scale is true only along that latitude. */
export const metersPerPx = (lat, z) => (2 * Math.PI * R * Math.cos(lat * DEG)) / worldPx(z);

/** The view's corners: { w, e, s, n } in degrees (w may be below −180 or e above 180 when the view
 *  crosses the 180th meridian), from its middle (world units) and size (CSS px). */
export function bounds(cx, cy, z, width, height) {
  const W = worldPx(z), hw = width / 2 / W, hh = height / 2 / W;
  return { w: (cx - hw) * 360 - 180, e: (cx + hw) * 360 - 180, n: yToLat(Math.max(0, cy - hh)), s: yToLat(Math.min(1, cy + hh)) };
}
