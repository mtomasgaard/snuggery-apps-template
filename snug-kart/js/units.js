// Every number, time and place the game writes (ART.md 3; HOUSE.md 6). Pure: runs in Node.
// U+202F between a number and its unit and between thousands, the true minus, whole seconds after
// "about" for a time the race did not measure.

export const NNBSP = '\u202f';
const MINUS = '−';

/** "16380" becomes "16 380" (U+202F): four digits and more are grouped. */
function group(d) {
  let out = '';
  for (let i = 0; i < d.length; i++) out += (i && (d.length - i) % 3 === 0 ? NNBSP : '') + d[i];
  return out;
}
/** A number with d decimals: the true minus, no "−0.0", thousands grouped. */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  const [i, f] = Math.abs(v).toFixed(d).split('.');
  return (v < 0 && Number(`${i}.${f || 0}`) ? MINUS : '') + (i.length > 3 ? group(i) : i) + (f ? `.${f}` : '');
}
export const unit = (s, u) => `${s}${NNBSP}${u}`;
export const meters = (x, d = 0) => unit(fixed(x, d), 'm');
export const percent = (x, d = 1) => unit(fixed(x, d), '%');

export const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export const place = (n) => `${n}${ordinal(n)}`;
export const placeOf = (n, of) => `${place(n)} of ${of}`;
export const lapOf = (n, of) => `Lap ${n} of ${of}`;

const split = (t) => { const ms = Math.round(t * 1000), m = Math.floor(ms / 60000); return [m, (ms - m * 60000) / 1000]; };
/** "1:52.985"; "–:––.–––" before there is a time. */
export function raceTime(t) {
  if (t == null || !Number.isFinite(t)) return '–:––.–––';
  const [m, s] = split(t);
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
/** A projected time: "about 1:54", to the second, because ten seconds of average speed is all it is. */
export function aboutTime(t) {
  const s = Math.round(t);
  return `about ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
/** What VoiceOver hears: "1 minute 52.985 seconds", or "about 1 minute 54 seconds". */
export function spokenTime(t, about = false) {
  const [m, s] = about ? [Math.floor(Math.round(t) / 60), Math.round(t) % 60] : split(t);
  const sec = `${about ? s : s.toFixed(3)} second${s === 1 ? '' : 's'}`;
  return (about ? 'about ' : '') + (m ? `${m} minute${m === 1 ? '' : 's'} ${sec}` : sec);
}

/** The diagnostics' three lines (tap the race time five times). */
export const diagnostics = (fps, js, calls, tris, pr, built) =>
  `${unit(fixed(fps), 'fps')}, ${unit(fixed(js, 1), 'ms')} JS\n${calls} calls, ${fixed(tris)} triangles, ×${fixed(pr, 2)}\nbuilt in ${unit(fixed(built), 'ms')}`;
