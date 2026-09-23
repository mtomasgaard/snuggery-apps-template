// Besseggen — an offline 3D terrain viewer for the ridge between Gjende and Bessvatnet.
//
// This file wires the pieces together and owns the render scheduler. Everything else lives in
// js/: the tile store and quadtree (terrain.js), the shading shader (material.js), solar
// position and cast shadows (sun.js), viewshed and line of sight (analysis.js), the walk and the
// walking-time models (route.js), the profile strip (profile.js), the camera modes (camera.js),
// the trail, lakes and masks (overlays.js), loading and re-reading (data.js), coordinates
// (geo.js) and the small shared helpers (util.js).
//
// Nothing here draws on a loop. A frame is scheduled when something changed and the scheduler
// stops as soon as nothing is animating.

import * as THREE from './vendor/three.module.js';
import { $, $$, clamp, store, fmt, fmtDist, fmtHM, fmtClock, fmtDate, fmtDateShort, dayOfYear, daysInMonth, compassPoint, escapeHtml, DEG, RAD } from './js/util.js';
import { Frame, fmtLonLat } from './js/geo.js';
import { DataSet, onRegainFocus } from './js/data.js';
import { Terrain, MAX_TILES, TRIS_PER_TILE } from './js/terrain.js';
import { makeTerrainMaterial, applyPalette, makeMaskTexture, setGridRect } from './js/material.js';
import { sunAt, dayEvents, sunVector, shadowMask, makeSeed, directSunWindow, tzName, tzOffsetHours } from './js/sun.js';
import { viewshed, lineOfSight, visiblePeaks, visibleFrom, measure, benchGrid } from './js/analysis.js';
import { Route, timeForSegments, paceLabel, langmuirNote } from './js/route.js';
import { Profile } from './js/profile.js';
import { CameraRig, reduceMotion } from './js/camera.js';
import { makeLineMaterial, buildLine, buildLines, lineFeatureToPoints, buildWater, makeWaterMaterial, buildMask, colorOf } from './js/overlays.js';

// ---------------------------------------------------------------- state
const today = new Date();
const S = {
  sheet: store.get('sheet', 0),
  layers: Object.assign({
    sun: true, shadow: true, hillshade: true, slope: false, bands: false,
    contour20: false, contour100: true, water: true, glacier: true,
    route: true, rivers: true, viewshed: true, labels: true,
  }, store.get('layers', {})),
  date: store.get('date', { y: today.getFullYear(), mo: 6, d: 14 }),
  minutes: store.get('minutes', 7 * 60),
  exag: store.get('exag', 1),
  reversed: store.get('reversed', false),
  cursor: store.get('cursor', 0),
  marker: store.get('marker', null),
  paceModel: store.get('paceModel', null),
  paceFit: store.get('paceFit', null),
  debug: store.get('debug', false),
  savedViews: store.get('savedViews', []),
  eyeM: store.get('eyeM', 1.7),
  tool: null,
};
const save = () => {
  store.set('sheet', S.sheet); store.set('layers', S.layers); store.set('date', S.date);
  store.set('minutes', S.minutes); store.set('exag', S.exag); store.set('reversed', S.reversed);
  store.set('cursor', S.cursor); store.set('marker', S.marker); store.set('debug', S.debug);
  store.set('paceModel', S.paceModel); store.set('paceFit', S.paceFit);
  store.set('savedViews', S.savedViews);
  store.set('eyeM', S.eyeM);
  store.set('camera', rig ? rig.serialise() : null);
};

// ---------------------------------------------------------------- renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 4, 140000);
const raycaster = new THREE.Raycaster();

let data, frame, terrain, mat, route, profile, rig, waterMesh, waterMat, lineMat, routeLine,
  altLine, connLine, riverLine, toolLine, markerLine, shadowCore, shadowShell, viewshedTex,
  shadowBuf, shellBuf, viewshedInfo = null, sunInfo = null, events = null;
let scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const timings = { shadowMs: 0, viewshedMs: 0, selectMs: 0, frameMs: 0, buildMs: 0 };

// ---------------------------------------------------------------- render scheduler
let queued = false, lastT = 0, shadowDirty = false, shadowTimer = 0;
function invalidate() { if (!queued) { queued = true; requestAnimationFrame(frameLoop); } }

function frameLoop(t) {
  queued = false;
  const dt = lastT ? t - lastT : 16; lastT = t;
  const t0 = performance.now();
  let busy = rig.update(dt, route, S.reversed);
  if (rig.flying) {
    // The walk slider, the profile cursor and the readouts follow the fly-through. No saving
    // while it runs: a localStorage write per frame is not worth it, and the state is stored
    // again when it stops.
    $('fp-t').value = String(Math.round(rig.routeT * 1000));
    const i = route.indexAtDist(rig.routeT * route.length, S.reversed);
    if (i !== S.cursor) setCursor(i, false, false);
  }

  // Adaptive near plane: precision where the camera is, without a logarithmic depth buffer that
  // every custom shader here would have to reimplement.
  const d = camera.position.distanceTo(rig.controls.target);
  const near = clamp(d * 0.0012, rig.mode === 'orbit' ? 2.5 : 1.1, 220);
  if (Math.abs(near - camera.near) > near * 0.2) { camera.near = near; camera.updateProjectionMatrix(); }

  camera.updateMatrixWorld();
  const s0 = performance.now();
  const sel = terrain.select(camera, renderer.domElement.clientHeight || 800);
  timings.selectMs = performance.now() - s0;

  renderer.render(scene, camera);
  updateLabels();
  updateGauge();
  timings.frameMs = performance.now() - t0;
  if (S.debug) updateDebug();
  if (busy || sel.pending > 0) invalidate();
}

// ---------------------------------------------------------------- boot
async function boot() {
  // Read the stored camera before anything can overwrite it: wireUI() saves state as a side
  // effect of setting the sheet stop, and a save before the restore would hand back the default
  // camera sitting at the origin.
  const savedCam = store.get('camera', null);
  data = new DataSet();
  await data.load((p, msg) => {
    $('load-bar').style.width = `${Math.round(p * 100)}%`;
    $('load-msg').textContent = msg;
  });
  frame = new Frame(data.manifest);
  const projErr = frame.checkProjection();

  terrain = new Terrain(data, frame);
  mat = makeTerrainMaterial();
  terrain.setMaterial(mat);
  scene.add(terrain.group);
  terrain.buildAnalysisGrids((n) => data.note(n));

  const core = terrain.analysis.core, shell = terrain.analysis.shell;
  setGridRect(mat, 'uCore', core, frame);
  setGridRect(mat, 'uShell', shell, frame);
  shadowBuf = new Uint8Array(core.nx * core.ny);
  shellBuf = new Uint8Array(shell.nx * shell.ny);
  shadowCore = makeMaskTexture(shadowBuf, core.nx, core.ny);
  shadowShell = makeMaskTexture(shellBuf, shell.nx, shell.ny);
  mat.uniforms.uShadowCore.value = shadowCore;
  mat.uniforms.uShadowShell.value = shadowShell;

  // Water and glacier mask, on the same grid as the core analysis raster.
  const maskTex = buildMask(core, data.geo.water, data.geo.glaciers);
  mat.uniforms.uMask.value = maskTex;
  setGridRect(mat, 'uMask', core, frame);
  viewshedTex = makeMaskTexture(new Uint8Array(core.nx * core.ny), core.nx, core.ny);
  mat.uniforms.uViewshedTex.value = viewshedTex;

  route = new Route(data.geo.route, data.edit.waypoints);
  S.cursor = clamp(S.cursor, 0, Math.max(0, route.n - 1));

  buildOverlays();

  rig = new CameraRig(camera, canvas, terrain, frame, invalidate);
  profile = new Profile($('profile'), (i) => { setCursor(i, true); });
  profile.setRoute(route, S.reversed);

  applyScheme();
  applyExaggeration(S.exag);
  buildLayerPanel();
  buildCameraChips();
  buildToolChips();
  buildViewpointChips();
  buildAbout(projErr);
  wireUI();

  if (!rig.restore(savedCam)) frameRoute();
  setCursor(S.cursor, false);
  updateSun(true);
  applyLayerUniforms();
  updatePace();
  showNotices();

  onRegainFocus(async () => {
    const changed = await data.refetchEditable();
    if (!changed.length) return;
    if (changed.includes('colors')) applyScheme();
    if (changed.includes('waypoints')) { route.setWaypointNames(data.edit.waypoints); profile.build(); }
    if (changed.includes('viewpoints')) buildViewpointChips();
    if (changed.includes('pace')) updatePace();
    if (changed.includes('about')) buildAbout(projErr);
    showNotices();
    setCursor(S.cursor, false);
    invalidate();
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    scheme = e.matches ? 'dark' : 'light';
    applyScheme();
    invalidate();
  });

  // A read-only hook for the headless verification run and for anyone debugging in a console.
  // It reports; it changes nothing.
  window.__besseggen = {
    stats: () => ({
      tilesDrawn: terrain.stats.tiles, tileCap: MAX_TILES,
      trianglesSubmitted: terrain.stats.tiles * TRIS_PER_TILE,
      trianglesDrawn: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      capped: terrain.stats.capped, built: terrain.stats.built,
      coreGrid: [terrain.analysis.core.nx, terrain.analysis.core.ny],
      shellGrid: [terrain.analysis.shell.nx, terrain.analysis.shell.ny],
      levels: terrain.levels.map((L) => ({ level: L.level, res: L.res, tiles: L.tiles.length })),
      timings: { ...timings },
      projectionErrMm: +frame.checkProjection().toFixed(3),
      convergenceDeg: +frame.convergence.toFixed(4),
      lat: +frame.centreLat.toFixed(5), lon: +frame.centreLon.toFixed(5),
      sun: sunInfo ? { azTrue: +sunInfo.az.toFixed(3), altApparent: +sunInfo.elevApparent.toFixed(3) } : null,
      events: events ? {
        sunrise: events.sunrise, sunset: events.sunset, dawn: events.dawn, dusk: events.dusk,
        maxAlt: +events.maxAlt.toFixed(3), minAlt: +events.minAlt.toFixed(3),
      } : null,
      route: { n: route.n, lengthM: +route.length.toFixed(1), ascentM: Math.round(route.ascent), highM: Math.round(route.z[route.highIdx] || 0) },
      lakes: (waterMesh.userData && waterMesh.userData.lakes) || [],
      waterTriangles: (waterMesh.userData && waterMesh.userData.triangles) || 0,
      notices: data.notices,
      bytes: data.bytes,
    }),
    sunAt: (y, mo, d, min) => sunAt(y, mo, d, min, frame.centreLat, frame.centreLon),
    dayEvents: (y, mo, d) => {
      const e = dayEvents(y, mo, d, frame.centreLat, frame.centreLon);
      return { sunrise: e.sunrise, sunset: e.sunset, dawn: e.dawn, dusk: e.dusk, maxAlt: e.maxAlt, minAlt: e.minAlt, polarDay: e.polarDay };
    },
    heightAt: (x, y) => terrain.heightAt(x, y),
    bench: () => {
      const g = benchGrid(1281, 1025);
      const buf = new Uint8Array(g.nx * g.ny);
      let t0 = performance.now();
      shadowMask(g, 140, 18, buf);
      const sweep = performance.now() - t0;
      t0 = performance.now();
      const vs = viewshed(g, g.x0 + g.nx * 8, g.y1 - g.ny * 8, 1.7, 12000, (x, y) => terrain.gridSample(g, x, y));
      const v = performance.now() - t0;
      return { sweepMs: +sweep.toFixed(1), viewshedMs: +v.toFixed(1), viewshedRays: vs.nAz, viewshedSamples: vs.samples };
    },
    setLayer: (id, on) => { S.layers[id] = !!on; applyLayerUniforms(); },
    drawnLevels: () => {
      const h = {};
      for (const sl of terrain.pool) {
        if (!sl.mesh.visible || !sl.L) continue;
        h[sl.L.level] = (h[sl.L.level] || 0) + 1;
      }
      return h;
    },
    applyViewpoint: (i) => {
      const list = (data.edit.viewpoints && data.edit.viewpoints.viewpoints) || [];
      if (list[i]) rig.applyViewpoint(list[i]);
      return list[i] && list[i].name;
    },
    debugSelect: () => {
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const fr = new THREE.Frustum().setFromProjectionMatrix(m);
      const box = new THREE.Box3();
      let pass = 0;
      const L = terrain.levels[0];
      for (const t of L.tiles) {
        const S_ = L.tileSpan;
        const x0 = L.grid.x0 + t.tx * S_ - frame.ox;
        const z1 = -((L.grid.y0 + t.ty * S_) - frame.oy);
        box.min.set(x0, t.dmin * 0.1 - 300, z1 - S_);
        box.max.set(x0 + S_, t.dmax * 0.1 + 100, z1);
        if (fr.intersectsBox(box)) pass++;
      }
      return {
        camPos: camera.position.toArray().map((v) => +v.toFixed(0)),
        target: rig.controls.target.toArray().map((v) => +v.toFixed(0)),
        // Unrounded, for a check that has to reproduce the projection: a metre of rounding is
        // nothing at a 15 km target and everything when the ground is seven metres away.
        camPosExact: camera.position.toArray(),
        targetExact: rig.controls.target.toArray(),
        near: camera.near, far: camera.far, fov: camera.fov, aspect: +camera.aspect.toFixed(3),
        canvas: [canvas.clientWidth, canvas.clientHeight],
        l0Pass: pass, l0Total: L.tiles.length,
        stats: { ...terrain.stats },
        mode: rig.mode,
      };
    },
    setDateTime: (mo, d, min) => { S.date = { ...S.date, mo, d }; S.minutes = min; updateSun(true); },
    // Run a tool the way a tap would, so the verification exercises the real code path.
    runTool: (id, pts) => {
      S.tool = id;
      picked = [];
      const body = $('tool-body');
      body.hidden = false;
      const hits = pts.map(([x, y]) => ({ x, y, elevM: terrain.heightAt(x, y) }));
      if (id === 'measure') runMeasure(hits[0], hits[1], body);
      if (id === 'los') runLos(hits[0], hits[1], body);
      if (id === 'viewshed') runViewshed(hits[0], body);
      if (id === 'firstsun') runFirstSun(hits[0], body);
      S.tool = null;
      return body.textContent.replace(/\s+/g, ' ').trim();
    },
    setEye: (m) => { S.eyeM = m; $('eye-h').value = String(m); $('eye-out').textContent = `${m.toFixed(1)} m`; },
    peaksFrom: (x, y, eye) => {
      const z = terrain.analysisHeight(x, y) + (eye ?? 1.7);
      return visiblePeaks(data.geo.places, (a, b) => terrain.analysisHeight(a, b), frame, x, y, z,
        { maxDist: 25000 }).map((k) => ({
        name: k.name, elevM: Math.round(k.elevM), distM: Math.round(k.dist),
        bearing: Math.round(k.bearing),
      }));
    },
    los: (ax, ay, bx, by) => {
      const r = lineOfSight((x, y) => terrain.heightAt(x, y), ax, ay, 1.7, bx, by, 0);
      return { clear: r.clear, distM: Math.round(r.dist), worstM: +r.worst.toFixed(1), blocks: r.blocks.length };
    },
    viewshedRings: (ex, ey) => {
      const g = terrain.analysis.core, d = viewshedTex.image.data;
      const rings = new Array(16).fill(0).map(() => [0, 0]);
      for (let r = 0; r < g.ny; r++) {
        for (let c = 0; c < g.nx; c++) {
          const x = g.x0 + c * g.res, y = g.y1 - r * g.res;
          const k = Math.min(15, Math.floor(Math.hypot(x - ex, y - ey) / 1000));
          rings[k][1]++;
          if (d[r * g.nx + c]) rings[k][0]++;
        }
      }
      return rings.map(([lit, tot], i) => `${i}-${i + 1}km ${(100 * lit / Math.max(1, tot)).toFixed(1)}%`);
    },
    profileLine: (ax, ay, bx, by, n) => {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        out.push(+terrain.analysisHeight(ax + (bx - ax) * f, ay + (by - ay) * f).toFixed(1));
      }
      return out;
    },
    viewshedVisible: (x, y) => {
      const g = terrain.analysis.core;
      const c = Math.round((x - g.x0) / g.res), r = Math.round((g.y1 - y) / g.res);
      if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return null;
      return viewshedTex.image.data[r * g.nx + c] > 0;
    },
    gradientAt: (x, y) => {
      const d = 16;
      return {
        dzdx: (terrain.analysisHeight(x + d, y) - terrain.analysisHeight(x - d, y)) / (2 * d),
        dzdy: (terrain.analysisHeight(x, y + d) - terrain.analysisHeight(x, y - d)) / (2 * d),
        z: terrain.analysisHeight(x, y),
      };
    },
    shadowAt: (x, y) => {
      const g = terrain.analysis.core;
      const c = Math.round((x - g.x0) / g.res), r = Math.round((g.y1 - y) / g.res);
      if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return null;
      return shadowBuf[r * g.nx + c] > 0 ? 'lit' : 'shadow';
    },
  };

  onResize();
  window.addEventListener('resize', onResize);
  $('loading').classList.add('done');
  invalidate();
}

function onResize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  lineMat.uniforms.uRes.value.set(w, h);
  for (const m of [connLine, riverLine, toolLine, markerLine]) {
    if (m) m.material.uniforms.uRes.value.set(w, h);
  }
  // The profile's labels are counter-scaled against the width the strip was given, so they have
  // to be measured again whenever that width changes.
  if (profile) profile.relayout();
  invalidate();
}

function frameWholeModel() {
  const c = data.manifest.core;
  const box = new THREE.Box3(
    new THREE.Vector3(frame.sx(c.x0), terrain.minM, frame.sz(c.y1)),
    new THREE.Vector3(frame.sx(c.x1), terrain.maxM, frame.sz(c.y0)),
  );
  rig.frameBox(box, 34, 200);
}

function routeBox() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < route.n; k++) {
    x0 = Math.min(x0, route.x[k]); x1 = Math.max(x1, route.x[k]);
    y0 = Math.min(y0, route.y[k]); y1 = Math.max(y1, route.y[k]);
  }
  if (!Number.isFinite(x0)) return null;
  return new THREE.Box3(
    new THREE.Vector3(frame.sx(x0 - 2000), terrain.minM, frame.sz(y1 + 2500)),
    new THREE.Vector3(frame.sx(x1 + 2000), terrain.maxM, frame.sz(y0 - 2500)),
  );
}

// The opening view: standing east of Gjendesheim looking west along the whole walk, which is the
// way the ridge is normally photographed and the only angle where both lakes are visible at once.
function frameRoute() {
  const b = routeBox();
  if (b) rig.frameBox(b, 24, 95); else frameWholeModel();
}

// ---------------------------------------------------------------- overlays
function buildOverlays() {
  lineMat = makeLineMaterial(0xc0392b, 3.4);
  const sample = (x, y) => terrain.heightAt(x, y);

  const mainPts = lineFeatureToPoints(
    (route.main && route.main.geometry.coordinates) || [], frame, sample, 0,
  );
  routeLine = new THREE.Mesh(buildLine(mainPts), lineMat);
  routeLine.frustumCulled = false; routeLine.renderOrder = 4;
  scene.add(routeLine);

  // Connectors and rivers are merged into one geometry each: the real rivers layer is hundreds
  // of features, and hundreds of draw calls cost a phone more than the triangles do.
  const connMat = makeLineMaterial(0x2c3e50, 2.0);
  connMat.uniforms.uOpacity.value = 0.85;
  const connPts = [];
  for (const f of route.connectors) {
    const g = f.geometry;
    const runs = g && g.type === 'LineString' ? [g.coordinates]
      : (g && g.type === 'MultiLineString' ? g.coordinates : []);
    for (const co of runs) connPts.push(lineFeatureToPoints(co, frame, sample, 0));
  }
  connLine = new THREE.Mesh(buildLines(connPts), connMat);
  connLine.frustumCulled = false; connLine.renderOrder = 3;
  scene.add(connLine);

  const riverMat = makeLineMaterial(0x6f93b5, 1.6);
  riverMat.uniforms.uOpacity.value = 0.8;
  const riverPts = [];
  for (const f of (data.geo.rivers.features || [])) {
    const g = f.geometry;
    const runs = g && g.type === 'LineString' ? [g.coordinates]
      : (g && g.type === 'MultiLineString' ? g.coordinates : []);
    for (const co of runs) riverPts.push(lineFeatureToPoints(co, frame, sample, 0));
  }
  riverLine = new THREE.Mesh(buildLines(riverPts), riverMat);
  riverLine.frustumCulled = false; riverLine.renderOrder = 2;
  scene.add(riverLine);

  const w = buildWater(data.geo.water, frame, 8);
  waterMat = makeWaterMaterial();
  waterMesh = new THREE.Mesh(w.geo, waterMat);
  waterMesh.frustumCulled = false; waterMesh.renderOrder = 1;
  scene.add(waterMesh);
  waterMesh.userData = w;

  const toolMat = makeLineMaterial(0x2f6a4f, 2.6);
  toolMat.uniforms.uLift.value = 6;
  toolLine = new THREE.Mesh(new THREE.BufferGeometry(), toolMat);
  toolLine.frustumCulled = false; toolLine.renderOrder = 6; toolLine.visible = false;
  scene.add(toolLine);

  const markMat = makeLineMaterial(0x111418, 2.2);
  markMat.uniforms.uLift.value = 0;
  markerLine = new THREE.Mesh(new THREE.BufferGeometry(), markMat);
  markerLine.frustumCulled = false; markerLine.renderOrder = 7; markerLine.visible = false;
  scene.add(markerLine);

  altLine = null;
}

function applyScheme() {
  const colors = data.edit.colors;
  applyPalette(mat, colors, scheme, data.manifest.elevation);
  scene.background = colorOf(colors, scheme, 'sky', scheme === 'dark' ? '#0d1218' : '#dfe7ef');
  lineMat.uniforms.uColor.value.copy(colorOf(colors, scheme, 'route', '#c0392b'));
  connLine.material.uniforms.uColor.value.copy(colorOf(colors, scheme, 'routeAlt', '#2c3e50'));
  riverLine.material.uniforms.uColor.value.copy(colorOf(colors, scheme, 'water', '#9fb9cf'));
  waterMat.uniforms.uColor.value.copy(colorOf(colors, scheme, 'water', '#9fb9cf'));
  markerLine.material.uniforms.uColor.value.copy(colorOf(colors, scheme, 'marker', '#111418'));
  toolLine.material.uniforms.uColor.value.copy(colorOf(colors, scheme, 'viewshed', '#3fa7a0'));
  toolLine.material.uniforms.uColor2.value.copy(colorOf(colors, scheme, 'route', '#c0392b'));
}

function applyExaggeration(v) {
  S.exag = v;
  terrain.setExaggeration(v);
  mat.uniforms.uExag.value = v;
  waterMat.uniforms.uExag.value = v;
  for (const m of [lineMat, connLine.material, riverLine.material,
    toolLine.material, markerLine.material]) {
    m.uniforms.uExag.value = v;
  }
  $('exag-out').textContent = v === 1 ? '×1.0 (true)' : `×${v.toFixed(1)}`;
  if (!$('scale-sub').textContent.includes('·')) $('scale-sub').textContent = `vertical ×${v.toFixed(1)}`;
  invalidate();
}

// ---------------------------------------------------------------- sun
function sunNow() {
  const { y, mo, d } = S.date;
  return sunAt(y, mo, d, S.minutes, frame.centreLat, frame.centreLon);
}

function updateSun(recomputeShadow) {
  const s = sunNow();
  sunInfo = s;
  const v = sunVector(s.az, s.elevApparent, frame.convergence);
  mat.uniforms.uSunDir.value.set(v.x, v.y, v.z).normalize();
  mat.uniforms.uSunUp.value = s.elevApparent > -0.5 ? 1 : 0;
  waterMat.uniforms.uSunDir.value.set(v.x, v.y, v.z);
  waterMat.uniforms.uSunUp.value = s.elevApparent > 0 ? 1 : 0;

  const { y, mo, d } = S.date;
  events = dayEvents(y, mo, d, frame.centreLat, frame.centreLon);
  const off = tzOffsetHours(y, mo, d, S.minutes);
  $('date-out').textContent = fmtDateShort(y, mo, d);
  $('time-out').textContent = `${fmtClock(S.minutes)} ${tzName(off)}`;
  $('sun-when').textContent = s.elevApparent > 0
    ? `${s.elevApparent.toFixed(1)}° up, ${compassPoint(s.az)} ${Math.round(s.az)}°`
    : `below the horizon (${s.elevApparent.toFixed(1)}°)`;

  const ev = [];
  if (events.polarDay) ev.push('The sun does not set today.');
  else if (events.polarNight) ev.push('The sun does not rise today.');
  else {
    ev.push(`Sunrise ${fmtClock(events.sunrise)} · sunset ${fmtClock(events.sunset)}`);
  }
  if (events.goldenMorning && events.goldenMorning[0] != null && events.goldenMorning[1] != null) {
    ev.push(`Golden ${fmtClock(events.goldenMorning[0])}–${fmtClock(events.goldenMorning[1])}`);
  }
  if (events.goldenEvening && events.goldenEvening[0] != null && events.goldenEvening[1] != null) {
    ev.push(`and ${fmtClock(events.goldenEvening[0])}–${fmtClock(events.goldenEvening[1])}`);
  }
  if (events.dawn == null && events.dusk == null && !events.polarNight) {
    ev.push('Civil twilight lasts all night — it never gets properly dark.');
  } else if (events.dawn != null && events.dusk != null) {
    ev.push(`Civil twilight from ${fmtClock(events.dawn)} and until ${fmtClock(events.dusk)}.`);
  }
  ev.push(`Highest ${events.maxAlt.toFixed(1)}° at ${fmtClock(events.solarNoon)}.`);
  $('sun-events').textContent = ev.join(' ');
  $('sub').textContent = `${fmtDate(y, mo, d)} · ${fmtClock(S.minutes)} ${tzName(off)}`;

  if (recomputeShadow) computeShadows();
  else { shadowDirty = true; scheduleShadow(); }
  invalidate();
}

function scheduleShadow() {
  clearTimeout(shadowTimer);
  shadowTimer = setTimeout(() => { if (shadowDirty) computeShadows(); }, 170);
}

function computeShadows() {
  shadowDirty = false;
  const s = sunInfo || sunNow();
  const core = terrain.analysis.core, shell = terrain.analysis.shell;
  const t0 = performance.now();
  const gridAz = s.az - frame.convergence;
  if (s.elevApparent <= 0) {
    shadowBuf.fill(0); shellBuf.fill(0);
  } else {
    shadowMask(shell, gridAz, s.elevApparent, shellBuf);
    const seed = makeSeed(shell, core, (x, y) => terrain.gridSample(shell, x, y), gridAz, s.elevApparent);
    shadowMask(core, gridAz, s.elevApparent, shadowBuf, seed);
  }
  timings.shadowMs = performance.now() - t0;
  shadowCore.needsUpdate = true;
  shadowShell.needsUpdate = true;
  invalidate();
}

// ---------------------------------------------------------------- cursor and marker
function setCursor(i, fromProfile, persist = true) {
  S.cursor = clamp(i | 0, 0, Math.max(0, route.n - 1));
  profile.setCursor(S.cursor);
  const r = route;
  const dist = r.dirDist(S.cursor, S.reversed);
  const g = r.gradientAt(S.cursor);
  $('s-dist').textContent = fmtDist(dist);
  $('s-elev').textContent = `${Math.round(r.z[S.cursor])} m`;
  $('s-grad').textContent = `${(g * 100).toFixed(0)} %`;
  const endIdx = S.reversed ? 0 : r.n - 1;
  const t = timeForSegments(r, S.cursor, endIdx, effectivePace());
  $('s-time').textContent = fmtHM(t.hours);
  const upto = S.reversed
    ? { up: r.descent - r.descentTo[S.cursor], down: r.ascent - r.ascentTo[S.cursor] }
    : { up: r.ascentTo[S.cursor], down: r.descentTo[S.cursor] };
  const totalUp = Math.round(r.props.ascentM ?? r.ascent);
  $('s-updown').textContent =
    `+${Math.round(upto.up)} / −${Math.round(upto.down)} m so far · `
    + `${fmtDist(r.props.lengthM ?? r.length)} and ${totalUp} m up in all`;
  if (rig && rig.mode !== 'orbit' && !rig.flying && fromProfile) {
    // routeT is measured along the direction being walked, so it mirrors with the direction.
    const t = S.reversed ? 1 - r.cum[S.cursor] / r.length : r.cum[S.cursor] / r.length;
    rig.placeOnRoute(r, t, S.reversed, rig.eyeM, true);
    $('fp-t').value = String(Math.round(t * 1000));
  }
  $('fp-out').textContent = `${fmtDist(dist)} · ${Math.round(r.z[S.cursor])} m`;
  setMarker({ x: r.x[S.cursor], y: r.y[S.cursor], z: r.z[S.cursor], onRoute: true }, false);
  if (persist) save();
  invalidate();
}

function setMarker(m, updateCursor = true) {
  S.marker = m ? { x: m.x, y: m.y } : null;
  if (!m) { markerLine.visible = false; invalidate(); return; }
  const z = Number.isFinite(m.z) ? m.z : terrain.heightAt(m.x, m.y);
  const sx = frame.sx(m.x), sz = frame.sz(m.y);
  const pts = new Float64Array([sx, z, sz, sx, z + 90, sz]);
  markerLine.geometry.dispose();
  markerLine.geometry = buildLine(pts);
  markerLine.visible = true;
  markerLine.userData = { x: m.x, y: m.y, z };
  if (updateCursor) {
    const near = route.n ? route.nearestIndex(m.x, m.y) : null;
    if (near && near.dist < 180) setCursor(near.i, false);
  }
  const [lon, lat] = frame.lonLat(m.x, m.y);
  $('readout').hidden = false;
  $('r-main').textContent = `${Math.round(z)} m`;
  $('r-sub').textContent = fmtLonLat(lon, lat);
  invalidate();
}

function effectivePace() {
  const p = JSON.parse(JSON.stringify(data.edit.pace || {}));
  if (S.paceModel) p.model = S.paceModel;
  if (S.paceFit) p.fitnessFactor = S.paceFit;
  return p;
}

// ---------------------------------------------------------------- picking
let tap = null;
canvas.addEventListener('pointerdown', (e) => {
  tap = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
});
canvas.addEventListener('pointerup', (e) => {
  if (!tap || e.pointerId !== tap.id) { tap = null; return; }
  const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
  const dt = performance.now() - tap.t;
  tap = null;
  if (moved < 10 && dt < 600) onTap(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', () => { tap = null; });

function pickTerrain(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - r.left) / r.width) * 2 - 1,
    -((clientY - r.top) / r.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  return terrain.raycast(raycaster.ray.origin, raycaster.ray.direction);
}

function onTap(cx, cy) {
  const hit = pickTerrain(cx, cy);
  if (!hit) return;
  if (S.tool) { toolPoint(hit); return; }
  setMarker(hit, true);
}

// ---------------------------------------------------------------- tools
const TOOLS = [
  { id: 'measure', name: 'Measure', points: 2, hint: 'Tap two points to measure between them.' },
  { id: 'los', name: 'Line of sight', points: 2, hint: 'Tap the eye, then what you want to see.' },
  { id: 'viewshed', name: 'Viewshed', points: 1, hint: 'Tap a viewpoint to see what it can see.' },
  { id: 'firstsun', name: 'First and last sun', points: 1, hint: 'Tap a point to find when the sun reaches it.' },
];
let picked = [];
let lastRun = null;

function setTool(id) {
  S.tool = S.tool === id ? null : id;
  picked = [];
  $$('#tool-chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool)));
  const def = TOOLS.find((t) => t.id === S.tool);
  $('pickbar').hidden = !def;
  if (def) $('pickbar').textContent = def.hint;
  if (!def) { toolLine.visible = false; $('tool-body').hidden = true; invalidate(); }
  invalidate();
}

function toolPoint(hit) {
  const def = TOOLS.find((t) => t.id === S.tool);
  if (!def) return;
  picked.push(hit);
  if (picked.length < def.points) {
    $('pickbar').textContent = def.id === 'los' ? 'Now tap what you want to see.' : 'Now tap the second point.';
    setMarker(hit, false);
    return;
  }
  $('pickbar').hidden = true;
  const body = $('tool-body');
  body.hidden = false;
  if (def.id === 'measure') runMeasure(picked[0], picked[1], body);
  if (def.id === 'los') runLos(picked[0], picked[1], body);
  if (def.id === 'viewshed') runViewshed(picked[0], body);
  if (def.id === 'firstsun') runFirstSun(picked[0], body);
  picked = [];
  if (S.sheet < 2) setStop(2);
  $('pickbar').hidden = false;
  $('pickbar').textContent = def.hint;
}

function drawToolLine(pts, split) {
  toolLine.geometry.dispose();
  toolLine.geometry = buildLine(pts.arr, pts.t);
  toolLine.material.uniforms.uSplit.value = split == null ? -1 : split;
  toolLine.visible = true;
  invalidate();
}

function runMeasure(a, b, body) {
  const m = measure((x, y) => terrain.heightAt(x, y), a.x, a.y, b.x, b.y);
  const n = 64, arr = new Float64Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    arr[i * 3] = frame.sx(x); arr[i * 3 + 1] = terrain.heightAt(x, y) + 4; arr[i * 3 + 2] = frame.sz(y);
  }
  drawToolLine({ arr }, null);
  const bearing = frame.trueBearing(a.x, a.y, b.x, b.y);
  body.innerHTML = `<b>Measure</b><dl>`
    + row('Horizontal', fmtDist(m.horiz))
    + row('Straight line', fmtDist(m.slant))
    + row('Height difference', `${m.dz >= 0 ? '+' : ''}${Math.round(m.dz)} m`)
    + row('Average gradient', `${(m.gradient * 100).toFixed(1)} % (${m.angleDeg.toFixed(1)}°)`)
    + row('Bearing', `${Math.round(bearing)}° ${compassPoint(bearing)} true`)
    + `</dl><p class="dim small">Heights from the finest terrain level loaded at each end.</p>`;
}

function runLos(a, b, body) {
  const eyeA = S.eyeM, eyeB = 0;
  lastRun = { id: 'los', pts: [a, b] };
  const los = lineOfSight((x, y) => terrain.heightAt(x, y), a.x, a.y, eyeA, b.x, b.y, eyeB);
  const n = los.n, arr = new Float64Array((n + 1) * 3), tv = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    arr[i * 3] = frame.sx(x); arr[i * 3 + 1] = los.sight[i]; arr[i * 3 + 2] = frame.sz(y);
    tv[i] = f;
  }
  // Colour splits at the first blocking stretch, so the line itself shows where it is stopped.
  drawToolLine({ arr, t: tv }, los.clear ? -1 : los.blocks[0].from);

  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= n; i++) {
    lo = Math.min(lo, los.prof[i], los.sight[i]); hi = Math.max(hi, los.prof[i], los.sight[i]);
  }
  const W = 300, H = 88, pad = 4;
  const X = (i) => (i / n) * W;
  const Y = (z) => pad + (1 - (z - lo) / Math.max(1, hi - lo)) * (H - pad * 2);
  let terr = `M0 ${H}`;
  for (let i = 0; i <= n; i++) terr += `L${X(i).toFixed(1)} ${Y(los.prof[i]).toFixed(1)}`;
  terr += `L${W} ${H}Z`;
  let sight = `M0 ${Y(los.sight[0]).toFixed(1)}L${W} ${Y(los.sight[n]).toFixed(1)}`;
  let blocks = '';
  for (const bl of los.blocks) {
    blocks += `<rect class="blk" x="${(bl.from * W).toFixed(1)}" y="0" width="${Math.max(1.5, (bl.to - bl.from) * W).toFixed(1)}" height="${H}"/>`;
  }
  body.innerHTML = `<b>Line of sight</b><dl>`
    + row('Distance', fmtDist(los.dist))
    + row('Eye', `${Math.round(los.az)} m (${eyeA} m above ground)`)
    + row('Target', `${Math.round(los.bz)} m`)
    + row('Verdict', los.clear
      ? (los.grazes
        ? (Math.abs(los.worst) < 0.1
          ? `clear, but only just — the line grazes the ground at ${fmtDist(los.worstAt * los.dist)}`
          : `clear, but only just — the line passes within ${Math.abs(los.worst).toFixed(1)} m `
            + `of the ground at ${fmtDist(los.worstAt * los.dist)}`)
        : 'clear')
      : `blocked by up to ${Math.round(los.worst)} m at ${fmtDist(los.worstAt * los.dist)}`)
    + `</dl><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Terrain cross-section with the sight line">`
    + `${blocks}<path class="terr" d="${terr}"/><path class="sight${los.clear ? '' : ' blocked'}" d="${sight}"/></svg>`;
}

function runViewshed(p, body) {
  const core = terrain.analysis.core;
  const eye = S.eyeM;
  lastRun = { id: 'viewshed', pts: [p] };
  const t0 = performance.now();
  const vs = viewshed(core, p.x, p.y, eye, Math.min(25000, (core.x1 - core.x0) * 0.75),
    (x, y) => terrain.analysisHeight(x, y));
  timings.viewshedMs = performance.now() - t0;
  viewshedTex.image.data.set(vs.mask);
  viewshedTex.needsUpdate = true;
  mat.uniforms.uHasViewshed.value = 1;
  S.layers.viewshed = true;
  applyLayerUniforms();
  viewshedInfo = { x: p.x, y: p.y, eyeZ: vs.eyeZ };
  toolLine.visible = false;

  const peaks = visiblePeaks(data.geo.places, (x, y) => terrain.analysisHeight(x, y),
    frame, p.x, p.y, vs.eyeZ, { maxDist: vs.radiusM });
  let lit = 0;
  for (let i = 0; i < vs.mask.length; i++) if (vs.mask[i]) lit++;
  body.innerHTML = `<b>Viewshed</b><dl>`
    + row('Eye', `${Math.round(vs.eyeZ)} m (${eye} m above ground)`)
    + row('Radius', fmtDist(vs.radiusM))
    + row('Visible ground', `${((lit / vs.mask.length) * 100).toFixed(1)} % of the core box`)
    + row('Rays', `${vs.nAz} azimuths, ${core.res} m steps`)
    + row('Target', `a person ${vs.targetAboveGround} m tall standing there`)
    + `</dl>`
    + (peaks.length
      ? `<ul class="peaks">${peaks.map((k) => `<li><span>${escapeHtml(k.name || '—')}</span>`
        + `<span class="d">${Math.round(k.elevM)} m</span>`
        + `<span class="d">${fmtDist(k.dist)} ${compassPoint(k.bearing)} ${Math.round(k.bearing)}°</span></li>`).join('')}</ul>`
      : `<p class="dim small">No named peak in places.geojson is visible from here.</p>`)
    + `<p class="dim small">Marched on the ${core.res} m analysis grid inside the core box only. `
    + `Bearings are TRUE, corrected for the ${frame.convergence.toFixed(2)}° grid convergence. `
    + `A viewpoint on a convex summit hides much of its own slope from an eye ${eye} m above the `
    + `ground — that is the geometry, not a bug. Raise the eye height to see how far it reaches.</p>`;
  setMarker(p, false);
}

function runFirstSun(p, body) {
  lastRun = { id: 'firstsun', pts: [p] };
  const { y, mo, d } = S.date;
  const t0 = performance.now();
  const w = directSunWindow(
    (x, yy) => terrain.analysisHeight(x, yy), p.x, p.y, p.elevM,
    y, mo, d, frame.centreLat, frame.centreLon, frame.convergence, terrain.maxM + 5,
  );
  const ms = performance.now() - t0;
  const off = tzOffsetHours(y, mo, d, 720);
  const spans = w.spans.map(([a, b]) => `${fmtClock(a)}–${fmtClock(b)}`).join(', ');
  body.innerHTML = `<b>Direct sun on this point</b><dl>`
    + row('Point', `${Math.round(p.elevM)} m`)
    + row('Date', fmtDate(y, mo, d))
    + row('First sun', w.first == null ? 'never today' : `${fmtClock(w.first)} ${tzName(off)}`)
    + row('Last sun', w.last == null ? '—' : `${fmtClock(w.last)} ${tzName(off)}`)
    + row('Total', w.totalMinutes ? fmtHM(w.totalMinutes / 60) : 'none')
    + (w.spans.length > 1 ? row('In', spans) : '')
    + `</dl><p class="dim small">Sampled every two minutes and bisected to the minute, `
    + `ray-marching the height grid toward the sun each time (${ms.toFixed(0)} ms). `
    + `Shadowing by terrain only — no cloud, no trees.</p>`;
  setMarker(p, false);
}

const row = (k, v) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`;

// ---------------------------------------------------------------- labels
const labelBox = $('labels');
const _v = new THREE.Vector3();
function projectScene(x, y, z) {
  _v.set(x, y * S.exag, z).project(camera);
  if (_v.z > 1 || _v.z < -1) return null;
  const r = canvas.getBoundingClientRect();
  return { x: (_v.x * 0.5 + 0.5) * r.width, y: (-_v.y * 0.5 + 0.5) * r.height, z: _v.z };
}
function zoomBand() {
  const d = camera.position.distanceTo(rig.controls.target);
  return d > 25000 ? 0 : d > 9000 ? 1 : d > 3000 ? 2 : 3;
}
// A label is worth drawing only if the thing it names can actually be seen. The occlusion test
// is the same ray-march the line-of-sight tool uses, from the camera to the point, on the
// analysis grid — which is what stops a summit label from floating over the valley in front of it.
function labelVisible(x, y, z) {
  const cx = frame.wx(camera.position.x), cy = frame.wy(camera.position.z);
  const cz = camera.position.y / Math.max(S.exag, 0.001);
  const dist = Math.hypot(x - cx, y - cy);
  if (dist < 60) return true;
  return visibleFrom((ax, ay) => terrain.analysisHeight(ax, ay), cx, cy, cz, x, y, z + 8,
    clamp(dist / 140, 24, 400));
}

const LABEL_LIMIT = 26;
function updateLabels() {
  if (!S.layers.labels) { if (labelBox.childElementCount) labelBox.textContent = ''; return; }
  const band = zoomBand();
  const items = [];
  for (const w of route.waypoints) {
    items.push({ cls: 'wp', name: w.name, sub: `${Math.round(w.elevM)} m`, x: w.x, y: w.y, z: w.elevM, pri: 1000 });
  }
  for (const f of (data.geo.places.features || [])) {
    const p = f.properties || {};
    if ((p.showAt ?? 3) > band) continue;
    const c = f.geometry.coordinates;
    items.push({
      cls: 'peak', name: p.name, sub: p.kind === 'peak' || p.kind === 'ridge' ? `${Math.round(p.elevM ?? c[2])} m` : '',
      x: c[0], y: c[1], z: c[2] ?? terrain.heightAt(c[0], c[1]), pri: (p.relief1kmM ?? 0) + (p.elevM ?? 0) / 20,
    });
  }
  if (band >= 2) {
    for (const mk of (route.kmMarks || [])) {
      const i = clamp(mk.i | 0, 0, route.n - 1);
      const km = S.reversed ? Math.round((route.length - route.cum[i]) / 1000) : mk.km;
      items.push({ cls: 'km', name: `${km} km`, sub: '', x: route.x[i], y: route.y[i], z: route.z[i], pri: 5 });
    }
  }
  if (markerLine.visible) {
    const m = markerLine.userData;
    items.push({ cls: 'mark', name: `${Math.round(m.z)} m`, sub: '', x: m.x, y: m.y, z: m.z + 90, pri: 2000, noOcclude: true });
  }
  items.sort((a, b) => b.pri - a.pri);

  const placed = [];
  const r = canvas.getBoundingClientRect();
  let html = '';
  let n = 0, tested = 0;
  for (const it of items) {
    if (n >= LABEL_LIMIT || tested > 90) break;
    const p = projectScene(frame.sx(it.x), it.z, frame.sz(it.y));
    if (!p) continue;
    if (p.x < 6 || p.y < 6 || p.x > r.width - 6 || p.y > r.height - 6) continue;
    // Boxes, not points: these labels are 70 to 160 px wide and a point test lets them pile up.
    const w = (String(it.name || '').length * 6.2) + 14;
    const h = it.sub ? 30 : 19;
    // Slide a label back inside the frame rather than dropping it: a name half off the edge is
    // worse than the same name nudged twenty pixels.
    if (w < r.width - 12) p.x = clamp(p.x, w / 2 + 4, r.width - w / 2 - 4);
    p.y = clamp(p.y, h + 4, r.height - 4);
    let clash = false;
    for (const q of placed) {
      if (Math.abs(q.x - p.x) * 2 < (q.w + w) && Math.abs(q.y - p.y) * 2 < (q.h + h)) { clash = true; break; }
    }
    if (clash) continue;
    tested++;
    if (!it.noOcclude && !labelVisible(it.x, it.y, it.z)) continue;
    placed.push({ x: p.x, y: p.y - h / 2, w, h });
    n++;
    html += `<span class="lbl ${it.cls}" style="transform:translate(${p.x.toFixed(0)}px,${p.y.toFixed(0)}px) translate(-50%,-100%)">`
      + `${escapeHtml(it.name || '')}${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</span>`;
  }
  labelBox.innerHTML = html;
}

// ---------------------------------------------------------------- compass and scale
const SCALE_STEPS = [1, 1.5, 2, 2.5, 3, 5, 7.5];
// A scale bar in a perspective view is only true at one depth, so the depth has to be the ground
// the viewer is looking at: the centre of the screen. Using the orbit target instead is right in
// orbit — the target is what you are looking at — and badly wrong in first person, where the rig
// parks the target 500 m ahead and the bar then reads 50 m across a fifteen-kilometre panorama.
// If the centre ray misses the terrain (looking at the sky) the target is the fallback.
function gaugeReference() {
  const r = canvas.getBoundingClientRect();
  const hit = pickTerrain(r.left + r.width / 2, r.top + r.height / 2);
  if (hit) return { x: frame.sx(hit.x), y: hit.elevM, z: frame.sz(hit.y), onGround: true };
  const t = rig.controls.target;
  return { x: t.x, y: t.y / Math.max(S.exag, 0.001), z: t.z, onGround: false };
}

function updateGauge() {
  const ref = gaugeReference();
  const camDist = Math.hypot(camera.position.x - ref.x,
    camera.position.y - ref.y * S.exag, camera.position.z - ref.z);
  const d = Math.max(1, camDist * 0.02);
  const p0 = projectScene(ref.x, ref.y, ref.z);
  if (!p0) return;
  const pe = projectScene(ref.x + d, ref.y, ref.z);
  // Grid north is -Z; true north is that turned by the grid convergence.
  const cv = frame.convergence * DEG;
  const pnT = projectScene(ref.x - d * Math.sin(cv), ref.y, ref.z - d * Math.cos(cv));
  const pnG = projectScene(ref.x, ref.y, ref.z - d);
  if (!pe || !pnT || !pnG) return;

  const acrossPx = Math.hypot(pe.x - p0.x, pe.y - p0.y);
  const ppm = acrossPx / d;
  if (ppm > 0 && Number.isFinite(ppm)) {
    let best = 0, err = Infinity;
    for (let e = -1; e <= 5; e++) {
      for (const st of SCALE_STEPS) {
        const m = st * 10 ** e, x = Math.abs(Math.log(m * ppm / 104));
        if (x < err) { err = x; best = m; }
      }
    }
    $('scale-len').textContent = best >= 1000 ? `${+(best / 1000).toFixed(2)} km` : `${+best.toFixed(0)} m`;
    $('scale-bar').style.width = `${Math.max(8, Math.round(best * ppm))}px`;
    // Say where the bar is true. One scale cannot hold across a perspective view, and in a
    // first-person view tilted down the middle of the screen can be the ground at your feet —
    // so the caption names the distance the bar applies at rather than letting it read as global.
    $('scale-sub').textContent = `${ref.onGround ? `at ${fmtDist(camDist)} · ` : ''}`
      + `vertical ×${S.exag.toFixed(1)}`;
  }
  const ang = (p, el) => {
    const dx = p.x - p0.x, dy = p.y - p0.y;
    const a = Math.atan2(dx, -dy) * RAD;
    const k = clamp(Math.hypot(dx, dy) / Math.max(acrossPx, 0.001), 0.3, 1);
    el.setAttribute('transform', `translate(26 26) rotate(${a.toFixed(1)}) scale(1 ${k.toFixed(3)}) translate(-26 -26)`);
    return a;
  };
  const aT = ang(pnT, $('needle'));
  ang(pnG, $('gridn'));
  const r = 21, rad = aT * DEG;
  $('cn').setAttribute('x', (26 + r * Math.sin(rad)).toFixed(1));
  $('cn').setAttribute('y', (26 - r * Math.cos(rad)).toFixed(1));
  $('compass').setAttribute('aria-label',
    `Compass: true north is ${Math.round(((-aT % 360) + 360) % 360)} degrees from the top of the view. `
    + `The dashed arm is UTM grid north, ${Math.abs(frame.convergence).toFixed(1)} degrees away.`);
}

// ---------------------------------------------------------------- layers panel
const LAYERS = [
  { id: 'sun', name: 'Sunlight', sub: 'Lit from the real solar position for the date and time' },
  { id: 'shadow', name: 'Cast shadows', sub: 'Swept over the height grid, not a guess from the slope' },
  { id: 'hillshade', name: 'Hillshade', sub: 'The map-maker’s fixed lamp from the north-west' },
  { id: 'slope', name: 'Slope angle', sub: '30° and 40° picked out, measured on the true surface' },
  { id: 'bands', name: 'Elevation bands', sub: 'Colours from data/colors.json' },
  { id: 'contour20', name: 'Contours, 20 m', sub: '' },
  { id: 'contour100', name: 'Contours, 100 m', sub: '' },
  { id: 'water', name: 'Water surfaces', sub: '' },
  { id: 'glacier', name: 'Glaciers', sub: '' },
  { id: 'rivers', name: 'Rivers and streams', sub: '' },
  { id: 'route', name: 'The trail', sub: 'Turrutebasen, draped on the terrain' },
  { id: 'viewshed', name: 'Viewshed overlay', sub: 'Shown once you have run the viewshed tool' },
  { id: 'labels', name: 'Place names', sub: '' },
];
function buildLayerPanel() {
  const box = $('layer-rows');
  box.innerHTML = LAYERS.map((L) => `<div class="layer-row">`
    + `<button class="sw" data-layer="${L.id}" aria-pressed="${S.layers[L.id] ? 'true' : 'false'}" aria-label="${escapeHtml(L.name)}"></button>`
    + `<span class="t"><b>${escapeHtml(L.name)}</b>${L.sub ? `<span>${escapeHtml(L.sub)}</span>` : ''}</span>`
    + `</div>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.sw');
    if (!b) return;
    const id = b.dataset.layer;
    S.layers[id] = !S.layers[id];
    b.setAttribute('aria-pressed', String(S.layers[id]));
    applyLayerUniforms();
    save();
  });
}
function applyLayerUniforms() {
  const u = mat.uniforms;
  u.uLayerSun.value = S.layers.sun ? 1 : 0;
  u.uLayerShadow.value = S.layers.shadow ? 1 : 0;
  u.uLayerHill.value = S.layers.hillshade ? 1 : 0;
  u.uLayerSlope.value = S.layers.slope ? 1 : 0;
  u.uLayerBands.value = S.layers.bands ? 1 : 0;
  u.uLayerC20.value = S.layers.contour20 ? 1 : 0;
  u.uLayerC100.value = S.layers.contour100 ? 1 : 0;
  u.uLayerGlacier.value = S.layers.glacier ? 1 : 0;
  u.uLayerWater.value = S.layers.water ? 1 : 0;
  u.uLayerViewshed.value = S.layers.viewshed ? 1 : 0;
  waterMesh.visible = !!S.layers.water;
  routeLine.visible = !!S.layers.route;
  connLine.visible = !!S.layers.route;
  riverLine.visible = !!S.layers.rivers;
  $$('#layer-rows .sw').forEach((b) => b.setAttribute('aria-pressed', String(!!S.layers[b.dataset.layer])));
  const lakes = (waterMesh.userData && waterMesh.userData.lakes) || [];
  $('layer-note').textContent = lakes.length
    ? `Lake surfaces are drawn flat at the level N50 states: ${lakes.filter((l) => l.name).slice(0, 4).map((l) => `${l.name} ${Math.round(l.levelM)} m`).join(', ')}.`
    : '';
  invalidate();
}

// ---------------------------------------------------------------- chips
function buildCameraChips() {
  const box = $('cam-chips');
  box.innerHTML = ['Whole area', 'Fit the route', 'On the route'].map((n, i) =>
    `<button class="chip" data-cam="${i}">${n}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const i = +b.dataset.cam;
    if (i === 0) frameWholeModel();
    if (i === 1) frameRoute();
    if (i === 2) { rig.setMode('fp'); rig.placeOnRoute(route, rig.routeT, S.reversed, rig.eyeM, false); }
    save();
  });
}

function buildViewpointChips() {
  const list = [...((data.edit.viewpoints && data.edit.viewpoints.viewpoints) || []), ...S.savedViews];
  $('vp-chips').innerHTML = list.length
    ? list.map((v, i) => `<button class="chip" data-vp="${i}">${escapeHtml(v.name || v.id || `View ${i + 1}`)}</button>`).join('')
    : '<span class="dim small">data/viewpoints.json has no viewpoints.</span>';
  $('vp-chips').onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    rig.applyViewpoint(list[+b.dataset.vp]);
    save();
  };
}

function buildToolChips() {
  const box = $('tool-chips');
  box.innerHTML = TOOLS.map((t) => `<button class="chip" data-tool="${t.id}" aria-pressed="false">${t.name}</button>`).join('')
    + `<button class="chip" data-tool="clear">Clear</button>`;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (b.dataset.tool === 'clear') {
      S.tool = null; picked = []; toolLine.visible = false;
      mat.uniforms.uHasViewshed.value = 0; viewshedInfo = null;
      $('tool-body').hidden = true; $('pickbar').hidden = true;
      $$('#tool-chips .chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      invalidate();
      return;
    }
    setTool(b.dataset.tool);
  });
}

// ---------------------------------------------------------------- about
function buildAbout(projErr) {
  const a = data.edit.about || {};
  const m = data.manifest;
  const rp = route.props || {};
  const src = m.source || {};
  const fixture = m.fixture === true;
  const lakes = (waterMesh.userData && waterMesh.userData.lakes) || [];
  const box = $('about-body');
  box.innerHTML =
    `<p class="lead"><b>Not a navigation tool.</b> ${escapeHtml(a.notNavigation
      || 'This is a planning tool. It has no position fix, no compass reading and no live weather. '
      + 'Besseggen is exposed and the weather turns fast — carry a map and compass and check conditions before you go.')}</p>`
    + (fixture ? `<p class="lead"><b>Fixture data.</b> ${escapeHtml(a.fixtureWarning || 'This build is running on synthetic data. Nothing you see is a real mountain.')}</p>` : '')
    + `<h3>Elevation</h3><dl>`
    + row('Source', `${(a.terrain && a.terrain.name) || src.terrain || '—'}`)
    + row('Owner', (a.terrain && a.terrain.owner) || '—')
    + row('Source resolution', `${(a.terrain && a.terrain.resolutionM) || src.resolutionM || '—'} m`)
    + row('Model resolution', `${(a.terrain && a.terrain.modelResolutionM) || '—'} m on the route, ${m.levels[0].res} m at the horizon`)
    + row('Licence', (a.terrain && a.terrain.licence) || '—')
    + row('Retrieved', (a.terrain && a.terrain.retrieved) || src.retrieved || '—')
    // The download date is not the survey date, and for a lidar model the survey is the one
    // that matters. about.json has carried the capture projects all along.
    + (((a.terrain && a.terrain.projects) || []).length
      ? row('Surveyed', a.terrain.projects.join(', ')) : '')
    + row('Elevation range', (() => {
      // The detailed box, not the horizon ring: the shell reaches down to a valley 20 km away
      // and quoting that as "the elevation range" would say nothing about this mountain.
      const r = (a.terrain && a.terrain.elevationRangeM) || null;
      const c = m.elevation.core || m.elevation;
      return r ? `${Math.round(r[0])}–${Math.round(r[1])} m` : `${Math.round(c.minM)}–${Math.round(c.maxM)} m`;
    })())
    + `</dl>`
    + ((a.terrain && a.terrain.accuracy) ? `<p class="dim">${escapeHtml(a.terrain.accuracy)}</p>` : '')
    + `<h3>The trail</h3><dl>`
    + row('Source', (a.trails && a.trails.name) || rp.source || '—')
    + row('Owner', (a.trails && a.trails.owner) || '—')
    + row('Licence', (a.trails && a.trails.licence) || '—')
    + row('Updated', rp.sourceUpdated || (a.trails && a.trails.retrieved) || '—')
    + row('Length', fmtDist(rp.lengthM ?? route.length))
    + row('Ascent as shipped', `${Math.round(rp.ascentM ?? route.ascent)} m up, ${Math.round(rp.descentM ?? route.descent)} m down`)
    + row('Sampling', `${rp.sampleStepM ?? '—'} m steps, ${rp.smoothing || 'no smoothing stated'}`)
    + (rp.rawAscentM ? row('Unsmoothed', `${Math.round(rp.unsmoothedAscentM ?? 0)} m at ${rp.sampleStepM} m, ${Math.round(rp.rawAscentM)} m on the raw vertices`) : '')
    + `</dl>`
    + `<p class="dim">Cumulative ascent depends entirely on how often you sample a noisy elevation `
    + `model. The figure above is the one the pipeline states, with what it did to get there; `
    + `the raw number is about 20 % higher because a 1 m model read every few metres counts `
    + `boulders as climbing.</p>`
    + ((a.trails && a.trails.accuracy) ? `<p class="dim">${escapeHtml(a.trails.accuracy)}</p>` : '')
    + `<h3>Map data</h3><dl>`
    + row('Lakes, glaciers, rivers', (a.mapData && a.mapData.name) || '—')
    + row('Owner', (a.mapData && a.mapData.owner) || '—')
    + row('Licence', (a.mapData && a.mapData.licence) || '—')
    + row('Place names', (a.placeNames && a.placeNames.name) || '—')
    + row('Owner', (a.placeNames && a.placeNames.owner) || '—')
    + row('Licence', (a.placeNames && a.placeNames.licence) || '—')
    + `</dl>`
    + (lakes.length ? `<p class="dim">Lake surfaces are drawn at the water level the lidar reads, `
      + `never below the whole metre N50 states, because lidar returns the surface itself and that `
      + `surface is usually a few decimetres above the rounded figure — a plane at the integer `
      + `would be buried under its own shore: `
      + `${lakes.filter((l) => l.name).map((l) => `${escapeHtml(l.name)} ${l.levelM.toFixed(1)} m`
        + (l.n50Hoyde != null && Math.abs(l.n50Hoyde - l.levelM) > 0.15 ? ` (N50 ${l.n50Hoyde})` : '')).join(', ')}. `
      + `Lidar returns the water surface, not the bed, so the terrain under a lake already sits at that level.</p>` : '')
    + (a.route && a.route.howMeasured ? `<p class="dim">${escapeHtml(a.route.howMeasured)}</p>` : '')
    + `<h3>The boat</h3><p>${escapeHtml(a.boat || 'Most people take the MS Gjende boat one way. No timetable is shown here; it changes every season.')}</p>`
    + `<h3>How the sun is computed</h3>`
    + `<p>Solar position uses the NOAA Solar Calculator algorithm (Meeus, <i>Astronomical `
    + `Algorithms</i>), written out in this app rather than taken from a library. NOAA gives about `
    + `one minute of error on sunrise and sunset for latitudes inside 72°, and a hundredth of a `
    + `degree on position before the refraction model's own error. Times are Norwegian local time `
    + `(CET, CEST in summer) computed from the European rule, not from this device's clock.</p>`
    + `<p>Shadows are cast by sweeping the ${terrain.analysis.core.res} m height grid away from `
    + `the sun in one pass, so a ridge really does shade the slope behind it. Bearings are true `
    + `bearings: the UTM grid here is turned ${frame.convergence.toFixed(2)}° from true north and `
    + `the app corrects for it. Magnetic declination is not modelled.</p>`
    + `<h3>Projection</h3>`
    + `<p>Everything on disk is EPSG:25833 (ETRS89 / UTM 33N). The inverse projection is a `
    + `fourth-order Krüger series carried in the manifest; checked against the manifest's own `
    + `checkpoints at startup, worst error ${projErr.toFixed(1)} mm.</p>`
    + (a.app ? `<h3>This app</h3><dl>`
      + row('Coordinates', a.app.crs || '—')
      + row('Built', a.app.built || '—')
      + `</dl>${a.app.offline ? `<p class="dim">${escapeHtml(a.app.offline)}</p>` : ''}` : '')
    + `<h3>Honest limits</h3>`
    + `<p>The elevation model has real error and the trail geometry is generalised and largely `
    + `contributed, so its position on the ground is approximate. There is no position fix, no `
    + `compass sensor and no live weather in this app, by design. The walking time is a model, `
    + `not a measurement. Nothing here should be used to decide whether to go on in bad `
    + `visibility.</p>`;
}

function updatePace() {
  const p = effectivePace();
  $('pace-model').value = p.model === 'naismith' ? 'naismith' : 'tobler';
  $('pace-fit').value = String(p.fitnessFactor ?? 1);
  $('fit-out').textContent = `×${Number(p.fitnessFactor ?? 1).toFixed(2)}`;
  $('pace-out').textContent = paceLabel(p);
  const note = p.model === 'naismith' ? langmuirNote(p) : null;
  $('pace-note').textContent = note || 'Tobler 1993: walking speed falls off either side of a gentle downhill. Editable in data/pace.json.';
  setCursor(S.cursor, false);
}

function showNotices() {
  const el = $('notices');
  if (!data.notices.length) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = data.notices.join(' ');
}

// ---------------------------------------------------------------- debug
function updateDebug() {
  const st = terrain.stats;
  const ri = renderer.info.render;
  const core = terrain.analysis.core, shell = terrain.analysis.shell;
  $('dbg-body').textContent = [
    `tiles drawn   ${st.tiles} / ${MAX_TILES}${st.capped ? ' (capped)' : ''}`,
    `triangles     ${fmt(ri.triangles)}  budget 1 500 000`,
    `  submitted   ${fmt(st.tiles * TRIS_PER_TILE)} terrain + overlays`,
    `draw calls    ${ri.calls}`,
    `frame         ${timings.frameMs.toFixed(1)} ms (select ${timings.selectMs.toFixed(1)})`,
    `shadow sweep  ${timings.shadowMs.toFixed(0)} ms  grid ${core.nx}x${core.ny} + ${shell.nx}x${shell.ny}`,
    `viewshed      ${timings.viewshedMs ? `${timings.viewshedMs.toFixed(0)} ms` : '—'}`,
    `geom built    ${st.built}  pool ${terrain.pool.length}`,
    `exaggeration  x${S.exag.toFixed(1)}`,
  ].join('\n');
}

// ---------------------------------------------------------------- UI wiring
function setStop(n) {
  S.sheet = clamp(Math.round(n), 0, 2);
  const sheet = $('sheet');
  sheet.classList.remove('s0', 's1', 's2');
  sheet.classList.add(`s${S.sheet}`);
  $('grip').setAttribute('aria-label', ['Show more controls', 'Show all controls', 'Hide the extra controls'][S.sheet]);
  save();
  requestAnimationFrame(onResize);
}

function wireUI() {
  setStop(S.sheet);
  const grip = $('grip');
  let drag = null, skipClick = false;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    skipClick = false; grip.setPointerCapture(e.pointerId); drag = { y: e.clientY, moved: false };
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (dy > 42 && S.sheet < 2) { setStop(S.sheet + 1); drag.y = e.clientY; }
    else if (dy < -42 && S.sheet > 0) { setStop(S.sheet - 1); drag.y = e.clientY; }
  });
  grip.addEventListener('pointerup', () => { if (drag && drag.moved) skipClick = true; drag = null; });
  grip.addEventListener('pointercancel', () => { drag = null; });
  grip.addEventListener('click', () => { if (skipClick) { skipClick = false; return; } setStop((S.sheet + 1) % 3); });
  grip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setStop(S.sheet + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setStop(S.sheet - 1); }
  });

  const openSheet = (id, btn) => {
    const el = $(id);
    el.hidden = !el.hidden;
    if (btn) btn.setAttribute('aria-expanded', String(!el.hidden));
  };
  $('btn-layers').addEventListener('click', (e) => { $('about').hidden = true; openSheet('layers', e.currentTarget); });
  $('btn-about').addEventListener('click', (e) => { $('layers').hidden = true; openSheet('about', e.currentTarget); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => {
    b.closest('aside').hidden = true;
    $('btn-layers').setAttribute('aria-expanded', 'false');
    $('btn-about').setAttribute('aria-expanded', 'false');
  }));

  $('btn-dir').addEventListener('click', () => {
    S.reversed = !S.reversed;
    profile.setReversed(S.reversed);
    updateDirLabel();
    setCursor(S.cursor, false);
    save();
  });
  updateDirLabel();

  const dateEl = $('date-d'), timeEl = $('time-t');
  dateEl.value = String(dayOfYear(S.date.y, S.date.mo, S.date.d));
  timeEl.value = String(S.minutes);
  const setDoy = (doy) => {
    const y = S.date.y;
    let mo = 1, d = clamp(doy, 1, 366);
    while (d > daysInMonth(y, mo)) { d -= daysInMonth(y, mo); mo++; if (mo > 12) { mo = 12; d = 31; break; } }
    S.date = { y, mo, d };
  };
  dateEl.addEventListener('input', () => { setDoy(+dateEl.value); updateSun(false); save(); });
  dateEl.addEventListener('change', () => { computeShadows(); });
  timeEl.addEventListener('input', () => { S.minutes = +timeEl.value; updateSun(false); save(); });
  timeEl.addEventListener('change', () => { computeShadows(); });

  const exagEl = $('exag');
  exagEl.value = String(S.exag);
  exagEl.addEventListener('input', () => { applyExaggeration(+exagEl.value); });
  exagEl.addEventListener('change', save);

  const fp = $('fp-t');
  fp.addEventListener('input', () => {
    const t = +fp.value / 1000;
    if (rig.mode === 'orbit') rig.setMode('fp');
    const i = rig.placeOnRoute(route, t, S.reversed, rig.eyeM, false);
    if (i != null) setCursor(i, false);
  });
  fp.addEventListener('change', save);

  // Reduced motion: the same walk, one named point at a time, with nothing moving in between.
  const flyLabel = () => (reduceMotion() ? 'Step to the next point' : 'Fly the route');
  const stopFlying = () => {
    rig.flying = false;
    $('btn-fly').textContent = flyLabel();
    $('btn-fly').classList.remove('primary');
  };
  $('btn-fly').textContent = flyLabel();
  rig.onFlyEnd = () => { stopFlying(); save(); };
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-reduced-motion: reduce)')
      .addEventListener('change', () => { if (!rig.flying) $('btn-fly').textContent = flyLabel(); });
  }
  const stepToNextWaypoint = () => {
    // routeT and dirDist are both measured in the direction being walked, so this needs no
    // special case for the reversed walk.
    const wps = (route.waypoints || []).map((w) => route.dirDist(w.i, S.reversed))
      .sort((a, b) => a - b);
    if (!wps.length) return;
    const here = rig.routeT * route.length;
    const next = wps.find((d) => d > here + 5);
    rig.setMode('fp');
    const i = rig.placeOnRoute(route, (next === undefined ? wps[0] : next) / route.length,
      S.reversed, rig.eyeM, false);
    if (i != null) setCursor(i, false);
    $('fp-t').value = String(Math.round(rig.routeT * 1000));
    save();
  };
  $('btn-fly').addEventListener('click', () => {
    if (reduceMotion()) { stopFlying(); stepToNextWaypoint(); invalidate(); return; }
    rig.flying = !rig.flying;
    if (rig.flying) {
      rig.setMode('fp');
      if (rig.routeT >= 0.999) rig.routeT = 0;
      $('btn-fly').textContent = 'Stop';
      $('btn-fly').classList.add('primary');
    } else { stopFlying(); save(); }
    invalidate();
  });
  $('btn-orbit').addEventListener('click', () => {
    stopFlying();
    rig.setMode('orbit');
    rig.controls.target.copy(camera.position).add(
      new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(1800),
    );
    rig.controls.update();
    save();
  });

  const eye = $('eye-h');
  eye.value = String(S.eyeM);
  $('eye-out').textContent = `${Number(S.eyeM).toFixed(1)} m`;
  eye.addEventListener('input', () => {
    S.eyeM = +eye.value;
    $('eye-out').textContent = `${S.eyeM.toFixed(1)} m`;
  });
  eye.addEventListener('change', () => {
    save();
    // Re-run whatever visibility question was last asked, rather than making the user tap again.
    if (lastRun && lastRun.id !== 'firstsun') {
      const body = $('tool-body');
      body.hidden = false;
      if (lastRun.id === 'viewshed') runViewshed(lastRun.pts[0], body);
      if (lastRun.id === 'los') runLos(lastRun.pts[0], lastRun.pts[1], body);
    }
  });

  $('pace-model').addEventListener('change', (e) => { S.paceModel = e.target.value; updatePace(); save(); });
  $('pace-fit').addEventListener('input', (e) => { S.paceFit = +e.target.value; updatePace(); });
  $('pace-fit').addEventListener('change', save);

  $('btn-save-vp').addEventListener('click', () => {
    const p = camera.position;
    S.savedViews.push({
      id: `mine-${Date.now()}`, name: `My view ${S.savedViews.length + 1}`,
      x: frame.wx(p.x), y: frame.wy(p.z), eyeM: p.y / Math.max(S.exag, 0.001),
      aboveGround: false, headingDeg: rig.headingTrue(), pitchDeg: rig.pitch, fovDeg: camera.fov,
    });
    buildViewpointChips(); save();
  });
  $('btn-clear-vp').addEventListener('click', () => { S.savedViews = []; buildViewpointChips(); save(); });

  const dbg = $('t-debug');
  dbg.checked = S.debug;
  $('debug').hidden = !S.debug;
  dbg.addEventListener('change', () => { S.debug = dbg.checked; $('debug').hidden = !S.debug; save(); invalidate(); });
  const lab = $('t-labels');
  lab.checked = !!S.layers.labels;
  lab.addEventListener('change', () => { S.layers.labels = lab.checked; applyLayerUniforms(); save(); });

  $('dbg-bench').addEventListener('click', () => {
    // The fixture's grids are small; benchmark at the real model's size so the number means
    // something for the shipped data.
    const g = benchGrid(1281, 1025);
    const buf = new Uint8Array(g.nx * g.ny);
    const t0 = performance.now();
    shadowMask(g, 140, 18, buf);
    const sweep = performance.now() - t0;
    const t1 = performance.now();
    viewshed(g, g.x0 + g.nx * 8, g.y1 - g.ny * 8, 1.7, 12000, (x, y) => terrain.gridSample(g, x, y));
    const vs = performance.now() - t1;
    $('dbg-body').textContent += `\nbench 1281x1025: sweep ${sweep.toFixed(0)} ms, viewshed ${vs.toFixed(0)} ms`;
  });

  // ---- persistence on the way out, and after every drag ----------------------------------
  // A camera set by dragging has to survive the app being closed. `beforeunload` is not enough:
  // WebKit does not fire it in a WKWebView, and an app killed in the background never fires it
  // anywhere. `pagehide` and a hidden `visibilitychange` are the two events iOS does give, and a
  // debounced save after the camera settles means even a kill with no event at all loses nothing.
  let camTimer = 0;
  const saveCameraSoon = () => {
    if (camTimer) clearTimeout(camTimer);
    camTimer = setTimeout(() => { camTimer = 0; if (!rig.flying) save(); }, 400);
  };
  rig.controls.addEventListener('end', saveCameraSoon);   // orbit drag, pinch and wheel zoom
  rig.onLookEnd = saveCameraSoon;                         // first-person look drag
  const saveNow = () => { if (camTimer) { clearTimeout(camTimer); camTimer = 0; } save(); };
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
}

function updateDirLabel() {
  const wps = route.waypoints;
  const a = wps.length ? wps[0].name : 'start';
  const b = wps.length ? wps[wps.length - 1].name : 'end';
  $('btn-dir').textContent = S.reversed ? `${b} → ${a}` : `${a} → ${b}`;
  $('s-time-label').textContent = 'time to the end';
}

// Started last, so every const in this module is initialised before the first await returns.
boot().catch((err) => {
  $('load-msg').textContent = `Could not start: ${err && err.message ? err.message : err}`;
  console.error(err);
});
