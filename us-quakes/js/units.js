// Units and dates (DESIGN §2): SI by default or US, thousands grouped with U+202F, the minus sign,
// "1964-03-28 03:36 UTC", ages in words, and the minute counts the data use (minutes since 1600-01-01 UTC).

export const NNBSP = ' ';
export const MINUS = '−';
export const EPOCH_MS = Date.UTC(1600, 0, 1);
export const msOf = (t) => EPOCH_MS + t * 60000;
export const minOf = (ms) => Math.floor((ms - EPOCH_MS) / 60000);
export const minOfYMD = (y, mo = 0, d = 1) => minOf(Date.UTC(y, mo, d));
export const yearOf = (t) => new Date(msOf(t)).getUTCFullYear();

let us = false;
export const setUnits = (u) => { us = u === 'us'; };
export const units = () => (us ? 'us' : 'si');

export function num(v, d = 0) {
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const out = f ? `${g}.${f}` : g;
  return v < 0 && /[1-9]/.test(out) ? MINUS + out : out;
}

export const dist = (km, d = 0) => (us ? `${num(km * 0.621371, d)} mi` : `${num(km, d)} km`);
// the catalog's fixed depth is a round 10 km; in US units the miles follow it, never replace it
export const tenKm = () => (us ? `10 km (${num(10 * 0.621371)} mi)` : '10 km');
export const lenUnit = () => (us ? [1.609344, 'mi'] : [1, 'km']);
// the depth legend's stops, 0 · 35 · 300 km, in the chosen unit
export const rampLabel = () => [0, 35, 300].map((k) => num(us ? k * 0.621371 : k)).join(' · ') + (us ? ' mi' : ' km');
export const elev = (m) => (us ? `${num(m * 3.28084)} ft` : `${num(m)} m`);

const p2 = (n) => String(n).padStart(2, '0');
export function utc(t, withTime = true) {
  const a = new Date(msOf(t));
  const day = `${a.getUTCFullYear()}-${p2(a.getUTCMonth() + 1)}-${p2(a.getUTCDate())}`;
  return withTime ? `${day} ${p2(a.getUTCHours())}:${p2(a.getUTCMinutes())} UTC` : day;
}
export const hhmmUTC = (ms) => { const a = new Date(ms); return `${p2(a.getUTCHours())}:${p2(a.getUTCMinutes())}`; };
export const hhmmLocal = (ms) => { const a = new Date(ms); return `${p2(a.getHours())}:${p2(a.getMinutes())}`; };

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function age(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(0, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${num(d)} day${d === 1 ? '' : 's'}`;
}

export const magText = (m) => (m === 255 ? '' : num((m - 20) / 10, 1));
export const depthKm = (d) => (d === 65535 ? null : d / 100 - 5);
