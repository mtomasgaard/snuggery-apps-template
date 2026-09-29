// localStorage, every access in try/catch: the game works without it (private windows, blocked
// storage, thumbnails). Nothing goes in sessionStorage — Snuggery empties it on every launch.

const PREFIX = 'snugkart:v1:';

export function load(key, fallback) {
  try { const s = window.localStorage.getItem(PREFIX + key); return s ? { ...fallback, ...JSON.parse(s) } : { ...fallback }; }
  catch { return { ...fallback }; }
}
export function save(key, value) {
  try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function loadRaw(key) {
  try { const s = window.localStorage.getItem(PREFIX + key); return s ? JSON.parse(s) : null; } catch { return null; }
}

export const DEFAULT_SETTINGS = { sound: false, tilt: false, quality: 'high', controls: 'pad', pace: 'standard', track: 'harbour', racer: 'pip' };

/** Best lap and best race for a track, in milliseconds: { lap, race, racer, at } or null. */
export const bestFor = (trackId) => loadRaw(`best:${trackId}`);

/** Record a finished race; returns { newLap, newRace }. */
export function recordBest(trackId, lapMs, raceMs, racer) {
  const old = bestFor(trackId) || {};
  const newLap = lapMs != null && (old.lap == null || lapMs < old.lap);
  const newRace = raceMs != null && (old.race == null || raceMs < old.race);
  if (newLap || newRace) {
    save(`best:${trackId}`, {
      lap: newLap ? lapMs : old.lap, race: newRace ? raceMs : old.race,
      racer: newRace ? racer : (old.racer || racer), at: new Date().toISOString(),
    });
  }
  return { newLap, newRace };
}
