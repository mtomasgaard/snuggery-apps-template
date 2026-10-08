/* World News, a Snuggery mini-app. The look is ART.md (the house system, Template/HOUSE.md, its pane-app
 * register, section 11, and the Datelines); every date and count on screen is written by js/units.js, the
 * Datelines by js/datelines.js.
 *
 * THE SHAPE OF ./data/snapshot.json, written by scripts/world_news.py once a day. Whatever rewrites this
 * app next year will not have read the conversation that made it, so the contract lives here.
 *
 *   schema       1, bumped only on a breaking change
 *   generatedAt  ISO 8601 UTC. Required: every age on screen is counted to it.
 *   regions[]    in the order they are drawn: { key, name, stale (every item kept from a failed run),
 *                items[]: { title, source, feed, link, published (ISO), summary ("" when the license says
 *                no), author (when the feed names one), stale (kept from a run whose feed failed) } }
 *   sources[]    { name, attribution, licence, terms }: the credit each source's terms ask for, printed in
 *                About word for word (the key is the pipeline's; the words are shown as written)
 *   feeds[]      { id, source, region (its name), ok, items, note }: one row per feed, this run
 *   ask[]        flat rows for Snuggery's Ask; this page does not read them
 *
 * Load-bearing: generatedAt, and regions[] whose items carry title and published. Anything else missing
 * is left out of the screen. A failed fetch upstream can still return valid JSON (an API error envelope),
 * and a Shortcut writes it over this file without complaint, so the app checks the fields it reads and
 * says what is wrong in a sentence, never an empty page.
 *
 * Links: a mini-app reaches no network, so a headline is a link out (target _blank), which Snuggery offers
 * to open in Safari. Everything in the snapshot is someone else's text: it reaches the page only through
 * textContent, and a link is accepted only when its scheme is http or https.
 */

import { int, count, list, clock, dayMon, stampWhen, full, isDateOnly, itemWhen, spokenItem, spoken, ageShort } from './js/units.js';
import { model, hit, label, draw, hollows, SRC, ageOf } from './js/datelines.js';

const DATA_URL = './data/snapshot.json';
const REFRESH_HOURS = 30;      // the job runs daily; 30 hours is a missed run
// The credit line's own words around the sources' names, as the file gives them (tools/check.mjs pins them).
// It is About's first paragraph under Sources and credits (HOUSE 4.15), so it no longer points to About.
const CREDIT = ['Headlines from ', '.'];
// The key at the end of every pane (HOUSE 11.1 rule 1), World News' words.
const ABOUT_KEY = 'Sources, their terms and credits are in About.';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const keyOf = (r) => String(r.key || r.name);
const safeLink = (v) => { const u = String(v ?? '').trim(); return /^https?:\/\//i.test(u) ? u : null; };

let snap = null;               // the file on screen
let tab = 'all';               // the pane: 'all' or a region's key; the app stores nothing
let sel = null;                // the headline a tick picked, { ri, ii }, until another tap or pane
let M = null;                  // the Datelines' model as drawn
let labelW = 0;                // the Datelines' label column, measured in the face
let others = new Map();        // link to the region names that also carry it

/** One polite live region for sentences (HOUSE 4.9): never twice for one event. */
function announce(text) {
  const n = $('live');
  n.textContent = '';
  setTimeout(() => { n.textContent = text; }, 60);
}

/* ── loading ──────────────────────────────────────────────────────────── */

/** What is wrong with a parsed file, as the end of a sentence, or null when it is usable. */
function validate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'it is not a JSON object.';
  if (typeof d.generatedAt !== 'string') return 'it has no generatedAt, so its age cannot be told.';
  if (!Number.isFinite(Date.parse(d.generatedAt))) return `its generatedAt, “${d.generatedAt.slice(0, 40)}”, is not a date this app can read.`;
  if (!Array.isArray(d.regions)) return 'it has no regions, the list of sections this app draws.';
  if (!d.regions.length) return 'its list of regions is empty.';
  for (const r of d.regions) {
    if (!r || typeof r.name !== 'string') return 'a region in it has no name.';
    if (!Array.isArray(r.items)) return `its region ${r.name} has no list of items.`;
    if (r.items.some((i) => !i || typeof i.title !== 'string' || typeof i.published !== 'string')) return `a headline in ${r.name} has no title or no published time.`;
  }
  if (!d.regions.some((r) => r.items.length)) return 'every region in it is empty: no feed answered on the last run, and none was kept from an earlier one.';
  return null;
}

async function load() {
  let raw, d;
  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (err) {
    return fail(`could not be read (${err.message || err}).`);
  }
  try { d = JSON.parse(raw); } catch { return fail('is not valid JSON; it looks like a web page or an error was written over it.'); }
  const why = validate(d);
  if (why) return fail(`is not the shape this app expects: ${why}`);
  $('notice').hidden = true;
  if (snap && d.generatedAt === snap.generatedAt) { stamp(); return; }   // the same file: only its age moved
  const fresh = !!snap;
  try { await document.fonts.load('620 12.5px "Ysabeau Office"'); } catch { /* measured in the fallback face */ }
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '620 12.5px "Ysabeau Office", system-ui, sans-serif';
  labelW = Math.ceil(Math.max(...d.regions.map((r) => ctx.measureText(r.name).width))) + 10;
  snap = d;
  if (!snap.regions.some((r) => keyOf(r) === tab)) tab = 'all';
  sel = null;
  boot();
  if (fresh) announce(`New headlines, updated ${stampWhen(Date.parse(snap.generatedAt))}.`);
}

/** A problem with the file is a sentence on a plate (HOUSE 4.9). A broken replacement keeps the headlines
 *  that were showing, the stamp, the pane and the scroll, and says so; Close puts the plate away. */
function fail(what) {
  const box = $('notice');
  box.replaceChildren();
  if (snap) {
    const p = Date.parse(snap.generatedAt), x = el('button', 'textkey', 'Close');
    x.type = 'button';
    x.onclick = () => { box.hidden = true; };
    box.append(el('p', null, `The new data/snapshot.json ${what} Still showing the headlines from ${dayMon(p)}, ${clock(p)}.`), x);
    box.classList.add('kept');
  } else {
    $('stamp').textContent = 'No usable data';
    $('tabs').hidden = true;
    $('pane').replaceChildren();
    box.classList.remove('kept');
    box.append(el('p', null, `data/snapshot.json ${what}`), el('p', 'notice-lines', 'In Snuggery, Options, then App Files shows what the file holds.'));
  }
  box.hidden = false;
}

/* ── the stamp, the tabs ──────────────────────────────────────────────── */

function boot() {
  others = new Map();
  for (const r of snap.regions) for (const it of r.items) {
    const u = safeLink(it.link);
    if (u) others.set(u, [...(others.get(u) || []), r.name]);
  }
  const names = (Array.isArray(snap.sources) ? snap.sources : []).map((s) => s && s.name).filter((s) => typeof s === 'string');
  $('about-credit-line').textContent = `${CREDIT[0]}${names.length ? list(names) : 'the publishers named under each story'}${CREDIT[1]}`;
  stamp();
  buildTabs();
  const keep = $('main').scrollTop;
  render();
  $('main').scrollTop = keep;
  showTab();
  aboutList();
}

/** When the file was made, in words, and how many feeds answered; stale is a sentence in ink, never a color. */
function stamp() {
  const gen = Date.parse(snap.generatedAt), feeds = Array.isArray(snap.feeds) ? snap.feeds.filter(Boolean) : [];
  const tail = `Updated ${stampWhen(gen)}${feeds.length ? `, ${int(feeds.filter((f) => f.ok).length)} of ${count(feeds.length, 'feed')} answered` : ''}`;
  const stale = Date.now() - gen > REFRESH_HOURS * 3600e3;
  $('stamp').replaceChildren(...(stale ? [el('span', 'lead', 'Stale.'), ` ${tail}`] : [tail]));
}

/** The tabs: All, then the file's regions by name, built after the parse (the camera waits for Europe). A
 *  tab's accessible name is always its visible word; a region kept from an earlier run says so as its
 *  description, never by renaming the tab. */
function buildTabs() {
  const nav = $('tabs'), entries = [['all', 'All', false], ...snap.regions.map((r) => [keyOf(r), r.name, !!r.stale])];
  nav.replaceChildren();
  entries.forEach(([key, name, stale], i) => {
    const b = el('button', null, name);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'pane');
    b.id = `tab-${i}`;
    b.dataset.key = key;
    if (stale) b.setAttribute('aria-describedby', 'kept-hint');
    b.onclick = () => choose(key);
    b.onkeydown = (ev) => {
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: entries.length - 1 }[ev.key];
      if (j == null) return;
      ev.preventDefault();
      const k = entries[(j + entries.length) % entries.length][0];
      choose(k);
      nav.querySelector(`[data-key="${CSS.escape(k)}"]`).focus();
    };
    nav.append(b);
  });
  nav.hidden = false;
  markTabs();
}
function markTabs() {
  for (const b of $('tabs').children) {
    const on = b.dataset.key === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) $('pane').setAttribute('aria-labelledby', b.id);
  }
}
/** The chosen tab is never left half off the row's edge: the row scrolls by itself, only when the tab is
 *  clipped (scrollIntoView would also move where the next Tab starts from). */
const showTab = () => {
  const nav = $('tabs'), b = nav.querySelector('[aria-selected="true"]');
  if (!b) return;
  const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect();
  nav.scrollLeft += r.left < n.left ? r.left - n.left - 16 : r.right > n.right ? r.right - n.right + 16 : 0;
};
/** A pane chosen: the focused tab says its own name, so the live region adds nothing (HOUSE 4.9). */
function choose(key) {
  tab = key;
  sel = null;
  markTabs();
  render();
  showTab();
  $('main').scrollTop = 0;
}

/* ── the pane: the Datelines, then the stories ────────────────────────── */

function render() {
  const pane = $('pane'), gen = Date.parse(snap.generatedAt), region = snap.regions.find((x) => keyOf(x) === tab);
  pane.replaceChildren();
  // The sources, in the file's order, give the ticks and swatches their colors (HOUSE 11.3: --src-1 to --src-3).
  SRC.clear();
  (Array.isArray(snap.sources) ? snap.sources : []).forEach((x) => { if (x && typeof x.name === 'string' && !SRC.has(x.name) && SRC.size < 3) SRC.set(x.name, SRC.size + 1); });
  // The Datelines head the pane on their own plate. A finger lands on a hidden layer over the image. The listener
  // is on their wrapper, so VoiceOver's press finds it and clicks the image itself, which onTick passes over. A
  // click, so a swipe here picks nothing.
  const top = el('section', 'sec lead-sec'), box = $('dl-tpl').content.firstElementChild.cloneNode(true);
  box.addEventListener('click', onTick);
  top.append(el('h2', null, 'Every headline by age'), box);
  pane.append(top);
  drawDatelines();
  // one short label, what the scale is, on one line (HOUSE 11.1 rule 9); then a key in place of the band's
  // words (rule 6): on a region's tab its sources' colors, which only its own row takes, and a hollow tick
  // whenever one is drawn. On All the table of sources is the colors' key.
  top.append(el('p', 'cap', `Age when the file was made, ${dayMon(gen)}, ${clock(gen)}. Log scale.`));
  const keys = [];
  if (region) for (const [name, i] of SRC) if (region.items.some((it) => it.source === name)) keys.push(keyItem(`src-${i}`, name));
  if (M && hollows(M)) keys.push(keyItem('hollow', 'From an earlier run'));
  if (keys.length) { const k = el('div', 'key'); k.append(...keys); top.append(k); }
  if (tab === 'all') top.append(keyTable());
  snap.regions.forEach((r, ri) => {
    if (tab !== 'all' && keyOf(r) !== tab) return;
    const host = el('section', 'sec'), head = el('div', 'sec-head');
    const ages = r.items.map((it) => ageOf(gen, it.published)).filter(Number.isFinite);
    head.append(el('h2', null, r.name), el('span', 'sec-meta', `${count(r.items.length, 'headline')}${ages.length ? `, newest ${ageShort(Math.min(...ages))}` : ''}`));
    host.append(head, ...statements(r));
    r.items.forEach((it, ii) => host.append(story(it, ri, ii)));
    pane.append(host);
  });
  aboutKey(pane);
}

/** One word of a key (HOUSE 4.15): a 10 px swatch drawing the mark, then its word. */
function keyItem(mark, word) {
  const k = el('span', 'k'), sw = el('i', `sw ${mark}`);
  sw.setAttribute('aria-hidden', 'true');
  k.append(sw, word);
  return k;
}

/** All's table of sources, also the colors' key: a swatch and the name, its headlines, its feeds that answered. */
function keyTable() {
  const t = el('table', 'keytab'), head = el('tr'), items = snap.regions.flatMap((r) => r.items);
  const feeds = Array.isArray(snap.feeds) ? snap.feeds.filter(Boolean) : [];
  for (const h of ['Source', 'Headlines', 'Feeds']) head.append(el('th', null, h));
  t.append(head);
  for (const [name, i] of SRC) {
    const tr = el('tr'), td = el('td'), fs = feeds.filter((f) => f.source === name);
    td.append(el('i', `sw src-${i}`), name);
    tr.append(td, el('td', null, int(items.filter((x) => x.source === name).length)), el('td', null, `${int(fs.filter((f) => f.ok).length)} of ${int(fs.length)}`));
    t.append(tr);
  }
  return t;
}

/** The key at the end of every pane: a text button that opens About (HOUSE 11.1 rule 1). */
function aboutKey(host) {
  const b = el('button', 'aboutlink', ABOUT_KEY);
  b.type = 'button';
  b.onclick = () => about(true);
  host.append(b);
}

function drawDatelines() {
  const svg = $('pane').querySelector('.dl');
  if (!svg) return;
  const plate = svg.closest('.sec'), cs = getComputedStyle(plate);   // the Datelines fill their plate's inner width
  const width = plate.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  M = model(snap, width, labelW);
  const chosen = new Set(snap.regions.map((r, i) => i).filter((i) => tab === 'all' || keyOf(snap.regions[i]) === tab));
  draw(svg, M, chosen, sel);
  svg.setAttribute('aria-label', `Datelines. ${label(M)}`);
}

function onTick(ev) {
  if (!ev.target.matches('.dlhit')) return;   // VoiceOver's press clicks the image: nothing
  const r = ev.target.getBoundingClientRect(), t = M && hit(M, ev.clientX - r.left, ev.clientY - r.top);
  if (!t) return;
  const it = t.items[0], region = snap.regions[it.ri], item = region.items[it.ii];
  if (tab !== 'all' && tab !== keyOf(region)) { tab = keyOf(region); markTabs(); render(); showTab(); }
  sel = { ri: it.ri, ii: it.ii };
  drawDatelines();
  for (const n of $('pane').querySelectorAll('[aria-current]')) n.removeAttribute('aria-current');
  const row = $(`s-${it.ri}-${it.ii}`), main = $('main');
  if (row) {
    row.firstChild.setAttribute('aria-current', 'true');
    main.scrollTop += row.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
  }
  const title = item.title.trim();
  announce(spoken(`${t.items.length > 1 ? `${count(t.items.length, 'headline')} at this age. ` : ''}${region.name}, ${itemWhen(item.published)}: ${title}${/[.?!…]$/.test(title) ? '' : '.'} ${item.source || 'Its source is not named'}, ${spokenItem(M.gen, item.published)} before the file was made.`));
}

/** Sentences on the page, the first words at 620, for a region whose feeds failed or that is empty. */
function statements(r) {
  const say = (lead, text) => { const p = el('p', 'statement'); if (lead) p.append(el('b', null, lead), ' '); p.append(text); return p; };
  if (!r.items.length) return [say(null, `No headlines for ${r.name} on the last run, and none kept from an earlier one.`)];
  const feeds = (Array.isArray(snap.feeds) ? snap.feeds : []).filter((f) => f && f.region === r.name), down = feeds.filter((f) => f.ok === false);
  if (!down.length) return [];
  const note = (f) => String(f.note || 'no answer').split(';')[0];
  const notes = [...new Set(down.map(note))];
  const which = notes.length === 1 ? `${list(down.map((f) => f.id))} (${notes[0]}).` : `${list(down.map((f) => `${f.id} (${note(f)})`))}.`;
  const its = `${r.name}’${/s$/.test(r.name) ? '' : 's'}`;   // Europe’s, Americas’
  const lead = down.length === feeds.length ? `${its} feeds did not answer on the last run:` : `${down.length === 1 ? 'One' : int(down.length)} of ${its} ${count(feeds.length, 'feed')} did not answer on the last run:`;
  const kept = r.items.filter((i) => i.stale).length, n = r.items.length;
  const tail = kept === n ? (n === 1 ? 'This headline is kept from an earlier run.' : `These ${count(n, 'headline')} are kept from an earlier run.`)
    : kept ? `${int(kept)} of these ${count(n, 'headline')} ${kept === 1 ? 'is' : 'are'} kept from an earlier run.` : 'Nothing of theirs was kept from an earlier run.';
  return [say(lead, `${which} ${tail}`)];
}

/** A story: a row whose headline is the link, named by its own words and described by the source line (B12);
 *  the link's ::after covers the row, so a tap anywhere opens it, while the source line (its byline joined to
 *  it, HOUSE 11.1 rule 10) and the summary stay text after the link that VoiceOver reaches by swiping. On All
 *  a summary shows two lines; a region's own tab shows it whole. */
function story(it, ri, ii) {
  const url = safeLink(it.link), n = el('div', 'story'), hl = el(url ? 'a' : 'span', 'hl', it.title), src = el('span', 'src');
  n.id = `s-${ri}-${ii}`;
  src.id = `${n.id}-m`;
  if (url) { hl.href = url; hl.target = '_blank'; hl.rel = 'noopener noreferrer'; hl.setAttribute('aria-describedby', src.id); }
  if (sel && sel.ri === ri && sel.ii === ii) hl.setAttribute('aria-current', 'true');
  if (SRC.has(it.source)) src.append(el('i', `sw src-${SRC.get(it.source)}`));
  src.append([it.source || 'Source not named', itemWhen(it.published), it.author ? `by ${it.author}` : null].filter(Boolean).join(', '));
  if (it.stale) src.append(', ', el('span', 'lead', 'kept from an earlier run'));
  const also = (others.get(url) || []).filter((name) => name !== snap.regions[ri].name);
  if (also.length) src.append(`, also under ${list(also)}`);
  n.append(hl, src);
  if (it.summary) n.append(el('span', tab === 'all' ? 'sum clamp' : 'sum', it.summary));
  return n;
}

/* ── About ────────────────────────────────────────────────────────────── */

function aboutList() {
  const dl = $('about-list'), items = snap.regions.flatMap((r) => r.items), feeds = (Array.isArray(snap.feeds) ? snap.feeds : []).filter(Boolean);
  dl.replaceChildren();
  const add = (k, v) => dl.append(el('dt', null, `${k}:`), el('dd', null, v));
  add('Updated', full(Date.parse(snap.generatedAt)));
  add('Stale after', `${REFRESH_HOURS} hours`);
  add('Regions', int(snap.regions.length));
  add('Headlines', int(items.length));
  add('Dates without a time', int(items.filter((i) => isDateOnly(i.published)).length));
  if (feeds.length) add('Feeds', `${int(feeds.filter((f) => f.ok).length)} of ${int(feeds.length)} answered on the last run`);
  for (const f of feeds.filter((x) => !x.ok)) add(String(f.id), String(f.note || 'no answer'));
  add('In two regions or more', int([...others.values()].filter((v) => v.length > 1).length));
  const box = $('about-sources');
  box.replaceChildren();
  for (const s of Array.isArray(snap.sources) ? snap.sources : []) {
    if (!s) continue;
    const p = el('p'), lines = [s.attribution, s.licence].filter((x) => typeof x === 'string' && x);
    p.append(el('span', 'src-name', String(s.name || '')));
    for (const x of lines) p.append(el('br'), x);
    const u = safeLink(s.terms);
    if (u) {
      const a = el('a', null, u.replace(/^https?:\/\//i, ''));
      a.href = u;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      p.append(el('br'), a);
    }
    box.append(p);
  }
}

let aboutFrom = null;
function about(open) {
  $('about').hidden = !open;
  for (const id of ['head', 'main']) $(id).inert = open;           // holds Tab inside the sheet
  $('about-list').parentElement.hidden = !snap;                    // with no usable file, its prose stands
  if (open) { aboutFrom = document.activeElement; $('about-close').focus(); } else if (aboutFrom) aboutFrom.focus();
}
$('stamp').onclick = () => about(true);
$('about-close').onclick = $('about-close-2').onclick = () => about(false);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('about').hidden) about(false); });

// An empty touchstart listener, passive, so iOS draws :active (a story held, a key pressed; plan 0011's owed item).
document.addEventListener('touchstart', () => {}, { passive: true });
// A return to the screen reads the file again: the same file redraws only the stamp (load()).
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
// A new width (a phone turned on its side) redraws the Datelines alone.
let lastW = 0;
new ResizeObserver(() => {
  const w = $('pane').clientWidth;
  if (snap && w !== lastW) { lastW = w; drawDatelines(); }
}).observe($('pane'));

// The test hook (tools/shoot.mjs): inert, nothing in the app calls it.
window.__wn = {
  ready: () => !!snap && !!$('pane').querySelector('.dl'),
  pane: () => tab,
  selected: () => sel,
  datelines: () => M && { x0: M.G.x0, W: M.G.W, lo: M.lo, hi: M.hi,
    rows: M.rows.map((r) => ({ name: r.name, ticks: r.ticks.map((t) => ({ x: t.x, items: t.items.map((i) => [i.ri, i.ii, i.stale]) })) })) },
};

load();
