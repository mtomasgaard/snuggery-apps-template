// The time model (DESIGN §4, §7): Live windows back from the feed's minute; calendar History windows
// (Month, Year, Decade, All, the stub before 1900), each labeled with exactly what it spans; the steps
// of the keys and of Play.

import { minOfYMD, msOf, MONTHS } from './units.js';

export const LIVE_DAYS = { day: 1, week: 7, month: 30 };
export const T1600 = minOfYMD(1600), T1900 = minOfYMD(1900);
const ymd = (t) => { const d = new Date(msOf(t)); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };

export const liveWindow = (to, win) => ({ t0: to - LIVE_DAYS[win] * 1440, t1: to + 1 });

export function histWindow(kind, at, now, first, slide = null) {
  const [y, mo] = ymd(at);
  let t0, t1, label;
  if (kind === 'all') { t0 = T1600; t1 = now + 1; label = `All, ${first}–${ymd(now)[0]}`; }
  else if (at < T1900) { t0 = T1600; t1 = T1900; label = 'Before 1900'; }
  else if (slide != null) { t0 = minOfYMD(slide); t1 = minOfYMD(slide + 10); label = `${slide}–${slide + 9}`; }
  else if (kind === 'month') { t0 = minOfYMD(y, mo); t1 = minOfYMD(y, mo + 1); label = `${new Date(Date.UTC(y, mo)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${y}`; }
  else if (kind === 'decade') { const d = y - (y % 10); t0 = minOfYMD(d); t1 = minOfYMD(d + 10); label = `${d}s`; }
  else { t0 = minOfYMD(y); t1 = minOfYMD(y + 1); label = String(y); }
  if (t1 > now + 1 && kind !== 'all') {
    const [, m2, d2] = ymd(now);
    label += ` (to ${MONTHS[m2]} ${d2})`;
    t1 = now + 1;
  }
  return { t0, t1, label };
}

export function stepAt(kind, at, k) {
  const [y, mo] = ymd(Math.max(at, T1900));
  if (at < T1900) return k > 0 ? T1900 : at;
  if (kind === 'month') return minOfYMD(y, mo + k);
  if (kind === 'decade') return minOfYMD(y - (y % 10) + 10 * k);
  return minOfYMD(y + k);
}

export const PLAY_MS = { month: 400, year: 600, decade: 600 };
export function playStep(kind, at, slide, now) {
  if (kind === 'decade') {
    const y = ymd(Math.max(at, T1900))[0], s = slide == null ? y - (y % 10) + 1 : slide + 1;
    if (minOfYMD(s) > now) return null;
    return { at: minOfYMD(s), slide: s };
  }
  const next = at < T1900 ? T1900 : stepAt(kind, at, 1);
  return next > now ? null : { at: next, slide: null };
}
