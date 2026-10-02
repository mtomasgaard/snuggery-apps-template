// The Levels, the app's signature (ART.md section 1): this body’s own vertebrae used as the rule a
// height in the trunk is read by. Pure math, no DOM and no WebGL, so tools/test_decode.mjs runs it in
// Node against formulas of its own. app.js projects the vertebrae through the camera and draws.
//
// A vertebra is a part of anatomy.json whose type is one of SPINE and which carries a label (C1 to
// L5, S1–S5), at its box in geometry.json. Its band is the heights between the midpoints to its
// neighbors' box centers; C1's band tops out at C1's box top and the last band ends at its box
// bottom. The level of a height is the label of the band that holds it.

export const SPINE = ['atlas', 'axis', 'cervical', 'thoracic', 'lumbar', 'sacrum'];

/** The labeled vertebrae, top to bottom: { id, label, top, bottom, center, x, z } in meters. */
export function vertebrae(anatomy, geometry) {
  const box = new Map(((geometry && geometry.parts) || []).map((p) => [p.id, p]));
  const out = [];
  for (const p of (anatomy && anatomy.parts) || []) {
    const b = box.get(p.id);
    if (!b || !p.label || !SPINE.includes(p.type)) continue;
    out.push({ id: p.id, label: p.label, top: b.max[1], bottom: b.min[1], center: (b.min[1] + b.max[1]) / 2, x: (b.min[0] + b.max[0]) / 2, z: (b.min[2] + b.max[2]) / 2 });
  }
  return out.sort((a, b) => b.center - a.center);
}

/** Each vertebra's band, { label, hi, lo, center }, top to bottom. */
export function bands(v) {
  return v.map((e, i) => ({
    label: e.label,
    hi: i === 0 ? e.top : (v[i - 1].center + e.center) / 2,
    lo: i === v.length - 1 ? e.bottom : (v[i + 1].center + e.center) / 2,
    center: e.center,
  }));
}

/** Where a region of the spine ends: between C7 and T1, T12 and L1, L5 and the sacrum. */
export const regionEnd = (b, i) => i + 1 < b.length && b[i].label[0] !== b[i + 1].label[0];

/** The level of a height: a label, or "above C1" over the rule's top, "below the sacrum" under it. */
export function levelOf(y, b) {
  if (!b.length) return '';
  if (y > b[0].hi) return `above ${b[0].label}`;
  if (y < b[b.length - 1].lo) return 'below the sacrum';
  for (const e of b) if (y >= e.lo) return e.label;
  return b[b.length - 1].label;
}

/** A span in words, top first: "T12 to L3", or one level when both ends fall in one band. */
export function spanWords(lo, hi, b) {
  const a = levelOf(hi, b), z = levelOf(lo, b);
  return a === z ? a : `${a} to ${z}`;
}

/**
 * The piecewise-linear map from a height (meters) to the column (screen px), through the knots
 * (the rule's top, every vertebra's center, the rule's bottom) and their projected screen heights.
 * `scr` = { top, centers: [...], bottom } in the same order as `b`. Past either end the place is
 * clamped to that end and `open` says which way the span runs on.
 */
export function toColumn(y, b, scr) {
  const kw = [b[0].hi, ...b.map((e) => e.center), b[b.length - 1].lo];
  const ks = [scr.top, ...scr.centers, scr.bottom];
  if (y >= kw[0]) return { y: ks[0], open: y > kw[0] ? 'up' : null };
  if (y <= kw[kw.length - 1]) return { y: ks[ks.length - 1], open: y < kw[kw.length - 1] ? 'down' : null };
  for (let i = 1; i < kw.length; i++) {
    if (y >= kw[i]) {
      const t = kw[i - 1] === kw[i] ? 0 : (kw[i - 1] - y) / (kw[i - 1] - kw[i]);
      return { y: ks[i - 1] + (ks[i] - ks[i - 1]) * t, open: null };
    }
  }
  return { y: ks[ks.length - 1], open: null };
}

/* The caption line's sentences (ART.md section 1, test 3). A level is a labeled part, so the sacrum,
   five fused vertebrae, is one level: 25 levels are 24 vertebrae and the sacrum. */
export const ruleSentence = (b) => `Levels: this body’s spine in ${b.length} levels, ${b[0].label} to ${b[b.length - 1].label}, drawn beside it where the camera sees them.`;
export const NO_RULE = 'Levels: the data names no vertebrae, so there is no rule beside the body.';
/** Why there is no column, in the words that say what to do: 'steep' (the camera looks down or up
 *  the spine) or 'small' (the spine is drawn too short to read). */
export const HIDDEN_RULE = {
  steep: 'Levels: turn the body upright to read its vertebrae beside it.',
  small: 'Levels: come closer to read this body’s vertebrae beside it.',
};
const TO_SEE = { steep: 'turn the body upright to see its bar', small: 'come closer to see its bar' };
export function spanSentence(words, b, drawn, why = 'small') {
  if (words.startsWith('above ') && !words.includes(' to ')) return `The selection lies ${words}, over the top of the spine.`;
  if (words === 'below the sacrum') return 'The selection lies below the sacrum, under the spine.';
  const verb = words.startsWith('above ') ? 'runs from' : words.includes(' to ') ? 'spans' : 'lies at';
  return drawn ? `The selection ${verb} ${words} on this body’s spine: the bar beside the levels.`
    : `The selection ${verb} ${words}; ${TO_SEE[why] || TO_SEE.small}.`;
}
export const explodedSentence = (amount, by) => `Pulled apart ${amount} by ${by}, a display distance; the levels follow the vertebrae as drawn.`;
