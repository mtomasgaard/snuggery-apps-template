// Static checks for Hello Live (HOUSE.md section 7.1; ART.md; tools/DECISIONS.md). Node, no dependencies but python3 for
// tools/art/palette.py; Power Hours' tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( is relative, inside the folder, present; the one data read;
//   4. js/ holds the two modules, fonts/ the house face and its OFL.txt at the sha256 HOUSE.md pins, and no
//      supplement; data/ the one file; NOTES.md and About credit the face word for word;
//   5. the data: data/snapshot.json's shape as the refresh job writes it (the job rewrites it about hourly, so a sha256
//      pin failed on every fresh file; plan 0012 package 4), and the tests' fixed day, tools/fixtures/snapshot.json
//      (the file the old pin named), pinned by sha256;
//   6. miniapp.json is valid, its name unchanged, its version 2.1 (plan 0012 package 4; HOUSE 13);
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credit word for word as About's first Sources and credits paragraph (#about-credit-line) and in NOTES.md;
//      no band, caption line or credit line on the front (HOUSE 4.15);
//   9. the marketing camera's string (HOUSE.md 7.4): the Library row's name, miniapp.json's; the one storage key with
//      the app's prefix, every access in try/catch; the pane scrolls inside the frame;
//  10. SI and the dates: no plain space between a digit and a unit in the app's strings; toFixed, toLocale* and Intl
//      nowhere (B5, B6);
//  11. no transition anywhere, and only the house's one animation here (About); Reduce Motion zeroes it;
//  12. innerHTML never set (the stock's one use is gone, B9); no insertAdjacentHTML, outerHTML, document.write, eval
//      or new Function;
//  13. palette.py passes, and its --json tokens are style.css's in both themes;
//  14. the look: the chrome tokens exactly, no accent or warn token; no box-shadow, backdrop-filter, `transition:
//      all`, uppercase, letter-spacing, monospace, serif, gradient, sticky; one family, every font string in a
//      script naming "Ysabeau Office" first; no middle dot or em dash in the app's own strings; no →, ←, ➤, ▸, ▾, ▴,
//      ⓘ or ⋯ in shipped text, the .md files included, and no "..." in the app's; both theme-color metas; the
//      @font-face rule; the page's language and viewport; the pane apps' type scale, one 34 px key number;
//      overflow-wrap on the headline (B16); the white ground (HOUSE 12);
//  15. the bugs on record (B1 to B16, ART.md section 8) stay fixed in the code;
//  16. budgets: app code at most 200,000 bytes, fonts/ at most 160,000, the ZIP built exactly as build-zips.yml
//      builds it at most 89,805 (the house rule for plan 0012 package 4: 71,844 before the pass × 1.25);
//  17. US spelling in every shipped text file;
//  18. the app's own strings use only characters the face's cut draws;
//  19. the pane-app register as this app takes it (HOUSE 11; plan 0012 P1 to P9 and the Hello Live list): the key
//      number, the card's key, the rows' values, no plates, the About key, the pane's foot, the centered header,
//      a passive touchstart listener.
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
// D5's formula: 3 730 B before the pass × 1.25, rounded down, plus 37 834 B for the face. The stock ZIP is a tenth of the
// face it gains, so the lead rules on the measured figure (HOUSE.md 8; ART.md section 6); set ZIP_RULED when it has.
// Plan 0012 package 4: the house rule, 71 844 B before the pass (the change list's figure) × 1.25, rounded down, above
// plan 0011 D42's 74 000, so the cap rises to it (tools/DECISIONS.md)
const ZIP_CAP = 89805, ZIP_RULED = true;
const ZIP_BEFORE = 71844;
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const htmlText = (src) => code(src, 'x.html').replace(/<template[\s\S]*?<\/template>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, '’').replace(/&hellip;/g, '…').replace(/&[a-z]+;|&#\d+;/g, "'");

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

// 3. References: relative, inside the folder, present; the one data read
const app = read('app.js'), html = read('index.html'), css = read('style.css');
const mods = ['js/units.js', 'js/card.js'];
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
  const dataPaths = [...new Set(web.flatMap((f) => [...code(read(f), f).matchAll(/\.\/data\/[\w./-]+/g)].map((m) => m[0])))].sort();
  ok(/const DATA_URL = '\.\/data\/snapshot\.json';/.test(app) && /fetch\(DATA_URL, \{ cache: 'no-store' \}\)/.test(app) && (app.match(/fetch\(/g) || []).length === 1 && JSON.stringify(dataPaths) === '["./data/snapshot.json"]',
    `the data read: ${dataPaths.join(', ')}, through DATA_URL with cache: no-store, the app's one fetch()`);
}

// 4. js/, fonts/ and data/ hold exactly the contract's files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('js', ['card.js', 'units.js']);
exactly('fonts', ['OFL.txt', 'ysabeau-office-gw.woff2']);
exactly('data', ['snapshot.json']);
const sha = (f) => (fs.existsSync(path.join(APP, f)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex') : 'missing');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/no fonts?,|No fonts|ships no font|system font|system stack/i.test(read('NOTES.md') + css),
  'the face is credited word for word in NOTES.md (the app\'s credits file) and About ("Type: …"); nothing says no font ships');

// 5. The data. The refresh job rewrites data/snapshot.json about every hour, so its bytes cannot be pinned (the pin to
// db50d9ad…, the file of 1 Oct, failed on every fresh file): its shape is checked instead, as app.js's header gives it
// and scripts/refresh_hello_live.py writes it. That file of 1 Oct is the tests' fixed day, tools/fixtures/snapshot.json
// (from the public template at bd8f679), pinned here.
{
  let s = null, why = [];
  try { s = JSON.parse(read('data/snapshot.json')); } catch (e) { why.push(e.message); }
  if (s) {
    const str = (v) => typeof v === 'string' && v.length > 0;
    if (!str(s.generatedAt) || !Number.isFinite(Date.parse(s.generatedAt)) || !/Z$/.test(s.generatedAt)) why.push('no ISO generatedAt in UTC');
    if (!str(s.headline)) why.push('no headline');
    if (s.caption != null && typeof s.caption !== 'string') why.push('caption is not a string');
    if (!Array.isArray(s.runs) || s.runs.some((r) => !r || typeof r.label !== 'string' || !['string', 'number'].includes(typeof r.value))) why.push('runs[] is not { label, value } rows');
    if (!Array.isArray(s.ask) || s.ask.length > 60 || s.ask.some((r) => !r || typeof r.measure !== 'string' || typeof r.value !== 'number')) why.push('ask[] is not { measure, value } rows (at most 60)');
  }
  ok(why.length === 0, `data/snapshot.json: the shape app.js's header documents (made ${s && s.generatedAt}, headline "${s && s.headline}", ${s && Array.isArray(s.runs) ? s.runs.length : 0} rows, ${s && Array.isArray(s.ask) ? s.ask.length : 0} ask rows); any file the job writes passes${why.length ? ': ' + why.join('; ') : ''}`);
}
const DATA = { 'tools/fixtures/snapshot.json': 'db50d9add6f0d940671235ee12a3fbe7f2a4f7e90e9620e3f6899539f04333a8' };
for (const [f, want] of Object.entries(DATA)) ok(sha(f) === want, `${f} sha256 ${sha(f).slice(0, 12)}… is the file of 1 Oct, the tests' fixed day; it does not ship (${want.slice(0, 12)}…)`);

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Hello Live' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && !/—/.test(mini.description) && mini.version === '2.1',
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters, no em dash`);
}

// 7. No AI vendor or model name in shipped text (Global Weather's list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
{
  const named = texts.filter((f) => namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files, ART.md and NOTES.md included${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credit (HOUSE 4.15; plan 0012 F1, F8): static as About's first Sources and credits paragraph, byte for byte as
// the band held it, and in NOTES.md; nothing on the front carries a credit (this app has no 4.15 exception)
const CREDIT = 'Data: this repository’s own refresh job; no outside source.';
{
  const about = (html.match(/<h3>Sources and credits<\/h3>\s*(?:<!--[\s\S]*?-->\s*)?<p id="about-credit-line">([^<]*)<\/p>/) || [])[1];
  ok(about != null && about.replace(/&rsquo;/g, '’') === CREDIT && read('NOTES.md').includes(`- ${CREDIT}`) && !/\$\('credits'\)|\$\('capline'\)|\$\('about-credit-line'\)|'band'/.test(code(app, 'x.js'))
    && !/id="credits"|id="band"|id="capline"|<footer/.test(html) && !/\.band\b|\.capline\b|\.credits\b/.test(code(css, 'x.css')),
    `the credit: "${CREDIT}" static as About's first Sources and credits paragraph and in NOTES.md; app.js never rewrites it; no band, caption line or credit line on the front`);
}

// 9. The marketing camera's string (HOUSE.md 7.4), storage, the pane
{
  ok(mini && mini.name === 'Hello Live' && /<h1 translate="no">Hello Live<\/h1>/.test(html) && /<title>Hello Live<\/title>/.test(html), 'camera: the Library row is "Hello Live", miniapp.json\'s name, unchanged; the h1 and the title say the same');
  ok(/\.pane \{[^}]*overflow-y: auto;/.test(css) && !/position:\s*sticky/.test(css) && /html, body \{[^}]*overflow: hidden;/.test(css),
    'the pane scrolls inside the frame under a still header (nothing scrolls at 390 × 844; at 844 × 390 the pane may)');
  const all = web.map((f) => code(read(f), f)).join('\n');
  const keys = [...all.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\((\w+|'[^']*')/g)].map((m) => m[1]);
  const accesses = [...app.matchAll(/localStorage\./g)].length;
  const guarded = [...code(app, 'x.js').matchAll(/try \{[^}]*localStorage\.[^}]*\} catch/g)].length;
  ok(/const KEY = 'hello-live\.card';/.test(app) && keys.length === 2 && keys.every((k) => k === 'KEY') && accesses === 2 && guarded === 2 && !/sessionStorage|indexedDB/.test(all),
    `storage: one key, "hello-live.card" (the app's prefix), read once and written once, both inside try/catch (${guarded} of ${accesses}); nothing else stored`);
  ok(/<svg class="card" id="card" role="img" aria-label="Time card" focusable="false"><\/svg>/.test(html) && /setAttribute\('aria-label', describe\(record, now\)\)/.test(app) && !/addEventListener\('(pointer|touch|click)/.test(read('js/card.js') + app.replace(/\$\('stamp'\)\.onclick|onclick = /g, '').replace("document.addEventListener('touchstart', () => {}, { passive: true });", '')),
    'the card is an image (role img) with its name from the record; nothing on it is a control (the document\'s empty touchstart listener aside)');
}

// 10. SI and the dates in what the app writes; no toFixed, toLocale* or Intl
{
  const UNIT = /\d (h|d|min|%|px|s)(?![\w/’])/;   // a clock time's zone ("01:59 UTC") is the file's own words, not a unit
  const files = ['index.html', 'app.js', ...mods];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [htmlText(read(f))] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const locale = [];
  for (const f of ['app.js', ...mods]) code(read(f), f).split('\n').forEach((l, i) => {
    if (/\.(toLocaleString|toLocaleDateString|toLocaleTimeString|toFixed)\(|\bIntl\.|en-GB|nb-NO/.test(l)) locale.push(`${f}:${i + 1}`);
  });
  ok(locale.length === 0 && /export function stamp\(made, now = Date\.now\(\)\)/.test(read('js/units.js')) && /export const localLead/.test(read('js/units.js')),
    `dates and numbers by hand in js/units.js: no toLocale*, toFixed, Intl, en-GB or nb-NO anywhere; the stamp's states and the lead's clock are units.js's (B5, B6)${locale.length ? ': ' + locale.join(', ') : ''}`);
}

// 11. Motion: no transition at all; only About animates, zeroed under Reduce Motion
{
  const c = code(css, 'x.css');
  const anims = [...c.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]).sort();
  ok(!/transition\s*:/.test(c) && JSON.stringify(anims) === '["sheet-in"]' && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important; transition-duration: 0s !important;/.test(c)
    && !/behavior: 'smooth'|scrollTo\(\{|scrollIntoView|requestAnimationFrame/.test(app + read('js/card.js')),
    `motion: no transition, the house's one animation here (${anims.join(', ')}), every duration 0 s under Reduce Motion; the punches, now and the stamp change instantly, no animation frame is ever asked for`);
}

// 12. innerHTML never set
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)/g)) uses.push([f, m[1]]);
  ok(uses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses (the stock's one, carrying markup, is gone: B9; the house's rule now held); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. palette.py passes, and its --json tokens are style.css's tokens
const TOK = {
  light: { '--page': '#ffffff', '--sheet': '#f6f9fa', '--ink': '#0f1c23', '--ink-2': '#45555d', '--ink-3': '#5b6a72', '--line': '#c9d4d8', '--line-strong': '#74858c' },
  dark: { '--page': '#141d21', '--sheet': '#1c272c', '--ink': '#e6edee', '--ink-2': '#a3b1b6', '--ink-3': '#8b9a9f', '--line': '#2a373c', '--line-strong': '#64757b' },
};
const PAL_KEY = { '--page': 'page', '--sheet': 'sheet', '--ink': 'ink', '--ink-2': 'ink2', '--ink-3': 'ink3', '--line': 'line', '--line-strong': 'strong' };
const c0 = code(css, 'x.css');
const blockOf = (scheme) => (scheme === 'light' ? c0.slice(c0.indexOf(':root {'), c0.indexOf('@media (prefers-color-scheme: dark)')) : c0.slice(c0.indexOf('@media (prefers-color-scheme: dark)'), c0.indexOf('* { box-sizing')));
const tok = (scheme, name) => (blockOf(scheme).match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  let PAL = null;
  try { PAL = JSON.parse(json.stdout); } catch { PAL = null; }
  const off = PAL ? ['light', 'dark'].flatMap((s) => Object.keys(TOK[s]).filter((k) => PAL[s][PAL_KEY[k]] !== tok(s, k)).map((k) => `${s} ${k} ${tok(s, k)} against ${PAL[s][PAL_KEY[k]]}`)) : ['no --json'];
  ok(PAL && off.length === 0, `style.css's tokens equal palette.py --json in both themes (no data color: the app's data is a clock and three counts, and the card is ink)${off.length ? ': ' + off.join(', ') : ''}`);
}

// 14. The look
{
  const c = c0;
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|ui-monospace|SFMono|Menlo|font-variant\s*:\s*small-caps|Georgia|serif\b(?<!sans-serif)/, 'monospace, small capitals or a serif'], [/linear-gradient|radial-gradient/, 'a gradient'], [/position:\s*sticky/, 'a sticky header'], [/border-radius:\s*1[0-9]px/, 'the stock\'s 14 px radius']];
  const found = banned.filter(([re]) => re.test(c)).map(([, nm]) => nm);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace, small capitals, serif, gradient, sticky header or card radius${found.length ? ': ' + found.join(', ') : ''}`);
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} ${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--warn|--card|--dim|--bg\b|--surface|--radius|--hairline|--text-|--glass|--shadow|--ring/.test(c + app) && !/#2f6f4f|#7ec79b|#8a3324|#e5907f|#131316|#16161a|#f6f6f4/i.test(c),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page; none of the stock's tokens or hues (its green, red, grays)${off.length ? ': ' + off.join(', ') : ''}`);
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
  ok(dots.length === 0 && dashes.length === 0, `no middle dot and no em dash in any string the app writes (tells 6 and 7; the stock's hint had spaced em dashes)${dots.length + dashes.length ? ': ' + [...dots, ...dashes].join(' | ') : ''}`);
  const arrows = [];
  for (const f of [...web, ...shipped.filter((x) => /\.md$/.test(x))]) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? htmlText(src) + code(src, f) : f.endsWith('.css') ? code(src, f) : src;
    if (/[→➤▸▾▴ⓘ⋯←]|&rarr;/i.test(lit)) arrows.push(f);
    if (!f.endsWith('.md') && /\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ←, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included (the stock's hint had ⋯ and →, B9), and no "..." in the app's${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, '--page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', '--page')} / ${tok('dark', '--page')}) (B12)`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, '@font-face: the house rule word for word, and no other');
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module (B12)');
  const px = [...c.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const offScale = px.filter((v) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 19, 21, 34].includes(v));
  const big = [...c.matchAll(/([^{}]+)\{[^}]*font-size: 34px/g)].map((m) => m[1].trim());
  const weights = [...c.replace(/@font-face \{[^}]*\}/, '').matchAll(/font-weight:\s*(\d+)|font:\s*(\d{3}) /g)].map((m) => Number(m[1] || m[2]));
  ok(offScale.length === 0 && JSON.stringify(big) === '[".fig b"]' && weights.every((w) => [400, 560, 600, 620, 650].includes(w)) && !/letter-spacing/.test(c),
    `type: sizes ${[...new Set(px)].sort((a, b) => a - b).join(', ')} px, the one 34 px key number ${big.join(', ')} (the file's headline, HOUSE 11.1 rule 2; the stock's 41.6 px at 640 with tracking is gone, B2); weights ${[...new Set(weights)].sort().join(', ')}${offScale.length ? ': off the scale ' + offScale.join(', ') : ''}`);
  ok(/\.fig b \{[^}]*overflow-wrap: anywhere;/.test(c) && /\.cap \{[^}]*overflow-wrap: anywhere;/.test(c), 'the file-controlled headline and caption carry overflow-wrap: anywhere, so a long string can never widen the page (B16)');
}

// 15. The bugs on record (ART.md section 8), each a must, stay fixed in the code
{
  const Un = read('js/units.js'), Cd = read('js/card.js'), Ac = code(app, 'x.js'), Uc = code(Un, 'x.js');
  const B = [
    ['B1 staleness is a sentence in ink, never a hue', /if \(now - made >= STALE_MS\) return \{ lead: 'Stale\.', rest \};/.test(Un) && /\.stamp \.lead \{ color: var\(--ink\); \}/.test(css) && !/\.stale|\.age\b/.test(css + Ac)],
    ['B2 the headline at 34 px 650 (the key number), the name at 15 px 650, no tracking', /\.fig b \{ font-size: 34px; line-height: 1\.05; font-weight: 650;/.test(css) && /\.head h1 \{ font-size: 15px; font-weight: 650;/.test(css)],
    ['B3 the house face, no monospace', /font: 400 13\.5px\/1\.35 var\(--face\);/.test(css) && !/code\b|monospace/.test(css)],
    ['B4 no card kit: the data on the page between hairlines', !/\.card \{[^}]*border/.test(css) && /\.sec \{ padding: 10px 0 6px; border-top: 1px solid var\(--line\); \}/.test(css) && !/class="card problem"|\.problem[\s,.{]/.test(html + css + Ac)],
    ['B5 the stamp carries the instant on the phone\'s clock, in the header', /export const stampWhen/.test(Un) && /const rest = `Updated \$\{stampWhen\(made, now\)\}`;/.test(Un) && /<div class="stamp-home"><button class="stamp" id="stamp"/.test(html)],
    ['B6 a file ahead of the clock says so', /if \(made - now > AHEAD_MS\) return \{ lead: 'Made after the phone’s time\.', rest \};/.test(Un) && !/just now/.test(Uc + Ac)],
    ['B7 an unreadable date is "Undated file.", never the raw string', /return \{ lead: 'Undated file\.', rest: '' \};/.test(Un) && !/textContent = (data|d|D\.data)\.generatedAt/.test(Ac)],
    ['B8 a broken replacement keeps the view and says so', /if \(D\) \{(?:(?!\} else \{)[\s\S])*box\.classList\.add\('kept'\);\s*\} else \{/.test(app) && /Still showing the file/.test(app) && !/replaceChildren\(\);\s*\$\('pane'\)\.replaceChildren/.test(Ac)],
    ['B9 no innerHTML: text only, the menu path in words', !/innerHTML/.test(Ac) && /In Snuggery, Options, then App Files shows what the file holds\./.test(app) && !/<code>|http\.server/.test(Ac)],
    ['B10 <main> is not a live region; one polite live region', /<main class="pane" id="main">/.test(html) && (html.match(/aria-live/g) || []).length === 1 && /<p class="sr" id="live" aria-live="polite"><\/p>/.test(html)],
    ['B11 the render in place: text nodes kept, the dl rebuilt only when its labels change', /const setText = \(node, text\) => \{ if \(node\.textContent !== text\) node\.textContent = text; \};/.test(app) && /if \(labels\.join\('\\n'\) !== have\.join\('\\n'\)/.test(app) && /if \(D && r\.text != null && r\.text === D\.text\) \{ \$\('notice'\)\.hidden = true; refresh\(\); return; \}/.test(app) && !/\$\('pane'\)\.replaceChildren/.test(Ac)],
    ['B12 the page\'s declarations', /<html lang="en-US">/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && (html.match(/<meta name="theme-color"/g) || []).length === 2],
    ['B13 About explains the numbers and the two clocks; the lead gives the phone\'s clock', /<h3>What the Time Card is<\/h3>/.test(html) && /<h3>This data<\/h3>/.test(html) && /<h3>Sources and credits<\/h3>/.test(html) && /<h3>How the data gets here<\/h3>/.test(html) && /all of that one instant/.test(html) && /in UTC/.test(html) && /localLead\(D\.made\)/.test(app)],
    ['B14 a notice is the house plate with role alert, no color, no code face', /<div class="notice" id="notice" role="alert" hidden><\/div>/.test(html) && /\.notice \{[^}]*border: 1px solid var\(--line-strong\); border-radius: 8px; background: var\(--sheet\);/.test(css)],
    ['B15 one timeout to the next whole minute while visible, cleared when hidden', /tick = setTimeout\(\(\) => \{ tick = 0; refresh\(\); \}, 60000 - \(Date\.now\(\) % 60000\) \+ 20\);/.test(app) && /if \(!D \|\| document\.hidden\) return;/.test(app) && /if \(document\.hidden\) \{ clearTimeout\(tick\); tick = 0; \} else load\(\);/.test(app) && /addEventListener\('pagehide', \(\) => \{ clearTimeout\(tick\); tick = 0; \}\)/.test(app)],
    ['B16 overflow-wrap on the headline', /\.fig b \{[^}]*overflow-wrap: anywhere;/.test(css)],
    ['the card drawn with createElementNS and textContent, replaced once per draw', /document\.createElementNS\(NS, tag\)/.test(Cd) && /svg\.replaceChildren\(\);/.test(Cd) && !/innerHTML|insertAdjacentHTML/.test(Cd)],
    ['the record: one per generatedAt, at most 400, sanitized on read', /export const MAX_RECORD = 400;/.test(Cd) && /if \(record\.some\(\(\[w\]\) => w === written\)\) return record;/.test(Cd) && /record = readRecord\(\);/.test(app) && /return sanitize\(t \? JSON\.parse\(t\) : \[\]\);/.test(app) && /try \{ t = localStorage\.getItem\(KEY\); \} catch \{ storage = false; return \[\]; \}/.test(app)],
    ['the face loaded before the first card, the card drawn again on loadingdone', /await document\.fonts\.load\(LABEL_FONT\);/.test(app) && /document\.fonts\.addEventListener\('loadingdone', \(\) => \{ if \(D\) drawCard\(\); \}\);/.test(app)],
    ['the caption line gone; its offset is the key\'s, written where caption() was called', !/function caption\(|capline/.test(Ac) && /function hoursKey\(\) \{\s*setText\(\$\('hours-key'\), `Hours: this phone’s, \$\{offsetWord\(Date\.now\(\)\)\}`\);\s*\}/.test(app) && (Ac.match(/hoursKey\(\);/g) || []).length === 2],
  ];
  const bad = B.filter(([, okk]) => !okk).map(([nm]) => nm);
  ok(bad.length === 0, `the bugs on record stay fixed in the code: ${B.length} pinned here (tools/test_card.mjs and shoot.mjs drive them)${bad.length ? '; failing: ' + bad.join('; ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...mods];
const size = (f) => (fs.existsSync(path.join(APP, f)) ? fs.statSync(path.join(APP, f)).size : 0);
const codeBytes = codeFiles.reduce((s, f) => s + size(f), 0);
ok(codeBytes <= CODE_CAP && shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f)).every((f) => codeFiles.includes(f)), `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's; 46,888 before plan 0012, 7,281 before plan 0011): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((s, f) => s + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)}; none before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'hello-live.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((s, p) => s + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((x) => shipped.includes(x)) && !names.some((f) => /^(tools|screenshots|scripts)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data ${fmt(stored((x) => x.startsWith('data/')))}, fonts/ ${fmt(stored((x) => x.startsWith('fonts/')))}, app code ${fmt(stored((x) => codeFiles.includes(x)))}, ART.md ${fmt(stored((x) => x === 'ART.md'))}, NOTES.md ${fmt(stored((x) => x === 'NOTES.md'))}`);
if (zsize <= ZIP_CAP) ok(true, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}, the house rule: ${fmt(ZIP_BEFORE)} before plan 0012 × 1.25)`);
else if (!ZIP_RULED) { const m = `ZIP size ${fmt(zsize)} bytes against D5's ${fmt(ZIP_CAP)} (${fmt(ZIP_BEFORE)} before the pass): the stock ZIP is a tenth of the face it gains, so the lead rules on this measured figure (HOUSE.md 8; plan 0011 D27, D30, D34, D39)`; console.log(`HOLD ${m}`); held.push(m); }
else ok(false, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}, the lead's ruling)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole; the data file is the
// pipeline's)
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|behaviour\w*|recognis\w*|organis\w*|normalis\w*|personalis\w*|analys(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|judgement\w*|for ever|amortis\w*|authoris\w*|categoris\w*|instalments?|artefacts?|cosy|cancell\w*)\b/gi;
  const PHRASES = { 'ART.md': ['`colours`'] };
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt' && !x.startsWith('data/'))) {
    read(f).split('\n').forEach((line, i) => {
      let l = line;
      for (const p of PHRASES[f] || []) l = l.split(p).join('');
      for (const m of l.matchAll(BRIT)) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 2} shipped text files (the data file is the pipeline's, OFL.txt the upstream's)${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

// 18. The app's own strings use only characters the face's cut draws (HOUSE.md 2.2's measured cmap)
{
  const R = [[0x20, 0x7e], [0xa0, 0xac], [0xae, 0x17f], [0x2009, 0x2009], [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e], [0x2026, 0x2026], [0x202f, 0x202f], [0x2032, 0x2033], [0x2212, 0x2212], [0x2264, 0x2265]];
  const inCut = (cp) => R.some(([a, b]) => cp >= a && cp <= b);
  const unesc = (s) => s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const own = [...new Set([...[app, html, ...mods.map(read)].map((s, i) => (i === 1 ? htmlText(s) : unesc(strings(s).join(' ')))).join(' ')].filter((ch) => ch.codePointAt(0) >= 0x20 && !inCut(ch.codePointAt(0))))];
  ok(own.length === 0, `the app's own strings use only characters the cut draws (no supplement; the stock's ⋯ is gone)${own.length ? ': ' + own.join(' ') : ''}`);
}

// 19. The pane-app register as Hello Live takes it (HOUSE 11.1, 11.3; plan 0012 P1 to P9, the Hello Live list)
{
  const c = code(css, 'x.css'), a = code(app, 'x.js'), h = code(html, 'x.html');
  ok(/\.fig \{ display: flex; flex-direction: column;/.test(c) && /\.fig b \{ font-size: 34px; line-height: 1\.05; font-weight: 650; min-width: 0; max-width: 100%; overflow-wrap: anywhere; \}/.test(c) && /\.fig \.lead \{ font-size: 13\.5px; color: var\(--ink-2\); \}/.test(c)
    && /\.cap \{[^}]*font-size: 12\.5px;/.test(c),
    'the key number: the file\'s headline at 34 px 650, the phone\'s clock under it at 13.5 px --ink-2, the data\'s caption under them at 12.5 px (HOUSE 11.1 rule 2)');
  ok(/<svg class="card" id="card"[^>]*><\/svg>\s*<div class="key" id="card-key"><span class="k"><i class="sw sw-punch" aria-hidden="true"><\/i>File written<\/span><span class="k"><i class="sw sw-tail" aria-hidden="true"><\/i>Until it was first read here<\/span><span class="k" id="hours-key">Hours: this phone&rsquo;s<\/span><\/div>/.test(h)
    && /\.key \{ display: flex; flex-wrap: wrap; gap: 2px 12px;[^}]*font-size: 11\.5px; line-height: 15px; color: var\(--ink-2\); \}/.test(c) && /\.key \.sw-punch \{ width: 3px; \}/.test(c) && /\.key \.sw-tail \{ height: 2px;/.test(c),
    'the card\'s key under it, in place of the band\'s sentence: File written (a 3 × 10 px ink mark), Until it was first read here (a 10 × 2 px ink line), Hours: this phone\'s and its offset (HOUSE 4.15, F4)');
  ok(/\.rows dd \{[^}]*font-size: 15px; font-weight: 600;/.test(c), 'the rows a two-column table, their values at 15 px 600 (HOUSE 11.1 rule 3)');
  ok(/\.sec \{ padding: 10px 0 6px; border-top: 1px solid var\(--line\); \}/.test(c) && !/\.sec \{[^}]*background/.test(c), 'no plates: the three sections keep their hairlines on the white page (HOUSE 11.1 rule 11)');
  ok(/<section class="sec" id="rows-sec">[\s\S]*?<\/section>\s*<button type="button" class="aboutlink" id="about-key">Sources, method and credits are in About\.<\/button>\s*<\/div>/.test(h) && /\$\('stamp'\)\.onclick = \$\('about-key'\)\.onclick = \(\) => about\(true\);/.test(app)
    && /\.aboutlink \{ display: block; margin: 14px 0 0; min-height: 44px; font-size: 12\.5px; color: var\(--ink-2\); text-decoration: underline; text-underline-offset: 3px; \}/.test(c) && /for \(const id of \['head', 'main'\]\) \$\(id\)\.inert = open;/.test(app),
    'the pane ends with the About key, static after the rows, 12.5 px --ink-2, underlined at 3 px, 44 px tall, opening About as the stamp does; About makes the head and main inert');
  ok(/\.panebody \{[^}]*padding-top: 4px; padding-bottom: calc\(28px \+ env\(safe-area-inset-bottom\)\); \}/.test(c) && (c.match(/(^|\n)\.panebody \{/g) || []).length === 1,
    'the pane\'s foot pads the home indicator, calc(28 px + the bottom inset), the band that carried it gone (HOUSE 4.14, P3)');
  ok(/\.head \{[^}]*calc\(max\(16px, 50% - 364px\) \+ env\(safe-area-inset-right\)\) 0 calc\(max\(16px, 50% - 364px\) \+ env\(safe-area-inset-left\)\); \}/.test(c) && /\.panebody \{ max-width: 760px; margin: 0 auto;/.test(c) && !/min-width: 700px/.test(c),
    'the pane a centered 760 px column, the header\'s sides on it: max(16 px, 50 % − 364 px); the old 700 px rule gone (plan 0011\'s owed item; shoot.mjs measures it)');
  ok(/document\.addEventListener\('touchstart', \(\) => \{\}, \{ passive: true \}\);/.test(app), 'a passive, empty touchstart listener on the document, so iOS draws the :active tints (plan 0011\'s owed item)');
  ok(tok('light', '--page') === '#ffffff' && /<meta name="theme-color" content="#ffffff" media="\(prefers-color-scheme: light\)">/.test(html) && !/--own|--owe|--up\b|--down\b|--watch|--cheap|--dear/.test(c),
    'the white ground (HOUSE 12, F7): light --page #ffffff and its theme-color; no register token (HOUSE 11.3: none for this app)');
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed${held.length ? `; ${held.length} held for the lead` : ''}`); process.exit(1); }
console.log(held.length ? `\nall checks pass; ${held.length} held for the lead's ruling (the ZIP's size, printed above)` : '\nall checks pass');
