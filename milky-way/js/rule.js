// The Reach (ART.md section 1), the app's signature: a ruler of distance from the Sun on a log scale,
// 0.001 AU to 10^12 AU, past both ends of the one continuous zoom (30 km to 580 kpc). Its 6 px bar is
// inked in every device-pixel column where the shipped catalogs hold an object on the day shown,
// blank where they hold none; a notch cut through it stands at the camera's own distance from the
// Sun, the number the caption prints. Nothing in it moves by itself. `census` is pure, so
// tools/test_decode.mjs can call it.

import { css, FONT } from './track.js';

export const LO = -3, HI = 12;            // log10 of the distance in AU at the two ends
const BAR_Y = 7, BAR_H = 6, H = 33;
const PC = Math.log10(648000 / Math.PI);  // log10 of a parsec in AU
const UNITS = [[0, '1\u202FAU'], [PC, '1\u202Fpc'], [PC + 3, '1\u202Fkpc'], [PC + 6, '1\u202FMpc']];

/** Which of `cols` equal columns over [LO, HI] hold at least one of the log10 distances given. */
export function census(lists, cols) {
  const mask = new Uint8Array(cols), k = cols / (HI - LO);
  for (const logs of lists) for (const l of logs) {
    const c = Math.floor((l - LO) * k);
    if (c >= 0 && c < cols) mask[c] = 1;
  }
  return mask;
}

export function createReach(canvas) {
  const ctx = canvas.getContext('2d');
  const R = { lists: [], mask: null, you: NaN };
  let W = 1, dpr = 1, tokens = null, drawn = '', fixed = null;
  const xOf = (l) => ((l - LO) / (HI - LO)) * W;
  R.resize = () => {
    W = Math.max(1, Math.round(canvas.parentElement.getBoundingClientRect().width)); dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    R.mask = fixed = null; drawn = '';
  };
  /** lists[0] moves with the date; the others' columns are worked out once per canvas width. */
  R.setLists = (lists) => { R.lists = lists; R.mask = null; drawn = ''; };
  R.invalidate = () => { tokens = null; drawn = ''; };
  /** Draws when the census, the size, the theme or the notch's device column changed. */
  R.draw = (au) => {
    R.you = au;
    if (!R.mask) {
      fixed = fixed || census(R.lists.slice(1), canvas.width);
      R.mask = census(R.lists.slice(0, 1), canvas.width).map((v, c) => v | fixed[c]);
    }
    const nx = Math.round(xOf(Math.max(LO, Math.min(HI, Math.log10(au)))) * dpr);
    if (drawn === `${nx}`) return;
    drawn = `${nx}`;
    if (!tokens) tokens = { reach: css('--reach'), page: css('--page'), line: css('--line-strong'), ink2: css('--ink-2'), ink3: css('--ink-3') };
    const t = tokens, m = R.mask;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // the ink: one rectangle per run of inked device columns
    ctx.fillStyle = t.reach;
    for (let c = 0; c < m.length; c++) {
      if (!m[c]) continue;
      let e = c; while (e + 1 < m.length && m[e + 1]) e++;
      ctx.fillRect(c, BAR_Y * dpr, e - c + 1, BAR_H * dpr);
      c = e;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = t.line; ctx.fillRect(0, BAR_Y + BAR_H, W, 1);
    // the graduation: a 4 px tick at every power of ten, a 7 px one and its name at each unit
    ctx.fillStyle = t.ink3;
    for (let l = LO; l <= HI; l++) ctx.fillRect(Math.min(W - 1, Math.round(xOf(l))), BAR_Y + BAR_H + 1, 1, 4);
    ctx.font = FONT; ctx.textBaseline = 'alphabetic';
    let placed = -Infinity;
    for (const [l, text] of UNITS) {
      const x = Math.round(xOf(l)), w = ctx.measureText(text).width;
      ctx.fillStyle = t.ink2; ctx.fillRect(Math.min(W - 1, x), BAR_Y + BAR_H + 1, 1, 7);
      let left = Math.max(0, x - w / 2);
      if (left + w > W) left = W - w;
      if (left < placed + 6) continue;
      ctx.textAlign = 'left'; ctx.fillText(text, left, BAR_Y + BAR_H + 16);
      placed = left + w;
    }
    // the notch: a 3 px cut of the page through the bar, a 1.5 px hairline through it
    const x = nx / dpr;
    ctx.fillStyle = t.page; ctx.fillRect(x - 1.5, BAR_Y, 3, BAR_H);
    ctx.fillStyle = t.reach; ctx.fillRect(x - 0.75, BAR_Y - 6, 1.5, BAR_H + 12);
  };
  return R;
}
