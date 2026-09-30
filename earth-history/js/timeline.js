// The axis function, the slider, the age row, play and step (DESIGN §3.3, §3.4, §4).
//
// The axis runs from 750 Ma at the left to today at the right: linear from 550 Ma over the right
// 85 %, the three older maps squeezed behind a break mark in the left 15 % (manifest.axis).
// Stop index 0 is today; the slider draws old on the left. The slider's aria value is the
// position from the left (0 = 750 Ma, 89 = today), so → and "increase" both move toward today.

import { clamp, el, reducedMotion } from './util.js';
import { ageText } from './units.js';

/** Axis position x ∈ [0, 1] of an age in Ma (§3.4). */
export function axisX(age, axis) {
  const c = axis.compressed_fraction, b = axis.break_ma;
  if (age <= b) return c + (1 - c) * (1 - age / b);
  const k = axis.knots;                           // [[750, 0], [690, c/3], [600, 2c/3], [550, c]]
  if (age >= k[0][0]) return k[0][1];
  for (let j = 0; j < k.length - 1; j++) {
    const [a0, x0] = k[j], [a1, x1] = k[j + 1];
    if (age <= a0 && age >= a1) return x0 + (x1 - x0) * (a0 - age) / (a0 - a1);
  }
  return c;
}
/** The inverse: the age at axis position x. */
export function axisAge(x, axis) {
  const c = axis.compressed_fraction, b = axis.break_ma;
  x = clamp(x, 0, 1);
  if (x >= c) return b * (1 - (x - c) / (1 - c));
  const k = axis.knots;
  for (let j = 0; j < k.length - 1; j++) {
    const [a0, x0] = k[j], [a1, x1] = k[j + 1];
    if (x >= x0 && x <= x1) return a0 + (a1 - a0) * (x - x0) / (x1 - x0);
  }
  return k[0][0];
}

/** "Triassic · Lower Triassic · Induan" — period, epoch, age names from timescale.json (§3.3). */
export function icsLine(slice, ts) {
  const names = [];
  for (const r of ['period', 'epoch', 'age']) {
    const id = slice.ics[r];
    if (!id) continue;
    const n = ts.byId.get(id).name;
    if (names[names.length - 1] !== n) names.push(n);     // Pridoli is both an epoch and an age
  }
  return names.join(' · ');
}

/** Split an age line into its number and its unit ("251", "million years ago"); "Today" has no unit. */
export function ageParts(text) {
  const m = /^([\d.,]+) (.+)$/.exec(text);
  return m ? [m[1], m[2]] : [text, ''];
}
/** Set an age line as a number and an italic unit; its textContent stays the plain age text. */
function setAge(elm, text) {
  const [n, u] = ageParts(text);
  const parts = [el('span', 'n', n)];
  if (u) parts.push(document.createTextNode(' '), el('span', 'u', u));
  elm.replaceChildren(...parts);
}

/**
 * els: { slider, track, thumb, ticks, strip, eraband, eras, compressed, labels, swatch, age, ageRoll, ics, row, live, prev, play, next }
 * h: { scrubStart(), scrub(stop), scrubEnd(stop), go(stop, how), step(dir), play() }
 */
export function createTimeline(els, manifest, ts, h) {
  const axis = manifest.axis, N = manifest.count;
  const xs = manifest.slices.map((s) => axisX(s.age_ma, axis));
  let stop = 0, dragging = false;

  /* static parts: ticks, period strip, labels */
  for (const x of xs) { const t = el('span', 'tick'); t.style.left = `${(x * 100).toFixed(3)}%`; els.ticks.append(t); }
  const band = (host, u) => {
    const x0 = axisX(Math.min(u.begin_ma, 750), axis), x1 = axisX(Math.max(u.end_ma, 0), axis);
    const seg = el('span', 'seg-c');
    seg.style.left = `${(x0 * 100).toFixed(3)}%`;
    seg.style.width = `${((x1 - x0) * 100).toFixed(3)}%`;
    seg.style.background = u.colour;
    host.append(seg);
    return [x0, x1];
  };
  // The bar is a stratigraphic column read sideways: a thin band of eras over the periods, in the
  // chart's own colours (timescale.json), the way the ICS chart nests its columns.
  for (const p of ts.periods) if (p.begin_ma > 0 && p.end_ma < 750) band(els.strip, p);
  const ERAS = [['Neoproterozoic', 'Proterozoic'], ['Paleozoic', 'Paleozoic'], ['Mesozoic', 'Mesozoic'], ['Cenozoic', 'Cenozoic']];
  const eraSpans = ERAS.map(([bandId, labelId]) => {
    const [x0, x1] = band(els.eraband, ts.byId.get(bandId));
    // The oldest span is named by its eon: "Neoproterozoic" does not fit its 60 px.
    const lab = el('span', 'era', ts.byId.get(labelId).name);
    els.eras.append(lab);
    return { x0, x1, lab };
  });
  els.compressed.style.width = `${(axis.compressed_fraction * 100).toFixed(3)}%`;
  /** Centre each era's name on its span, kept inside the track (measured, so it follows the font). */
  function layoutEras() {
    const W = els.track.getBoundingClientRect().width;
    if (!W) return;
    for (const e of eraSpans) {
      const w = e.lab.getBoundingClientRect().width;
      const x = clamp((e.x0 + e.x1) / 2 * W - w / 2, 0, Math.max(0, W - w));
      e.lab.style.left = `${x.toFixed(1)}px`;
    }
  }
  layoutEras();
  try { new ResizeObserver(layoutEras).observe(els.track); } catch { /* old engines: laid out once */ }
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', layoutEras);
  // "750", "539", "252", "66", "Now": 750 Ma, the ICS starts of the Paleozoic, Mesozoic and Cenozoic, rounded, and today.
  const eraStart = (id) => ts.byId.get(id).begin_ma;
  const labels = [[750, '750'], ...['Paleozoic', 'Mesozoic', 'Cenozoic'].map((id) => [eraStart(id), String(Math.round(eraStart(id)))]), [0, 'Now']];
  for (const [age, text] of labels) {
    const l = el('span', 'lab', text);
    const x = axisX(age, axis);
    l.style.left = `${(x * 100).toFixed(3)}%`;
    if (x <= 0) l.classList.add('first'); else if (x >= 1) l.classList.add('last');
    els.labels.append(l);
  }
  els.breakMark.style.left = `${(axis.compressed_fraction * 100).toFixed(3)}%`;

  els.slider.setAttribute('aria-valuemin', '0');
  els.slider.setAttribute('aria-valuemax', String(N - 1));

  const nearest = (x) => { let b = 0, d = Infinity; for (let i = 0; i < N; i++) { const e = Math.abs(xs[i] - x); if (e < d) { d = e; b = i; } } return b; };
  const placeThumb = (x) => { els.thumb.style.left = `${(x * 100).toFixed(3)}%`; };

  /* The rolling counter (§19): while playing, the number counts toward each map's age and lands on
     it exactly. #age always holds the true text (screen readers, tests); the roll is drawn in a
     twin that is hidden from assistive tech, and nothing runs once it has landed. */
  const roll = { v: null, target: 0, raf: 0, t: 0 };
  function rollFinish() {
    if (roll.raf) cancelAnimationFrame(roll.raf);
    roll.raf = 0;
    roll.v = roll.target;
    els.row.classList.remove('rolling');
  }
  function rollFrame(now) {
    const dt = Math.min(250, now - roll.t);
    roll.t = now;
    roll.v += (roll.target - roll.v) * (1 - Math.exp(-dt / 70));
    if (Math.abs(roll.target - roll.v) < 0.5) { rollFinish(); return; }
    setAge(els.ageRoll, `${Math.round(roll.v)} million years ago`);
    els.row.classList.add('rolling');
    roll.raf = requestAnimationFrame(rollFrame);
  }
  function rollTo(i, on) {
    const ageMa = manifest.slices[i].age_ma;
    roll.target = ageMa;
    // Only a count between two ages in millions of years rolls; today and 21 000 years land at once.
    if (!on || roll.v == null || ageMa < 0.1 || roll.v < 0.1 || reducedMotion()) { rollFinish(); return; }
    // The count never strays further than the map next to this one: it always sits between this
    // map's age and its neighbour's on the side it is counting from, however slow the frames are.
    const j = roll.v > ageMa ? Math.min(N - 1, i + 1) : Math.max(0, i - 1), nb = manifest.slices[j].age_ma;
    roll.v = clamp(roll.v, Math.min(ageMa, nb), Math.max(ageMa, nb));
    if (Math.abs(roll.target - roll.v) < 0.5) { rollFinish(); return; }
    setAge(els.ageRoll, `${Math.round(roll.v)} million years ago`);
    els.row.classList.add('rolling');
    if (!roll.raf) { roll.t = performance.now(); roll.raf = requestAnimationFrame(rollFrame); }
  }

  let liveTimer = 0;
  function render(i, { announce = false, thumb = true, rolling = false } = {}) {
    stop = i;
    const s = manifest.slices[i];
    const col = s.ics.colour, period = ts.byId.get(s.ics.period).name, age = ageText(s.age_ma);
    if (thumb) placeThumb(xs[i]);
    els.swatch.style.background = col;
    setAge(els.age, age);
    rollTo(i, rolling);
    els.ics.textContent = icsLine(s, ts);
    els.slider.setAttribute('aria-valuenow', String(N - 1 - i));
    els.slider.setAttribute('aria-valuetext', `${age}, ${period}`);
    if (announce) {
      // Announced, then cleared, so reading the page line by line does not meet the age a third time.
      els.live.textContent = `${age}. ${icsLine(s, ts)}.`;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => { els.live.textContent = ''; }, 1500);
    }
  }

  /* dragging: the thumb follows the finger; the map shown is the nearest stop (§4.2) */
  const xAt = (e) => { const r = els.track.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
  function dragStart(e) {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
    dragging = true;
    els.slider.classList.add('dragging');
    h.scrubStart();
    dragMove(e);
  }
  function dragMove(e) {
    if (!dragging) return;
    const x = xAt(e);
    placeThumb(x);
    const i = nearest(x);
    if (i !== stop) { render(i, { thumb: false }); h.scrub(i); }
  }
  function dragEnd() {
    if (!dragging) return;
    dragging = false;
    els.slider.classList.remove('dragging');
    render(stop, { announce: true });
    h.scrubEnd(stop);
  }
  for (const surface of [els.slider, ...(els.extraScrub || [])]) {
    surface.addEventListener('pointerdown', dragStart);
    surface.addEventListener('pointermove', dragMove);
    surface.addEventListener('pointerup', dragEnd);
    surface.addEventListener('pointercancel', dragEnd);
  }

  els.slider.addEventListener('keydown', (e) => {
    const map = { ArrowRight: -1, ArrowUp: -1, ArrowLeft: 1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
    let to = null;
    if (e.key in map) to = clamp(stop + map[e.key], 0, N - 1);
    else if (e.key === 'Home') to = N - 1;
    else if (e.key === 'End') to = 0;
    if (to == null) return;
    e.preventDefault();
    h.go(to, 'key');
  });
  els.prev.addEventListener('click', () => h.step(1));
  els.next.addEventListener('click', () => h.step(-1));
  els.play.addEventListener('click', () => h.play());

  return {
    set: (i, opt) => render(i, opt),
    setPlaying(on) {
      els.play.classList.toggle('playing', on);
      els.play.setAttribute('aria-label', on ? 'Pause' : 'Play toward today');
    },
    /** Play reads as a time-lapse: the thumb glides linearly from map to map over ms (0: it jumps). */
    setGlide(ms) {
      const on = ms > 0 && !reducedMotion();
      els.slider.classList.toggle('gliding', on);
      if (on) els.slider.style.setProperty('--glide', `${ms}ms`);
    },
    stopRoll: rollFinish,
    get dragging() { return dragging; },
    xs,
    nearest,
    placeThumb,
  };
}
