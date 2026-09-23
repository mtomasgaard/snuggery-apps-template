// Focus mode: the mountain on its own.
//
// The controls sheet slides out from under the stage so the 3D view gets the whole height, the
// title shrinks to a line, and a slim column of round buttons appears at the right for the four
// things a person who does not know the gestures needs: zoom in, zoom out, back to the whole
// walk, and what the gestures are. The compass, the scale bar and the readout stay where they
// were; so do the two round buttons at the top right, because the shading layers and the About
// panel are still worth reaching.
//
// It is entered and left by a double-tap on the view (app.js owns the tap timing, because it
// already owns the single tap), by the F key, and by the button at the top of that column —
// which is always visible while focus mode is on, so nobody can get stuck in it.
//
// Focus mode is deliberately not remembered. Every launch starts with the controls showing:
// somebody opening this again after a month should not have to work out where they went. The
// one thing that is remembered is whether the gesture hint has been shown, so it appears once
// per install and never nags again.

import { $, store } from './util.js';

const HINT_MS = 4000;          // long enough to read five lines, short enough not to be in the way
const SEEN_KEY = 'focusHintSeen';

export function setupFocus({ onLayoutChange, zoom, wholeWalk, toolActive }) {
  const kit = $('focus-kit'), hint = $('hint'), btnHint = $('btn-hint');
  let on = false, hintTimer = 0, dismiss = null;

  function clearHint() {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
    if (dismiss) { document.removeEventListener('pointerdown', dismiss, true); dismiss = null; }
  }
  function hideHint() {
    clearHint();
    hint.hidden = true;
    btnHint.setAttribute('aria-expanded', 'false');
  }
  function showHint(auto) {
    clearHint();
    hint.hidden = false;
    btnHint.setAttribute('aria-expanded', 'true');
    // Any touch takes it away. Attached a tick late, so the very tap that asked for it does not
    // dismiss it again before the finger is off the glass.
    setTimeout(() => {
      if (hint.hidden) return;
      dismiss = () => hideHint();
      document.addEventListener('pointerdown', dismiss, true);
    }, 0);
    if (auto) hintTimer = setTimeout(hideHint, HINT_MS);
  }

  function set(next) {
    next = !!next;
    if (next === on) return;
    on = next;
    document.body.classList.toggle('focus', on);
    kit.hidden = !on;
    if (!on) hideHint();
    else if (!store.get(SEEN_KEY, false)) { store.set(SEEN_KEY, true); showHint(true); }
    // The stage just changed height: the renderer, the line materials and the profile's labels
    // all work from the size they were given, so they have to be told again.
    requestAnimationFrame(onLayoutChange);
  }

  // `source` is 'tap' for the double-tap and 'key' or 'button' otherwise. While an analysis tool
  // is armed the view is a picking surface: two quick taps near one spot is somebody correcting
  // a pick that missed, not a request to hide the panel the tool writes its answer into. So the
  // double-tap is ignored in both directions while a tool is on, and the F key and the round
  // button — neither of which can be mistaken for a pick — still work.
  function toggle(source) {
    if (source === 'tap' && toolActive()) return false;
    set(!on);
    return true;
  }

  $('btn-unfocus').addEventListener('click', () => set(false));
  $('btn-zoom-in').addEventListener('click', () => zoom(1 / 1.35));
  $('btn-zoom-out').addEventListener('click', () => zoom(1.35));
  $('btn-whole').addEventListener('click', () => wholeWalk());
  btnHint.addEventListener('click', () => (hint.hidden ? showHint(false) : hideHint()));
  $('hint-ok').addEventListener('click', hideHint);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || ''))) return;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggle('key'); }
    else if (e.key === 'Escape' && on) { e.preventDefault(); set(false); }
  });

  return { toggle, set, isOn: () => on, hintShowing: () => !hint.hidden };
}
