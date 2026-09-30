// The seven stories (DESIGN §7.6): the list, the card with stories.json's text and sources verbatim, the
// window, floor and view a story names, its anchors in this copy, and the cumulative sequence windows
// [from, from + k·step) that Play the sequence steps through.

import { el, xBtn, nums } from './util.js';
import { minOf, utc, magText } from './units.js';

const day = (s) => minOf(Date.parse(s + 'T00:00:00Z'));
export function storyState(s) {
  const w = s.window, [y, mo] = w.start.split('-').map(Number);
  return { histWin: { stub: 'year', month: 'month', year: 'year', decade: 'decade' }[w.kind], histAt: minOf(Date.UTC(y, mo ? mo - 1 : 0, 1)),
    floor: { 2.5: 45, 4: 60, 5: 70, 6: 80 }[s.floor] };
}
export function anchors(C, s) {
  const out = [];
  for (const id of s.anchors) { const j = C.ids.indexOf(id); if (j >= 0) out.push(C.textRows[j]); }
  return out.sort((a, b) => C.m[b] - C.m[a]);
}
export function seqWindow(s, k) {
  const p = s.play, t0 = day(p.from), end = day(p.to), t1 = Math.min(end, t0 + k * (p.step === 'week' ? 7 : 1) * 1440);
  return { t0, t1, label: `${p.from} to ${utc(t1 - 1440, false)}`, done: t1 >= end };
}
export const tabText = (C, i) => `M ${magText(C.m[i])} · ${utc(C.t[i], false)}`;

export function storyList(A, body) {
  const ST = A.stories;
  if (!ST) return;
  body.append(el('h2', null, 'Stories'));
  const ul = el('ul', 'list');
  for (const s of ST.stories) {
    const b = el('button', 'row story'), w = el('span', 'w');
    w.append(nums(s.text, true));
    b.append(el('span', 'm', s.when.slice(0, 4)), el('span', 'p', s.title), w);
    b.onclick = () => A.openStory(s.id);
    const li = el('li'); li.append(b); ul.append(li);
  }
  body.append(ul);
}

export function storyCard(A, s) {
  const d = el('article', 'card story-card'), l1 = el('div', 'l1');
  l1.append(el('h3', 'place', s.title));
  l1.append(xBtn('Close the story', () => A.closeStory()));
  const tm = el('p', 'time'), tx = el('p');
  tm.append(nums(s.when)); tx.append(nums(s.text, true));
  d.append(l1, tm, tx);
  if (s.play) {
    const on = A.seqOn(s), b = el('button', 'btn', on ? 'Stop the sequence' : 'Play the sequence');
    b.setAttribute('aria-pressed', String(on)); b.onclick = () => A.playSeq(s); d.append(b);
  }
  for (const id of s.sources) {
    const src = A.stories.sources.find((q) => q.id === id);
    if (src) d.append(el('p', 'small', `${src.title}. ${src.owner}. Retrieved ${src.retrieved}.`), el('p', 'addr', src.url));
  }
  return d;
}
