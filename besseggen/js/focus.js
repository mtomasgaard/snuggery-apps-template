// Focus mode (HOUSE.md section 4.10): the mountain on its own. The header, the key column, the legend
// rows, the controls sheet, an open card and any open sheet leave, hidden and inert; the plate, the
// About key (moved into the caption band), the instrument line, the caption and the player stay.
// In by the key named Hide the controls, the F key or a double-tap on the view (app.js owns the
// tap timing); out by the ghost key named Show the controls, Escape (app.js), F or the double-tap.
// Remembered as besseggen:focus and restored before the first draw.

import { $, store } from './util.js';

export function setupFocus({ onChange, toolActive, say, dialogOpen }) {
  let on = false;
  const gone = () => [$('head'), $('keys'), $('legends'), $('sheet')];
  const RM = matchMedia('(prefers-reduced-motion: reduce)');

  function set(next, byKey, now) {
    next = !!next;
    if (next === on && !now) return;
    on = next;
    store.set('focus', on);
    onChange(on);
    if (on) {
      const done = () => {
        for (const e of gone()) { e.hidden = true; e.inert = true; e.classList.remove('leaving'); }
        $('caption').prepend($('btn-about'));
        document.body.classList.add('focus');
        $('focus-exit').hidden = false;
        if (byKey) $('focus-exit').focus();
      };
      if (now || RM.matches) done(); else { for (const e of gone()) e.classList.add('leaving'); setTimeout(done, 160); }
      if (!now) say('Controls hidden. Press Escape or the corner key to show them.');
    } else {
      for (const e of gone()) { e.hidden = false; e.inert = false; e.classList.remove('leaving'); }
      $('hkeys').append($('btn-about'));
      document.body.classList.remove('focus');
      $('focus-exit').hidden = true;
      if (byKey) $('focus-key').focus();
      say('Controls shown.');
    }
  }

  // While an analysis tool waits for points the view is a picking surface: two quick taps near one
  // spot is somebody correcting a pick, so the double-tap stands down; F and the keys still work.
  const toggle = (source, byKey) => {
    if (source === 'tap' && toolActive()) return false;
    set(!on, byKey);
    return true;
  };
  const kb = (e) => e.detail === 0;
  $('focus-key').addEventListener('click', (e) => set(true, kb(e)));
  $('focus-exit').addEventListener('click', (e) => set(false, kb(e)));
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || ''))) return;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggle('key', true); }
  });
  if (store.get('focus', false) === true) set(true, false, true);
  return { toggle, set, isOn: () => on };
}
