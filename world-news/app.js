/* World News — Snuggery mini-app.
 *
 * ---------------------------------------------------------------------------
 * SHAPE OF ./data/snapshot.json
 * ---------------------------------------------------------------------------
 * Whatever rewrites this file next year will not have read the conversation
 * that created it, so the contract lives here. Everything that changes is in
 * the JSON; this file and style.css should sit untouched for months.
 *
 * {
 *   "schema": 1,                            // bumped only on a breaking change
 *   "generatedAt": "2026-09-21T05:20:11Z",  // ISO 8601 UTC. Required. Shown.
 *
 *   "regions": [                            // six, in the order they are drawn
 *     {"key": "europe",                     // stable id, used for the tab
 *      "name": "Europe",                    // what the section is headed
 *      "stale": false,                      // true when every item is cached
 *      "items": [                           // 5-8, newest first
 *        {"title": "...",                   // plain text; trimmed unless the
 *                                           //   source forbids derivatives
 *         "source": "Global Voices",        // printed under the headline
 *         "feed": "gv-western-europe",      // which feed carried it
 *         "link": "https://...",            // opens in the reader's browser
 *         "published": "2026-09-21T08:56:27Z",
 *         "summary": "...",                 // the feed's own line, shortened;
 *                                           //   "" when the licence says no
 *         "author": "...",                  // only when the feed names one
 *         "stale": false}                   // kept from a run that failed
 *      ]}
 *   ],
 *
 *   "sources": [                            // the attribution the terms ask for
 *     {"name": "Global Voices", "attribution": "...", "licence": "...",
 *      "terms": "https://..."}
 *   ],
 *
 *   "feeds": [                              // one row per feed, this run
 *     {"id": "...", "source": "...", "region": "...", "ok": true,
 *      "items": 8, "note": null}
 *   ],
 *
 *   "ask": [                                // Snuggery's Ask reads only this
 *     {"region": "Europe", "source": "Global Voices", "title": "...",
 *      "published": "2026-09-21 08:56 UTC"}
 *   ]
 * }
 *
 * Load-bearing fields: generatedAt, and regions[] with items[] carrying title,
 * link and published. If any are missing or the wrong type this app says so on
 * screen and names the field, instead of drawing an empty page — a failed fetch
 * upstream still returns perfectly valid JSON (an API error envelope), and the
 * Shortcut writes that straight over this file without complaining.
 *
 * A NOTE ON LINKS. A Snuggery mini-app cannot reach the network: it can read
 * only the files inside its own folder. So a headline here is a link out —
 * target="_blank", which hands the address to the reader's own browser — and
 * never something this page could fetch and show inline.
 *
 * SAFETY. Everything in the snapshot is somebody else's text. It is written to
 * the page through textContent, or through esc() when it has to pass through
 * innerHTML; link addresses are accepted only when they start http:// or
 * https://, so a javascript: address in a feed cannot become a tappable link.
 */

const REFRESH_HOURS = 30;      // the job runs daily; 30 h is a missed run

const stampEl = document.getElementById('stamp');
const tabsEl = document.getElementById('tabs');
const mainEl = document.getElementById('main');
const footEl = document.getElementById('foot');
const sourcesEl = document.getElementById('sources');
const feednoteEl = document.getElementById('feednote');

let openTab = 'all';           // survives a re-render, as the conventions ask

/* ------------------------------------------------------------------ escaping */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeLink(value) {
  const url = String(value ?? '').trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

/* ------------------------------------------------------------------ problems */

function problem(title, detail, hint) {
  mainEl.innerHTML = '';
  tabsEl.innerHTML = '';
  footEl.hidden = true;
  stampEl.textContent = '';
  stampEl.classList.remove('is-stale');

  const box = document.createElement('div');
  box.className = 'problem';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  box.append(h, p);
  if (hint) {
    const q = document.createElement('p');
    q.innerHTML = hint;                      // hints are this file's own text
    box.append(q);
  }
  mainEl.append(box);
}

/* Names what is wrong rather than drawing an empty page. Returns a string to
   show, or null when the snapshot is usable. */
function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'The file parsed, but it is not an object.';
  }
  if (typeof data.generatedAt !== 'string') {
    return 'It has no `generatedAt` string, so there is no way to tell how old it is.';
  }
  if (Number.isNaN(Date.parse(data.generatedAt))) {
    return `\`generatedAt\` is "${data.generatedAt}", which is not a date this app can read.`;
  }
  if (!Array.isArray(data.regions)) {
    return 'It has no `regions` array — that is the list of sections this app draws.';
  }
  if (!data.regions.length) {
    return '`regions` is empty. The job wrote a file, but it found no headlines at all.';
  }
  for (const region of data.regions) {
    if (!region || typeof region.name !== 'string') {
      return 'One entry in `regions` has no `name`.';
    }
    if (!Array.isArray(region.items)) {
      return `The "${region.name}" region has no \`items\` array.`;
    }
    for (const item of region.items) {
      if (!item || typeof item.title !== 'string' || typeof item.published !== 'string') {
        return `A headline in "${region.name}" is missing \`title\` or \`published\`.`;
      }
    }
  }
  if (!data.regions.some((region) => region.items.length)) {
    return 'Every region is empty. No feed answered on the last run, and there was nothing cached to fall back on.';
  }
  return null;
}

/* ------------------------------------------------------------------ time */

function ageHours(iso) {
  const then = Date.parse(iso);
  return Number.isNaN(then) ? null : (Date.now() - then) / 3600000;
}

function stampText(iso) {
  const when = new Date(iso);
  const hhmm = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hours = ageHours(iso);
  if (hours === null) return `Updated ${iso}`;
  if (hours < 24) return `Updated ${hhmm}`;
  const days = Math.round(hours / 24);
  return `Updated ${when.toLocaleDateString([], { day: 'numeric', month: 'short' })}` +
         ` · ${days} day${days === 1 ? '' : 's'} ago`;
}

function whenText(iso) {
  const hours = ageHours(iso);
  if (hours === null) return '';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} min ago`;
  }
  if (hours < 24) return `${Math.round(hours)} h ago`;
  const when = new Date(iso);
  if (hours < 24 * 6) {
    return when.toLocaleDateString([], { weekday: 'short' }) + ' ' +
           when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return when.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------------ drawing */

function drawTabs(data) {
  tabsEl.innerHTML = '';
  const entries = [{ key: 'all', name: 'All', stale: false }].concat(
    data.regions.map((region) => ({
      key: String(region.key || region.name),
      name: region.name,
      stale: Boolean(region.stale),
    })),
  );
  if (!entries.some((entry) => entry.key === openTab)) openTab = 'all';

  for (const entry of entries) {
    const button = document.createElement('button');
    button.className = 'tab';
    button.type = 'button';
    button.role = 'tab';
    button.setAttribute('aria-selected', String(entry.key === openTab));
    button.textContent = entry.name;
    if (entry.stale) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.title = 'showing cached headlines';
      button.append(dot);
      button.setAttribute('aria-label', `${entry.name} — cached headlines`);
    }
    button.addEventListener('click', () => {
      openTab = entry.key;
      drawTabs(data);
      drawRegions(data);
    });
    tabsEl.append(button);
  }
}

function drawStory(item) {
  const url = safeLink(item.link);
  const node = document.createElement(url ? 'a' : 'div');
  node.className = 'story';
  if (url) {
    node.href = url;
    node.target = '_blank';                  // the reader's browser, not this page
    node.rel = 'noopener noreferrer';
  }

  const headline = document.createElement('div');
  headline.className = 'headline';
  headline.textContent = item.title;
  node.append(headline);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const src = document.createElement('span');
  src.className = 'src';
  src.textContent = item.source || 'Unknown source';
  meta.append(src);
  const when = whenText(item.published);
  if (when) meta.append(document.createTextNode(` · ${when}`));
  if (item.author) meta.append(document.createTextNode(` · ${item.author}`));
  if (item.stale) {
    const old = document.createElement('span');
    old.className = 'old';
    old.textContent = ' · cached';
    meta.append(old);
  }
  node.append(meta);

  if (item.summary) {
    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.textContent = item.summary;
    node.append(summary);
  }
  return node;
}

function drawRegions(data) {
  mainEl.innerHTML = '';
  const shown = data.regions.filter(
    (region) => openTab === 'all' || String(region.key || region.name) === openTab,
  );

  for (const region of shown) {
    const section = document.createElement('section');
    section.className = 'region';

    const heading = document.createElement('h2');
    heading.textContent = region.name;
    if (region.stale) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'cached';
      heading.append(badge);
    }
    section.append(heading);

    if (!region.items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No headlines for this region on the last run, and nothing cached to show.';
      section.append(empty);
    } else {
      for (const item of region.items) section.append(drawStory(item));
    }
    mainEl.append(section);
  }
}

function drawFooter(data) {
  sourcesEl.innerHTML = '';
  const sources = Array.isArray(data.sources) ? data.sources : [];
  for (const source of sources) {
    const li = document.createElement('li');
    const terms = safeLink(source.terms);
    // The one place markup is assembled as a string, so everything in it is
    // escaped on the way through.
    li.innerHTML = `<b>${esc(source.name)}</b> — ${esc(source.attribution || '')} ` +
      `${esc(source.licence || '')}` +
      (terms ? ` <a href="${esc(terms)}" target="_blank" rel="noopener noreferrer">Terms</a>` : '');
    sourcesEl.append(li);
  }

  const feeds = Array.isArray(data.feeds) ? data.feeds : [];
  const down = feeds.filter((feed) => feed && feed.ok === false);
  if (down.length) {
    feednoteEl.textContent =
      `${down.length} of ${feeds.length} feeds did not answer on the last run ` +
      `(${down.map((feed) => feed.id).join(', ')}). Their headlines are the ones marked “cached”.`;
    feednoteEl.hidden = false;
  } else {
    feednoteEl.hidden = true;
  }
  footEl.hidden = false;
}

function render(data) {
  const hours = ageHours(data.generatedAt);
  stampEl.textContent = stampText(data.generatedAt);
  stampEl.classList.toggle('is-stale', hours !== null && hours > REFRESH_HOURS);
  drawTabs(data);
  drawRegions(data);
  drawFooter(data);
}

/* ------------------------------------------------------------------ loading */

async function load() {
  // Snuggery re-fires visibilitychange when a Shortcut lands new data, so the
  // page redraws in place. Holding the scroll offset across that redraw is what
  // makes it a refresh rather than a jump back to the top.
  const scroll = window.scrollY;

  let response;
  try {
    response = await fetch('./data/snapshot.json', { cache: 'no-store' });
  } catch (error) {
    return problem(
      'Could not read data/snapshot.json',
      'The file is missing, or this page was opened straight off the filesystem.',
      'Serve the folder with <code>python3 -m http.server</code> — opening index.html in a browser blocks fetch() of its own data.',
    );
  }
  if (!response.ok) {
    return problem('Could not read data/snapshot.json',
                   `The file returned ${response.status}.`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    return problem(
      'data/snapshot.json is not valid JSON',
      'Something replaced it with text this app cannot read.',
      'If a Shortcut writes this file, look at what its web address actually returned — an expired token answers with an error page, not data.',
    );
  }

  const wrong = validate(data);
  if (wrong) {
    return problem('data/snapshot.json is not the shape this app expects', wrong,
      'Open the file in Snuggery — Options ⋯ → App Files — and look at what is actually in it. An API error reply is valid JSON too.');
  }

  render(data);
  window.scrollTo(0, scroll);
}

load();
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
