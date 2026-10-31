// The cast shadows: two nested grids around the view's center (js/analysis.js), swept away from
// the sun every time the sun moves (js/sun.js, Besseggen's sweep, its seed carrying the shell's
// shadows into the core), uploaded as two one-byte textures the terrain shader reads.
//
//   core   SIDE_K x the camera's ground distance across (3 to 50 km), 512 x 512 cells: 6 to 98 m
//   shell  five times as wide (to 250 km), 384 x 384 cells: the ridges that throw a shadow into
//          the core from outside it, and the shadows of the far field
//
// The grids are rebuilt when the view has moved by a sixth of the core or changed its scale by a
// third, and when new heights have arrived (at most every 1.5 s), never while the view moves; the
// sweep runs on every new sun, so a scrub always shows the light and the shadows of one instant.

import * as THREE from '../vendor/three.module.js';
import { buildGrid, gridSample, sceneRect } from './analysis.js';
import { shadowMask, makeSeed } from './sun.js';
import { clamp } from './util.js';
import { tileOf, tileSpan, cosLat, WORLD } from './geo.js';

const N_CORE = 512, N_SHELL = 384, SIDE_K = 2.4;

function maskTexture(n) {
  const data = new Uint8Array(n * n).fill(255);
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.flipY = false; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

export class Shade {
  constructor(heights, shared) {
    this.heights = heights;
    this.shared = shared;
    this.core = null; this.shell = null;
    this.coreTex = maskTexture(N_CORE); this.shellTex = maskTexture(N_SHELL);
    shared.uShCore.value = this.coreTex; shared.uShShell.value = this.shellTex;
    this.dirty = true; this.builtAt = 0; this.sunKey = '';
    this.stats = { buildMs: 0, sweepMs: 0, builds: 0, sweeps: 0, missing: 0 };
  }
  /** Rebuild the grids if the view moved, or if heights arrived since the last build. */
  maybeBuild(cX, cY, distG, now) {
    const side = clamp(distG * SIDE_K, 3000, 50000);
    const c = this.core;
    const moved = !c || Math.hypot((cX - c.cX) * c.c, (cY - c.cY) * c.c) > c.side / 6 || Math.abs(Math.log(side / c.side)) > Math.log(4 / 3);
    if (!moved && !(this.dirty && now - this.builtAt > 1500)) return false;
    const t0 = performance.now();
    const sample = this.heights.sampler();
    this.core = buildGrid(sample, cX, cY, side, N_CORE);
    this.shell = buildGrid(sample, cX, cY, side * 5, N_SHELL);
    this.stats.buildMs = performance.now() - t0; this.stats.builds++;
    this.stats.missing = this.core.missing;
    this.dirty = false; this.builtAt = now; this.sunKey = '';
    return true;
  }
  /** Sweep both grids for the sun at true azimuth `az` and apparent altitude `alt`. */
  sweep(az, alt, tag) {
    if (!this.core) return;
    const key = `${az.toFixed(3)} ${alt.toFixed(3)} ${this.stats.builds}`;
    if (key === this.sunKey) return;
    this.sunKey = key;
    this.tag = tag;          // the instant the shadows are of (the scrub's test reads it)
    const t0 = performance.now();
    if (alt <= 0) { this.coreTex.image.data.fill(0); this.shellTex.image.data.fill(0); }
    else {
      shadowMask(this.shell, az, alt, this.shellTex.image.data);
      const seed = makeSeed(this.shell, this.core, (x, y) => gridSample(this.shell, x, y), az, alt);
      shadowMask(this.core, az, alt, this.coreTex.image.data, seed);
    }
    this.coreTex.needsUpdate = true; this.shellTex.needsUpdate = true;
    this.stats.sweepMs = performance.now() - t0; this.stats.sweeps++;
  }
  /** Where the grids lie in the scene (after a rebase as well). */
  place(frame) {
    if (!this.core) return;
    sceneRect(this.core, frame, this.shared.uCoreRect.value);
    sceneRect(this.shell, frame, this.shared.uShellRect.value);
  }
  /** The Terrarium tiles under the shell and the skyline's reach (60 km each way), so that the
   *  mountains behind the camera cast their shadows and stand on the skyline too: three or four
   *  tiles a side from the CDN, asked for as soon as the nearest map tiles. */
  want(cX, cY, distG) {
    const side = Math.max(clamp(distG * SIDE_K, 3000, 50000) * 5, 120000);
    const z = clamp(Math.floor(Math.log2((WORLD * cosLat(cY)) / (side / 3))), 5, 12);
    const half = side / 2 / cosLat(cY);
    const [x0, y0] = tileOf(cX - half, cY + half, z), [x1, y1] = tileOf(cX + half, cY - half, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.heights.want('T', z, x, y, 0.5);
    return tileSpan(z);
  }
}
