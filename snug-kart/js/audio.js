// Sound (DESIGN.md §14): Web Audio synthesis only, no sound files. Off by default. The AudioContext
// is created inside a tap (iOS allows audio only from a gesture) — the tap that turns Sound on, or
// the Race tap when Sound was left on from an earlier visit — and resumed on any later tap while it
// is suspended. Suspended while paused or hidden. Master gain 0.7 through a compressor.

let ctx = null, master = null, noiseBuf = null;
let enabled = false, held = false;       // held: suspended by pause/hidden, not by the user
let engine = null, screech = null;
let paramT = 1;                          // time since the engine parameters were last set

const now = () => ctx.currentTime;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { ctx = new AC(); } catch { ctx = null; return false; }
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain(); master.gain.value = 0.7;
  master.connect(comp); comp.connect(ctx.destination);
  // One second of white noise, looped or sliced by everything that hisses.
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function env(g, t, a, peak, hold, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
}

/** A single oscillator note: type, frequency (or [from, to] sweep), start offset, duration, gain. */
function tone(type, f, at = 0, dur = 0.12, gain = 0.2, attack = 0.005) {
  const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + dur); }
  else o.frequency.setValueAtTime(f, t);
  env(g, t, attack, gain, Math.max(0, dur - attack - 0.04), 0.06);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.1);
}

/** A burst of filtered noise: filter type, frequency (or [from, to] sweep), duration, gain. */
function hiss(type, f, dur, gain, q = 1, at = 0) {
  const t = now() + at, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = type; fl.Q.value = q;
  if (Array.isArray(f)) { fl.frequency.setValueAtTime(f[0], t); fl.frequency.exponentialRampToValueAtTime(f[1], t + dur); }
  else fl.frequency.setValueAtTime(f, t);
  env(g, t, 0.01, gain, Math.max(0, dur - 0.06), 0.05);
  src.connect(fl); fl.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.1);
}

function startLoops() {
  if (engine) return;
  // Engine (player only): a sawtooth and a square an octave down, through a low-pass, with a wobble LFO.
  const saw = ctx.createOscillator(), sq = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  saw.type = 'sawtooth'; sq.type = 'square';
  lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 1.5;
  g.gain.value = 0;
  lfo.frequency.value = 7; lfoG.gain.value = 0;
  lfo.connect(lfoG); lfoG.connect(saw.frequency); lfoG.connect(sq.frequency);
  saw.connect(lp); sq.connect(lp); lp.connect(g); g.connect(master);
  saw.start(); sq.start(); lfo.start();
  engine = { saw, sq, lp, g, lfo, lfoG };
  // Drift screech: looping noise through a 2.2 kHz band-pass (Q 6).
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), sg = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true;
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 6;
  sg.gain.value = 0;
  src.connect(bp); bp.connect(sg); sg.connect(master); src.start();
  screech = { src, bp, g: sg };
}

function quietLoops() {
  if (!engine) return;
  const t = now();
  engine.g.gain.setTargetAtTime(0, t, 0.05);
  screech.g.gain.setTargetAtTime(0, t, 0.05);
}

const SFX = {
  count: () => tone('sine', 660, 0, 0.12, 0.25),
  go: () => tone('sine', 1320, 0, 0.4, 0.25),
  miniBoost: (e) => tone('sine', [400, e.tier === 2 ? 1200 : 900], 0, 0.2, 0.18),
  pickup: () => { tone('triangle', 880, 0, 0.05, 0.16); tone('triangle', 1320, 0.05, 0.05, 0.16); tone('triangle', 1760, 0.1, 0.05, 0.16); },
  roll: () => tone('square', 2000, 0, 0.03, 0.05, 0.002),
  kettle: () => hiss('bandpass', [800, 3000], 0.6, 0.28, 2),
  quilt: () => { for (const f of [523, 659, 784]) tone('sine', f, 0, 0.5, 0.09, 0.12); },
  shieldPop: () => hiss('highpass', 1500, 0.04, 0.4),
  yarn: () => tone('sine', 140, 0, 0.1, 0.35),
  honey: () => { const t = now(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); env(g, t, 0.01, 0.35, 0.05, 0.4); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6); },
  plane: () => hiss('highpass', [500, 4000], 0.3, 0.22),
  stun: () => tone('sawtooth', [600, 120], 0, 0.5, 0.12),
  wall: (e) => hiss('lowpass', 300, 0.08, Math.min(0.5, 0.08 + (e.speed || 3) * 0.04)),
  bump: (e) => hiss('lowpass', 500, 0.05, Math.min(0.25, 0.04 + (e.speed || 1) * 0.03)),
  lap: (e) => (e.final ? [784, 988, 1175] : [784, 1047]).forEach((f, i) => tone('triangle', f, i * 0.12, 0.12, 0.2)),
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, i * 0.15, i === 3 ? 0.6 : 0.15, 0.2)),
};

export const audioHook = {
  /** Called inside a tap. Creates or resumes the context. */
  unlock() {
    if (!ctx && !build()) return false;
    if (ctx.state === 'suspended' && !held) ctx.resume().catch(() => {});
    return true;
  },
  setEnabled(on) {
    enabled = !!on;
    if (!ctx) return;
    if (enabled && !held) ctx.resume().catch(() => {});
    if (!enabled) { quietLoops(); ctx.suspend().catch(() => {}); }
  },
  suspend() { held = true; if (ctx) { quietLoops(); ctx.suspend().catch(() => {}); } },
  resume() { held = false; if (ctx && enabled) ctx.resume().catch(() => {}); },
  /** Race events → one-shot sounds. Only the player's own events, plus the countdown and nearby hits. */
  onEvent(e, race) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const mine = e.kart && e.kart.isPlayer;
    try {
      switch (e.type) {
        case 'count': case 'go': SFX[e.type](e); break;
        case 'lap': if (mine) SFX.lap(e); break;
        case 'finish': if (mine) SFX.finish(e); break;
        case 'miniBoost': case 'pickup': case 'roll': case 'wall': case 'bump': if (mine) SFX[e.type](e); break;
        case 'use': if (mine && SFX[e.item]) SFX[e.item](e); break;
        case 'shieldPop': if (mine || near(e.kart, race)) SFX.shieldPop(e); break;
        case 'stun': if (mine || near(e.kart, race)) SFX.stun(e); break;
      }
    } catch { /* a sound must never break the race */ }
  },
  /** Every frame: the engine follows the player's speed; the screech follows the drift. */
  frame(race, dt) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const P = race && race.player;
    if (!P || race.done) { quietLoops(); return; }
    startLoops();
    // 20 updates a second is plenty for parameters that glide on 40–80 ms time constants, and it
    // keeps the audio thread's event queue short (six parameters × 60 fps was 360 events a second).
    paramT += dt;
    if (paramT < 0.05) return;
    paramT = 0;
    const t = now(), v = Math.abs(P.v), r = Math.min(1.3, v / 30);
    const pitch = 1 + (P.drift ? 0.06 : 0) + (P.boostT > 0 ? 0.15 : 0);
    const f = (55 + 170 * r) * pitch;
    engine.saw.frequency.setTargetAtTime(f, t, 0.04);
    engine.sq.frequency.setTargetAtTime(f / 2, t, 0.04);
    engine.lp.frequency.setTargetAtTime(400 + 1800 * r, t, 0.05);
    engine.lfoG.gain.setTargetAtTime(P.drift ? f * 0.02 : 0, t, 0.05);
    engine.g.gain.setTargetAtTime(race.phase === 'countdown' ? 0.05 : 0.08, t, 0.08);
    screech.g.gain.setTargetAtTime(P.drift ? 0.06 * Math.min(1, v / 20) : 0, t, 0.04);
  },
  state: () => (ctx ? ctx.state : 'none'),
  get enabled() { return enabled; },
};

function near(k, race) {
  const P = race.player;
  return k && Math.hypot(k.x - P.x, k.z - P.z) < 40;
}
