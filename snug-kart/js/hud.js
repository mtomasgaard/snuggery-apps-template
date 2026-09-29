// The HUD and the mini-map (DESIGN.md §11): DOM over the canvas, refreshed at most 30 times a
// second (the countdown and banners are immediate).

import { lapShown } from './race.js';

export const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export const fmtTime = (t) => {
  if (t == null || !Number.isFinite(t)) return '–:––.–––';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

export class Hud {
  constructor(el) {
    this.el = el;           // { root, posN, posSuf, lap, time, last, map, count, banner, diag, drift }
    this.shown = {};        // the text last written to each element
    this.acc = 0;
    this.bannerT = 0;
    this.base = null;       // offscreen road outline
    this.taps = []; this.diagOn = false;
    el.time.addEventListener('pointerdown', () => {
      const now = performance.now();
      this.taps = this.taps.filter((t) => now - t < 2000); this.taps.push(now);
      if (this.taps.length >= 5) { this.taps = []; this.diagOn = !this.diagOn; el.diag.hidden = !this.diagOn; }
    });
  }

  show(on) { this.el.root.hidden = !on; }

  /** Prepare the mini-map for a track (drawn once into an offscreen canvas at the device pixel ratio). */
  setTrack(track) { this.track = track; this.base = null; this.shown = {}; }

  buildMap() {
    const track = this.track, cv = this.el.map, dpr = Math.min(3, window.devicePixelRatio || 1);
    const css = cv.clientWidth || 104;
    const size = Math.round(css * dpr);
    cv.width = size; cv.height = size;
    const B = track.bounds, pad = 8 * dpr;
    const sc = (size - 2 * pad) / Math.max(B.maxX - B.minX, B.maxZ - B.minZ);
    const ox = pad + ((size - 2 * pad) - (B.maxX - B.minX) * sc) / 2, oz = pad + ((size - 2 * pad) - (B.maxZ - B.minZ) * sc) / 2;
    this.map = { sc, ox, oz, B, dpr, size };
    const off = document.createElement('canvas'); off.width = size; off.height = size;
    const g = off.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const X = (i) => ox + (track.px[i] - B.minX) * sc, Z = (i) => oz + (track.pz[i] - B.minZ) * sc;
    const step = 3, segs = [];
    for (let i = 0; i < track.N; i += step) segs.push([i, Math.min(i + step, track.N) % track.N]);
    // Draw in order of height, so on Lantern Night the bridge passes visibly over the underpass.
    segs.sort((a, b) => track.py[a[0]] - track.py[b[0]]);
    for (const [a, b] of segs) {
      g.strokeStyle = 'rgba(20,20,28,0.9)'; g.lineWidth = 9 * dpr;
      g.beginPath(); g.moveTo(X(a), Z(a)); g.lineTo(X(b), Z(b)); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5 * dpr;
      g.beginPath(); g.moveTo(X(a), Z(a)); g.lineTo(X(b), Z(b)); g.stroke();
    }
    // Start line tick
    const i0 = 0, rx = -track.fz[i0], rz = track.fx[i0];
    g.strokeStyle = '#1E1E22'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(X(i0) - rx * 5 * dpr, Z(i0) - rz * 5 * dpr); g.lineTo(X(i0) + rx * 5 * dpr, Z(i0) + rz * 5 * dpr); g.stroke();
    this.base = off;
  }

  drawMap(karts) {
    if (!this.track) return;
    if (!this.base) this.buildMap();         // main.js clears `base` on every resize
    const { size } = this.map, g = this.el.map.getContext('2d');
    g.clearRect(0, 0, size, size);
    g.drawImage(this.base, 0, 0);
    let player = null;
    for (const k of karts) { if (k.isPlayer) { player = k; continue; } this.dot(g, k, 3.5, false); }
    if (player) this.dot(g, player, 5, true);
  }

  dot(g, k, r, ring) {
    const { sc, ox, oz, B, dpr } = this.map;
    const x = ox + (k.x - B.minX) * sc, y = oz + (k.z - B.minZ) * sc;
    g.beginPath(); g.arc(x, y, r * dpr, 0, Math.PI * 2);
    g.fillStyle = k.racer.body; g.fill();
    g.lineWidth = (ring ? 2 : 1) * dpr; g.strokeStyle = ring ? '#FFFFFF' : 'rgba(0,0,0,0.6)'; g.stroke();
  }

  /** Set an element's text only when it changes (no layout work, and no re-announcing #pos). */
  text(key, node, value) {
    if (this.shown[key] === value) return;
    this.shown[key] = value; node.textContent = value;
  }

  /** Called every frame; does the DOM work at ≤ 30 Hz. */
  update(race, dt, diagText) {
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.classList.remove('show'); }
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    const P = race.player, el = this.el;
    if (race.phase !== 'countdown' && race.time > 0.9 && !el.count.hidden) el.count.hidden = true;
    this.text('posN', el.posN, String(P.place)); this.text('posSuf', el.posSuf, ordinal(P.place));
    this.text('lap', el.lap, `Lap ${lapShown(race, P)}/${race.laps}`);
    this.text('time', el.time, fmtTime(P.finished && !P.projected ? P.finishTime : race.time));
    const lt = P.lapTimes;
    this.text('last', el.last, lt.length ? `Last ${fmtTime(lt[lt.length - 1])}` : '');
    this.drawMap(race.karts);
    const tier = P.drift ? String(P.driftTier) : '';
    if (el.drift && el.drift.dataset.tier !== tier) el.drift.dataset.tier = tier;
    if (this.diagOn && diagText) el.diag.textContent = diagText();
  }

  countdown(text) {
    const c = this.el.count;
    c.textContent = text; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    c.hidden = !text;
  }

  banner(text, seconds = 1.2) {
    const b = this.el.banner;
    b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    this.bannerT = seconds;
  }

  hideBanner() { this.bannerT = 0; this.el.banner.classList.remove('show'); }
}
