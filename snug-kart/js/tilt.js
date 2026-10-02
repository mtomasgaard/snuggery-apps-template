// Tilt steering (DESIGN.md §13), off by default. Turning it on is a tap on the title's Tilt word, so
// iOS's DeviceOrientationEvent.requestPermission() can be called inside the gesture; either way the
// word turns on only if real orientation readings actually arrive. Steering then comes from gamma in
// portrait (beta in landscape, signed by the screen angle): steer = (angle − neutral) / 22°, with a 3°
// dead zone, where `neutral` is the average reading over the countdown. No reading in the last half
// second → null, and the pad or keys steer as usual.

const RANGE = 22, DEAD = 3, STALE_MS = 500;

let listening = false, input = null;
let last = null, lastAt = 0;           // the latest usable angle (degrees) and when it came
let neutral = 0;
const recent = [];                      // [time, angle] over the last 3 s, for calibration

function screenAngle() {
  const o = window.screen && window.screen.orientation;
  if (o && typeof o.angle === 'number') return o.angle;
  return typeof window.orientation === 'number' ? window.orientation : 0;
}

function onOrient(e) {
  if (e.gamma == null && e.beta == null) return;
  const a = screenAngle();
  let angle;
  if (a === 90) angle = e.beta;                 // landscape, home side right
  else if (a === -90 || a === 270) angle = -e.beta;
  else if (a === 180) angle = -e.gamma;
  else angle = e.gamma;
  if (angle == null || !Number.isFinite(angle)) return;
  last = angle; lastAt = performance.now();
  recent.push([lastAt, angle]);
  while (recent.length && lastAt - recent[0][0] > 3000) recent.shift();
}

function listen(on) {
  if (on === listening) return;
  listening = on;
  if (on) window.addEventListener('deviceorientation', onOrient);
  else window.removeEventListener('deviceorientation', onOrient);
}

/** The steer the tilt gives now, or null when there is no fresh reading. */
function steer() {
  if (last === null || performance.now() - lastAt > STALE_MS) return null;
  let d = last - neutral;
  if (Math.abs(d) < DEAD) return 0;
  d -= Math.sign(d) * DEAD;
  return Math.max(-1, Math.min(1, d / (RANGE - DEAD)));
}

export const tiltHook = {
  /** Must be called straight from a tap. Resolves true only when tilt readings can be had. */
  async request() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function') {
      // iOS (and recent Chromium): ask inside the tap. This call must come before any await.
      let r;
      try { r = await DOE.requestPermission(); } catch { return false; }
      if (r !== 'granted') return false;
    }
    // Permission or not, the word turns on only if a real reading arrives within 1 s (a desktop
    // may grant it and still have no sensor).
    listen(true);
    const t0 = performance.now();
    for (let n = 0; n < 20 && lastAt <= t0; n++) await new Promise((res) => setTimeout(res, 50));
    const ok = lastAt > t0;
    if (!ok && !input) listen(false);
    return ok;
  },
  start(inp) { input = inp; listen(true); inp.tiltSteer = steer; document.body.classList.add('tilt'); },
  stop() { if (input) input.tiltSteer = null; input = null; listen(false); last = null; document.body.classList.remove('tilt'); },
  /** Take the average reading over the countdown as the neutral angle. */
  calibrate() {
    const t = performance.now(), xs = recent.filter(([at]) => t - at < 3000).map(([, a]) => a);
    neutral = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : (last ?? 0);
  },
  debug: () => ({ listening, last, neutral, steer: steer() }),
};
