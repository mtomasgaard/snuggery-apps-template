// The flow layer (DESIGN §1): tracers carried by the forecast's wind, drawn as faded trails on two
// canvases of their own over the base. One call a frame from app.js's loop; nothing here owns a
// requestAnimationFrame, so the flow and the base can never race.
//
// Each streak sits where the snapshot's wind is and moves the way that wind goes, at its speed times
// one printed rate (the rung), at the hour on the slider. Its color, width and alpha encode nothing.

import * as M from './flow-math.js';

const CLEAR_MS = 4000, STAGGER_MS = 2000;       // the ping-pong pair (DESIGN §1.6)
const PREWARM = 4, PREWARM_DT = M.TRAIL_S / PREWARM;
const DPR_CAP = 2, MARGIN = 8, BINS = 4;
const LIFE_MIN = 1.5, LIFE_SPAN = 2.0;

export function createFlow(canvasA, canvasB) {
  const cvs = [canvasA, canvasB], ctxs = cvs.map((c) => c.getContext('2d'));
  const ll = [0, 0], uv = [0, 0], pa = [0, 0, 0], pb = [0, 0, 0];
  let N = 0, nTarget = 0, P = new Float64Array(0), Q = new Float64Array(0), life = new Float32Array(0);
  let rand = M.mulberry32(0x5eed), probing = false, held = false;
  let W = 0, H = 0, dpr = 1, sizeKey = '', themeKey = '', fieldKey = '', viewKey = '', lastMap = null;
  let rung = 0, last = 0, clearedAt = [0, 0], shown = 0, wantPrewarm = true, wantRelease = false;
  let nScale = 1, single = false, half = false, parity = 0, carry = 0, goodSecs = 0, judgedAt = 0;
  let lastS = null, suppressed = null, stopped = true, used = { k0: -1, k1: -1, f: 0 }, turning = false, prevBase = true;
  const frames = [], ladder = [];

  function size(S) {
    const d = Math.min(DPR_CAP, S.dpr || 1);
    const key = `${S.tab}|${S.W}|${S.H}|${d}`;
    if (key === sizeKey) return false;
    sizeKey = key; W = S.W; H = S.H; dpr = d;
    for (const c of cvs) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    return true;
  }
  function seed(S, i) {
    const o = i * 3;
    const okay = S.tab === 'map' ? (M.seedMap(rand, S.map, P, o), true) : M.seedGlobe(rand, S.g, W, H, P, o);
    Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2];
    life[i] = okay ? LIFE_MIN + rand() * LIFE_SPAN : 0;
  }
  function resizeTo(S, n) {
    const P2 = new Float64Array(n * 3), Q2 = new Float64Array(n * 3), L2 = new Float32Array(n);
    const keep = Math.min(n, N);
    P2.set(P.subarray(0, keep * 3)); Q2.set(Q.subarray(0, keep * 3)); L2.set(life.subarray(0, keep));
    P = P2; Q = Q2; life = L2;
    const from = N; N = n;
    for (let i = keep; i < n; i++) seed(S, i);
    return from;
  }
  function reseedAll(S) { for (let i = 0; i < N; i++) seed(S, i); }
  function count(S) {
    nTarget = M.particleCount(M.drawableArea(S.tab, S.map, S.g, S.W, S.H));
    return Math.max(Math.min(nTarget, 400), Math.round(nTarget * nScale));
  }

  function clear(i) { const c = ctxs[i]; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cvs[i].width, cvs[i].height); }
  function clearBoth() { clear(0); clear(1); }
  function fadeBoth(f) {
    for (let i = 0; i < (single ? 1 : 2); i++) {
      const c = ctxs[i];
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = `rgba(0,0,0,${f})`;
      c.fillRect(0, 0, cvs[i].width, cvs[i].height);
      c.globalCompositeOperation = 'source-over';
    }
  }
  /* A Mercator pan or zoom is a similarity of the screen, so the trails' pixels are carried exactly. */
  function carryMap(m0, m1) {
    const k = m1.scale / m0.scale;
    let dcx = m0.cx - m1.cx; dcx -= Math.round(dcx);
    const tx = (W / 2) * (1 - k) + dcx * m1.scale, ty = (H / 2) * (1 - k) + (m0.cy - m1.cy) * m1.scale;
    for (let i = 0; i < 2; i++) {
      const c = ctxs[i], w = cvs[i].width, h = cvs[i].height;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'copy';
      c.drawImage(cvs[i], 0, 0, w, h, tx * dpr, ty * dpr, w * k, h * k);
      c.restore();
    }
  }

  /** Advance every particle dt seconds of screen time; if `bins`, collect this frame's segments. */
  function advance(S, dt, bins) {
    const s = (dt * rung * 3600) / M.R_EARTH, map = S.tab === 'map';
    const sun = S.sun, kappa = S.look.kappa;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const x = P[o], y = P[o + 1], z = P[o + 2];
      Q[o] = x; Q[o + 1] = y; Q[o + 2] = z;
      M.toLonLat(x, y, z, ll);
      M.sampleUV(S.grid, S.U0, S.V0, S.U1, S.V1, S.f, ll[0], ll[1], uv);
      M.stepVec(P, o, uv[0], uv[1], s);
      if (!probing) life[i] -= dt;
      if (!bins) continue;
      let gone = !probing && life[i] <= 0;
      if (map) {
        if (Math.abs(P[o + 2]) > M.MAX_Z) gone = true;
        M.mapXY(x, y, z, S.map, pa); M.mapXY(P[o], P[o + 1], P[o + 2], S.map, pb);
        if (M.seamJump(pa[0], pb[0], W)) gone = true;
      } else {
        M.globeXY(x, y, z, S.g, pa); M.globeXY(P[o], P[o + 1], P[o + 2], S.g, pb);
        if (pb[2] < M.HIDE_Z) gone = true;
      }
      if (pb[0] < -MARGIN || pb[0] > W + MARGIN || pb[1] < -MARGIN || pb[1] > H + MARGIN) gone = true;
      if (gone && !probing) { seed(S, i); continue; }
      if (gone) continue;
      let b = 0;
      if (sun && kappa > 0) b = Math.round(M.nightFade(P[o] * sun[0] + P[o + 1] * sun[1] + P[o + 2] * sun[2]) * (BINS - 1));
      bins[b].moveTo(pa[0], pa[1]);
      bins[b].lineTo(pb[0], pb[1]);
    }
  }
  function stroke(S, bins, mult) {
    const look = S.look;
    for (let i = 0; i < (single ? 1 : 2); i++) {
      const c = ctxs[i];
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.lineWidth = 1; c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = look.color;
      for (let b = 0; b < BINS; b++) {
        c.globalAlpha = look.head * (1 - (look.kappa * b) / (BINS - 1)) * mult;
        c.stroke(bins[b]);
      }
      c.globalAlpha = 1;
    }
  }
  const newBins = () => Array.from({ length: BINS }, () => new Path2D());
  /* Every streak on screen belongs to the field just drawn: four sub-steps of it, each at the alpha
   * the fade would have left it, and no full-canvas fade (DESIGN §1.10). */
  function prewarm(S) {
    clearBoth();
    for (let k = 1; k <= PREWARM; k++) {
      const bins = newBins();
      advance(S, PREWARM_DT, bins);
      stroke(S, bins, M.fade((PREWARM - k) * PREWARM_DT));
    }
  }

  /* Judged once a second, never during play, and only on the interval between two frames in which the
   * base was not redrawn: an interval that ends a frame after a base draw carries that draw's cost, and
   * play's own cost must never be blamed on the flow (DESIGN §1.8). */
  function judge(now, playing) {
    if (now - judgedAt < 1000) return;
    judgedAt = now;
    if (playing) { goodSecs = 0; return; }
    const recent = frames.filter((f) => now - f.t <= 2000).map((f) => f.iv).sort((a, b) => a - b);
    const quiet = frames.filter((f) => now - f.t <= 1000 && f.quiet).map((f) => f.iv).sort((a, b) => a - b);
    if (recent.length < 20 || quiet.length < 10) return;
    const period = recent[Math.floor(recent.length * 0.1)], med = quiet[quiet.length >> 1];
    if (med > 1.5 * period) {
      goodSecs = 0;
      if (Math.round(nTarget * nScale * 0.75) >= Math.max(400, 0.35 * nTarget)) nScale *= 0.75;
      else if (!single) single = true;
      else if (!half) half = true;
      else return;
      ladder.push({ t: Math.round(now), down: true, nScale: Math.round(nScale * 1000) / 1000, single, half, median: med, period });
    } else if (med <= 1.1 * period && (nScale < 1 || single || half)) {
      if (++goodSecs < 5) return;
      goodSecs = 0;
      if (half) half = false; else if (single) single = false; else nScale = Math.min(1, nScale * 1.15);
      ladder.push({ t: Math.round(now), down: false, nScale: Math.round(nScale * 1000) / 1000, single, half, median: med, period });
    }
  }

  const F = {
    /** One frame. S: { tab, W, H, dpr, map, g, grid, U0, V0, U1, V1, k0, k1, f, playing, sun, look,
     *  theme, baseDrawn, dragging }. */
    frame(now, S) {
      const t0 = performance.now();
      const iv = last ? now - last : 1000 / 60;
      last = now;
      lastS = S; suppressed = null; stopped = false;
      if (probing) return;
      if (held) {                             // a test holds the trails still; a map move still carries them
        if (S.tab === 'map') {
          const m = S.map;
          if (lastMap && (m.cx !== lastMap.cx || m.cy !== lastMap.cy || m.scale !== lastMap.scale)) carryMap(lastMap, m);
          lastMap = { cx: m.cx, cy: m.cy, scale: m.scale };
        }
        return;
      }
      let dt = Math.min(iv, 50) / 1000;
      let prewarmNow = wantPrewarm;
      if (size(S)) { resizeTo(S, count(S)); reseedAll(S); prewarmNow = true; clearedAt = [now, now - STAGGER_MS]; }
      else { const n = count(S); if (n !== N) resizeTo(S, n); }
      const r = M.pickRung(M.rateStar(M.pxPerMetre(S.tab, S.map, S.g)), rung);
      if (r !== rung) { rung = r; prewarmNow = true; }
      if (S.theme !== themeKey) { themeKey = S.theme; prewarmNow = true; }
      const fk = S.playing ? 'play' : `${S.k0}|${S.k1}|${S.f}`;
      if (fk !== fieldKey) { if (fk !== 'play' && fieldKey !== '') prewarmNow = true; fieldKey = fk; }
      used = { k0: S.k0, k1: S.k1, f: S.f };
      let moving = false;
      if (S.tab === 'map') {
        const m = S.map;
        if (lastMap && !prewarmNow && (m.cx !== lastMap.cx || m.cy !== lastMap.cy || m.scale !== lastMap.scale)) carryMap(lastMap, m);
        lastMap = { cx: m.cx, cy: m.cy, scale: m.scale };
      } else {
        const vk = `${S.g.lon}|${S.g.sinLat}|${S.g.r}`;
        moving = (viewKey !== '' && vk !== viewKey) || !!S.dragging;
        viewKey = vk;
        lastMap = null;
        // a turning globe is not a similarity of the screen, so no trail can be carried: while it turns
        // the flow is not drawn at all (one-frame dots would read as speckle), and the frame after it
        // stops prewarms the new view
        if (!moving && turning) prewarmNow = true;
        turning = moving;
      }
      // the pair: each cleared outright every 4 s, 2 s apart; the one cleared longer ago is shown
      for (let i = 0; i < 2; i++) {
        if (now - clearedAt[i] >= CLEAR_MS) {
          clearedAt[i] = now;
          if (single && i === 0) prewarmNow = true; else clear(i);
        }
      }
      shown = single ? 0 : clearedAt[0] <= clearedAt[1] ? 0 : 1;
      cvs[0].style.visibility = shown === 0 ? 'visible' : 'hidden';
      cvs[1].style.visibility = shown === 1 ? 'visible' : 'hidden';
      wantPrewarm = false;
      if (wantRelease) {                      // the opening: tracers write themselves in, no prewarm
        wantRelease = false; prewarmNow = false; clearBoth();
      }
      const base = !!S.baseDrawn, quiet = !base && !prevBase;
      prevBase = base;
      if (moving) { clearBoth(); advance(S, dt, null); carry = 0; }
      else if (prewarmNow) { prewarm(S); carry = 0; }
      else {
        if (half && (parity++ & 1) === 0) { carry += dt; frames.push({ t: now, iv, flowMs: performance.now() - t0, base, quiet }); return; }
        dt += carry; carry = 0;
        fadeBoth(M.fade(dt));
        const bins = newBins();
        advance(S, dt, bins);
        stroke(S, bins, 1);
      }
      frames.push({ t: now, iv, flowMs: performance.now() - t0, base, quiet });
      if (frames.length > 240) frames.splice(0, frames.length - 240);
      judge(now, S.playing);
    },
    /** The next frame starts from empty canvases, without a prewarm (the first after unpacking). */
    release() { wantRelease = true; wantPrewarm = false; },
    /** The next frame clears and prewarms (a new snapshot, a return from hidden, focus mode). */
    invalidate() { wantPrewarm = true; },
    /** Stop drawing: the canvases cleared, the reason kept for state(). */
    stop(reason) { suppressed = reason; stopped = true; clearBoth(); last = 0; fieldKey = ''; viewKey = ''; lastMap = null; turning = false; wantPrewarm = true; },
    exposure: () => (rung ? M.exposure(rung) : ''),
    rung: () => rung,
    /** Called with the view the next frame will draw, so the caption can name the rung before it. */
    peekRung(S) { return M.pickRung(M.rateStar(M.pxPerMetre(S.tab, S.map, S.g)), rung); },
    state: () => ({
      on: !stopped && N > 0, suppressed, n: N, nTarget, rung, rateHours: rung, keyText: rung ? M.exposure(rung) : '',
      shown: shown ? 'B' : 'A', ladder: { nScale, single, half }, k0: used.k0, k1: used.k1, f: used.f, probing,
    }),
    /** Test hooks (DESIGN §1.16): fixed particles, infinite life, no respawn. */
    probe(points, seedValue) {
      if (!points) { probing = false; rand = M.mulberry32(seedValue >>> 0 || 0x5eed); sizeKey = ''; wantPrewarm = true; return 0; }
      probing = true;
      N = points.length; P = new Float64Array(N * 3); Q = new Float64Array(N * 3); life = new Float32Array(N).fill(1e9);
      points.forEach(([lon, lat], i) => { M.toVec(lon, lat, P, i * 3); M.toVec(lon, lat, Q, i * 3); });
      return N;
    },
    step(n, dt) { if (!lastS) return false; for (let k = 0; k < n; k++) advance(lastS, dt, null); return true; },
    positions() {
      if (!lastS) return [];
      const out = [];
      for (let i = 0; i < N; i++) {
        const o = i * 3;
        M.toLonLat(P[o], P[o + 1], P[o + 2], ll);
        let vis = true;
        if (lastS.tab === 'map') M.mapXY(P[o], P[o + 1], P[o + 2], lastS.map, pb);
        else { M.globeXY(P[o], P[o + 1], P[o + 2], lastS.g, pb); vis = pb[2] >= M.HIDE_Z; }
        out.push([ll[0], ll[1], pb[0], pb[1], vis]);
      }
      return out;
    },
    hold(on) { held = !!on; },
    reseed(seedValue) { rand = M.mulberry32(seedValue >>> 0); sizeKey = ''; wantPrewarm = true; },
    perf: () => ({ frames: frames.slice(-120).map((f) => ({ ...f, flowMs: +f.flowMs.toFixed(3) })), ladder: ladder.slice() }),
  };
  return F;
}
