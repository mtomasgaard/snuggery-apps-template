// Everything a track looks like (DESIGN.md §5, §15): road, verges, walls, kerbs, the start line,
// what holds the road up, the ground or terrain, the sky, lights and the props — all generated here
// from data/tracks.json and a seeded RNG, so every race on a track looks the same.

import {
  Group, Mesh, InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry,
  SphereGeometry, IcosahedronGeometry, PlaneGeometry, BufferGeometry, Float32BufferAttribute, Color, Object3D,
  HemisphereLight, DirectionalLight, Fog, DoubleSide, BackSide, AdditiveBlending, LineSegments, LineBasicMaterial,
} from '../vendor/three.module.js';
import { pointAt, nearest, FLAG_BRIDGE, FLAG_ROCKCUT, WALL_THICK, WALL_HEIGHT } from './track.js';
import { mulberry32, hashSeed, valueNoise2D, range } from './rng.js';
import { Soup, mergeParts, canvasTexture } from './geo.js';

const P = {};             // scratch point for pointAt
const dummy = new Object3D();
const col = new Color();

/** Build the whole scene for one track. quality: 'high' | 'low'. */
export function buildScenery(track, quality) {
  const t0 = performance.now();
  const def = track.def, pal = def.palette, high = quality === 'high';
  const rnd = mulberry32(hashSeed(def.id));
  const group = new Group(); group.name = `scenery:${def.id}`;
  const S = { group, track, quality, update: [], tex: [] };
  const edgeOf = (i) => track.hw[i] + track.verge[i] + WALL_THICK;
  S.edgeOf = edgeOf;
  const fogFar = high ? pal.fogFar : Math.min(pal.fogFar, 180);
  S.fog = new Fog(pal.fog, Math.min(pal.fogNear, fogFar * 0.5), fogFar);
  S.far = fogFar + 10;

  // ---- Lights
  const night = !!pal.night;
  // Night: the design's 0.6 hemisphere is in three's legacy units; r186 lights are physical, so it is
  // scaled up here (tuned by screenshot until the road reads between the light pools).
  const hemi = new HemisphereLight(pal.hemiSky, pal.hemiGround, night ? 1.7 : 1.5);
  const sun = new DirectionalLight(pal.sun, night ? 0.7 : 2.2);
  sun.position.set(night ? 80 : -60, 120, night ? -40 : 50);
  sun.userData.offset = sun.position.clone();
  if (high) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera; c.left = -35; c.right = 35; c.top = 35; c.bottom = -35; c.near = 10; c.far = 300;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  }
  group.add(hemi, sun, sun.target);
  S.sun = sun;

  // ---- Sky: a vertex-coloured sphere that follows the camera, inside the camera's far plane.
  {
    const R = S.far * 0.92;
    const g = new SphereGeometry(R, 24, 12), top = new Color(pal.skyTop), hor = new Color(pal.skyHorizon), cols = [];
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const h = Math.max(0, pos.getY(i) / R); col.copy(hor).lerp(top, Math.pow(h, 0.6)); cols.push(col.r, col.g, col.b); }
    g.setAttribute('color', new Float32BufferAttribute(cols, 3));
    const sky = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; sky.frustumCulled = false;
    group.add(sky);
    S.update.push((dt, cam) => sky.position.copy(cam.position));
    if (night) {
      const moonTex = canvasTexture(64, 64, (ctx) => {
        const gr = ctx.createRadialGradient(32, 32, 10, 32, 32, 31); gr.addColorStop(0, '#F4F1E4'); gr.addColorStop(0.62, '#E8E4D0'); gr.addColorStop(0.7, 'rgba(232,228,208,0.25)'); gr.addColorStop(1, 'rgba(232,228,208,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
      });
      S.tex.push(moonTex);
      const moon = new Mesh(new PlaneGeometry(26, 26), new MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
      moon.renderOrder = -9; moon.frustumCulled = false;
      group.add(moon);
      S.update.push((dt, cam) => { moon.position.set(cam.position.x + R * 0.85, cam.position.y + R * 0.2, cam.position.z - R * 0.1); moon.lookAt(cam.position); });
    }
  }

  // ---- Textures
  const asphalt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = pal.asphalt; ctx.fillRect(0, 0, w, h);
    const r2 = mulberry32(7);
    for (let i = 0; i < 2600; i++) { const v = r2(); ctx.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(r2() * w, r2() * h, 2, 2); }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(4, 0, 5, h); ctx.fillRect(w - 9, 0, 5, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(w / 2 - 2, 0, 4, h / 2);
  }, { repeat: true });
  asphalt.anisotropy = 4;
  const vergeTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = pal.verge; ctx.fillRect(0, 0, w, h);
    const r2 = mulberry32(11);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = r2() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'; ctx.fillRect(r2() * w, r2() * h, 2 + r2() * 2, 2); }
  }, { repeat: true });
  S.tex.push(asphalt, vergeTex);

  const matRoad = new MeshLambertMaterial({ map: asphalt });
  const matVerge = new MeshLambertMaterial({ map: vergeTex });
  const matVC = new MeshLambertMaterial({ vertexColors: true });
  const matVC2 = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });

  // ---- Road, verges, kerbs, start line
  const N = track.N, W = track.wrap;
  const road = new Soup(true), verge = new Soup(true), kerb = new Soup(), walls = new Soup(), struct = new Soup();
  const at = (i, l, lift = 0) => { pointAt(track, W(i), l, lift, P); return [P.x, P.y, P.z]; };
  const ROAD_STEP = 2;
  for (let i = 0; i < N; i += ROAD_STEP) {
    const j = Math.min(i + ROAD_STEP, N), vi = i * track.ds / 8, vj = j * track.ds / 8;
    const hi = track.hw[W(i)], hj = track.hw[W(j)];
    road.quad([...at(i, -hi), 0, vi], [...at(i, hi), 1, vi], [...at(j, hj), 1, vj], [...at(j, -hj), 0, vj]);
    const ei = hi + track.verge[W(i)] + WALL_THICK, ej = hj + track.verge[W(j)] + WALL_THICK;
    const si = i * track.ds / 4, sj = j * track.ds / 4;
    verge.quad([...at(i, -ei), 0, si], [...at(i, -hi), 1, si], [...at(j, -hj), 1, sj], [...at(j, -ej), 0, sj]);
    verge.quad([...at(i, hi), 0, si], [...at(i, ei), 1, si], [...at(j, ej), 1, sj], [...at(j, hj), 0, sj]);
    // Kerbs on the inside edge wherever |κ| > 1/60, alternating trim and white every 2 m.
    const k = track.kappa[W(i)];
    if (Math.abs(k) > 1 / 60) {
      kerb.color((i / ROAD_STEP) % 2 ? '#FFFFFF' : pal.accent);
      if (k > 0) kerb.quad(at(i, hi - 0.6, 0.02), at(i, hi, 0.02), at(j, hj, 0.02), at(j, hj - 0.6, 0.02));
      else kerb.quad(at(i, -hi, 0.02), at(i, -hi + 0.6, 0.02), at(j, -hj + 0.6, 0.02), at(j, -hj, 0.02));
    }
  }
  const addMesh = (geo, mat, { cast = false, receive = true, name } = {}) => {
    const m = new Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive && high; if (name) m.name = name; group.add(m); return m;
  };
  addMesh(road.geometry(), matRoad, { name: 'road' });
  addMesh(verge.geometry(), matVerge, { name: 'verge' });
  if (kerb.count) addMesh(kerb.geometry(), matVC, { name: 'kerbs' });
  {
    const checker = canvasTexture(64, 16, (ctx) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { ctx.fillStyle = (x + y) % 2 ? '#1E1E22' : '#FFFFFF'; ctx.fillRect(x * 8, y * 8, 8, 8); } });
    S.tex.push(checker);
    const sl = new Soup(true), h0 = track.hw[0];
    sl.quad([...at(0, -h0, 0.03), 0, 1], [...at(0, h0, 0.03), 1, 1], [...at(2, h0, 0.03), 1, 0], [...at(2, -h0, 0.03), 0, 0]);
    addMesh(sl.geometry(), new MeshLambertMaterial({ map: checker }), { name: 'startline' });
  }

  // ---- Walls (every 4th sample), cliff faces in the rock cut, railings on the bridge
  const WALL_STEP = 4, noise = valueNoise2D(hashSeed(def.id + 'cliff'), 9, 2);
  const railPosts = [];
  const rail = new Soup();
  for (let i = 0; i < N; i += WALL_STEP) {
    const j = Math.min(i + WALL_STEP, N), fi = track.flags[W(i)], fj = track.flags[W(j)];
    for (const side of [-1, 1]) {
      const li = side * (track.hw[W(i)] + track.verge[W(i)]), lj = side * (track.hw[W(j)] + track.verge[W(j)]);
      const oi = li + side * WALL_THICK, oj = lj + side * WALL_THICK;
      if ((fi & FLAG_ROCKCUT) || (fj & FLAG_ROCKCUT)) {
        // A jagged granite face from the wall line up to road + 8 m, leaning outward.
        const jag = (n, l) => { pointAt(track, W(n), l, 0, P); return noise(P.x, P.z) * 1.6 - 0.8; };
        const topI = li + side * (2.5 + jag(i, li)), topJ = lj + side * (2.5 + jag(j, lj));
        walls.color(pal.rock || pal.stone);
        walls.quad(at(i, li, -0.3), at(j, lj, -0.3), at(j, topJ, 8 + jag(j, 5)), at(i, topI, 8 + jag(i, 5)));
        walls.colorRGB(0.42, 0.43, 0.45);
        walls.quad(at(i, topI, 8 + jag(i, 5)), at(j, topJ, 8 + jag(j, 5)), at(j, lj + side * 9, 7), at(i, li + side * 9, 7));
        continue;
      }
      if ((fi & FLAG_BRIDGE) && (fj & FLAG_BRIDGE)) {
        rail.color('#C9CCD6');
        rail.quad(at(i, li, 1.0), at(j, lj, 1.0), at(j, lj, 1.12), at(i, li, 1.12));
        for (let n = i; n < j; n += 2) { pointAt(track, W(n), li, 0, P); railPosts.push([P.x, P.y + 0.55, P.z]); }
        continue;
      }
      walls.color(pal.wall);
      walls.quad(at(i, li), at(j, lj), at(j, lj, WALL_HEIGHT), at(i, li, WALL_HEIGHT));
      walls.quad(at(i, oi), at(j, oj), at(j, oj, WALL_HEIGHT), at(i, oi, WALL_HEIGHT));
      walls.color((i / WALL_STEP) % 2 ? pal.accent : '#F4F1EA');
      walls.quad(at(i, li, WALL_HEIGHT), at(j, lj, WALL_HEIGHT), at(j, oj, WALL_HEIGHT), at(i, oi, WALL_HEIGHT));
    }
  }
  addMesh(walls.geometry(), matVC2, { name: 'walls' });
  if (rail.count) addMesh(rail.geometry(), matVC2, { name: 'rail' });
  if (railPosts.length) instanced(new BoxGeometry(0.12, 1.1, 0.12), new MeshLambertMaterial({ color: '#C9CCD6' }), railPosts.map((p) => ({ p })), 'railposts');

  // ---- What holds the road up (flat-ground tracks): deck underside, fascia, skirt or columns.
  const columns = [];
  if (def.ground !== 'terrain') {
    for (let i = 0; i < N; i += ROAD_STEP) {
      const j = Math.min(i + ROAD_STEP, N);
      if (track.py[W(i)] < 1.5 && track.py[W(j)] < 1.5) continue;
      const ei = edgeOf(W(i)), ej = edgeOf(W(j));
      struct.color(pal.stone);
      if (def.ground === 'harbour') {
        // A skirt of harbour stone down to the ground, left open over the canal (piers below).
        for (const side of [-1, 1]) {
          pointAt(track, W(i), side * ei, 0, P);
          if (P.x > 45 && P.x < 75) continue;
          const a = at(i, side * ei), b = at(j, side * ej);
          struct.quad([a[0], -0.05, a[2]], [b[0], -0.05, b[2]], b, a);
        }
      }
      struct.colorRGB(0.35, 0.36, 0.40);
      struct.quad(at(i, -ei, -0.8), at(j, -ej, -0.8), at(j, ej, -0.8), at(i, ei, -0.8));
      struct.color(pal.stone);
      for (const side of [-1, 1]) struct.quad(at(i, side * ei, -0.8), at(j, side * ej, -0.8), at(j, side * ej, 0), at(i, side * ei, 0));
      if (def.ground === 'lantern' && i % 14 === 0 && track.py[W(i)] > 2) {
        for (const side of [-1, 1]) { pointAt(track, W(i), side * (ei - 1.2), -0.8, P); columns.push({ p: [P.x, P.y / 2, P.z], s: [1, P.y + 0.05, 1] }); }
      }
    }
    if (def.ground === 'harbour') {
      // Two stone piers under the hump bridge, at x = 45 and x = 75.
      for (const px of [45, 75]) {
        const n = nearest(track, px, -160); const y = track.py[n.idx];
        columns.push({ p: [px, y / 2 - 0.4, track.pz[n.idx]], s: [3, y, 2 * edgeOf(n.idx)], box: true });
      }
    }
    if (struct.count) addMesh(struct.geometry(), matVC2, { name: 'structure' });
  }
  if (columns.some((c) => !c.box)) instanced(new CylinderGeometry(0.6, 0.7, 1, 8), new MeshLambertMaterial({ color: pal.stone }), columns.filter((c) => !c.box), 'columns');
  if (columns.some((c) => c.box)) instanced(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: pal.stone }), columns.filter((c) => c.box), 'piers');

  // ---- Ground
  const B = track.bounds, M = 180;
  if (def.ground === 'terrain') buildTerrain(S, track, pal, high, edgeOf);
  else {
    const x0 = B.minX - M, x1 = B.maxX + M, z0 = B.minZ - M, z1 = B.maxZ + M;
    const flat = new Soup();
    const rect = (ax, az, bx, bz, y, c) => { flat.color(c); flat.quad([ax, y, bz], [bx, y, bz], [bx, y, az], [ax, y, az]); };
    if (def.ground === 'harbour') {
      const g = pal.ground, qz = 20;
      rect(x0, z0, 45, qz, -0.05, g); rect(75, z0, x1, qz, -0.05, g); rect(45, -135, 75, qz, -0.05, g); rect(45, z0, 75, -320, -0.05, g);
      rect(x0, qz, x1, z1 + 200, -1.2, pal.water);                        // the sea
      rect(45, -320, 75, -135, -1.2, pal.water);                          // the canal
      flat.color(pal.stone);
      const wall = (ax, az, bx, bz) => flat.quad([ax, -1.2, az], [bx, -1.2, bz], [bx, -0.05, bz], [ax, -0.05, az]);
      wall(x0, qz, x1, qz); wall(45, -320, 45, -135); wall(75, -135, 75, -320); wall(45, -135, 75, -135); wall(75, -320, 45, -320);
    } else {
      rect(x0, z0, x1, 110, -0.05, pal.ground);
      rect(x0, 110, x1, z1 + 200, -0.6, pal.water);                       // the lake
      flat.color(pal.stone); flat.quad([x0, -0.6, 110], [x1, -0.6, 110], [x1, -0.05, 110], [x0, -0.05, 110]);
    }
    addMesh(flat.geometry(), matVC2, { name: 'ground' });
  }

  // ---- Props
  S.clear = (x, z, margin) => { const n = nearest(track, x, z); return n.d >= edgeOf(n.idx) + margin ? n : null; };
  const scale = high ? 1 : 0.55;
  if (def.id === 'harbour' || def.ground === 'harbour') harbourProps(S, track, pal, def.props || {}, scale, rnd);
  else if (def.ground === 'terrain') pinewoodProps(S, track, pal, def.props || {}, scale, rnd);
  else lanternProps(S, track, pal, def.props || {}, scale, rnd);

  function instanced(geo, mat, list, name, { cast = false } = {}) { return addInstanced(S, geo, mat, list, name, cast); }

  S.buildMs = performance.now() - t0;
  S.dispose = () => disposeGroup(group, S.tex);
  S.tick = (dt, cam, time) => { for (const f of S.update) f(dt, cam, time); };
  S.followShadow = (x, y, z) => {
    if (!sun.castShadow) return;
    const o = sun.userData.offset;
    sun.position.set(x + o.x, y + o.y, z + o.z); sun.target.position.set(x, y, z); sun.target.updateMatrixWorld();
  };
  return S;
}

function addInstanced(S, geo, mat, list, name, cast = false) {
  const m = new InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((it, i) => {
    dummy.position.set(...it.p);
    dummy.rotation.set(it.rx || 0, it.r || 0, it.rz || 0);
    dummy.scale.set(...(it.s || [1, 1, 1]));
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (it.c !== undefined) m.setColorAt(i, col.set(it.c));
  });
  m.count = list.length;
  m.name = name; m.castShadow = cast; m.receiveShadow = false;
  m.computeBoundingSphere();
  S.group.add(m);
  return m;
}

function disposeGroup(group, textures) {
  const mats = new Set();
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    if (o.dispose && o.isInstancedMesh) o.dispose();
    if (o.isLight && o.dispose) o.dispose();          // a directional light's shadow map is its own render target
  });
  for (const m of mats) { for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose(); m.dispose(); }
  for (const t of textures) t.dispose();
  group.removeFromParent();
}

// ---------------------------------------------------------------------------------------------
// Pinewood Pass: heightfield terrain (DESIGN.md §5.4)

function buildTerrain(S, track, pal, high, edgeOf) {
  const B = track.bounds, M = 180, G = 160;
  const x0 = B.minX - M, x1 = B.maxX + M, z0 = B.minZ - M, z1 = B.maxZ + M;
  const noise = valueNoise2D(hashSeed(track.def.id + 'terrain'), 120, 3);
  const pos = new Float32Array(G * G * 3), cols = new Float32Array(G * G * 3);
  const grass = new Color(pal.ground), rock = new Color(pal.rock), snow = new Color(pal.snow), c = new Color();
  const height = (x, z) => {
    const n = nearest(track, x, z), i = n.idx, e = edgeOf(i);
    const dx = x - track.px[i], dz = z - track.pz[i];
    const l = -dx * track.fz[i] + dz * track.fx[i];
    const le = Math.max(-e, Math.min(e, l));
    const ys = track.py[i] - le * (track.sinB[i] / track.cosB[i]) - 0.6;
    if (n.d <= e + 2) return ys;
    return ys + (n.d - e - 2) * 0.35 * (0.6 + 0.8 * noise(x, z));
  };
  S.height = height;
  for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) {
    const x = x0 + (x1 - x0) * gx / (G - 1), z = z0 + (z1 - z0) * gz / (G - 1), y = height(x, z), k = (gz * G + gx) * 3;
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
    if (y > 75) c.copy(rock).lerp(snow, Math.min(1, (y - 75) / 8));
    else if (y > 45) c.copy(grass).lerp(rock, Math.min(1, (y - 45) / 8));
    else c.copy(grass);
    c.multiplyScalar(0.9 + 0.2 * noise(x * 3, z * 3));
    cols[k] = c.r; cols[k + 1] = c.g; cols[k + 2] = c.b;
  }
  const idx = [];
  for (let gz = 0; gz < G - 1; gz++) for (let gx = 0; gx < G - 1; gx++) {
    const a = gz * G + gx, b = a + 1, d = a + G, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new Mesh(g, new MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = high; m.name = 'terrain';
  S.group.add(m);
  S.terrainGrid = { x0, x1, z0, z1, G, pos };
}

function pinewoodProps(S, track, pal, props, scale, rnd) {
  const B = track.bounds, M = 170;
  // Pines: trunk + three stacked cones, one merged geometry with vertex colours.
  const pine = mergeParts([
    { geo: new CylinderGeometry(0.18, 0.25, 1.6, 5, 1, true), pos: [0, 0.8, 0], color: pal.timber },
    { geo: new ConeGeometry(1.9, 2.8, 6, 1, true), pos: [0, 2.6, 0], color: pal.pines[0] },
    { geo: new ConeGeometry(1.5, 2.4, 6, 1, true), pos: [0, 3.9, 0], color: pal.pines[1] },
    { geo: new ConeGeometry(1.0, 2.0, 6, 1, true), pos: [0, 5.0, 0], color: pal.pines[0] },
  ], { uvs: false });
  const want = Math.round((props.pines || 700) * scale), cells = [], CELL = 12;
  for (let x = B.minX - M; x < B.maxX + M; x += CELL) for (let z = B.minZ - M; z < B.maxZ + M; z += CELL) cells.push([x, z]);
  // Shuffle the cells, prefer those near the road (they are the ones you see).
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const pines = [], rocks = [];
  const scored = cells.map(([x, z]) => { const px = x + rnd() * CELL, pz = z + rnd() * CELL, n = nearest(track, px, pz); return { px, pz, n }; })
    .filter((c) => c.n.d >= S.edgeOf(c.n.idx) + 3).sort((a, b) => a.n.d - b.n.d + (rnd() - 0.5) * 60);
  for (const c of scored) {
    if (pines.length >= want) break;
    const y = S.height(c.px, c.pz), slope = Math.abs(S.height(c.px + 2, c.pz) - y) / 2 + Math.abs(S.height(c.px, c.pz + 2) - y) / 2;
    if (slope > 0.8) continue;
    const s = 0.8 + rnd() * 0.8;
    pines.push({ p: [c.px, y - 0.2, c.pz], r: rnd() * 6, s: [s, s * (0.9 + rnd() * 0.3), s], c: new Color().setScalar(0.85 + rnd() * 0.25) });
  }
  addInstanced(S, pine, new MeshLambertMaterial({ vertexColors: true }), pines, 'pines', false);
  // Rocks: jittered icosahedrons near the road and on the slopes.
  const rg = new IcosahedronGeometry(1, 0); const rp = rg.attributes.position; const rr = mulberry32(99);
  for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.75 + rr() * 0.5), rp.getY(i) * (0.75 + rr() * 0.5), rp.getZ(i) * (0.75 + rr() * 0.5));
  rg.computeVertexNormals();
  const wantR = Math.round((props.rocks || 120) * scale);
  for (let tries = 0; rocks.length < wantR && tries < 4000; tries++) {
    const i = Math.floor(rnd() * track.N), side = rnd() < 0.5 ? -1 : 1, d = S.edgeOf(i) + 1.5 + rnd() * 30;
    pointAt(track, i, side * d, 0, P);
    if (!S.clear(P.x, P.z, 1.2)) continue;
    const s = 0.6 + rnd() * 2.4;
    rocks.push({ p: [P.x, S.height(P.x, P.z) + s * 0.3, P.z], r: rnd() * 6, rx: rnd(), s: [s, s * 0.7, s * 1.1] });
  }
  addInstanced(S, rg, new MeshLambertMaterial({ color: pal.rock }), rocks, 'rocks');
  // The lodge: two cabins and a timber arch over the line.
  const parts = [];
  const i0 = 0, h0 = track.hw[i0] + track.verge[i0] + 1.2;
  for (const side of [-1, 1]) {
    pointAt(track, i0, side * h0, 0, P);
    parts.push({ geo: new BoxGeometry(0.6, 7, 0.6), pos: [P.x, P.y + 3.5, P.z], color: pal.timber });
  }
  pointAt(track, i0, 0, 7, P);
  parts.push({ geo: new BoxGeometry(0.8, 0.8, 2 * h0 + 1), pos: [P.x, P.y, P.z], rot: [0, -track.theta[i0], 0], color: pal.timber });
  for (const [s, side] of [[30, -1], [70, -1]]) {
    const i = Math.round(s / track.ds); pointAt(track, i, side * (S.edgeOf(i) + 9), 0, P);
    const y = S.height ? S.height(P.x, P.z) + 0.4 : P.y;
    parts.push({ geo: new BoxGeometry(10, 4.5, 7), pos: [P.x, y + 2.25, P.z], rot: [0, -track.theta[i], 0], color: '#9A6A44' });
    parts.push({ geo: new ConeGeometry(7.2, 3, 4, 1), pos: [P.x, y + 6, P.z], rot: [0, -track.theta[i] + Math.PI / 4, 0], scale: [1, 1, 0.75], color: pal.roof });
  }
  const lodge = new Mesh(mergeParts(parts, { uvs: false }), new MeshLambertMaterial({ vertexColors: true }));
  lodge.name = 'lodge'; S.group.add(lodge);
  // Chevron boards on the outer wall through the tight bends, every 8 m.
  const chevTex = canvasTexture(64, 32, (ctx) => {
    ctx.fillStyle = pal.accent; ctx.fillRect(0, 0, 64, 32); ctx.fillStyle = '#FFFFFF';
    for (const x of [10, 30, 50]) { ctx.beginPath(); ctx.moveTo(x - 6, 4); ctx.lineTo(x + 4, 16); ctx.lineTo(x - 6, 28); ctx.lineTo(x, 28); ctx.lineTo(x + 10, 16); ctx.lineTo(x, 4); ctx.fill(); }
  });
  S.tex.push(chevTex);
  const chev = [];
  for (let i = 0; i < track.N; i += Math.round(8 / track.ds)) {
    const k = track.kappa[i]; if (Math.abs(k) < 1 / 45) continue;
    const side = k > 0 ? -1 : 1;                           // the outside of the bend
    pointAt(track, i, side * (track.hw[i] + track.verge[i] + 0.3), 1.6, P);
    // Face the road: the board's normal points toward the inside; the chevrons point along the turn.
    // r turns the plane's +z to the inward normal; local +x then runs along the travel direction for
    // a board on the left (a right-hand bend) and against it on the right, so those are mirrored.
    chev.push({ p: [P.x, P.y, P.z], r: -track.theta[i] + (side > 0 ? Math.PI : 0), s: [side > 0 ? -1 : 1, 1, 1] });
  }
  if (chev.length) addInstanced(S, new PlaneGeometry(1.2, 0.8), new MeshLambertMaterial({ map: chevTex, side: DoubleSide }), chev, 'chevrons');
  // Marker posts every 10 m on both edges, white with an orange reflector (the close speed cue).
  const post = mergeParts([
    { geo: new BoxGeometry(0.15, 1.0, 0.15), pos: [0, 0.5, 0], color: '#F2F2F0' },
    { geo: new BoxGeometry(0.17, 0.14, 0.17), pos: [0, 0.82, 0], color: '#FF8A2A' },
  ], { uvs: false });
  const posts = [];
  for (let i = Math.round(111 / track.ds); i < track.N; i += Math.round(10 / track.ds)) {
    if (track.flags[i] & FLAG_ROCKCUT) continue;
    for (const side of [-1, 1]) { pointAt(track, i, side * (track.hw[i] + 1.4), 0, P); posts.push({ p: [P.x, P.y, P.z], r: -track.theta[i] }); }
  }
  addInstanced(S, post, new MeshLambertMaterial({ vertexColors: true }), posts, 'posts');
}

// ---------------------------------------------------------------------------------------------
// Harbour Loop (DESIGN.md §5.3)

function harbourProps(S, track, pal, props, scale, rnd) {
  const windows = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#3B4A5A';
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.fillRect(14 + x * 40, 16 + y * 40, 20, 22);
    ctx.fillStyle = '#FFFFFF'; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.fillRect(23 + x * 40, 16 + y * 40, 2, 22);
  });
  S.tex.push(windows);
  const houses = [], roofs = [];
  const want = Math.round((props.houses || 60) * scale), placed = [];
  for (let tries = 0; houses.length < want && tries < 6000; tries++) {
    const x = range(rnd, track.bounds.minX - 60, track.bounds.maxX + 40), z = range(rnd, track.bounds.minZ - 70, 8);
    if (x > 38 && x < 82 && z > -330 && z < -128) continue;          // the canal
    if (Math.hypot(x - 250, z + 60) < 40) continue;                   // the crane yard
    const w = range(rnd, 6, 10), d = range(rnd, 7, 9), h = range(rnd, 6, 14), half = Math.hypot(w, d) / 2;
    const n = S.clear(x, z, 6 + half); if (!n || n.d > 75) continue;
    if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + half + 1)) continue;
    placed.push([x, z, half]);
    // Face the road.
    const r = -track.theta[n.idx];
    const c = pal.houses[Math.floor(rnd() * pal.houses.length)];
    houses.push({ p: [x, h / 2 - 0.05, z], r, s: [w, h, d], c });
    roofs.push({ p: [x, h - 0.05, z], r, s: [w * 1.08, 2.4 + rnd(), d * 1.08] });
  }
  addInstanced(S, new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ map: windows }), houses, 'houses', true);
  // A roof prism: a triangular cross-section extruded along x.
  const roof = new Soup();
  roof.color(pal.roof);
  const A = [-0.5, 0, -0.5], Bq = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5], E = [-0.5, 1, 0], F = [0.5, 1, 0];
  roof.quad(A, E, F, Bq); roof.quad(D, C, F, E); roof.tri(A, D, E); roof.tri(Bq, F, C);
  addInstanced(S, roof.geometry(), new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }), roofs, 'roofs');

  const parts = [];
  // The archway at the gate (s ≈ 590): two 4 × 4 × 10 m towers and a beam across at 8.5 m.
  {
    const i = Math.round(590 / track.ds), e = S.edgeOf(i) + 2.2, r = -track.theta[i];
    for (const side of [-1, 1]) { pointAt(track, i, side * e, 0, P); parts.push({ geo: new BoxGeometry(4, 10, 4), pos: [P.x, P.y + 5 - 0.5, P.z], rot: [0, r, 0], color: pal.stone }); }
    pointAt(track, i, 0, 9.3, P);
    parts.push({ geo: new BoxGeometry(3, 1.8, 2 * e + 4), pos: [P.x, P.y, P.z], rot: [0, r, 0], color: pal.stone });
    parts.push({ geo: new BoxGeometry(3.2, 0.5, 2 * e + 4.4), pos: [P.x, P.y + 1.1, P.z], rot: [0, r, 0], color: pal.roof });
  }
  // The crane: a lattice of boxes 30 m tall with a boom.
  {
    const cx = 250, cz = -60, lat = '#E0A030';
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) parts.push({ geo: new BoxGeometry(0.5, 30, 0.5), pos: [cx + dx, 15, cz + dz], color: lat });
    for (let y = 3; y < 30; y += 4) { parts.push({ geo: new BoxGeometry(4.5, 0.3, 0.3), pos: [cx, y, cz - 2], color: lat }, { geo: new BoxGeometry(4.5, 0.3, 0.3), pos: [cx, y, cz + 2], color: lat }, { geo: new BoxGeometry(0.3, 0.3, 4.5), pos: [cx - 2, y, cz], color: lat }, { geo: new BoxGeometry(0.3, 0.3, 4.5), pos: [cx + 2, y, cz], color: lat }); }
    parts.push({ geo: new BoxGeometry(6, 4, 6), pos: [cx, 31, cz], color: '#C8C2B4' });
    parts.push({ geo: new BoxGeometry(1.2, 1.2, 40), pos: [cx, 32, cz + 16], color: lat });
    parts.push({ geo: new BoxGeometry(0.1, 14, 0.1), pos: [cx, 25, cz + 32], color: '#333333' });
  }
  S.group.add(Object.assign(new Mesh(mergeParts(parts, { uvs: false }), new MeshLambertMaterial({ vertexColors: true })), { name: 'landmarks', castShadow: false }));
  // Lamp posts every `lampEvery` m (24) on the outer edge of the harbour-front and quay straights.
  const lamps = [];
  const lamp = mergeParts([
    { geo: new CylinderGeometry(0.1, 0.14, 5, 6, 1, true), pos: [0, 2.5, 0], color: '#3A4048' },
    { geo: new BoxGeometry(0.5, 0.35, 0.5), pos: [0, 5.1, 0], color: '#FFF2C8' },
  ], { uvs: false });
  const lampEvery = Math.max(6, props.lampEvery || 24);
  for (const [a, b] of [[0, 121], [857, track.L]]) for (let s = a; s < b; s += lampEvery) {
    const i = Math.min(track.N - 1, Math.round(s / track.ds)); pointAt(track, i, S.edgeOf(i) + 1.2, 0, P); lamps.push({ p: [P.x, P.y, P.z] });
  }
  addInstanced(S, lamp, new MeshLambertMaterial({ vertexColors: true }), lamps, 'lamps');
  // Bollards every `bollardEvery` m (6) along the sea side of the quay.
  const bollards = [], bollardEvery = Math.max(2, props.bollardEvery || 6);
  for (let x = -100; x <= 200; x += bollardEvery) bollards.push({ p: [x, 0.35, 19.3] });
  addInstanced(S, new CylinderGeometry(0.15, 0.18, 0.8, 8), new MeshLambertMaterial({ color: '#2E3238' }), bollards, 'bollards');
  // Boats moored along the quay, bobbing.
  const boat = mergeParts([
    { geo: new BoxGeometry(3, 1.2, 8), pos: [0, 0.2, 0], scale: [1, 1, 1], color: '#F4F1EA' },
    { geo: new ConeGeometry(1.5, 2.5, 4, 1), pos: [0, 0.2, 5.2], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.8], color: '#F4F1EA' },
    { geo: new BoxGeometry(3.05, 0.3, 8.05), pos: [0, 0.55, 0], color: pal.accent },
    { geo: new CylinderGeometry(0.08, 0.08, 7, 5), pos: [0, 4, -0.5], color: '#8A6A44' },
    { geo: new BoxGeometry(1.8, 1.0, 2.4), pos: [0, 1.3, -1.5], color: '#E8DCC0' },
  ], { uvs: false });
  const boats = [];
  const nb = Math.round((props.boats || 8) * (scale < 1 ? 0.75 : 1));
  for (let b = 0; b < nb; b++) boats.push({ p: [-60 + b * 32 + rnd() * 8, -1.0, 26 + rnd() * 4], r: Math.PI / 2 + (rnd() - 0.5) * 0.3, phase: rnd() * 6 });
  const boatMesh = addInstanced(S, boat, new MeshLambertMaterial({ vertexColors: true }), boats, 'boats');
  S.update.push((dt, cam, time) => {
    boats.forEach((b, i) => {
      dummy.position.set(b.p[0], b.p[1] + Math.sin(time * 1.3 + b.phase) * 0.15, b.p[2]);
      dummy.rotation.set(0, b.r, Math.sin(time * 0.9 + b.phase) * 0.03); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      boatMesh.setMatrixAt(i, dummy.matrix);
    });
    boatMesh.instanceMatrix.needsUpdate = true;
  });
  // Crates in stacks near the crane.
  const crates = [], cc = ['#B5543C', '#2E6F95', '#5B8C3A', '#D9A21B'];
  for (let n = 0; n < Math.round((props.crates || 14) * scale) + 4; n++) {
    const x = 235 + rnd() * 30, z = -90 + rnd() * 18, h = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < h; k++) crates.push({ p: [x, 1.25 + k * 2.5, z], r: Math.round(rnd()) * Math.PI / 2, s: [6, 2.5, 2.5], c: cc[Math.floor(rnd() * 4)] });
  }
  addInstanced(S, new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: '#FFFFFF' }), crates, 'crates');
}

// ---------------------------------------------------------------------------------------------
// Lantern Night (DESIGN.md §5.5)

function lanternProps(S, track, pal, props, scale, rnd) {
  const every = Math.round((props.lanternEvery || 18) / track.ds / (scale < 1 ? 0.75 : 1));
  const poles = [], globes = [], pools = [];
  for (let i = 0; i < track.N; i += every) {
    for (const side of [-1, 1]) {
      const e = track.hw[i] + track.verge[i] + 0.3;
      pointAt(track, i, side * e, 0, P);
      poles.push({ p: [P.x, P.y + 1.5, P.z] });
      globes.push({ p: [P.x, P.y + 3.2, P.z], c: pal.lanterns[(i / every + (side > 0 ? 1 : 0)) % 3 | 0] });
      pointAt(track, i, side * (track.hw[i] - 1.0), 0.06, P);
      pools.push({ p: [P.x, P.y, P.z], i });
    }
  }
  addInstanced(S, new CylinderGeometry(0.06, 0.08, 3, 5, 1, true), new MeshLambertMaterial({ color: '#2A2C36' }), poles, 'poles');
  addInstanced(S, new SphereGeometry(0.42, 8, 6), new MeshBasicMaterial({ color: '#FFFFFF' }), globes, 'lanterns');
  // Light pools: additive radial gradients lying on the road — what makes the road readable at night.
  const poolTex = canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,190,110,0.75)'); g.addColorStop(0.5, 'rgba(255,170,90,0.3)'); g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  S.tex.push(poolTex);
  const poolMesh = new InstancedMesh(new PlaneGeometry(6, 6), new MeshBasicMaterial({ map: poolTex, transparent: true, blending: AdditiveBlending, depthWrite: false }), pools.length);
  const up = new Object3D();
  pools.forEach((p, n) => {
    const i = p.i;
    up.position.set(...p.p);
    up.lookAt(p.p[0] + track.nx[i], p.p[1] + track.ny[i], p.p[2] + track.nz[i]);
    up.updateMatrix(); poolMesh.setMatrixAt(n, up.matrix);
  });
  poolMesh.name = 'pools'; poolMesh.renderOrder = 2; poolMesh.computeBoundingSphere();
  S.group.add(poolMesh);
  // String lights across the road at six places.
  const bulbs = [], wire = [];
  const ns = props.strings || 6;
  for (let n = 0; n < ns; n++) {
    let i = Math.round(((n + 0.5) / ns) * track.N);
    if (track.flags[i] & FLAG_BRIDGE) i = (i + Math.round(200 / track.ds)) % track.N;
    const e = track.hw[i] + track.verge[i] + 0.3;
    let prev = null;
    for (let b = 0; b <= 24; b++) {
      const t = b / 24, l = -e + 2 * e * t;
      pointAt(track, i, l, 0, P);
      const y = P.y + 6.2 - 1.6 * (1 - (2 * t - 1) ** 2);
      if (b > 0 && b < 24) bulbs.push({ p: [P.x, y - 0.12, P.z], c: pal.lanterns[b % 3] });
      if (prev) wire.push(...prev, P.x, y, P.z);
      prev = [P.x, y, P.z];
    }
  }
  addInstanced(S, new SphereGeometry(0.16, 5, 4), new MeshBasicMaterial({ color: '#FFFFFF' }), bulbs, 'bulbs');
  const wg = new BufferGeometry(); wg.setAttribute('position', new Float32BufferAttribute(wire, 3));
  const wires = new LineSegments(wg, new LineBasicMaterial({ color: '#2A2C36' })); wires.name = 'wires'; S.group.add(wires);
  // Buildings with lit windows (emissive), around the outside of both loops.
  const dark = canvasTexture(128, 256, (ctx) => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 128, 256); ctx.fillStyle = '#9098A8'; for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) ctx.fillRect(4 + x * 16, 6 + y * 16, 8, 9); });
  const lit = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 128, 256); const r2 = mulberry32(5);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) if (r2() < 0.35) { ctx.fillStyle = pal.windows; ctx.fillRect(4 + x * 16, 6 + y * 16, 8, 9); }
  });
  S.tex.push(dark, lit);
  const bld = [], placed = [];
  const want = Math.round((props.buildings || 70) * scale);
  for (let tries = 0; bld.length < want && tries < 8000; tries++) {
    const x = range(rnd, track.bounds.minX - 110, track.bounds.maxX + 110), z = range(rnd, track.bounds.minZ - 110, 100);
    const w = range(rnd, 10, 20), d = range(rnd, 10, 20), h = range(rnd, 12, 40), half = Math.hypot(w, d) / 2;
    const n = S.clear(x, z, 10 + half); if (!n || n.d > 100) continue;
    if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + half + 2)) continue;
    placed.push([x, z, half]);
    bld.push({ p: [x, h / 2 - 0.05, z], r: -track.theta[n.idx], s: [w, h, d], c: ['#3A3F55', '#454A60', '#2F3448'][Math.floor(rnd() * 3)] });
  }
  addInstanced(S, new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ map: dark, emissive: '#FFFFFF', emissiveMap: lit }), bld, 'buildings');
  // Park trees with round crowns.
  const tree = mergeParts([
    { geo: new CylinderGeometry(0.15, 0.22, 2, 5, 1, true), pos: [0, 1, 0], color: '#3A2E26' },
    { geo: new IcosahedronGeometry(1.8, 1), pos: [0, 3.4, 0], color: pal.trees },
  ], { uvs: false });
  const trees = [];
  const wantT = Math.round((props.trees || 160) * scale);
  for (let tries = 0; trees.length < wantT && tries < 8000; tries++) {
    const x = range(rnd, track.bounds.minX - 60, track.bounds.maxX + 60), z = range(rnd, track.bounds.minZ - 60, 104);
    const n = S.clear(x, z, 3.5); if (!n || n.d > 55) continue;
    if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + 3)) continue;
    const s = 0.8 + rnd() * 0.6;
    trees.push({ p: [x, 0, z], r: rnd() * 6, s: [s, s, s], c: new Color().setScalar(0.8 + rnd() * 0.35) });
  }
  addInstanced(S, tree, new MeshLambertMaterial({ vertexColors: true }), trees, 'trees');
}
