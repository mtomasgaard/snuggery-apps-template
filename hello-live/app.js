/* Hello Live, a Snuggery mini-app. The look is ART.md (the house system, Template/HOUSE.md, and the Time Card);
 * every number, date and span on screen is written by js/units.js, and the card is laid out by js/card.js.
 *
 * ---------------------------------------------------------------------------
 * data/snapshot.json — the ONLY file that changes. Whatever rewrites it
 * tomorrow will not have read this conversation, so the shape is documented
 * here rather than left to be inferred:
 *
 *   {
 *     "generatedAt": "2026-09-08T12:31:42Z",   ISO 8601, UTC. Required.
 *     "headline":    "12:31 UTC",              the big number. Required.
 *     "caption":     "…",                      one line under it. Optional.
 *     "runs": [ { "label": "…", "value": "…" } ]   zero or more rows.
 *     "ask":  [ { "measure": "…", "value": 0 } ]   flat rows for Snuggery's Ask:
 *                                              a table for questions in words,
 *                                              never read by this app.
 *   }
 *
 * Everything else — layout, colors, copy — lives in this file, style.css and
 * js/ and should not need to change for months while the data is replaced
 * hourly.
 *
 * Nothing from the file ever reaches markup as markup: every value goes in
 * through textContent. innerHTML is never assigned. Keep it that way.
 * ---------------------------------------------------------------------------
 */

import { NB, int, count, si, stampWhen, full, offsetWord, dayMon, localLead, stamp as stampOf } from './js/units.js';
import { layout, rowFor, geometry, describe, draw, remember, sanitize, DAYS_SHOWN } from './js/card.js';

const DATA_URL = './data/snapshot.json';
const KEY = 'hello-live.card';   // the one storage key: the record of files read here
const LABEL_FONT = '400 10.5px "Ysabeau Office", system-ui, sans-serif';
const LANDSCAPE = '(orientation: landscape) and (max-height: 500px)';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** A text node kept and changed only when its words change (the render in place). */
const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

let D = null;          // the file as shown: { data, text, made } (made: generatedAt in ms, or null)
let record = [];       // [written, firstRead] pairs, newest last (js/card.js)
let storage = true;    // false once localStorage refused a read or a write: the record is then this page's life
let L = null, G = null;   // the card's layout and geometry as drawn
let tick = 0;          // the minute timeout

/** One polite live region for sentences (HOUSE 4.9): never twice for one event. */
function announce(text) {
  const n = $('live');
  n.textContent = '';
  setTimeout(() => { n.textContent = text; }, 60);
}

/* ── the record, in storage ─────────────────────────────────────────────── */
/** Storage refused is `storage = false`; a stored value that does not parse is an empty record, storage still fine. */
function readRecord() {
  let t;
  try { t = localStorage.getItem(KEY); } catch { storage = false; return []; }
  try { return sanitize(t ? JSON.parse(t) : []); } catch { return []; }
}
function writeRecord(r) {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { storage = false; }
}

/* ── reading the file ───────────────────────────────────────────────────── */
/** The app's only network-shaped call, and it never leaves the package. `hint` is for a page opened straight from a
 *  folder in a browser, where reading the file is refused (the stock's one help sentence, as words). */
async function readText() {
  let res;
  try { res = await fetch(DATA_URL, { cache: 'no-store' }); } catch (err) {
    return { error: `could not be read (${err && err.message ? err.message : err}).`, hint: 'Opened from a file, a browser blocks the read: serve the folder with a local web server.' };
  }
  if (!res.ok) return { error: `could not be read (HTTP ${res.status}).` };
  return { text: await res.text() };
}
function parse(r) {
  if (r.error) return { problems: [`data/snapshot.json ${r.error}`], hint: r.hint, unread: true };
  let d;
  try { d = JSON.parse(r.text); } catch { return { problems: ['data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing when a web address answers with one.'], short: 'It is not valid JSON.' }; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.headline !== 'string' || typeof d.generatedAt !== 'string') {
    return { problems: ['data/snapshot.json parsed, but has no headline or no generatedAt. An error reply is valid JSON too.'], short: 'It has no headline or no generatedAt.' };
  }
  return { value: d };
}

async function load() {
  const r = await readText();
  if (D && r.text != null && r.text === D.text) { $('notice').hidden = true; refresh(); return; }
  const S = parse(r);
  if (S.problems) return fail(S);
  const before = D, now = Date.now();
  const made = Date.parse(S.value.generatedAt);
  D = { data: S.value, text: r.text, made: Number.isNaN(made) ? null : made };
  if (D.made !== null) {
    const next = remember(record, D.made, now);
    if (next !== record) { record = next; writeRecord(record); }
  }
  $('notice').hidden = true;
  try { await document.fonts.load(LABEL_FONT); } catch { /* measured in the fallback face */ }
  render();
  if (before) announce(D.made === null ? 'New file, undated.' : `New file, written ${stampWhen(D.made)}.`);
  schedule();
}

/** The same file on a return, or the clock at a whole minute: only what the clock moves is written again (the stamp,
 *  the now notch and the rows, the caption's offset). */
function refresh() {
  stamp();
  drawCard();
  caption();
  aboutList();
  schedule();
}

/** While visible, one timeout to the next whole minute; cleared when hidden. */
function schedule() {
  clearTimeout(tick);
  tick = 0;
  if (!D || document.hidden) return;
  tick = setTimeout(() => { tick = 0; refresh(); }, 60000 - (Date.now() % 60000) + 20);
}

/** A problem with the file is a sentence on a plate (HOUSE 4.9). A broken replacement keeps the file that was
 *  showing, the stamp, the card and the rows, and says so; Close puts the plate away. */
function fail(S) {
  const box = $('notice');
  box.replaceChildren();
  if (D) {
    const x = el('button', 'textkey', 'Close');
    x.type = 'button';
    x.onclick = () => { box.hidden = true; };
    const what = S.unread ? `${S.problems.join(' ')} Nothing new arrived.` : `A new data/snapshot.json arrived and cannot be used. ${S.short}`;
    box.append(el('p', null, `${what} Still showing the file ${D.made !== null ? `updated ${stampWhen(D.made)}` : 'that was open'}.`),
      el('p', 'notice-lines', 'In Snuggery, Options, then App Files shows what the file holds.'), x);
    box.classList.add('kept');
  } else {
    $('stamp').textContent = 'No usable file.';
    $('pane').hidden = true;
    $('capline').textContent = '';
    box.classList.remove('kept');
    for (const p of S.problems) box.append(el('p', null, p));
    if (S.hint) box.append(el('p', 'notice-lines', S.hint));
    box.append(el('p', 'notice-lines', 'In Snuggery, Options, then App Files shows what the file holds.'));
  }
  box.hidden = false;
}

/* ── the stamp ──────────────────────────────────────────────────────────── */
/** When the file was made, on the phone's clock, in words; a lead sentence in ink when there is one (B1, B5, B6, B7). */
function stamp() {
  const s = stampOf(D.made, Date.now()), node = $('stamp');
  node.replaceChildren(...(s.lead ? [el('span', 'lead', s.lead)] : []), s.lead && s.rest ? ` ${s.rest}` : s.rest);
}

/* ── the pane, in place ─────────────────────────────────────────────────── */
function render() {
  const d = D.data;
  $('pane').hidden = false;
  setText($('headline'), d.headline);
  const lead = $('lead');
  lead.hidden = D.made === null;
  setText(lead, D.made === null ? '' : localLead(D.made));
  const cap = $('caption'), hasCap = typeof d.caption === 'string' && d.caption.trim() !== '';
  cap.hidden = !hasCap;
  setText(cap, hasCap ? d.caption : '');
  rows(d.runs);
  stamp();
  drawCard();
  caption();
  aboutList();
}

/** The file's runs[] as a dl: rebuilt only when the row count or the labels change; the values updated in place and
 *  passed through si(), so a value with a known unit gets its U+202F. */
function rows(runs) {
  const dl = $('rows'), list = Array.isArray(runs) ? runs.filter((r) => r && typeof r === 'object') : [];
  $('rows-sec').hidden = !list.length;
  const labels = list.map((r) => String(r.label ?? ''));
  const have = [...dl.querySelectorAll('dt')].map((t) => t.textContent);
  if (labels.join('\n') !== have.join('\n') || have.length !== labels.length) dl.replaceChildren(...labels.flatMap((l) => [el('dt', null, l), el('dd', null, '')]));
  [...dl.querySelectorAll('dd')].forEach((dd, i) => setText(dd, si(String(list[i].value ?? ''))));
}

/** The Time Card drawn for the pane's width at the present, its accessible name from the record. Its rows take the
 *  pane's free height (the pane's height less everything else in it), from 14 px up to 40, so the one card fills the
 *  screen it has instead of leaving it blank; on a phone on its side there is none to take and they stay at 14. */
function drawCard() {
  const pane = $('pane'), cs = getComputedStyle(pane), card = $('card');
  const width = Math.floor(pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  if (!(width > 0)) return;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = LABEL_FONT;
  const now = Date.now();
  const room = $('main').clientHeight - (pane.offsetHeight - card.getBoundingClientRect().height);
  L = layout(width, rowFor(room));
  G = geometry(record, now, L, (t) => ctx.measureText(t).width);
  draw($('card'), G);
  $('card').setAttribute('aria-label', describe(record, now));
}

/** The caption line (ART.md section 1): how to read the card, with the phone's offset. */
function caption() {
  setText($('capline'), `A mark where each file was written, by day; its tail runs to its first reading here. Hours: this phone’s, ${offsetWord(Date.now())}.`);
}

/* ── About ──────────────────────────────────────────────────────────────── */
function aboutList() {
  const dl = $('about-list'), d = D.data;
  dl.replaceChildren();
  const add = (k, v) => dl.append(el('dt', null, `${k}:`), el('dd', null, v));
  add('Written', D.made !== null ? full(D.made) : 'not readable in the file');
  add('In the file', d.headline);
  add('Rows', Array.isArray(d.runs) ? int(d.runs.length) : '0');
  add('Ask table', Array.isArray(d.ask) && d.ask.length ? count(d.ask.length, 'row') : 'none');
  const oldest = record.reduce((m, [, f]) => (m === null || f < m ? f : m), null);
  add('Files read here', record.length ? `${count(record.length, 'file')}, since ${dayMon(oldest)}${storage ? '' : '; storage is unavailable, so the record is this page’s'}` : 'none yet');
  if (G && G.before) add('Read before written', `${count(G.before, 'file')} (a clock behind the server’s), drawn without a tail`);
  add('Stale after', `6${NB}h`);
  add('Card', `${DAYS_SHOWN} days${L ? `, ${int(L.pph)}${NB}px an hour at this width` : ''}`);
}

let aboutFrom = null;
function about(open) {
  $('about').hidden = !open;
  for (const id of ['head', 'main', 'band']) $(id).inert = open;   // holds Tab inside the sheet
  $('about-data').hidden = !D;                                      // with no usable file, its prose stands
  if (open) { aboutFrom = document.activeElement; $('about-close').focus(); } else if (aboutFrom) aboutFrom.focus();
}
$('stamp').onclick = () => about(true);
$('about-close').onclick = $('about-close-2').onclick = () => about(false);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('about').hidden) about(false); });
// Tab is held inside the sheet: inert keeps the page out, and this turns the last key's Tab back to the first.
$('about').addEventListener('keydown', (ev) => {
  if (ev.key !== 'Tab') return;
  const keys = [...$('about').querySelectorAll('button')], i = keys.indexOf(document.activeElement);
  if (ev.shiftKey && i <= 0) { ev.preventDefault(); keys[keys.length - 1].focus(); } else if (!ev.shiftKey && i === keys.length - 1) { ev.preventDefault(); keys[0].focus(); }
});

/* Reads come fresh off disk, so reading again when the page comes back into view is what makes an app opened this
   morning show this morning's file. Snuggery fires the same event when a Shortcut delivers a new file while the app
   is open, which is why a new file redraws in place and adds its mark. Hidden, nothing runs. */
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(tick); tick = 0; } else load(); });
window.addEventListener('pagehide', () => { clearTimeout(tick); tick = 0; });
// A new width (a phone turned on its side) draws the card again, at its whole number of pixels per hour.
// A new height of the frame (the address bar of a browser, a split screen) gives the rows their room again.
let lastW = 0, lastH = 0;
new ResizeObserver(() => {
  const w = $('pane').clientWidth, h = $('main').clientHeight;
  if (D && (w !== lastW || h !== lastH)) { lastW = w; lastH = h; drawCard(); }
}).observe($('main'));
matchMedia(LANDSCAPE).addEventListener('change', () => { if (D) drawCard(); });
// The face arriving after the first card: its labels are measured again.
document.fonts.addEventListener('loadingdone', () => { if (D) drawCard(); });

// The test hook (tools/shoot.mjs): inert, nothing in the app calls it.
window.__hl = {
  ready: () => !!D,
  card: () => G && { row: G.L.row, punchH: G.L.punchH, pph: G.L.pph, x0: G.L.x0, plot: G.L.plot, width: G.L.width, height: G.L.height, rows: G.rows.map((r) => ({ k: r.k, y: r.y, label: r.label, start: r.start })), punches: G.punches, tails: G.tails, now: G.now, baseline: G.baseline, labels: G.labels.map((l) => l.text), dropped: G.dropped, files: G.files, before: G.before },
  record: () => record.map((e) => e.slice()),
  storage: () => storage,
  timer: () => tick !== 0,
};

record = readRecord();
load();
