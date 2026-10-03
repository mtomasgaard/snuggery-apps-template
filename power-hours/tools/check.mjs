// Static checks for Power Hours (HOUSE.md section 7.1; ART.md; tools/DECISIONS.md, item 10). Node, no dependencies
// but python3 for tools/art/palette.py; Outdoor Window's tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( is relative, inside the folder, present; the two data reads;
//   4. js/ holds the three modules, fonts/ the house face and its OFL.txt at the sha256 HOUSE.md pins, and no
//      supplement; NOTES.md and About credit the face word for word;
//   5. the data is pinned: data/snapshot.json's and data/appliances.json's sha256, byte-identical to before the
//      pass (on the public repository the refresh job rewrites the snapshot, so the lead's mirror leaves its data/);
//   6. miniapp.json is valid, its name unchanged;
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credits: the static fallback word for word in the band and About and in app.js; the data's own words
//      written by app.js, never typed into it;
//   9. the marketing camera's string (HOUSE.md 7.4): c/kWh never in index.html, so it appears only once the
//      snapshot parses, and written from js/units.js; the pane scrolls inside the frame (the camera's swipe); no
//      storage at all;
//  10. SI and the dates: no plain space between a digit and a unit in the app's strings; toFixed only in
//      js/units.js, toLocale* and Intl nowhere (B5, B6, B15);
//  11. no transition anywhere, and only the house's one animation here (About);
//  12. innerHTML never set; no insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  13. palette.py passes, and its --json price is style.css's --price in both themes;
//  14. the look: the chrome tokens exactly in both themes, no accent, warning or stock token; no box-shadow,
//      backdrop-filter, `transition: all`, uppercase, letter-spacing, monospace; one family, and every font
//      string in a script names "Ysabeau Office" first; no middle dot or em dash in the app's own strings; no
//      →, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included (B17); both theme-color metas; the
//      @font-face rule; the page's language and viewport; the type scale, one 21 px figure;
//  15. the bugs on record (B1 to B18, ART.md section 8, now tools/DECISIONS.md) stay fixed in the code;
//  16. budgets: app code at most 200,000 bytes, fonts/ at most 160,000, the ZIP built exactly as build-zips.yml
//      builds it, against D5's 70,305 until the lead rules on the measured figure (plan 0011 D27, D30, D34 for
//      the loop apps before this one): over it, the line is HELD for the lead, not failed;
//  17. US spelling in every shipped text file; the data's keys licence and licenceInfo, the API's quoted
//      "honour" and the zone codes IT-Centre-North and IT-Centre-South keep their words.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], held = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => (fs.existsSync(path.join(APP, f)) ? fs.readFileSync(path.join(APP, f), 'utf8') : '');   // a missing file reads empty, so its checks FAIL
const CODE_CAP = 200000, FONT_CAP = 160000;
// D5's formula: 25 977 B before the pass × 1.25, rounded down, plus 37 834 B for the face. The stock ZIP is smaller
// than the face it gains, so the lead rules on the measured figure (HOUSE.md 8); set ZIP_RULED when it has.
const ZIP_CAP = 97000, ZIP_RULED = true;   // plan 0011 D39: the lead's ruling on the build's measured 93 754 (D5's 70 305 could not fit an app smaller than the face it gains)
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const htmlText = (src) => code(src, 'x.html').replace(/<template[\s\S]*?<\/template>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/g, "'");

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

// 2. No URL in the app's own code, comments included
const web = shipped.filter((f) => /\.(html|css|js)$/.test(f));
{
  const withUrls = web.filter((f) => /https?:\/\//i.test(read(f)));
  ok(withUrls.length === 0, `no http(s):// in ${web.length} .html/.css/.js files, comments included${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);
}

// 3. References: relative, inside the folder, present; the two data reads
const app = read('app.js'), html = read('index.html'), css = read('style.css');
const mods = ['js/units.js', 'js/prices.js', 'js/staircase.js'];
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
  ok(bad.length === 0 && refs.length >= 7, `references: ${refs.length} (imports, src, href, url(), fetch()): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} to ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
  const dataPaths = [...new Set(web.flatMap((f) => [...code(read(f), f).matchAll(/\.\/data\/[\w./-]+/g)].map((m) => m[0])))].sort();
  ok(/const SNAPSHOT_URL = '\.\/data\/snapshot\.json';/.test(app) && /const APPLIANCES_URL = '\.\/data\/appliances\.json';/.test(app) && /fetch\(url, \{ cache: 'no-store' \}\)/.test(app)
    && /readText\(SNAPSHOT_URL\), readText\(APPLIANCES_URL\)/.test(app) && /if \(!\/\^\\\.\\\/data\\\/\[\\w-\]\+\\\.json\$\/\.test\(url\)\)/.test(app) && JSON.stringify(dataPaths) === '["./data/appliances.json","./data/snapshot.json"]',
    `the data reads: ${dataPaths.join(', ')}, through SNAPSHOT_URL and APPLIANCES_URL, behind the stock's path guard, and nothing else`);
}

// 4. js/, fonts/ and data/ hold exactly the contract's files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('js', ['prices.js', 'staircase.js', 'units.js']);
exactly('fonts', ['OFL.txt', 'ysabeau-office-gw.woff2']);
exactly('data', ['appliances.json', 'snapshot.json']);
const sha = (f) => (fs.existsSync(path.join(APP, f)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex') : 'missing');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/no fonts?,|No fonts|ships no font|system font|system stack/i.test(read('NOTES.md') + css),
  'the face is credited word for word in NOTES.md (the app\'s credits file) and About ("Type: …"); nothing says no font ships');

// 5. The data is pinned: both files byte-identical to the commit the pass started from
const DATA = { 'data/snapshot.json': 'cd7b0f7da4b92fd7ecbc732afd6ab81dbdbd149d3eba4c6ee0f98c2d7237e6d0', 'data/appliances.json': 'f308ce89d63af77f3cbc197df84e4cc2adf1c86543af1429b48b0db966063fe1' };
for (const [f, want] of Object.entries(DATA)) ok(sha(f) === want, `${f} sha256 ${sha(f).slice(0, 12)}… is the file committed before the pass (${want.slice(0, 12)}…)`);

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Power Hours' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && !/—/.test(mini.description) && typeof mini.version === 'string' && mini.version,
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters, no em dash`);
}

// 7. No AI vendor or model name in shipped text (Global Weather's list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
{
  const named = texts.filter((f) => namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files, ART.md, NOTES.md and PROMPT.md included${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credits: the static fallback in the band and About, the same constant in app.js; the data's words written
// by app.js from source.attribution and source.licenceInfo (or licence), never typed
const CREDIT = 'Day-ahead prices: Energy-Charts (Fraunhofer ISE).';
{
  const band = (html.match(/<p class="credits" id="credits">([^<]*)<\/p>/) || [])[1];
  const about = (html.match(/<p id="about-credit">([^<]*)<\/p>/) || [])[1];
  const priv = /<p class="credits private" id="private" hidden>These prices are licensed for private and internal use only\. Do not republish them\.<\/p>/.test(html);
  ok(band === CREDIT && about === CREDIT && app.includes(`const CREDIT_FALLBACK = '${CREDIT}';`) && /\$\('credits'\)\.textContent = t;/.test(app) && /\$\('about-credit'\)\.textContent = t;/.test(app)
    && /s\.licenceInfo/.test(app) && /s\.attribution/.test(app) && !/Bundesnetzagentur \| SMARD/.test(app.replace(/\/\*[\s\S]*?\*\//g, '')) && priv,
    `the credits: "${CREDIT}" static in the band and About and as app.js's fallback; the data's attribution and license words written by app.js; the private-use line static (shown when publishable is false)`);
}

// 9. The marketing camera's string (HOUSE.md 7.4) and storage
{
  ok(!html.includes('c/kWh') && /label: 'c\/kWh'/.test(read('js/units.js')) && !strings(app).some((s) => s.includes('c/kWh')),
    'camera: "c/kWh" is nowhere in index.html (comments included), so it appears only once the snapshot parses; it comes from js/units.js, never typed into app.js');
  ok(/\.pane \{[^}]*overflow-y: auto;/.test(css) && !/position:\s*sticky/.test(css) && /html, body \{[^}]*overflow: hidden;/.test(css),
    'camera: the pane scrolls inside the frame under a still header (the camera\'s swipe scrolls the pane, not the page)');
  ok(!/localStorage|sessionStorage|indexedDB/.test(web.map((f) => code(read(f), f)).join('\n')), 'storage: none, as before the pass (the app stores nothing; the camera has nothing to put back)');
  ok(/role="slider" tabindex="0" aria-label="Time"/.test(html) && !/role="img"|role: 'img'/.test(html + app), 'the drawing is one slider named Time, never an image (B7)');
}

// 10. SI and the dates in what the app writes; toFixed only in js/units.js; no toLocale* or Intl
{
  const UNIT = /\d (h|d|min|%|c\/kWh|EUR\/MWh)(?![\w/])/;   // a clock time's zone ("16:30 UTC") is not a unit
  const files = ['index.html', 'app.js', ...mods];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [htmlText(read(f))] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const locale = [];
  for (const f of ['app.js', ...mods]) code(read(f), f).split('\n').forEach((l, i) => {
    if (/\.(toLocaleString|toLocaleDateString|toLocaleTimeString)\(|\bIntl\.|en-GB|nb-NO/.test(l) || (f !== 'js/units.js' && /\.toFixed\(/.test(l))) locale.push(`${f}:${i + 1}`);
  });
  ok(locale.length === 0, `dates and numbers by hand: no toLocale*, Intl, en-GB or nb-NO; toFixed only in js/units.js (B5, B6, B15)${locale.length ? ': ' + locale.join(', ') : ''}`);
}

// 11. Motion: no transition at all; only About animates, under Reduce Motion
{
  const c = code(css, 'x.css');
  const anims = [...c.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]).sort();
  ok(!/transition\s*:/.test(c) && JSON.stringify(anims) === '["sheet-in"]' && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important; transition-duration: 0s !important;/.test(c)
    && !/behavior: 'smooth'|scrollTo\(\{|scrollIntoView/.test(app),
    `motion: no transition, the house's one animation here (${anims.join(', ')}), every duration 0 s under Reduce Motion; the landing and the head change instantly`);
}

// 12. innerHTML never set
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)/g)) uses.push([f, m[1]]);
  ok(uses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses (none before the pass; the house's rule kept); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. palette.py passes, and its --json price is style.css's --price
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
  const pairs = PAL ? ['light', 'dark'].map((s) => [s, PAL[s].price, tok(s, '--price')]) : [];
  ok(PAL && pairs.every(([, a, b]) => a === b), `style.css's --price equals palette.py --json in both themes (${pairs.map(([s, a, b]) => `${s} ${b}${a === b ? '' : ` against ${a}`}`).join(', ')}): the one data color, the stock's blue fitted to the band`);
}

// 14. The look
{
  const c = c0;
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|ui-monospace|SFMono|Menlo|font-variant\s*:\s*small-caps|Georgia|serif\b(?<!sans-serif)/, 'monospace, small capitals or a serif'], [/linear-gradient|radial-gradient/, 'a gradient'], [/position:\s*sticky/, 'a sticky header']];
  const found = banned.filter(([re]) => re.test(c)).map(([, nm]) => nm);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace, small capitals, serif, gradient or sticky header${found.length ? ': ' + found.join(', ') : ''}`);
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} ${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--warning|--critical|--good|--bar\b|--surface|--radius|--hairline|--text-|--on-accent|--glass|--shadow|--ring/.test(c + app),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page; no accent, warning or stock token${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const fontStrings = [app, ...mods.map(read)].flatMap((s) => strings(s)).filter((s) => /\d(\.\d+)?px [\w"']/.test(s));
  ok(families.length === 1 && families[0] === "'Ysabeau Office'" && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro|Segoe|BlinkMac|-apple-system,)/.test(c) && fontStrings.length >= 1 && fontStrings.every((s) => /^.\d{3} \d+(\.\d+)?px "Ysabeau Office"/.test(s)),
    `one family: one @font-face rule of 'Ysabeau Office', used through --face; every font string in a script names "Ysabeau Office" first (${fontStrings.join(', ')})`);
  const dots = [], dashes = [];
  for (const f of ['app.js', ...mods]) for (const s of strings(read(f))) {
    if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
    if (s.includes('—')) dashes.push(`${f}: ${s.slice(0, 50)}`);
  }
  if (/·/.test(htmlText(html))) dots.push('index.html');
  if (/—|&mdash;/.test(code(html, 'x.html'))) dashes.push('index.html');
  ok(dots.length === 0 && dashes.length === 0, `no middle dot and no em dash in any string the app writes (tells 6 and 7)${dots.length + dashes.length ? ': ' + [...dots, ...dashes].join(' | ') : ''}`);
  const arrows = [];
  for (const f of [...web, ...shipped.filter((x) => /\.md$/.test(x))]) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? htmlText(src) + code(src, f) : f.endsWith('.css') ? code(src, f) : src;
    if (/[→➤▸▾▴ⓘ⋯←]|&rarr;/i.test(lit.replace(/`[^`\n]*`/g, (m) => (f === 'ART.md' ? '' : m)))) arrows.push(f);
    if (!f.endsWith('.md') && /\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ←, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included (ART.md may quote the stock's in code), and no "..." in the app's (B17)${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, '--page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', '--page')} / ${tok('dark', '--page')})`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, '@font-face: the house rule word for word, and no other');
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module');
  const px = [...c.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const offScale = px.filter((v) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 21].includes(v));
  const big = [...c.matchAll(/([^{}]+)\{[^}]*font-size: 21px/g)].map((m) => m[1].trim());
  const weights = [...c.replace(/@font-face \{[^}]*\}/, '').matchAll(/font-weight:\s*(\d+)|font:\s*(\d{3}) /g)].map((m) => Number(m[1] || m[2]));
  ok(offScale.length === 0 && JSON.stringify(big) === '[".fig b"]' && weights.every((w) => [400, 560, 600, 620, 650].includes(w)),
    `type: sizes ${[...new Set(px)].sort((a, b) => a - b).join(', ')} px, the one 21 px figure ${big.join(', ')} (Now's price); weights ${[...new Set(weights)].join(', ')}${offScale.length ? ': off the scale ' + offScale.join(', ') : ''}`);
}

// 15. The bugs on record (ART.md section 8, tools/DECISIONS.md), each a must, stay fixed in the code
{
  const P = read('js/prices.js'), S = read('js/staircase.js'), Pc = code(P, 'x.js'), Ac = code(app, 'x.js');
  const B = [
    ['B1 no days[].label is read; each interval\'s day is its own string\'s', !/\b(day|d|meta|x)\.label\b/.test(Pc + Ac) && /date: `\$\{m\[1\]\}-\$\{m\[2\]\}-\$\{m\[3\]\}`/.test(P)],
    ['B2 a wholly ended file is history, never planned as if ahead', /const history = n > 0 && first < 0;/.test(P) && /'Cheapest runs in this file'/.test(app) && /These prices have all ended,/.test(app)],
    ['B3 runs cross midnight: one drawing, one search over the whole file', !/role', 'tab'|role="tab"/.test(app + html) && /for \(let a = M\.first; a \+ need <= M\.n; a\+\+\)/.test(P)],
    ['B4 no staleness by age; the stamp\'s states are sentences in ink', !/ageHours|> 14|STALE/.test(Ac) && /el\('span', 'lead', leads\.join\(' '\)\)/.test(app) && /\.stamp \.lead \{ color: var\(--ink\); \}/.test(css) && !/classList\.(add|toggle)\('stale'/.test(app)],
    ['B5 the stamp carries its date when not today', /stampWhen\(D\.made\)/.test(app) && !/\.title = /.test(Ac)],
    ['B7 one slider, no 13 px hour buttons', !/role: 'button'|'hit'/.test(Ac + code(S, 'x.js'))],
    ['B8 <main> is not a live region; one polite live region', /<main class="pane" id="main">/.test(html) && (html.match(/aria-live/g) || []).length === 1 && /<p class="sr" id="live" aria-live="polite"><\/p>/.test(html)],
    ['B9 axis labels placed by priority with a 4 px gap', /LABEL_GAP = 4/.test(S) && /labels\.some\(\(p\) => a < p\.b \+ LABEL_GAP && p\.a < b \+ LABEL_GAP\)/.test(S)],
    ['B10 no hourly means: one tread per interval', !/hourlyMeans|buckets/.test(Pc + Ac + code(S, 'x.js'))],
    ['B11 Now\'s rank is its own interval\'s', /const sec = el\('section', 'sec now'\), fig = el\('p', 'fig'\), r = P\.rankDay\(M, M\.cur\);/.test(app)],
    ['B12 intervals by instant and index, never by wall-clock hour', !/posOf|findIndex\(\(h\) => h\.hour/.test(Ac) && /\.sort\(\(a, b\) => a\.at - b\.at\)/.test(P)],
    ['B13 a broken replacement keeps the view', /if \(D\) \{(?:(?!\} else \{)[\s\S])*box\.classList\.add\('kept'\);\s*\} else \{/.test(app) && /Still showing the prices/.test(app)],
    ['B14 notices: plain sentences set as text, no backticks, no filesystem hint', !/`[^`]*\\`/.test(app) && !/filesystem|http\.server/.test(Ac) && !/esc\(/.test(Ac) && /In Snuggery, Options, then App Files shows what the file holds\./.test(app)],
    ['B18 no run searched across a gap', /if \(j > a && !M\.joined\[j\]\) \{ ok = false; break; \}/.test(P)],
  ];
  const bad = B.filter(([, okk]) => !okk).map(([nm]) => nm);
  ok(bad.length === 0, `the bugs on record stay fixed in the code: ${B.length} checked here (B6 and B15 above, B16 and B17 below and above; tools/test_prices.mjs and shoot.mjs drive them)${bad.length ? '; failing: ' + bad.join('; ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...mods];
const size = (f) => (fs.existsSync(path.join(APP, f)) ? fs.statSync(path.join(APP, f)).size : 0);
const codeBytes = codeFiles.reduce((s, f) => s + size(f), 0);
ok(codeBytes <= CODE_CAP && shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f)).every((f) => codeFiles.includes(f)), `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's; 46,466 before the pass): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((s, f) => s + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)}; none before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'power-hours.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((s, p) => s + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((x) => shipped.includes(x)) && !names.some((f) => /^(tools|screenshots|scripts)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data ${fmt(stored((x) => x.startsWith('data/')))}, fonts/ ${fmt(stored((x) => x.startsWith('fonts/')))}, app code ${fmt(stored((x) => codeFiles.includes(x)))}, ART.md ${fmt(stored((x) => x === 'ART.md'))}, NOTES.md and PROMPT.md ${fmt(stored((x) => x === 'NOTES.md' || x === 'PROMPT.md'))}`);
if (zsize <= ZIP_CAP) ok(true, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}${ZIP_RULED ? ', the lead\'s ruling' : ', D5\'s formula'}; 25,977 before the pass)`);
else if (!ZIP_RULED) { const m = `ZIP size ${fmt(zsize)} bytes against D5's ${fmt(ZIP_CAP)} (25,977 before the pass): the stock ZIP is smaller than the face it gains, so the lead rules on this measured figure (HOUSE.md 8; plan 0011 D27, D30, D34)`; console.log(`HOLD ${m}`); held.push(m); }
else ok(false, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}, the lead's ruling)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). The data's keys
// licence and licenceInfo, the API's quoted "honour" and its zone codes keep their words, by exact string.
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|behaviour\w*|recognis\w*|organis\w*|normalis\w*|analys(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|judgement\w*|for ever|amortis\w*|authoris\w*|categoris\w*|instalments?|artefacts?|cosy|cancell\w*|dearest)\b/gi;
  const KEYS = ['licenceInfo', '`licence`', '"licence"', 's.licence', 'source.licence', '(or `licence`)'];
  const PHRASES = { 'NOTES.md': ['Clients should honour that', 'IT-Centre-North', 'IT-Centre-South'], 'ART.md': ['`licence`', '`honours`', '`honouring`', '`colour(s)`', '`labelled`', '`honour`', '`IT-Centre-North`', '`IT-Centre-South`', 'dearest'] };
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt' && !x.startsWith('data/'))) {
    read(f).split('\n').forEach((line, i) => {
      let l = line;
      for (const p of [...(PHRASES[f] || []), ...KEYS]) l = l.split(p).join('');
      for (const m of l.matchAll(BRIT)) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 3} shipped text files (the data files are the pipeline's); the data's keys, the API's quoted "honour" and its zone codes keep their words (B16)${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

// The app's own strings use only characters the face's cut draws (HOUSE.md 2.2's measured cmap)
{
  const R = [[0x20, 0x7e], [0xa0, 0xac], [0xae, 0x17f], [0x2009, 0x2009], [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e], [0x2026, 0x2026], [0x202f, 0x202f], [0x2032, 0x2033], [0x2212, 0x2212], [0x2264, 0x2265]];
  const inCut = (cp) => R.some(([a, b]) => cp >= a && cp <= b);
  const unesc = (s) => s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const own = [...new Set([...[app, html, ...mods.map(read)].map((s, i) => (i === 1 ? htmlText(s) : unesc(strings(s).join(' ')))).join(' ')].filter((ch) => ch.codePointAt(0) >= 0x20 && !inCut(ch.codePointAt(0))))];
  ok(own.length === 0, `the app's own strings use only characters the cut draws (no supplement)${own.length ? ': ' + own.join(' ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed${held.length ? `; ${held.length} held for the lead` : ''}`); process.exit(1); }
console.log(held.length ? `\nall checks pass; ${held.length} held for the lead's ruling (the ZIP's size, printed above)` : '\nall checks pass');
