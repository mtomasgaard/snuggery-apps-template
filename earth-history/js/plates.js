// Quaternions, rotating the present-day geometry to each map, validity, arrows and the tap lookup
// (DESIGN §7; CONTRACT §3, §4, §15.2). Rotations ship as R(t)·R(0)⁻¹, so each is applied straight
// to the present-day geometry. Pure JS on typed arrays: tools/test_plates.mjs runs it in Node.

import { DEG, clamp } from './util.js';
import { mollTheta } from './proj.js';

export const EARTH_KM = 6371;

/** The renormalised quaternion [w, x, y, z] of plate index pi at slice i, k = 0 (T) or 1 (T + 1). */
export function quatAt(pl, i, k, pi, out = new Float64Array(4)) {
  const o = ((i * 2 + k) * pl.P + pi) * 4, r = pl.rotations;
  const w = r[o], x = r[o + 1], y = r[o + 2], z = r[o + 3];
  const n = Math.hypot(w, x, y, z) || 1;
  out[0] = w / n; out[1] = x / n; out[2] = y / n; out[3] = z / n;
  return out;
}
/** p' = p + w t + v × t, t = 2 (v × p). `inverse` rotates by the conjugate. */
export function rotate(q, px, py, pz, out, o = 0, inverse = false) {
  const w = q[0], s = inverse ? -1 : 1, x = s * q[1], y = s * q[2], z = s * q[3];
  const tx = 2 * (y * pz - z * py), ty = 2 * (z * px - x * pz), tz = 2 * (x * py - y * px);
  out[o] = px + w * tx + (y * tz - z * ty);
  out[o + 1] = py + w * ty + (z * tx - x * tz);
  out[o + 2] = pz + w * tz + (x * ty - y * tx);
  return out;
}
function unit(lonDeg, latDeg, out, o) {
  const l = lonDeg * DEG, p = latDeg * DEG, c = Math.cos(p);
  out[o] = c * Math.cos(l); out[o + 1] = c * Math.sin(l); out[o + 2] = Math.sin(p);
}
const lonLat = (x, y, z) => [Math.atan2(y, x) / DEG, Math.asin(clamp(z, -1, 1)) / DEG];
const angle = (a, b) => Math.atan2(Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);

/** Speed (cm/yr) and compass bearing (deg) of motion from b (T + 1) to a (T), seen at a (§7.3). */
export function motion(a, b) {
  const speed = angle(a, b) * EARTH_KM * 0.1;              // km per Myr × 0.1 = cm/yr
  const [lon, lat] = lonLat(a[0], a[1], a[2]);
  const l = lon * DEG, p = lat * DEG;
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  const east = -Math.sin(l) * dx + Math.cos(l) * dy;
  const north = -Math.sin(p) * Math.cos(l) * dx - Math.sin(p) * Math.sin(l) * dy + Math.cos(p) * dz;
  return { speed, bearing: (Math.atan2(east, north) / DEG + 360) % 360 };
}
const POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const compass = (bearing) => POINTS[Math.round(bearing / 45) % 8];

/**
 * The plates model over the decoded plates.bin and coast.bin (data.js). setStop(i) rotates every
 * vertex that exists at slice i once; the overlay then only projects.
 */
export function createPlates(pl, coast) {
  const ringXYZ = new Float64Array(pl.V * 3);
  for (let v = 0; v < pl.V; v++) unit(pl.vertices[2 * v] * pl.lonScale, pl.vertices[2 * v + 1] * pl.latScale, ringXYZ, 3 * v);
  const coastXYZ = new Float32Array(coast.V * 3);
  const tmp = [0, 0, 0];
  for (let v = 0; v < coast.V; v++) { unit(coast.vertices[2 * v] * coast.lonScale, coast.vertices[2 * v + 1] * coast.latScale, tmp, 0); coastXYZ.set(tmp, 3 * v); }
  const anchors = new Float64Array(pl.R * 3);
  for (let r = 0; r < pl.R; r++) unit(pl.ringAnchor[2 * r] * pl.lonScale, pl.ringAnchor[2 * r + 1] * pl.latScale, anchors, 3 * r);

  // Per-stop rotated geometry: unit vectors, longitude (rad) and Mollweide θ per vertex.
  const rings = { xyz: new Float32Array(pl.V * 3), lam: new Float32Array(pl.V), th: new Float32Array(pl.V), valid: new Uint8Array(pl.R) };
  const coasts = { xyz: new Float32Array(coast.V * 3), lam: new Float32Array(coast.V), th: new Float32Array(coast.V), valid: new Uint8Array(coast.N) };
  const quats = new Float64Array(pl.P * 4);
  const q = new Float64Array(4), out = [0, 0, 0];
  let stop = -1, T = 0;

  const ringValidAt = (r, t) => pl.ringEnd[r] <= Math.fround(t) && Math.fround(t) <= pl.ringBegin[r];

  function rotateInto(dst, src, v, qq) {
    rotate(qq, src[3 * v], src[3 * v + 1], src[3 * v + 2], out, 0);
    const n = Math.hypot(out[0], out[1], out[2]);
    dst.xyz[3 * v] = out[0] / n; dst.xyz[3 * v + 1] = out[1] / n; dst.xyz[3 * v + 2] = out[2] / n;
  }
  // Longitude and Mollweide θ per vertex depend only on the rotated position, so they are computed
  // once per stop — and only when the map view first draws that stop (the globe needs neither).
  let mapStop = -1;
  function mapArrays(dst, starts, counts, valid, n) {
    for (let k = 0; k < n; k++) {
      if (!valid[k]) continue;
      for (let v = starts[k], e = v + counts[k]; v < e; v++) {
        const x = dst.xyz[3 * v], y = dst.xyz[3 * v + 1], z = dst.xyz[3 * v + 2];
        dst.lam[v] = Math.atan2(y, x);
        dst.th[v] = mollTheta(Math.asin(clamp(z, -1, 1)));
      }
    }
  }

  const P = {
    rings, coasts, ringXYZ, pl, coast,
    get stop() { return stop; },
    get T() { return T; },
    /** Rotate everything that exists at slice i (§7.1–7.2). Returns the ms it took. */
    setStop(i) {
      const t0 = performance.now();
      stop = i; T = pl.times[i][0]; mapStop = -1;
      for (let p = 0; p < pl.P; p++) quats.set(quatAt(pl, i, 0, p, q), 4 * p);
      const qp = (pi) => quats.subarray(4 * pi, 4 * pi + 4);
      for (let r = 0; r < pl.R; r++) {
        const ok = ringValidAt(r, T);
        rings.valid[r] = ok ? 1 : 0;
        if (!ok) continue;
        const qq = qp(pl.ringPlate[r]), s = pl.ringStart[r], e = s + pl.ringCount[r];
        for (let v = s; v < e; v++) rotateInto(rings, ringXYZ, v, qq);
      }
      for (let k = 0; k < coast.N; k++) {
        const ok = Math.fround(T) <= coast.segBegin[k];
        coasts.valid[k] = ok ? 1 : 0;
        if (!ok) continue;
        const qq = qp(coast.segPlate[k]), s = coast.segStart[k], e = s + coast.segCount[k];
        for (let v = s; v < e; v++) rotateInto(coasts, coastXYZ, v, qq);
      }
      return performance.now() - t0;
    },
    ringValidAt,
    /** Make sure λ and θ are cached for the current stop (the map view); returns the ms it took. */
    needMap() {
      if (mapStop === stop) return 0;
      const t0 = performance.now();
      mapArrays(rings, pl.ringStart, pl.ringCount, rings.valid, pl.R);
      mapArrays(coasts, coast.segStart, coast.segCount, coasts.valid, coast.N);
      mapStop = stop;
      return performance.now() - t0;
    },
    /** Arrows for the current stop (§7.3): rings valid at T with area ≥ the minimum, larger first. */
    arrows() {
      const list = [], q0 = new Float64Array(4), q1 = new Float64Array(4), a = [0, 0, 0], b = [0, 0, 0];
      for (let r = 0; r < pl.R; r++) {
        if (!rings.valid[r] || pl.ringArea[r] < pl.arrowMinArea) continue;
        const pi = pl.ringPlate[r];
        quatAt(pl, stop, 0, pi, q0); quatAt(pl, stop, 1, pi, q1);
        rotate(q0, anchors[3 * r], anchors[3 * r + 1], anchors[3 * r + 2], a, 0);
        rotate(q1, anchors[3 * r], anchors[3 * r + 1], anchors[3 * r + 2], b, 0);
        const m = motion(a, b);
        list.push({ ring: r, area: pl.ringArea[r], a: [...a], b: [...b], speed: m.speed, bearing: m.bearing });
      }
      return list.sort((x, y) => y.area - x.area);
    },
    /**
     * "Where is this rock today" (§7.4): the smallest ring valid at T whose present-day polygon holds
     * the tapped point rotated back by its plate's rotation, or null.
     */
    lookup(lonDeg, latDeg) {
      const p = [0, 0, 0]; unit(lonDeg, latDeg, p, 0);
      let best = null;
      const back = [0, 0, 0];
      for (let r = 0; r < pl.R; r++) {
        if (!rings.valid[r] || (best && pl.ringArea[r] >= best.area)) continue;
        const pi = pl.ringPlate[r];
        rotate(quats.subarray(4 * pi, 4 * pi + 4), p[0], p[1], p[2], back, 0, true);
        if (!contains(r, back)) continue;
        best = { ring: r, pi, plate: pl.plates[pi], area: pl.ringArea[r], present: lonLat(back[0], back[1], back[2]), begin: pl.ringBegin[r], end: pl.ringEnd[r] };
      }
      if (best) {
        const q0 = quatAt(pl, stop, 0, best.pi), q1 = quatAt(pl, stop, 1, best.pi), a = [0, 0, 0], b = [0, 0, 0], p0 = [0, 0, 0];
        unit(best.present[0], best.present[1], p0, 0);
        rotate(q0, p0[0], p0[1], p0[2], a, 0); rotate(q1, p0[0], p0[1], p0[2], b, 0);
        Object.assign(best, motion(a, b));
      }
      return best;
    },
    /** Speed (cm/yr) and bearing at the current stop of a present-day point on plate index pi. */
    motionOf(pi, lonDeg, latDeg) {
      const p0 = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0];
      unit(lonDeg, latDeg, p0, 0);
      rotate(quatAt(pl, stop, 0, pi), p0[0], p0[1], p0[2], a, 0);
      rotate(quatAt(pl, stop, 1, pi), p0[0], p0[1], p0[2], b, 0);
      return motion(a, b);
    },
    /** A present-day point on plate index pi, rotated to the current stop: [lon, lat]. */
    place(pi, lonDeg, latDeg) {
      const p = [0, 0, 0]; unit(lonDeg, latDeg, p, 0);
      rotate(quats.subarray(4 * pi, 4 * pi + 4), p[0], p[1], p[2], out, 0);
      return lonLat(out[0], out[1], out[2]);
    },
  };

  // Spherical winding number: the sum of the signed angles the edges subtend at the point;
  // |sum| > π means the ring separates the point from its antipode (§7.4). Seen from a point, a
  // ring around the point's antipode winds too, with the opposite sign — so a point is inside only
  // when it winds with the same sign as the ring's own interior anchor does.
  function winding(p, start, count) {
    let sum = 0;
    const px = p[0], py = p[1], pz = p[2];
    for (let j = 0; j < count; j++) {
      const i1 = 3 * (start + j), i2 = 3 * (start + ((j + 1) % count));
      const ax = ringXYZ[i1], ay = ringXYZ[i1 + 1], az = ringXYZ[i1 + 2];
      const bx = ringXYZ[i2], by = ringXYZ[i2 + 1], bz = ringXYZ[i2 + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      const pa = px * ax + py * ay + pz * az, pb = px * bx + py * by + pz * bz;
      sum += Math.atan2(px * cx + py * cy + pz * cz, ax * bx + ay * by + az * bz - pa * pb);
    }
    return sum;
  }
  const ringSign = new Int8Array(pl.R);
  let unsigned = 0;
  for (let r = 0; r < pl.R; r++) {
    const w = winding(anchors.subarray(3 * r, 3 * r + 3), pl.ringStart[r], pl.ringCount[r]);
    if (Math.abs(w) > Math.PI) ringSign[r] = Math.sign(w);
    else unsigned++;
  }
  function contains(r, p) {
    const w = winding(p, pl.ringStart[r], pl.ringCount[r]);
    if (Math.abs(w) <= Math.PI) return false;
    // An anchor that fell outside its ring after quantisation: rings are smaller than a hemisphere,
    // so the point must be nearer the ring's vertices than their antipodes.
    if (!ringSign[r]) return ringXYZ[3 * pl.ringStart[r]] * p[0] + ringXYZ[3 * pl.ringStart[r] + 1] * p[1] + ringXYZ[3 * pl.ringStart[r] + 2] * p[2] > -0.5;
    return Math.sign(w) === ringSign[r];
  }
  P.contains = contains;
  P.unsignedRings = unsigned;
  return P;
}

/** Great-circle distance in km between two [lon, lat] (degrees). */
export function distanceKm(a, b) {
  const p1 = a[1] * DEG, p2 = b[1] * DEG, dl = (b[0] - a[0]) * DEG;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
