// The race card, the track map, the countdown and the banners (DESIGN.md §11; ART.md 3): DOM plates
// over the canvas, refreshed at most 30 times a second (the countdown and banners are immediate).

import { lapShown } from './race.js';
import { place, raceTime, spokenTime } from './units.js';
import { drawStrip, stripKey } from './chart.js';
import { tone, token, isDark } from './palette.js';

export class Hud {
  constructor(el) {
    this.el = el;           // { root, posN, posOf, lap, time, last, strip, map, count, banner, diag, drift }
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

  /** Prepare the map for a track (drawn once into an offscreen canvas at the device pixel ratio). */
  setTrack(track) { this.track = track; this.base = null; this.shown = {}; }

  /** The road in --line-strong over a --sheet casing, segments in order of height, so on Lantern
   *  Night the bridge reads over its underpass by a gap; the start a tick of --ink-2. */
  buildMap() {
    const track = this.track, cv = this.el.map, dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = Math.round((cv.clientWidth || 104) * dpr);
    cv.width = size; cv.height = size;
    const B = track.bounds, pad = 9 * dpr;
    const sc = (size - 2 * pad) / Math.max(B.maxX - B.minX, B.maxZ - B.minZ);
    const ox = pad + ((size - 2 * pad) - (B.maxX - B.minX) * sc) / 2, oz = pad + ((size - 2 * pad) - (B.maxZ - B.minZ) * sc) / 2;
    this.map = { sc, ox, oz, B, dpr, size };
    const off = document.createElement('canvas'); off.width = size; off.height = size;
    const g = off.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const X = (i) => ox + (track.px[i] - B.minX) * sc, Z = (i) => oz + (track.pz[i] - B.minZ) * sc;
    const step = 3, segs = [], sheet = token('--sheet'), road = token('--line-strong');
    for (let i = 0; i < track.N; i += step) segs.push([i, Math.min(i + step, track.N) % track.N]);
    segs.sort((a, b) => track.py[a[0]] - track.py[b[0]]);
    for (const [a, b] of segs) {
      for (const [w, c, cap] of [[8, sheet, 'butt'], [4, road, 'round']]) {   // a butt casing never covers a neighbor's road
        g.strokeStyle = c; g.lineWidth = w * dpr; g.lineCap = cap;
        g.beginPath(); g.moveTo(X(a), Z(a)); g.lineTo(X(b), Z(b)); g.stroke();
      }
    }
    const rx = -track.fz[0], rz = track.fx[0];
    g.strokeStyle = token('--ink-2'); g.lineWidth = 2 * dpr; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X(0) - rx * 5 * dpr, Z(0) - rz * 5 * dpr); g.lineTo(X(0) + rx * 5 * dpr, Z(0) + rz * 5 * dpr); g.stroke();
    this.base = off;
    this.colors = { sheet, ink: token('--ink'), theme: isDark() ? 'dark' : 'light' };   // read once, not per dot per frame
  }

  /** Rivals as 6 px discs in their tones on a 1 px ring; you as the tracer head, drawn last. */
  drawMap(karts) {
    if (!this.track) return;
    if (!this.base) this.buildMap();         // cleared on every resize and theme change
    const { size, sc, ox, oz, B, dpr } = this.map, g = this.el.map.getContext('2d'), { sheet, ink, theme } = this.colors;
    g.clearRect(0, 0, size, size);
    g.drawImage(this.base, 0, 0);
    const dot = (k, r, ring, fill) => {
      g.beginPath(); g.arc(ox + (k.x - B.minX) * sc, oz + (k.z - B.minZ) * sc, (r + ring) * dpr, 0, 7); g.fillStyle = sheet; g.fill();
      g.beginPath(); g.arc(ox + (k.x - B.minX) * sc, oz + (k.z - B.minZ) * sc, r * dpr, 0, 7); g.fillStyle = fill; g.fill();
    };
    for (const k of karts) if (!k.isPlayer) dot(k, 3, 1, tone(k.racer, theme));
    const P = karts.find((k) => k.isPlayer);
    if (P) dot(P, 4, 3, ink);
  }

  /** Set an element's text only when it changes; a time's words go to the .sr twin after it. */
  text(key, node, value, said) {
    if (this.shown[key] === value) return;
    this.shown[key] = value; node.textContent = value;
    if (said != null) node.nextElementSibling.textContent = said;
  }

  /** Called every frame; does the DOM work at ≤ 30 Hz. */
  update(race, dt, diagText) {
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.hidden = true; }
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    const P = race.player, el = this.el;
    if (race.phase !== 'countdown' && race.time > 0.9 && !el.count.hidden) el.count.hidden = true;
    this.text('pos', el.posN, place(P.place)); this.text('of', el.posOf, ` of ${race.karts.length}`);
    this.text('lap', el.lap, `Lap ${lapShown(race, P)} of ${race.laps}`);
    const t = P.finished && !P.projected ? P.finishTime : race.time, lt = P.lapTimes, last = lt[lt.length - 1];
    this.text('time', el.time, raceTime(t), `, ${spokenTime(t)}`);
    this.text('last', el.last, lt.length ? `Last lap ${raceTime(last)}` : '', lt.length ? `Last lap ${spokenTime(last)}` : '');
    const key = stripKey(el.strip, race, P);
    if (key !== this.shown.strip) { this.shown.strip = key; this.strips = (this.strips || 0) + 1; drawStrip(el.strip, race, P); }
    this.drawMap(race.karts);
    const tier = P.drift ? String(P.driftTier) : '';
    if (el.drift && el.drift.dataset.tier !== tier) el.drift.dataset.tier = tier;
    if (this.diagOn && diagText) el.diag.textContent = diagText();
  }

  countdown(text) { this.el.count.textContent = text; this.el.count.hidden = !text; }

  banner(text, seconds = 1.2) { this.el.banner.textContent = text; this.el.banner.hidden = false; this.bannerT = seconds; }

  hideBanner() { this.bannerT = 0; this.el.banner.hidden = true; }

  /** After a theme change: the map and the strip are drawn again in the new tokens. */
  restyle() { this.base = null; this.shown.strip = null; }
}
