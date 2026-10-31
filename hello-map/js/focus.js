// Focus mode (HOUSE.md section 4.10): the map on its own, plus the one control it needs, the layer
// switch. The header (the name, the status line, the units key) and the key column leave, hidden and
// inert, and an open card closes; the plate with the collar, the layer switch, the caption band (the
// scale and the caption line) and the About key, moved into the caption band, stay.
// In by the key named Hide the controls or the F key; out by the ghost key named Show the controls,
// Escape or F. On the map a double-tap zooms, so it never toggles focus mode.
// Remembered as hellomap:focus and restored before the first draw.

import { $, store } from './util.js';

export function setupFocus({ onChange, say, dialogOpen }) {
  let on = false;
  const gone = () => [$('head'), $('keys')];
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0;

  function set(next, byKey, now) {
    next = !!next;
    if (next === on && !now) return;
    on = next;
    store.set('focus', on);
    clearTimeout(timer);
    if (on) {
      onChange(on, false);
      const done = () => {
        for (const e of gone()) { e.hidden = true; e.inert = true; e.classList.remove('leaving'); }
        $('caption').prepend($('btn-about'));
        document.body.classList.add('focus');
        $('focus-exit').hidden = false;
        if (byKey) $('focus-exit').focus();
        onChange(on, true);
      };
      if (now || RM.matches) done(); else { for (const e of gone()) e.classList.add('leaving'); timer = setTimeout(done, 160); }
      if (!now) say('Controls hidden. Press Escape or the corner key to show them.');
    } else {
      for (const e of gone()) { e.hidden = false; e.inert = false; e.classList.remove('leaving'); }
      $('hkeys').append($('btn-about'));
      document.body.classList.remove('focus');
      $('focus-exit').hidden = true;
      if (byKey) $('focus-key').focus();
      say('Controls shown.');
      onChange(on, true);
    }
  }

  const kb = (e) => e.detail === 0;
  $('focus-key').addEventListener('click', (e) => set(true, kb(e)));
  $('focus-exit').addEventListener('click', (e) => set(false, kb(e)));
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || ''))) return;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); set(!on, true); }
    else if (e.key === 'Escape' && on) { e.preventDefault(); set(false, true); }
  });
  if (store.get('focus', false) === true) set(true, false, true);
  return { set, isOn: () => on };
}
