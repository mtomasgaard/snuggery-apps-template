// What the items look like (DESIGN.md §4, §11, §15): the parcels, snares, puddles, planes and Quilt
// bubbles as five instanced meshes (one draw call each, hidden while empty), the item button's icon
// and shuffle, the Paper Plane reticle and the "plane behind" warning. The rules live in js/items.js.

import {
  InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, SphereGeometry, CircleGeometry, BufferGeometry,
  Float32BufferAttribute, Matrix4, Vector3, Quaternion, Euler, Color, DoubleSide, DynamicDrawUsage,
} from '../vendor/three.module.js';
import { createItems, ITEMS, ITEM_NAMES } from './items.js';
import { mergeParts, canvasTexture } from './geo.js';

const $ = (id) => document.getElementById(id);
const m4 = new Matrix4(), v3 = new Vector3(), s3 = new Vector3(), q = new Quaternion(), e = new Euler();
const up = new Vector3(), fw = new Vector3(), rt = new Vector3(), col = new Color(), wob = new Matrix4();

let V = null;          // the live view: meshes, the race's item state, DOM refs

function parcelGeometry(accent) {
  const W = [0, 0];
  const parts = [
    { geo: new BoxGeometry(0.9, 0.9, 0.9), color: '#F7E7C6', uv: W },
    { geo: new BoxGeometry(0.94, 0.94, 0.18), color: accent, uv: W },
    { geo: new BoxGeometry(0.18, 0.94, 0.94), color: accent, uv: W },
    { geo: new SphereGeometry(0.16, 8, 6), pos: [0.13, 0.52, 0], scale: [1.3, 0.7, 0.8], color: accent, uv: W },
    { geo: new SphereGeometry(0.16, 8, 6), pos: [-0.13, 0.52, 0], scale: [1.3, 0.7, 0.8], color: accent, uv: W },
    { geo: new SphereGeometry(0.08, 6, 5), pos: [0, 0.52, 0], color: accent, uv: W },
  ];
  const g = mergeParts(parts, { uvs: false });
  for (const p of parts) p.geo.dispose();
  return g;
}

/** A folded paper dart, nose along +z. */
function planeGeometry() {
  const n = [0, 0.05, 0.7], lw = [0.5, 0.12, -0.45], rw = [-0.5, 0.12, -0.45], k = [0, -0.12, -0.4], c = [0, 0.05, -0.45];
  const tris = [n, lw, c, n, c, rw, n, c, k];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

function makeMesh(scene, geo, mat, max, name) {
  const m = new InstancedMesh(geo, mat, max);
  m.instanceMatrix.setUsage(DynamicDrawUsage);
  m.frustumCulled = false; m.count = 0; m.visible = false; m.name = name;
  scene.add(m);
  return m;
}

/** Orient an instance on the road: up = road normal at sample i, forward = heading ψ. */
function roadBasis(track, i, psi) {
  up.set(track.nx[i], track.ny[i], track.nz[i]);
  fw.set(Math.cos(psi), 0, Math.sin(psi)); fw.addScaledVector(up, -fw.dot(up)).normalize();
  rt.crossVectors(up, fw).normalize();
  return m4.makeBasis(rt, up, fw);
}

export const itemsHook = {
  attach(race, scene) {
    this.detach();
    const items = createItems(race), track = race.track, pal = track.def.palette, night = !!pal.night;
    // The Quilt bubble: mostly clear, with pale patches and dashed stitching, so it wraps the kart
    // without hiding it (or the road, when a shielded rival is close to the camera).
    const quiltTex = canvasTexture(128, 128, (g) => {
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(244,182,194,0.35)'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,241,214,0.55)'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) g.fillRect(x * 32 + 4, y * 32 + 4, 24, 24);
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.setLineDash([5, 4]); g.lineWidth = 2.5;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); }
    });
    const yarnTex = canvasTexture(64, 64, (g) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 3;
      for (let i = -64; i < 128; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 40, 64); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      for (let i = -64; i < 128; i += 13) { g.beginPath(); g.moveTo(i + 50, 0); g.lineTo(i, 64); g.stroke(); }
    });
    const honeyTex = canvasTexture(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(255,214,110,0.95)'); gr.addColorStop(0.75, 'rgba(232,160,40,0.9)'); gr.addColorStop(1, 'rgba(200,120,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(24, 22, 9, 5, -0.5, 0, 7); g.fill();
    });
    const glow = night ? 0.55 : 0.2;
    const meshes = {
      parcels: makeMesh(scene, parcelGeometry(pal.accent || '#2E6F95'), new MeshLambertMaterial({ vertexColors: true, emissive: new Color('#FFF1D6').multiplyScalar(glow) }), items.parcels.length, 'parcels'),
      yarns: makeMesh(scene, new SphereGeometry(0.45, 12, 9), new MeshLambertMaterial({ map: yarnTex, emissive: new Color(night ? '#402030' : '#000000') }), 10, 'yarns'),
      honeys: makeMesh(scene, new CircleGeometry(1, 24).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: honeyTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 4, 'honeys'),
      planes: makeMesh(scene, planeGeometry(), new MeshLambertMaterial({ color: '#FFFFFF', side: DoubleSide, emissive: new Color(night ? '#8090B0' : '#303030') }), 8, 'planes'),
      bubbles: makeMesh(scene, new SphereGeometry(1.55, 18, 12), new MeshBasicMaterial({ map: quiltTex, transparent: true, opacity: 0.7, depthWrite: false }), 8, 'bubbles'),
    };
    meshes.yarns.setColorAt(0, col.set('#FFFFFF'));          // create the color buffer before the first compile
    meshes.honeys.renderOrder = 1; meshes.bubbles.renderOrder = 2;
    meshes.parcels.count = items.parcels.length;
    V = {
      race, items, meshes, textures: [quiltTex, yarnTex, honeyTex], time: 0,
      btn: $('btn-item'), use: $('item-use'), reticle: $('reticle'), warn: $('warn'),
      shown: undefined, rolling: false, rollIdx: 0,
    };
    race.items = items;
    return items;
  },

  give(race, kart, id) {
    if (!race.items || !ITEMS.includes(id)) return false;
    return race.items.give(kart, id);
  },

  detach() {
    if (!V) return;
    for (const m of Object.values(V.meshes)) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); m.dispose(); }
    for (const t of V.textures) t.dispose();
    V.reticle.hidden = true; V.warn.hidden = true;
    V = null;
  },

  /** Every rendered frame: instance matrices from the item state, and the HUD bits. */
  frame(race, dt, camera, still) {
    if (!V || V.race !== race) return;
    V.time += dt;
    const { items, meshes } = V, track = race.track, t = V.time;
    // Parcels: turning at 1.2 rad/s, bobbing ±0.12 m over 1.6 s, shrinking when taken.
    items.parcels.forEach((p, n) => {
      const sc = Math.max(0.001, p.scale);
      e.set(0.25, t * 1.2 + n * 0.7, 0); q.setFromEuler(e);
      m4.compose(v3.set(p.x, p.y + 1.0 + 0.12 * Math.sin(t * Math.PI * 2 / 1.6 + n), p.z), q, s3.set(sc, sc, sc));
      meshes.parcels.setMatrixAt(n, m4);
    });
    meshes.parcels.instanceMatrix.needsUpdate = true;
    meshes.parcels.visible = true;
    // Snares, colored by the kart that dropped them.
    items.yarns.forEach((y, n) => {
      const grow = Math.min(1, y.age / 0.2);
      roadBasis(track, y.idx, track.theta[y.idx] + y.age * 0.8);
      m4.scale(s3.set(grow, grow, grow)); m4.setPosition(y.x, y.y + 0.42 * grow, y.z);
      meshes.yarns.setMatrixAt(n, m4);
      meshes.yarns.setColorAt(n, col.set(y.color));
    });
    finish(meshes.yarns, items.yarns.length);
    items.honeys.forEach((h, n) => {
      const fade = Math.min(1, (14 - h.age) / 1);
      roadBasis(track, h.idx, 0);
      m4.scale(s3.set(h.r * fade + 0.01, 1, h.r * fade + 0.01)); m4.setPosition(h.x, h.y + 0.04, h.z);
      meshes.honeys.setMatrixAt(n, m4);
    });
    finish(meshes.honeys, items.honeys.length);
    items.planes.forEach((pl, n) => {
      const sc = 1.4 * pl.fade + 0.001;
      roadBasis(track, pl.idx ?? race.player.fr.idx, pl.heading);
      e.set(0, 0, Math.sin(t * 9 + n) * 0.25); m4.multiply(wob.makeRotationFromEuler(e));
      m4.scale(s3.set(sc, sc, sc)); m4.setPosition(pl.x, pl.y, pl.z);
      meshes.planes.setMatrixAt(n, m4);
    });
    finish(meshes.planes, items.planes.length);
    let nb = 0;
    for (const k of race.karts) {
      if (k.shieldT <= 0 || k.respawnT > 0 || k.nearCam) continue;
      const ending = k.shieldT < 2;
      if (ending && !still && Math.floor(t * 6) % 2 === 0) continue;       // blinks at 3 Hz before it goes; under Reduce Motion it shrinks once instead
      const wob = (ending && still ? 0.8 : 1) * (1 + 0.03 * Math.sin(t * 6 + k.index));
      m4.makeRotationY(t * 0.6 + k.index); m4.scale(s3.set(wob, wob * 0.8, wob)); m4.setPosition(k.x, k.y + 0.8, k.z);
      meshes.bubbles.setMatrixAt(nb++, m4);
    }
    finish(meshes.bubbles, nb);
    this.hud(race, camera, still);
  },

  /** The item button (icon, shuffle), the reticle on the plane's target, the "plane behind" warning. */
  hud(race, camera, still) {
    const P = race.player, playing = !P.finished && !P.autopilot;
    let icon = P.item || null, rolling = P.item && P.itemRoll > 0;
    if (rolling && !still) icon = ITEMS[Math.floor((0.8 - P.itemRoll) / 0.2 + ITEMS.indexOf(P.item) + 1) % ITEMS.length];
    if (icon !== V.shown) {
      V.shown = icon;
      V.btn.classList.toggle('empty', !icon);
      if (icon) V.use.setAttribute('href', `#i-${icon}`); else V.use.removeAttribute('href');
    }
    // The shuffle's last tick already shows the item, so the label follows the roll, not the icon.
    const label = !icon ? 'No item' : rolling ? 'Item' : `Use the ${ITEM_NAMES[icon]}`;
    if (label !== V.label) { V.label = label; V.btn.setAttribute('aria-label', label); }
    if (!!rolling !== V.rolling) { V.rolling = !!rolling; V.btn.classList.toggle('rolling', V.rolling); }
    V.btn.classList.toggle('ready', !!P.item && !rolling);
    // Reticle: on the racer one place ahead while a ready plane is in hand, or on the target of the
    // player's plane in flight, where its ring closes round a dot: the lock is a shape, not a color.
    let target = null;
    if (playing && P.item === 'plane' && !rolling && race.order) target = race.order.find((o) => o.place === P.place - 1) || null;
    if (P.plane && P.plane.target) target = P.plane.target;
    const ret = V.reticle;
    if (target) {
      v3.set(target.x, target.y + 0.9, target.z).project(camera);
      const on = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
      ret.hidden = !on;
      if (on) {
        ret.style.transform = `translate(${((v3.x + 1) / 2) * window.innerWidth}px, ${((1 - v3.y) / 2) * window.innerHeight}px) translate(-50%, -50%)`;
        ret.classList.toggle('locked', !!P.plane);
      }
    } else ret.hidden = true;
    const incoming = playing && V.items.planes.some((p) => p.target === P);
    if (V.warn.hidden === incoming) V.warn.hidden = !incoming;
  },
};

function finish(mesh, n) {
  mesh.count = n; mesh.visible = n > 0;
  if (n) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
}
