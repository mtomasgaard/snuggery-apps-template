// What you can see from where: viewshed, point-to-point line of sight, named peaks on the
// horizon, and the two-point measure. All of it ray-marches the flat height grids the terrain
// assembles from tiles it has already downloaded, so nothing here needs data of its own.

import { DEG, RAD, clamp } from './util.js';

// Radial sweep. For each azimuth, march outward keeping the largest elevation angle seen so far;
// a sample is visible exactly when it rises above that running maximum. O(azimuths * range),
// which is what makes it usable on a phone instead of testing every cell against the eye.
//
// The azimuth count is chosen so the gap between neighbouring rays at the far edge is about four
// cells, and each visible sample is splatted into a disc that grows with distance, so the far
// field fills in rather than turning into a fan of spokes.
// targetAboveGround is the standard second offset of a viewshed: the question is not "can I see
// that patch of dirt" but "could I see a person standing there", and on a long uniform slope
// seen from its own top — which is exactly Veslfjellet — the two answers differ over kilometres.
// The horizon is still built from the bare ground; only the test is raised.
export function viewshed(grid, ex, ey, eyeAboveGround, radiusM, sampleH, targetAboveGround = 1.7) {
  const nx = grid.nx, ny = grid.ny, res = grid.res;
  const out = new Uint8Array(nx * ny);
  const eyeGround = sampleH(ex, ey);
  const eyeZ = eyeGround + eyeAboveGround;
  const nAz = clamp(Math.round(2 * Math.PI * radiusM / (res * 4)), 720, 2880);
  const dTheta = 2 * Math.PI / nAz;
  const step = res;
  const put = (x, y, rad) => {
    const c0 = Math.round((x - grid.x0) / res), r0 = Math.round((grid.y1 - y) / res);
    for (let dr = -rad; dr <= rad; dr++) {
      const r = r0 + dr;
      if (r < 0 || r >= ny) continue;
      for (let dc = -rad; dc <= rad; dc++) {
        const c = c0 + dc;
        if (c < 0 || c >= nx) continue;
        out[r * nx + c] = 255;
      }
    }
  };
  put(ex, ey, 1);
  let samples = 0;
  for (let a = 0; a < nAz; a++) {
    const th = a * dTheta;
    const ux = Math.sin(th), uy = Math.cos(th);
    let maxAng = -Infinity;
    for (let t = step; t <= radiusM; t += step) {
      const x = ex + ux * t, y = ey + uy * t;
      if (x < grid.x0 || x > grid.x1 || y < grid.y0 || y > grid.y1) break;
      const h = sampleH(x, y);
      samples++;
      const ground = (h - eyeZ) / t;
      if ((h + targetAboveGround - eyeZ) / t >= maxAng) {
        put(x, y, t * dTheta > res * 2 ? Math.min(3, Math.round(t * dTheta / (2 * res))) : 0);
      }
      if (ground > maxAng) maxAng = ground;
    }
  }
  return { mask: out, eyeZ, eyeGround, nAz, samples, radiusM, targetAboveGround };
}

// Point to point. Returns the terrain profile, the sight line and every stretch that blocks it,
// which is what the cross-section in the panel draws.
//
// `tol` is the height the ground has to rise above the sight line before the line counts as
// blocked, and it is not a fudge: the profile is sampled every 12 m along the ground, heights are
// quantised to decimetres and interpolated between grid nodes, so an encroachment of a few
// centimetres is below what the model can resolve. Without it, sighting the exact top of a summit
// reports "blocked by up to 0 m" — the last few metres of the summit cone poke centimetres above a
// line that ends on the summit itself — which is both wrong and unreadable. The measured value is
// still returned as `worst`, and `grazes` says the line came within `tol` of the ground.
export function lineOfSight(sampleH, ax, ay, aEye, bx, by, bEye, maxSamples = 700, tol = 0.5) {
  const dist = Math.hypot(bx - ax, by - ay);
  const n = clamp(Math.round(dist / 12), 40, maxSamples);
  const az = sampleH(ax, ay) + aEye, bz = sampleH(bx, by) + bEye;
  const prof = new Float64Array(n + 1), sight = new Float64Array(n + 1);
  let clear = true, worst = 0, worstAt = 0;
  const blocks = [];
  let cur = null;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
    const h = sampleH(x, y);
    prof[i] = h;
    sight[i] = az + (bz - az) * f;
    const over = h - sight[i];
    if (i > 0 && i < n && over > worst) { worst = over; worstAt = f; }
    if (i > 0 && i < n && over > tol) {
      clear = false;
      if (!cur) { cur = { from: f, to: f, peak: over }; blocks.push(cur); }
      else { cur.to = f; cur.peak = Math.max(cur.peak, over); }
    } else cur = null;
  }
  return { n, dist, az, bz, prof, sight, clear, worst, worstAt, blocks,
           grazes: clear && worst > -tol, tol };
}

// Is a named point visible from the eye? A coarse march first, then the blocking test, so the
// peak labels do not cost a full profile each.
export function visibleFrom(sampleH, ex, ey, eyeZ, px, py, pz, step = 30) {
  const dist = Math.hypot(px - ex, py - ey);
  if (dist < 1) return true;
  const ux = (px - ex) / dist, uy = (py - ey) / dist;
  for (let t = step; t < dist - step * 0.5; t += step) {
    const f = t / dist;
    const line = eyeZ + (pz - eyeZ) * f;
    if (sampleH(ex + ux * t, ey + uy * t) > line) return false;
  }
  return true;
}

// The peaks on the horizon, with the distance and bearing you would read off a compass. Sorted
// by local relief so a knoll 400 m away does not outrank Surtningssue.
export function visiblePeaks(places, sampleH, frame, ex, ey, eyeZ, opts = {}) {
  const maxDist = opts.maxDist ?? 25000;
  const minRelief = opts.minRelief ?? 60;
  const limit = opts.limit ?? 28;
  const kinds = opts.kinds || new Set(['peak', 'ridge', 'pass', 'glacier']);
  const out = [];
  for (const f of (places.features || [])) {
    const p = f.properties || {};
    if (!kinds.has(p.kind)) continue;
    if ((p.relief1kmM ?? 0) < minRelief) continue;
    const [x, y, z] = f.geometry.coordinates;
    const dist = Math.hypot(x - ex, y - ey);
    if (dist < 120 || dist > maxDist) continue;
    const pz = (z ?? sampleH(x, y));
    if (!visibleFrom(sampleH, ex, ey, eyeZ, x, y, pz, Math.max(20, dist / 260))) continue;
    out.push({
      name: p.name, kind: p.kind, elevM: pz, dist,
      bearing: frame.trueBearing(ex, ey, x, y),
      up: Math.atan2(pz - eyeZ, dist) * RAD,
      relief: p.relief1kmM ?? 0, x, y,
    });
  }
  out.sort((a, b) => (b.relief + b.elevM / 10) - (a.relief + a.elevM / 10));
  return out.slice(0, limit);
}

export function measure(sampleH, ax, ay, bx, by) {
  const az = sampleH(ax, ay), bz = sampleH(bx, by);
  const horiz = Math.hypot(bx - ax, by - ay);
  const dz = bz - az;
  return {
    horiz, dz, slant: Math.hypot(horiz, dz),
    gradient: horiz > 0 ? dz / horiz : 0,
    angleDeg: horiz > 0 ? Math.atan2(dz, horiz) * RAD : 0,
    az, bz,
  };
}

// A cheap benchmark of the two heavy sweeps at whatever grid size is actually loaded, so the
// debug readout reports measured milliseconds rather than an estimate.
export function benchGrid(nx, ny) {
  const g = { nx, ny, res: 16, x0: 0, y1: 0, x1: nx * 16, y0: -ny * 16, data: new Uint16Array(nx * ny) };
  for (let i = 0; i < g.data.length; i++) {
    g.data[i] = 10000 + ((Math.sin(i * 0.013) + Math.cos(i * 0.0071)) * 2500 | 0);
  }
  return g;
}
