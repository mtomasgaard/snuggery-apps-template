// About (DESIGN §3.6, ART "Designed objects"): a full-height sheet over everything, closed by ✕ or
// Escape, scrolling inside itself, focus trapped while open. Its prose is assets/about.json's, with every
// placeholder of CONTRACT §5.3 filled from the snapshot, so no number about the data is typed here. The
// app adds only what it can count from the snapshot: the cells beyond the ±4 °C scale. Sources print
// their citations and addresses as plain text: nothing is a link. "This copy" is label: value lines,
// and five taps on the version line show the frame-time readout (DESIGN §13).

import { el, richText } from './util.js';
import { creditLine } from './readout.js';

/** A paragraph (or any element) whose proper names a translator leaves alone (util.richText). */
const rich = (tag, cls, t) => { const e = el(tag, cls); richText(e, t); return e; };
import { percent, group, monthName, MINUS, NNBSP, MON, si } from './units.js';
import { MAP_SCALE } from './ramp.js';

/** "2026-10-01T01:17:43Z" → "2026-10-01 01:17 UTC". */
const utc = (s) => (s ? s.replace('T', ' ').replace(/(:\d\d)?Z$/, ' UTC') : 'unknown');

/** Fill CONTRACT §5.3's placeholders from the snapshot. Unknown ones are kept and reported. */
export function fill(text, I, unknown = []) {
  const yearCover = (y) => { const k = I.years.indexOf(y); return k >= 0 ? percent(I.area[k], 1) : null; };
  return text.replace(/\{([A-Za-z]+)(?::([0-9a-z]+))?\}/g, (all, key, arg) => {
    let v = null;
    if (key === 'coverage') v = arg === 'last' ? percent(I.area[I.lastComplete], 1) : yearCover(+arg);
    else if (key === 'lastComplete') v = String(I.years[I.lastComplete]);
    else if (key === 'firstYear') v = String(I.years[0]);
    else if (key === 'partialLabel') v = I.partial >= 0 ? I.name[I.partial] : 'No partial year is shown at the moment.';
    else if (key === 'newestMonth') v = monthName(I.release.newestMonth, true);
    else if (key === 'releaseCreated') v = String(I.release.created).slice(0, 10);
    else if (key === 'accessed') v = I.release.retrieved || null;
    if (v == null) { unknown.push(all); return all; }
    return v;
  });
}

/**
 * Render About into box. o: { about (assets/about.json or null), idx (or null), snap, version,
 * counts: { cells (with a value in the last complete year), beyondAll, valuesAll }, onVersion }. The
 * panel's head (its title and ✕) is in index.html.
 * Returns { unknown: [placeholders left unfilled] }.
 */
export function renderAbout(box, o) {
  const { about: ab, idx: I, snap } = o, unknown = [];
  box.textContent = '';
  const add = (...n) => { for (const e of n) box.append(e); };
  const p = (t, cls) => rich('p', cls, t);
  if (!ab) { add(p('The text of this page (assets/about.json) could not be read.')); }
  for (const s of (ab && ab.sections) || []) {
    const sec = el('section'); sec.id = `ab-${s.id}`;
    sec.append(el('h3', null, s.title));
    for (const t of s.paragraphs) {
      if (!I && /\{/.test(t)) continue;                    // no snapshot: the static prose only
      sec.append(p(I ? fill(t, I, unknown) : t, s.id === 'partial' && t === '{partialLabel}' ? 'ab-label' : null));
    }
    if (s.id === 'colors' && I && o.counts) {
      // what the app can count: the cells beyond the fixed scale in the last complete year, and overall
      const k = I.lastComplete, y = I.years[k], a = I.above[k], b = I.below[k], c = o.counts;
      const hp = c.valuesAll ? Math.round((c.beyondAll / c.valuesAll) * 10000) : null;     // hundredths of a percent
      const share = hp == null ? null : `${Math.floor(hp / 100)}.${String(hp % 100).padStart(2, '0')}`;
      sec.append(p(`In ${y}, ${group(a)} of the ${group(c.cells)} cells with a value lie above +${MAP_SCALE}${NNBSP}°C and ${group(b)} below ${MINUS}${MAP_SCALE}${NNBSP}°C; they are drawn in the end colors.`
        + (share != null ? ` Across every complete year since ${I.years[0]}, ${share}${NNBSP}% of the cell values lie beyond the scale.` : '')));
    }
    if (s.id === 'revisions' && I && mixed(I)) {
      // a copy whose global means come from a newer table than its map (review R-13): said in words
      sec.append(p(`This copy mixes two of GISS’s releases. The map is the one with data to ${monthName(I.release.newestMonth, true)}; the global means and the stripes come from GISS’s table through ${monthName(I.release.tableNewestMonth, true)}, a newer release. So GISS’s own data already run to ${monthName(I.release.tableNewestMonth, true)}.`));
    }
    if (s.id === 'citations') {
      // the credit constant first (HOUSE §4.15: it left the legend in plan 0012), then the climatology's
      const head = sec.querySelector('h3'), cl = o.clim && o.clim.source;
      if (cl) head.after(p(cl.attribution, 'ab-credit'));
      if (I) { const c = p(creditLine(I.attribution), 'ab-credit'); c.id = 'about-credit-line'; c.translate = false; head.after(c); }
      sources(sec, I, snap, ab, cl);
    }
    if (s.id === 'this-copy') thisCopy(sec, I, o);
    add(sec);
  }
  if (!ab) { const sec = el('section'); sources(sec, I, snap, null, o.clim && o.clim.source); thisCopy(sec, I, o); add(sec); }
  return { unknown };
}

function sources(sec, I, snap, ab, cl) {
  const block = (title, lines) => {
    const d = el('div', 'ab-src');
    d.append(rich('h4', null, si(title)));
    for (const [t, cls] of lines) if (t) d.append(rich('p', cls || null, cls === 'ab-addr' ? t : si(t)));
    sec.append(d);
  };
  for (const s of (snap && snap.sources) || []) {
    block(s.name, [[s.owner], [s.licence], [s.attribution], ...(s.citation || []).map((c) => [c, 'ab-cite']),
      [s.url, 'ab-addr'], [s.via ? `Read through: ${s.via}.` : null], [s.readAt ? `Read ${utc(s.readAt)}.` : null], [s.use ? `Used for ${s.use}.` : null]]);
  }
  if (cl) block(cl.name, [[cl.owner], [cl.licence], ...(cl.citation || []).map((c) => [c, 'ab-cite']), [cl.url, 'ab-addr'], [cl.use ? `Used for ${cl.use}.` : null]]);
  for (const s of (ab && ab.static) || []) block(s.name, [[s.credit], [s.licence], [s.url, 'ab-addr']]);
  if (ab && ab.endorsement) {
    const e = el('p', 'ab-endorse'), i = ab.endorsement.indexOf('.') + 1;
    e.append(el('b', null, ab.endorsement.slice(0, i)), ab.endorsement.slice(i));
    sec.append(e);
  }
}

function thisCopy(sec, I, o) {
  const lines = [['Version', o.version || 'unknown']];
  if (I) {
    const r = I.release;
    lines.push(['Data file made', utc(I.generatedAt)]);
    lines.push(['GISS release', `created ${String(r.created).replace('T', ' ')}`]);
    lines.push(['Newest month', monthName(r.newestMonth, true)]);
    if (mixed(I)) lines.push(['Global means', `GISS’s table through ${monthName(r.tableNewestMonth, true)}, a newer release than the map’s`]);
    lines.push(['Read from', r.mode === 'research' ? 'the Internet Archive’s copies of GISS’s files (GISS’s server did not answer)' : 'GISS’s own server']);
    lines.push(['Accessed', r.retrieved || 'unknown']);
    lines.push(['Years', `${I.years[0]}–${I.years[I.lastComplete]}${I.partial >= 0 ? `, and ${I.name[I.partial]}` : ''}`]);
    lines.push(['Months', `${monthName(I.monthKeys[0], true)} to ${monthName(I.monthKeys[I.nm - 1], true)}`]);
    lines.push(['Base period', I.baseText]);
  }
  const d = el('div', 'ab-copy');
  for (const [k, v] of lines) {
    if (k === 'Version') {
      const b = el('button', 'ab-ver', `${k}: ${v}`); b.type = 'button';
      b.setAttribute('aria-label', `${k} ${v}. Five taps show the frame-time readout.`);
      let taps = [];
      b.addEventListener('click', () => { const t = performance.now(); taps = taps.filter((q) => t - q < 3000).concat(t); if (taps.length >= 5) { taps = []; if (o.onVersion) o.onVersion(); } });
      d.append(b);
    } else d.append(rich('p', null, `${k}: ${v}`));
  }
  sec.append(d);
}

/** True when the snapshot's global means come from a newer GISS table than its map (research mode). */
const mixed = (I) => /^\d{4}-\d{2}$/.test(I.release.tableNewestMonth || '') && I.release.tableNewestMonth > I.release.newestMonth;
/** "data to July 2026": a copy named by its newest month, never as "the July release", which reads as
 *  published in July (review R-14): GISS makes each release about the 10th of the month after. */
export const dataTo = (I) => `data to ${monthName(I.release.newestMonth, true)}`;

/** The top bar's stamp (Global Weather's "Updated" pattern): the data's newest month, and how this copy was made. */
export function stampText(I) {
  const d = new Date(I.generatedAt);
  const when = Number.isFinite(d.getTime()) ? `${MON[d.getMonth()]} ${d.getDate()}` : I.generatedAt.slice(0, 10);
  // one line (§20 Q-6): a research copy says so; a live one says when it was made. The date of a
  // research copy is in About, under "This copy".
  return {
    release: `Data to ${monthName(I.release.newestMonth, true)}`,
    tail: I.release.mode === 'research' ? ', archived copy' : `, updated ${when}`,
    spoken: I.release.mode === 'research' ? `read from an archived copy, made ${when}` : `updated ${when}`,
  };
}
