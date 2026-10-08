// Static checks for World News (HOUSE.md section 7.1; ART.md; tools/DECISIONS.md, item 12). Node, no
// dependencies but python3 for tools/art/palette.py; Finances' tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( is relative, inside the folder, present; the one data read;
//   4. js/ holds the two modules, fonts/ the house face and its OFL.txt at the sha256 HOUSE.md pins, and no
//      supplement; NOTES.md and About credit the face word for word;
//   5. the data's shape as scripts/world_news.py writes it, and every source's license line swept to US English
//      (the data follow-up, owner call 2); any file the hourly refresh writes passes; the fixed day the tests read,
//      tools/fixtures/snapshot.json, pinned by sha256;
//   6. miniapp.json is valid, its name unchanged, its description neither "today's" (B13) nor an em dash, its
//      version 1.2 (plan 0012 package 4's pass, from 1.1; HOUSE 13);
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credits: the constant words around the sources' names, written once into About's first paragraph under
//      Sources and credits; no credit line on the front (HOUSE 4.15; plan 0012 F1, F8);
//   9. the marketing camera's strings (HOUSE.md 7.4): Europe and Americas as tabs built from the data's regions
//      after the snapshot parses, named by their visible words only (B5); no storage at all;
//  10. SI and the dates: no plain space between a digit and a unit in the app's strings; toFixed and
//      toLocale* nowhere, no Intl (B1); the date-only rule (B11);
//  11. no transition anywhere, and only the house's two animations (the tracer, About);
//  12. innerHTML never set (the stock had 6 assignments, 2 of them markup from strings); no insertAdjacentHTML,
//      outerHTML, document.write, eval or new Function;
//  13. palette.py passes, and its --json tokens are style.css's (the seven chrome tokens and the register's three);
//  14. the look: the chrome tokens exactly in both themes, no accent, warning or stock token; no box-shadow,
//      backdrop-filter, `transition: all`, uppercase, letter-spacing, monospace; one family, and every font
//      string in a script names "Ysabeau Office" first; no middle dot or em dash in the app's own strings; no
//      →, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included; both theme-color metas; the @font-face
//      rule; the page's language and viewport; the pane apps' type scale (HOUSE 11.1 rule 2);
//  15. the bugs on record (B1 to B16, tools/DECISIONS.md) stay fixed in the code;
//  16. budgets: app code at most 200,000 bytes, fonts/ at most 160,000, the ZIP built exactly as build-zips.yml
//      builds it at most 107,530 (the house rule for plan 0012 package 4: 86,024 before the pass × 1.25);
//  17. US spelling in every shipped text file; the headlines and summaries are the publishers' words and are
//      read as information, never failed;
//  18. the pane-app register (HOUSE 11; plan 0012 P1 to P9): no band; every pane ends with the About key; the pane
//      pads the home indicator; sections on plates, rings and halos in --sheet; the sources' colors on the chosen
//      rows' ticks and the swatches; the byline joined to the source line; All's summaries clamped; the header
//      centered with the pane; a passive touchstart listener;
//  and, as information: any character in today's headlines the face's cut does not draw (HOUSE.md 2.3, rule 3).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const info = (msg) => console.log(`info ${msg}`);
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
// ZIP_CAP: the lead's ruling for plan 0012 package 4, the house rule (the ZIP before the pass, 86 024 B with that day's
// data, × 1.25), which is above the app's own 88 000 B of plan 0011 D30, so the cap rises to it (tools/DECISIONS.md)
const CODE_CAP = 200000, FONT_CAP = 160000, ZIP_CAP = 107530;
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const htmlText = (src) => code(src, 'x.html').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, "'");

// 1. What the ZIP ships
const shipped = [];
let maxDepth = 0, symlinks = 0, biggest = ['', 0], total = 0;
(function walk(dir, depth) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name), rel = path.relative(APP, abs);
    if (depth === 0 && e.isDirectory() && EXCLUDE.has(e.name)) continue;
    if (e.isSymbolicLink()) { symlinks++; continue; }
    if (e.isDirectory()) { maxDepth = Math.max(maxDepth, depth + 1); walk(abs, depth + 1); continue; }
    const size = fs.statSync(abs).size;
    shipped.push(rel); total += size;
    if (size > biggest[1]) biggest = [rel, size];
  }
})(APP, 0);
ok(shipped.length <= 10000 && maxDepth <= 16 && symlinks === 0 && biggest[1] <= 128 * 2 ** 20 && total <= 512 * 2 ** 20,
  `files: ${shipped.length} shipped, ${fmt(total)} bytes, folder depth ${maxDepth}, ${symlinks} symlinks, largest ${biggest[0]} ${fmt(biggest[1])} bytes`);

// 2. No URL in the app's own code
const web = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const withUrls = web.filter((f) => /https?:\/\//i.test(read(f)));
ok(withUrls.length === 0, `no http(s):// in ${web.length} .html/.css/.js files${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);

// 3. References: relative, inside the folder, present; the one data read
const app = read('app.js'), html = read('index.html'), css = read('style.css');
const mods = ['js/units.js', 'js/datelines.js'];
{
  const refs = [];
  for (const f of web) {
    const src = code(read(f), f);
    for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) if (!m[1].startsWith('data:')) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"`]([^'"`$]+)['"`]/g)) if (!m[1].startsWith('data:')) refs.push([f, m[1], '.']);
  }
  const bad = refs.filter(([f, r, dir]) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
    const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
    return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
  });
  ok(bad.length === 0 && refs.length >= 5, `references: ${refs.length} (imports, src, href, url(), fetch()): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} to ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
  const dataPaths = [...new Set(web.flatMap((f) => [...code(read(f), f).matchAll(/\.\/data\/[\w./-]+/g)].map((m) => m[0])))];
  ok(/const DATA_URL = '\.\/data\/snapshot\.json';/.test(app) && /fetch\(`\$\{DATA_URL\}\?t=\$\{Date\.now\(\)\}`/.test(app) && JSON.stringify(dataPaths) === '["./data/snapshot.json"]',
    `the data read: ${dataPaths.join(', ')} through DATA_URL, and nothing else`);
}

// 4. js/ and fonts/ hold exactly the contract's files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('js', ['datelines.js', 'units.js']);
exactly('fonts', ['OFL.txt', 'ysabeau-office-gw.woff2']);
exactly('data', ['snapshot.json']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/no font ships|system font only|No web font/i.test(read('NOTES.md') + css),
  'the face is credited word for word in NOTES.md (the app\'s credits file) and About ("Type: …"); nothing says no font ships');

// 5. The data's shape, not its bytes (plan 0012, package 4's "do first"). The hourly refresh rewrites
// data/snapshot.json, so a sha256 pin (the file committed before plan 0011's pass, its license lines swept)
// failed on every fresh file. What the pin guarded is checked instead, on any file the bot writes: the shape
// scripts/world_news.py writes (schema 1, generatedAt, regions[] with their items, sources[], feeds[],
// ask[] of at most 60 rows), and every source's license line swept (US English, no spaced em dash: the
// data follow-up of 2026-10-02, owner call 2). tools/fixtures/snapshot.json keeps that pinned file for the
// tests that need one fixed day (shoot.mjs and test_datelines.mjs pin it by sha256).
const snap = JSON.parse(read('data/snapshot.json'));
{
  const why = [];
  const str = (v) => typeof v === 'string' && v.length > 0;
  const iso = (v) => str(v) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v) && Number.isFinite(Date.parse(v));
  if (snap.schema !== 1) why.push('schema is not 1');
  if (!iso(snap.generatedAt)) why.push('generatedAt is not an ISO 8601 UTC instant');
  if (JSON.stringify(Object.keys(snap)) !== JSON.stringify(['schema', 'generatedAt', 'regions', 'sources', 'feeds', 'ask'])) why.push(`its keys are ${Object.keys(snap).join(', ')}`);
  const regions = Array.isArray(snap.regions) ? snap.regions : [];
  if (!regions.length) why.push('no regions');
  for (const r of regions) {
    if (!r || !str(r.key) || !str(r.name) || typeof r.stale !== 'boolean' || !Array.isArray(r.items)) { why.push(`a region is not { key, name, stale, items[] }`); continue; }
    for (const it of r.items) {
      if (!it || !str(it.title) || !str(it.source) || !str(it.feed) || !str(it.link) || !iso(it.published) || typeof it.summary !== 'string' || typeof it.stale !== 'boolean'
        || ('author' in it && typeof it.author !== 'string')) why.push(`an item in ${r.name} is not { title, source, feed, link, published, summary, author?, stale }`);
    }
  }
  const sources = Array.isArray(snap.sources) ? snap.sources : [];
  if (!sources.length) why.push('no sources');
  const BRIT_LINE = /\blicence\b|\s\u2014\s/;
  for (const x of sources) {
    if (!x || !str(x.name) || !str(x.attribution) || !str(x.licence) || !/^https:\/\//.test(x.terms || '')) why.push(`a source is not { name, attribution, licence, terms (https) }`);
    else if (BRIT_LINE.test(x.attribution) || BRIT_LINE.test(x.licence)) why.push(`${x.name}'s lines are not swept (a "licence" or a spaced em dash inside them)`);
  }
  const used = new Set(regions.flatMap((r) => (r.items || []).map((it) => it.source)));
  if ([...used].some((n) => !sources.some((x) => x && x.name === n))) why.push('a headline names a source sources[] does not credit');
  const feeds = Array.isArray(snap.feeds) ? snap.feeds : [];
  if (!feeds.length || feeds.some((f) => !f || !str(f.id) || !str(f.source) || !str(f.region) || typeof f.ok !== 'boolean' || !Number.isInteger(f.items) || !(f.note === null || typeof f.note === 'string'))) why.push('feeds[] is not { id, source, region, ok, items, note } rows');
  const ask = Array.isArray(snap.ask) ? snap.ask : null;
  if (!ask || ask.length > 60 || ask.some((a) => !a || !str(a.region) || !str(a.source) || !str(a.title) || !/^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(a.published || ''))) why.push('ask[] is not at most 60 { region, source, title, published } rows');
  ok(why.length === 0, `data/snapshot.json: the shape scripts/world_news.py writes (schema 1, made ${snap.generatedAt}, ${regions.length} regions, ${regions.reduce((n, r) => n + ((r && r.items) || []).length, 0)} headlines, ${sources.length} sources, ${feeds.length} feeds, ${ask ? ask.length : 0} ask rows), every source's license line swept; any file the hourly refresh writes passes${why.length ? ': ' + [...new Set(why)].slice(0, 4).join('; ') : ''}`);
  const FIXTURE_SHA = 'ecb808729f4562dfe98f324aaef3a54ffaeebef03982c62348ab6f8f910c5d2c';
  ok(fs.existsSync(path.join(APP, 'tools/fixtures/snapshot.json')) && sha('tools/fixtures/snapshot.json') === FIXTURE_SHA,
    `tools/fixtures/snapshot.json is the pinned file of 1 Oct 2026 (${FIXTURE_SHA.slice(0, 12)}…), the fixed day shoot.mjs and test_datelines.mjs read; it does not ship`);
}

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'World News' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && !/—|today/i.test(mini.description) && mini.version === '1.2',
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters, not "today's" (B13), no em dash`);
}

// 7. No AI vendor or model name in shipped text (Global Weather's list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
{
  const named = texts.filter((f) => namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files, the snapshot's headlines included${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credits: the constant words around the file's source names, written once into About's first paragraph
// under Sources and credits (HOUSE 4.15; plan 0012 F1, F8). The one constant a list changed: its closing words
// pointed to About and meant nothing inside it, so '; terms in About.' became '.'.
{
  const CREDIT = "const CREDIT = ['Headlines from ', '.'];";
  const built = /\$\('about-credit-line'\)\.textContent = `\$\{CREDIT\[0\]\}\$\{names\.length \? list\(names\) : 'the publishers named under each story'\}\$\{CREDIT\[1\]\}`;/.test(app);
  const sources = html.slice(html.indexOf('<h3>Sources and credits</h3>'));
  ok(app.includes(CREDIT) && built && (app.match(/\$\('about-credit-line'\)/g) || []).length === 1 && sources.startsWith('<h3>Sources and credits</h3>\n        <p id="about-credit-line" translate="no"></p>')
    && !/id="credits"|class="credits"|id="band"|id="capline"/.test(html) && !/\$\('credits'\)|\$\('capline'\)|\$\('band'\)|'band'/.test(code(app, 'x.js')) && !/\.band\b|\.capline\b|\.credits\b/.test(code(css, 'x.css')),
    `the credits: "Headlines from ${snap.sources.map((s) => s.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}." built from the file's sources in order, written once into <p id="about-credit-line">, About's first paragraph under Sources and credits; no band, caption line or credit line on the front`);
  // nothing else on the front carries a credit: the stories' source names are the view's own (HOUSE 4.15)
  const front = code(html.slice(0, html.indexOf('<div class="about"')), 'x.html');
  ok(!/Global Voices|The Conversation|UN News|Creative Commons|licen[cs]e|Ysabeau/i.test(front), 'nothing on the front\'s static markup names a source, a license or the face (HOUSE 4.15)');
}

// 9. The marketing camera's strings (HOUSE.md 7.4) and storage
{
  const build = (app.match(/function buildTabs\(\) \{[\s\S]*?\n\}/) || [''])[0];
  const fromData = /\['all', 'All', false\], \.\.\.snap\.regions\.map\(\(r\) => \[keyOf\(r\), r\.name, !!r\.stale\]\)/.test(build) && /el\('button', null, name\)/.test(build) && /b\.setAttribute\('role', 'tab'\)/.test(build);
  const afterParse = /const why = validate\(d\);[\s\S]*?snap = d;[\s\S]*?boot\(\);/.test(app) && /stamp\(\);\s*buildTabs\(\);/.test(app);
  const names = snap.regions.map((r) => r.name);
  ok(fromData && afterParse && !/aria-label/.test(build) && names.includes('Europe') && names.includes('Americas') && !/>\s*(Europe|Americas)\s*</.test(code(html, 'x.html'))
    && /<nav class="tabs" id="tabs" role="tablist" aria-label="Regions" hidden><\/nav>/.test(html),
    'camera: Europe and Americas are <button role="tab"> named by their visible words alone, built by buildTabs() from the data\'s regions after the snapshot parses and validates; the static markup holds no tab (B5)');
  ok(!/localStorage|sessionStorage|indexedDB/.test(web.map((f) => code(read(f), f)).join('\n')), 'storage: none, as before the pass (the app opens on All and stores nothing)');
}

// 10. SI and the dates in what the app writes; no toFixed, toLocale* or Intl
{
  const UNIT = /\d (h|d|min|%|UTC)(?![\w/])/;
  const files = ['index.html', 'app.js', ...mods];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [htmlText(read(f)).replace(/05:20 UTC/, '')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const locale = [];
  for (const f of ['app.js', ...mods]) code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString|toLocaleDateString|toLocaleTimeString)\(|\bIntl\.|en-GB|nb-NO/.test(l)) locale.push(`${f}:${i + 1}`); });
  ok(locale.length === 0, `dates by hand: no toLocale*, toFixed, Intl, en-GB or nb-NO in the app (B1)${locale.length ? ': ' + locale.join(', ') : ''}`);
  const u = read('js/units.js');
  ok(/export const isDateOnly = \(iso\) => \/T\(00\|12\):00:00/.test(u) && /if \(!isDateOnly\(iso\)\) return `\$\{dayMon\(ms, now\)\}, \$\{clock\(ms\)\}`;/.test(u) && /getUTCDate\(\)/.test(u) && !/ago`|h ago|min ago/.test(app + u),
    'the date-only rule: a stamp at exactly 00:00:00 or 12:00:00 UTC prints its UTC date alone; no relative "ago" counted from the phone (B11)');
}

// 11. Motion: no transition at all; only the tracer and About animate, both under Reduce Motion
{
  const c = code(css, 'x.css');
  const anims = [...c.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]).sort();
  ok(!/transition\s*:/.test(c) && JSON.stringify(anims) === '["sheet-in","tracer-in"]' && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important; transition-duration: 0s !important;/.test(c)
    && !/behavior: 'smooth'|scrollTo\(\{/.test(app),
    `motion: no transition, the house's two animations (${anims.join(', ')}), every duration 0 s under Reduce Motion; the scroll to a story is instant; the Datelines never move`);
}

// 12. innerHTML never set
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)/g)) uses.push([f, m[1]]);
  ok(uses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses (6 before the pass, 2 of them markup from strings); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. palette.py passes, and its tokens are style.css's
const TOK = {
  light: { '--page': '#e8eef0', '--sheet': '#f6f9fa', '--ink': '#0f1c23', '--ink-2': '#45555d', '--ink-3': '#5b6a72', '--line': '#c9d4d8', '--line-strong': '#74858c' },
  dark: { '--page': '#141d21', '--sheet': '#1c272c', '--ink': '#e6edee', '--ink-2': '#a3b1b6', '--ink-3': '#8b9a9f', '--line': '#2a373c', '--line-strong': '#64757b' },
};
const c0 = code(css, 'x.css');
const blockOf = (scheme) => (scheme === 'light' ? c0.slice(c0.indexOf(':root {'), c0.indexOf('@media (prefers-color-scheme: dark)')) : c0.slice(c0.indexOf('@media (prefers-color-scheme: dark)'), c0.indexOf('* { box-sizing')));
const tok = (scheme, name) => (blockOf(scheme).match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  let PAL = null;
  try { PAL = JSON.parse(json.stdout); } catch { PAL = null; }
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries((PAL || {})[s] || {})) if (tok(s, k) !== v) off.push(`${s} ${k}`);
  ok(PAL && off.length === 0 && Object.keys(PAL.light).length === 10 && Object.keys(PAL.dark).length === 10,
    `style.css's 10 tokens per theme equal palette.py --json (the seven chrome tokens and the register's --src-1 to --src-3, HOUSE 11.2; ART.md section 2)${off.length ? ': differ ' + off.join(', ') : ''}`);
  const REG = { light: { '--src-1': '#1f5f99', '--src-2': '#a64a1a', '--src-3': '#6d2736' }, dark: { '--src-1': '#8cbcf0', '--src-2': '#f0a070', '--src-3': '#ab8198' } };
  const regOff = [];
  for (const sc of ['light', 'dark']) for (const [k, v] of Object.entries(REG[sc])) if (tok(sc, k) !== v) regOff.push(`${sc} ${k} ${tok(sc, k)}`);
  ok(regOff.length === 0, `the register's tokens by name and value (HOUSE 11.2; --src-3 the lead's wine / mauve, not the board's purple): ${Object.entries(REG.light).map(([k, v]) => `${k} ${v} / ${REG.dark[k]}`).join(', ')}${regOff.length ? '; differ ' + regOff.join(', ') : ''}`);
}

// 14. The look
{
  const c = c0;
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|font-variant\s*:\s*small-caps|Georgia|serif\b(?<!sans-serif)/, 'monospace, small capitals or a serif'], [/linear-gradient\(\s*(?:to |180deg|0deg)/, 'a gradient wash']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace, small capitals, serif or gradient wash${found.length ? ': ' + found.join(', ') : ''} (B10)`);
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} ${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--stale|--critical|--surface|--radius|--hairline|--text-|--on-accent|--glass|--shadow/.test(c + app),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page; no accent, stale, critical or stock token (B2, B10)${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const fontStrings = [app, ...mods.map(read)].flatMap((s) => strings(s)).filter((s) => /\d(\.\d+)?px\b/.test(s));
  ok(families.length === 1 && families[0] === "'Ysabeau Office'" && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro|BlinkMac)/.test(c) && fontStrings.length >= 2 && fontStrings.every((s) => /^.\d{3} \d+(\.\d+)?px "Ysabeau Office"/.test(s)),
    `one family: one @font-face rule of 'Ysabeau Office', used through --face; every font string in a script names "Ysabeau Office" first (${fontStrings.join(', ')})`);
  const dots = [], dashes = [];
  for (const f of ['app.js', ...mods]) for (const s of strings(read(f))) {
    if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
    if (s.includes('—')) dashes.push(`${f}: ${s.slice(0, 50)}`);
  }
  if (/·/.test(htmlText(html))) dots.push('index.html');
  if (/—|&mdash;/.test(code(html, 'x.html'))) dashes.push('index.html');
  ok(dots.length === 0 && dashes.length === 0, `no middle dot and no em dash in any string the app writes (tells 6 and 7; the data's own are shown as written)${dots.length + dashes.length ? ': ' + [...dots, ...dashes].join(' | ') : ''}`);
  const arrows = [];
  for (const f of [...web, ...shipped.filter((x) => /\.md$/.test(x))]) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? htmlText(src) + code(src, f) : f.endsWith('.css') ? code(src, f) : src;
    if (/[→➤▸▾▴ⓘ⋯]|&rarr;/i.test(lit)) arrows.push(f);
    if (!f.endsWith('.md') && /\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included (B7, B15), and no "..." in the app's${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, '--page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', '--page')} / ${tok('dark', '--page')}) (B16)`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, '@font-face: the house rule word for word, and no other');
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module (B16)');
  const px = [...c.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const offScale = px.filter((v) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 19, 21, 34].includes(v));
  const weights = [...c.replace(/@font-face \{[^}]*\}/, '').matchAll(/font-weight:\s*(\d+)|font:\s*(\d{3}) /g)].map((m) => Number(m[1] || m[2]));
  ok(offScale.length === 0 && !px.some((v) => v === 21 || v === 34 || v === 12) && weights.every((w) => [400, 560, 600, 620, 650].includes(w)),
    `type: sizes ${[...new Set(px)].sort((a, b) => a - b).join(', ')} px, on the pane apps' scale (HOUSE 11.1 rule 2); no 12 px, and no key number (34 px) or figure at 21 px: the subject is headlines (HOUSE 11.1 rule 2; ART.md section 4); weights ${[...new Set(weights)].join(', ')}${offScale.length ? ': off the scale ' + offScale.join(', ') : ''}`);
}

// 15. The bugs on record (the art pass's stranger's run, B1 to B16; tools/DECISIONS.md) stay fixed in the code
{
  const B = [
    ['B2 stale is a sentence in ink, never a color, a dot or a badge', /el\('span', 'lead', 'Stale\.'\)/.test(app) && /\.stamp \.lead \{ color: var\(--ink\); \}/.test(css) && !/\.dot|\.badge|is-stale|'cached'/.test(app + css)],
    ['B3 the stamp is a button opening About, and a broken file never empties it once one was read', /<button class="stamp" id="stamp" type="button" aria-haspopup="dialog" aria-describedby="stamp-hint">/.test(html) && /\$\('stamp'\)\.onclick = \(\) => about\(true\);/.test(app) && /if \(snap\) \{[\s\S]{0,400}Still showing the headlines from/.test(app)],
    ['B4 <main> is not a live region; one polite live region', /<main class="pane" id="main">/.test(html) && (html.match(/aria-live/g) || []).length === 1 && /<p class="sr" id="live" aria-live="polite"><\/p>/.test(html)],
    ['B5 a stale region\'s tab keeps its name; its state is a description', /if \(stale\) b\.setAttribute\('aria-describedby', 'kept-hint'\);/.test(app) && !/cached headlines/.test(app)],
    ['B6 a broken replacement keeps the view', /if \(snap\) \{(?:(?!\} else \{)[\s\S])*box\.classList\.add\('kept'\);\s*\} else \{/.test(app) && !/if \(snap\) \{(?:(?!\} else \{)[\s\S])*(replaceChildren\(\);|tabs'\)\.hidden)/.test(app.slice(app.indexOf('function fail(')))],
    ['B7 notices: no backtick, no code face, no red, no server hint, words for the menu', !/`[a-zA-Z]+`/.test(strings(app).filter((s) => !s.startsWith('`')).join('')) && !/<code|http\.server|--critical/.test(app + css) && /'In Snuggery, Options, then App Files shows what the file holds\.'/.test(app)],
    ['B11 dates by the date-only rule, no relative ages from the phone', /itemWhen\(it\.published\)/.test(app) && !/ageHours|Date\.now\(\) - then/.test(app)],
    ['B12 a story is named by its headline (the link holds the headline alone, stretched over the row), described by its source line; no "Terms" links', /hl = el\(url \? 'a' : 'span', 'hl', it\.title\)/.test(app) && /hl\.setAttribute\('aria-describedby', src\.id\);/.test(app) && /\.story a::after \{ content: ''; position: absolute; inset: 0; \}/.test(css) && !/'Terms'|>Terms</.test(app + html)],
    ['B13 no "today\'s headlines" in shipped text', !texts.filter((f) => !f.startsWith('data/')).some((f) => /today'?s headlines|eight of today/i.test(read(f)))],
    ['B14 cross-filed stories say so', /also under \$\{list\(also\)\}/.test(app)],
    ['B16 the pane scrolls inside the frame; the same file redraws only the stamp', /\.pane \{[^}]*overflow-y: auto;/.test(css) && /if \(snap && d\.generatedAt === snap\.generatedAt\) \{ stamp\(\); return; \}/.test(app) && !/position: sticky/.test(css)],
  ];
  const bad = B.filter(([, okk]) => !okk).map(([n]) => n);
  ok(bad.length === 0, `the bugs on record stay fixed in the code: ${B.length} checked here (B1, B10, B15, B16's page above; B6, B8, B9 by shoot.mjs)${bad.length ? '; failing: ' + bad.join('; ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...mods];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's; 46,119 before plan 0012's pass, 21,787 before plan 0011's): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)}; none before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'world-news.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => /^(tools|screenshots|scripts)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data ${fmt(stored((n) => n.startsWith('data/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, ART.md ${fmt(stored((n) => n === 'ART.md'))}, NOTES.md and PROMPT.md ${fmt(stored((n) => n === 'NOTES.md' || n === 'PROMPT.md'))}`);
ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}: the house rule for plan 0012 package 4, 86,024 before the pass × 1.25; it was 88,000, plan 0011 D30)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). The snapshot
// is checked for the pipeline's own words (sources' lines, region names); its headlines, summaries and bylines
// are the publishers' and are listed, never failed. `licence` is the pipeline's data key, so app.js and ART.md
// may name it and the data may hold it as a key alone; since the data follow-up (owner call 2) the license lines
// themselves say `license`, so a `licence` inside a line fails.
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|behaviour\w*|recognis\w*|organis\w*|analys(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|judgement\w*|for ever|amortis\w*|authoris\w*|categoris\w*|instalments?|artefacts?|cosy|cancell\w*)\b/gi;
  const ALLOW = { 'app.js': ['licence'], 'ART.md': ['licence'] };
  // NOTES.md quotes The Conversation's own words; the data's `licence` is passed over as the key itself, nowhere else.
  const PHRASES = { 'NOTES.md': ['Attribution/No derivatives licence'], 'data/snapshot.json': ['"licence":'] };
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    const allow = ALLOW[f] || [];
    const body = f === 'data/snapshot.json' ? JSON.stringify([snap.sources, snap.regions.map((r) => r.name), snap.feeds]) : read(f);
    body.split('\n').forEach((line, i) => {
      let l = line;
      for (const p of PHRASES[f] || []) l = l.split(p).join('');
      for (const m of l.matchAll(BRIT)) if (!allow.includes(m[0])) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files, the pipeline's own words in the snapshot included${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
  const theirs = [...new Set(snap.regions.flatMap((r) => r.items.flatMap((it) => [it.title, it.summary, it.author].join(' ').match(BRIT) || [])))];
  info(`the publishers' own spellings in today's headlines and summaries, shown as written: ${theirs.join(', ') || 'none'}`);
}

// 18. The pane-app register (HOUSE 11.1; plan 0012 P1 to P9)
{
  const c = code(css, 'x.css'), a = code(app, 'x.js');
  ok(/const ABOUT_KEY = 'Sources, their terms and credits are in About\.';/.test(app) && /function aboutKey\(host\) \{\s*const b = el\('button', 'aboutlink', ABOUT_KEY\);\s*b\.type = 'button';\s*b\.onclick = \(\) => about\(true\);\s*host\.append\(b\);\s*\}/.test(app)
    && /\n  aboutKey\(pane\);\n\}/.test(app) && (a.match(/aboutKey\(/g) || []).length === 2
    && /\.aboutlink \{ display: block; margin: 14px 0 0; min-height: 44px; font-size: 12\.5px; color: var\(--ink-2\); text-decoration: underline; text-underline-offset: 3px; \}/.test(c),
  'every pane ends with the button "Sources, their terms and credits are in About.", 12.5 px --ink-2, underlined at 3 px, 44 px tall, 14 px under the last plate, opening About (render() adds it last, on All and on every region)');
  ok(/\.panebody \{[^}]*padding-top: 4px; padding-bottom: calc\(28px \+ env\(safe-area-inset-bottom\)\); \}/.test(c) && (c.match(/\.panebody \{/g) || []).length === 1,
    'the pane pads the home indicator itself: .panebody { padding-top: 4px; padding-bottom: calc(28px + env(safe-area-inset-bottom)) } (HOUSE 4.14, 11.1 rule 1; a phone row checks it)');
  ok(/\.sec \{ margin-top: 12px; padding: 12px 12px 4px; border: 1px solid var\(--line\); border-radius: 8px; background: var\(--sheet\); \}/.test(c) && /\.dl \.sel \{ stroke: var\(--sheet\);/.test(c) && /\.dl \.cnt \{[^}]*stroke: var\(--sheet\);/.test(c) && !/var\(--page\)/.test(c.replace(/html, body \{[^}]*\}/, ''))
    && /el\('section', 'sec lead-sec'\)/.test(app) && /const host = el\('section', 'sec'\), head = el\('div', 'sec-head'\);/.test(app),
    'sections on plates (--sheet, a 1 px --line edge, radius 8 px, padding 12 px, 12 px apart): the Datelines with their label and All\'s source table, then each region; the tapped tick\'s ring and the counts\' halos in --sheet (HOUSE 11.1 rule 4)');
  ok(/\.dl \.row\.on \.tk\.src-1 \{ fill: var\(--src-1\); \}\n\.dl \.row\.on \.tk\.src-2 \{ fill: var\(--src-2\); \}\n\.dl \.row\.on \.tk\.src-3 \{ fill: var\(--src-3\); \}/.test(c) && !/\.dl \.tk \{[^}]*width/.test(c)
    && /class: SRC\.has\(it\.src\) \? `tk src-\$\{SRC\.get\(it\.src\)\}` : 'tk', x: x - 1, y: top, width: 2, height: h/.test(read('js/datelines.js'))
    && /if \(SRC\.has\(it\.source\)\) src\.append\(el\('i', `sw src-\$\{SRC\.get\(it\.source\)\}`\)\);/.test(app),
    'the sources\' colors: the chosen rows\' ticks (a region\'s tab colors its own row and leaves the others --ink-3), the swatch on each source line and in All\'s table; the ticks stay 2 px wide, as draw() sets them (HOUSE 11.3)');
  ok(/it\.author \? `by \$\{it\.author\}` : null/.test(app) && !/'by', `By/.test(app) && /el\('span', tab === 'all' \? 'sum clamp' : 'sum', it\.summary\)/.test(app) && /\.sum\.clamp \{ display: -webkit-box; -webkit-line-clamp: 2;/.test(c),
    'the byline joins its source line, word for word; a summary shows two lines on All and whole on its region (HOUSE 11.1 rule 10; the words are unchanged)');
  ok(/\.head \{[^}]*calc\(max\(16px, 50% - 364px\) \+ env\(safe-area-inset-right\)\) 0 calc\(max\(16px, 50% - 364px\) \+ env\(safe-area-inset-left\)\); \}/.test(c) && /\.panebody \{ max-width: 760px; margin: 0 auto; padding: 0 calc\(16px \+ env\(safe-area-inset-right\)\) 0 calc\(16px \+ env\(safe-area-inset-left\)\);/.test(c),
    'the header centered with the pane: its sides max(16 px, 50 % − 364 px), so the name and the tabs start where the 760 px column\'s plates do (plan 0011\'s owed item; shoot.mjs measures it)');
  ok(/document\.addEventListener\('touchstart', \(\) => \{\}, \{ passive: true \}\);/.test(app),
    'a passive, empty touchstart listener on the document, so iOS draws the :active tints (plan 0011\'s owed item; a phone row checks it)');
}

// Information: characters in today's file that the face's cut does not draw (HOUSE.md 2.2's measured cmap). A
// daily file brings new ones; the browser sets them in the phone's face through --face's fallback.
{
  const R = [[0x20, 0x7e], [0xa0, 0xac], [0xae, 0x17f], [0x1a0, 0x1a1], [0x1af, 0x1b0], [0x218, 0x21b], [0x304, 0x304], [0x307, 0x307], [0x1e0c, 0x1e0f], [0x1e20, 0x1e21], [0x1e24, 0x1e25],
    [0x1e2a, 0x1e2b], [0x1e30, 0x1e31], [0x1e36, 0x1e3b], [0x1e40, 0x1e4b], [0x1e5a, 0x1e63], [0x1e6c, 0x1e6f], [0x1e80, 0x1e85], [0x1e8e, 0x1e8f], [0x1e92, 0x1e93], [0x1e97, 0x1e97], [0x1e9e, 0x1e9e],
    [0x1ea0, 0x1ef9], [0x2009, 0x2009], [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e], [0x2026, 0x2026], [0x202f, 0x202f], [0x2032, 0x2033], [0x2039, 0x203a], [0x2212, 0x2212], [0x2264, 0x2265]];
  const inCut = (cp) => R.some(([a, b]) => cp >= a && cp <= b);
  const text = JSON.stringify([snap.regions.map((r) => [r.name, r.items.map((i) => [i.title, i.source, i.author, i.summary])]), snap.sources]);
  const missing = [...new Set([...text].filter((ch) => ch.codePointAt(0) >= 0x20 && !inCut(ch.codePointAt(0))))];
  info(`characters in today's file outside the cut, set by the phone's face: ${missing.length ? missing.map((ch) => `${ch} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(', ') : 'none'}`);
  const own = [...new Set([...[app, html, ...mods.map(read)].map((s, i) => (i === 1 ? htmlText(s) : strings(s).join(' '))).join(' ')].filter((ch) => ch.codePointAt(0) >= 0x20 && !inCut(ch.codePointAt(0))))];
  ok(own.length === 0, `the app's own strings use only characters the cut draws${own.length ? ': ' + own.join(' ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
