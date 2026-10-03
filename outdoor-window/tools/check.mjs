// Static checks for Outdoor Window (HOUSE.md section 7.1; ART.md; tools/DECISIONS.md, item 12). Node, no
// dependencies but python3 for tools/art/palette.py; World News's tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment, but the two credit
//      anchors in index.html, allowed by file and exact string (owner call 3);
//   3. every import / src / href / url( / fetch( is relative, inside the folder, present; the two data reads;
//   4. js/ holds the three modules, fonts/ the house face and its OFL.txt at the sha256 HOUSE.md pins, and no
//      supplement; NOTES.md and About credit the face word for word;
//   5. the data is pinned: data/snapshot.json's and data/rules.json's sha256, byte-identical to before the pass;
//   6. miniapp.json is valid, its name unchanged;
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credits: the stock's static markup, word for word, with its two anchors, in the band and in About;
//   9. the marketing camera's strings (HOUSE.md 7.4): Windows and Hours as tabs built after the forecast parses
//      (B7); nothing else a button by either name; no storage at all;
//  10. SI and the dates: no plain space between a digit and a unit in the app's strings; toFixed only in
//      js/units.js, toLocale* and Intl nowhere (B1);
//  11. no transition anywhere, and only the house's two animations (the tracer, About);
//  12. innerHTML never set; no insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  13. palette.py passes, and its --json --used is style.css's in both themes;
//  14. the look: the chrome tokens exactly in both themes, no accent, warning or stock token; no box-shadow,
//      backdrop-filter, `transition: all`, uppercase, letter-spacing, monospace; one family, and every font
//      string in a script names "Ysabeau Office" first; no middle dot or em dash in the app's own strings; no
//      →, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included (B14); both theme-color metas; the
//      @font-face rule; the page's language and viewport; the type scale, one 21 px figure;
//  15. the scorer's arithmetic in js/score.js, line for line the stock app.js's; and the bugs on record (B1 to
//      B17, tools/DECISIONS.md) stay fixed in the code;
//  16. budgets: app code at most 200,000 bytes, fonts/ at most 160,000, the ZIP built exactly as build-zips.yml
//      builds it at most 99,000 (the lead's ruling on the measured 95,790, plan 0011 D34; D5's 75,257 could not
//      fit an app smaller than the face it gains);
//  17. US spelling in every shipped text file; Open-Meteo's address and the quoted CC BY clause keep their words.
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
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const CODE_CAP = 200000, FONT_CAP = 160000, ZIP_CAP = 99000 /* plan 0011 D34: the lead's ruling on the measured 95 790 (ART.md section 6); D5's 75 257 could not fit an app smaller than the face */;
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const htmlText = (src) => code(src, 'x.html').replace(/<template[\s\S]*?<\/template>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, '\u00a0').replace(/&[a-z]+;|&#\d+;/g, "'");

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

// 2. No URL in the app's own code, but the two credit anchors (owner call 3: Open-Meteo's terms ask for a link next
// to the data, CC BY for a link to the license; nothing is fetched from them)
const web = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const ANCHORS = ['<a href="https://open-meteo.com/">', '<a href="https://creativecommons.org/licenses/by/4.0/">'];
{
  const withUrls = web.filter((f) => { let s = read(f); if (f === 'index.html') for (const a of ANCHORS) s = s.split(a).join(''); return /https?:\/\//i.test(s); });
  const count = ANCHORS.map((a) => read('index.html').split(a).length - 1);
  ok(withUrls.length === 0 && count.every((c) => c === 1), `no http(s):// in ${web.length} .html/.css/.js files but the two credit anchors, once each in index.html${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);
}

// 3. References: relative, inside the folder, present; the two data reads
const app = read('app.js'), html = read('index.html'), css = read('style.css');
const mods = ['js/units.js', 'js/score.js', 'js/shutters.js'];
{
  const refs = [];
  for (const f of web) {
    const src = code(read(f), f).replace(/href="https:\/\/[^"]+"/g, '');
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
  ok(/const SNAPSHOT_URL = '\.\/data\/snapshot\.json';/.test(app) && /const RULES_URL = '\.\/data\/rules\.json';/.test(app) && /fetch\(url, \{ cache: 'no-store' \}\)/.test(app)
    && /readText\(SNAPSHOT_URL\), readText\(RULES_URL\)/.test(app) && JSON.stringify(dataPaths) === '["./data/rules.json","./data/snapshot.json"]',
    `the data reads: ${dataPaths.join(', ')}, through SNAPSHOT_URL and RULES_URL, and nothing else`);
}

// 4. js/, fonts/ and data/ hold exactly the contract's files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('js', ['score.js', 'shutters.js', 'units.js']);
exactly('fonts', ['OFL.txt', 'ysabeau-office-gw.woff2']);
exactly('data', ['rules.json', 'snapshot.json']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/no fonts?,|No fonts|type is the system's|system font/i.test(read('NOTES.md') + css),
  'the face is credited word for word in NOTES.md (the app\'s credits file) and About ("Type: …"); nothing says no font ships');

// 5. The data is pinned: both files byte-identical to the commit the pass started from
const DATA = { 'data/snapshot.json': '94071ec5e9cb14dfeb0a6b00df3e3e37002f162929d69fd4241a58a726d1f1f1', 'data/rules.json': 'ac9e029fe5147af3c247d59a173135014b5ae8b3f83a119fc0db0cc7afefc97a' };
for (const [f, want] of Object.entries(DATA)) ok(sha(f) === want, `${f} sha256 ${sha(f).slice(0, 12)}… is the file committed before the pass (${want.slice(0, 12)}…)`);
const snap = JSON.parse(read('data/snapshot.json'));

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Outdoor Window' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
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

// 8. The credits: the stock footer's first paragraph, word for word, static markup with its two anchors, in the
// band (on screen on every pane) and its words again in About's Sources and credits
const CREDIT = "Weather data by Open-Meteo.com, under CC\u00a0BY\u00a04.0. The free API is for non-commercial use. The forecast is Open-Meteo's, unmodified; the scores and the ask table beside it are this app's.";
{
  const p = (html.match(/<p class="credits" id="credits">([\s\S]*?)<\/p>/) || [])[1] || '';
  const words = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '\u00a0').replace(/[ \t\n]+/g, ' ').trim();
  const about = htmlText((html.match(/<h3>Sources and credits<\/h3>([\s\S]*?)<\/section>/) || [])[1] || '').replace(/[ \t\n]+/g, ' ');
  ok(words === CREDIT && p.includes(`${ANCHORS[0]}Weather data by Open-Meteo.com</a>`) && p.includes(`${ANCHORS[1]}CC&nbsp;BY&nbsp;4.0</a>`) && about.includes(CREDIT) && !/getElementById\('credits'\)|\$\('credits'\)/.test(app),
    `the credits: "${CREDIT.replace(/\u00a0/g, ' ')}" word for word in the band's static markup, its two anchors kept; the words again in About; no script writes them`);
}

// 9. The marketing camera's strings (HOUSE.md 7.4) and storage
{
  const build = (app.match(/function buildTabs\(\) \{[\s\S]*?\n\}/) || [''])[0];
  const named = /const TABS = \[\['windows', 'Windows'\], \['hours', 'Hours'\], \['rules', 'Rules'\]\];/.test(app) && /el\('button', null, name\)/.test(build) && /b\.setAttribute\('role', 'tab'\)/.test(build) && !/aria-label/.test(build);
  const afterParse = /const P = parseSnapshot\(a\);\s*if \(P\.problems\) return fail\(P\.problems\);[\s\S]*?if \(!before\) buildTabs\(\);/.test(app) && (app.match(/buildTabs\(\)/g) || []).length === 2;
  const markup = code(html, 'x.html');
  const others = /aria-label="(Windows|Hours)"|>\s*(Windows|Hours)\s*</.test(markup) || /'(Windows|Hours)'/.test(app.replace(/const TABS = [^\n]*\n/, '')) || /aria-label="Hour"/.test(markup) === false;
  ok(named && afterParse && !others && /<nav class="tabs" id="tabs" role="tablist" aria-label="Panes" hidden><\/nav>/.test(html),
    'camera: Windows and Hours are <button role="tab"> named by their visible words, built by buildTabs() only after the forecast parses and validates (B7); the static markup holds no tab; the Shutters are a slider named Hour, nothing else a button named Windows or Hours');
  ok(!/localStorage|sessionStorage|indexedDB/.test(web.map((f) => code(read(f), f)).join('\n')), 'storage: none, as before the pass (the app opens on Windows and stores nothing; the camera has nothing to put back)');
}

// 10. SI and the dates in what the app writes; toFixed only in js/units.js; no toLocale* or Intl
{
  const UNIT = /\d (h|d|min|%|mm|m|km\/h|°C|UTC)(?![\w/])/;
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
  const fixed = (code(read('js/units.js'), 'x.js').match(/\.toFixed\(/g) || []).length;
  ok(locale.length === 0 && fixed === 1, `dates and numbers by hand: no toLocale*, Intl, en-GB or nb-NO; toFixed once, in js/units.js (coordinates to two decimals) (B1, B10)${locale.length ? ': ' + locale.join(', ') : ''}`);
}

// 11. Motion: no transition at all; only the tracer and About animate, both under Reduce Motion
{
  const c = code(css, 'x.css');
  const anims = [...c.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]).sort();
  ok(!/transition\s*:/.test(c) && JSON.stringify(anims) === '["sheet-in","tracer-in"]' && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important; transition-duration: 0s !important;/.test(c)
    && !/behavior: 'smooth'|scrollTo\(\{|scrollIntoView/.test(app),
    `motion: no transition, the house's two animations (${anims.join(', ')}), every duration 0 s under Reduce Motion; the scroll to a row is instant; the Shutters never move (B13)`);
}

// 12. innerHTML never set
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)/g)) uses.push([f, m[1]]);
  ok(uses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses (3 before the pass, every one = ''; the house's rule kept); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. palette.py passes, and its --used is style.css's
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
  const pairs = PAL ? ['light', 'dark'].map((s) => [s, PAL[s].used, tok(s, '--used')]) : [];
  ok(PAL && pairs.every(([, a, b]) => a === b), `style.css's --used equals palette.py --json in both themes (${pairs.map(([s, a, b]) => `${s} ${b}${a === b ? '' : ` against ${a}`}`).join(', ')}): the one data color, the stock's green fitted to the band`);
}

// 14. The look
{
  const c = c0;
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|font-variant\s*:\s*small-caps|Georgia|serif\b(?<!sans-serif)/, 'monospace, small capitals or a serif'], [/linear-gradient\(\s*(?:to |180deg|0deg)/, 'a gradient wash'], [/position:\s*sticky/, 'a sticky header']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace, small capitals, serif, gradient wash or sticky header${found.length ? ': ' + found.join(', ') : ''} (B13)`);
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} ${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--warn|--alarm|--bar-|--surface|--radius|--hairline|--text-|--on-accent|--glass|--shadow/.test(c + app),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page; no accent, warning, alarm or stock token (B2, B13)${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const fontStrings = [app, ...mods.map(read)].flatMap((s) => strings(s)).filter((s) => /\d(\.\d+)?px\b/.test(s));
  ok(families.length === 1 && families[0] === "'Ysabeau Office'" && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro|BlinkMac|-apple-system,)/.test(c) && fontStrings.length >= 1 && fontStrings.every((s) => /^.\d{3} \d+(\.\d+)?px "Ysabeau Office"/.test(s)),
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
    if (/[→➤▸▾▴ⓘ⋯]|&rarr;/i.test(lit)) arrows.push(f);
    if (!f.endsWith('.md') && /\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤, ▸, ▾, ▴, ⓘ or ⋯ in shipped text, the .md files included (B14), and no "..." in the app's${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, '--page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', '--page')} / ${tok('dark', '--page')}) (B16)`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, '@font-face: the house rule word for word, and no other');
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module (B16)');
  const px = [...c.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const offScale = px.filter((v) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 21].includes(v));
  const big = [...c.matchAll(/([^{}]+)\{[^}]*font-size: 21px/g)].map((m) => m[1].trim());
  const weights = [...c.replace(/@font-face \{[^}]*\}/, '').matchAll(/font-weight:\s*(\d+)|font:\s*(\d{3}) /g)].map((m) => Number(m[1] || m[2]));
  ok(offScale.length === 0 && JSON.stringify(big) === '[".fig b"]' && weights.every((w) => [400, 560, 600, 620, 650].includes(w)),
    `type: sizes ${[...new Set(px)].sort((a, b) => a - b).join(', ')} px, the one 21 px figure ${big.join(', ')} (the next window's hours); weights ${[...new Set(weights)].join(', ')}${offScale.length ? ': off the scale ' + offScale.join(', ') : ''}`);
}

// 15. The scorer's arithmetic, line for line the stock app.js's (ART.md item 4), and the bugs on record
{
  const s = read('js/score.js');
  const STOCK = [
    "  if (!isNumber(limit)) return null;                       // rule not in use\n  if (!isNumber(value)) return { ok: false, comfort: 0 };  // no data is not a pass\n  if (limit <= 0) return { ok: value <= 0, comfort: value <= 0 ? 1 : 0 };\n  return { ok: value <= limit, comfort: clamp((limit - value) / limit) };",
    "  if (!band || !isNumber(band.min) || !isNumber(band.max)) return null;\n  if (!isNumber(value)) return { ok: false, comfort: 0 };\n  const { min, max } = band;\n  if (max <= min) return { ok: value === min, comfort: value === min ? 1 : 0 };\n  const half = (max - min) / 2;\n  const middle = (max + min) / 2;\n  return { ok: value >= min && value <= max, comfort: clamp((half - Math.abs(value - middle)) / half) };",
    "  return Math.max(low, Math.min(high, value));",
    "  const ms = Date.parse(stamp.slice(0, 16) + 'Z');\n  return Number.isNaN(ms) ? NaN : ms - offset * 1000;",
    "      golden = (epoch >= today.rise && epoch <= today.rise + span) ||\n               (epoch >= today.set - span && epoch <= today.set);",
    "    const active = checks.filter((check) => check.result !== null);\n    const comforts = active.map((check) => check.result.comfort);\n    const blocked = active.filter((check) => !check.result.ok).map((check) => check.label);\n    const score = comforts.length\n      ? Math.round(100 * comforts.reduce((sum, c) => sum + c, 0) / comforts.length)\n      : 0;",
    "  const need = isNumber(minHours) && minHours > 0 ? Math.ceil(minHours) : 1;",
    "        best: Math.max(...scores),\n        mean: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)",
    "      checks.push({ key: 'light', value: isDay, label: 'daylight', result: { ok: isDay === 1, comfort: isDay === 1 ? 1 : 0 } });",
    "      checks.push({ key: 'light', value: sunKnown ? 1 : null, label: 'golden hour', result: { ok: golden, comfort: golden ? 1 : 0 } });",
  ];
  const missing = STOCK.filter((x) => !s.includes(x));
  ok(missing.length === 0 && !/function (maxRule|bandRule|scoreHours|findWindows)/.test(app), `js/score.js holds the stock scorer's arithmetic line for line (${STOCK.length} passages: maxRule, bandRule, clamp, localToEpoch, the golden hour, the score, findWindows, both light rules) and app.js no copy of it${missing.length ? '; changed: ' + missing.map((x) => x.trim().slice(0, 40)).join(' | ') : ''}`);
  const B = [
    ['B1 dates built by hand from the phone\'s clock and the place\'s offset', /stampWhen\(s\.ms\)/.test(app) && !/toLocaleTimeString/.test(app)],
    ['B2 stale and ran out are sentences in ink, never a color', /el\('span', 'lead', lead\)/.test(app) && /'Stale\.'/.test(app) && /Forecast ran out \$\{span\(now - end\)\} ago\./.test(app) && /\.stamp \.lead \{ color: var\(--ink\); \}/.test(css) && !/classList\.(add|toggle)\('stale'/.test(app)],
    ['B3 the stamp is a button opening About; a broken file never empties it once one was read', /<button class="stamp" id="stamp" type="button" aria-haspopup="dialog" aria-describedby="stamp-hint">/.test(html) && /\$\('stamp'\)\.onclick = \(\) => about\(true\);/.test(app) && /if \(S\) \{[\s\S]{0,500}Still showing the forecast/.test(app)],
    ['B4 <main> is not a live region; one polite live region', /<main class="pane" id="main">/.test(html) && (html.match(/aria-live/g) || []).length === 1 && /<p class="sr" id="live" aria-live="polite"><\/p>/.test(html)],
    ['B5 a broken replacement keeps the view; the same files redraw only the stamp', /if \(S\) \{(?:(?!\} else \{)[\s\S])*box\.classList\.add\('kept'\);\s*\} else \{/.test(app) && !/if \(S\) \{(?:(?!\} else \{)[\s\S])*(replaceChildren\(\);|tabs'\)\.hidden)/.test(app.slice(app.indexOf('function fail('))) && /a\.text === texts\.snap && rulesText === texts\.rules\) \{ \$\('notice'\)\.hidden = true; refresh\(\); return; \}/.test(app)],
    ['B6 no hour is a 7 px button: the Shutters are one slider', !/el\('button', 'bar'\)/.test(app) && /role="slider" tabindex="0" aria-label="Hour"/.test(html)],
    ['B9 no unprinted "near" threshold', !/score >= 60|'near'|\.near/.test(app + css)],
    ['B10 values at the data\'s own precision, through js/units.js', /withUnit\(v, unit\)/.test(app) && !/num\(chosen\.|toFixed\(digits\)/.test(app)],
    ['B11 the first window of a run-out file is named as the first, never the best', /'First window in this file'/.test(app) && !/Best window in this/.test(app)],
    ['B12 a band missing an end is "Not used: needs both min and max"; the light rule read ignoring case', /'Not used: needs both min and max'/.test(app) && /const light = lightRule\(r\)/.test(app) && !/rules\.daylight === 'golden'/.test(app)],
    ['B16 the pane scrolls inside the frame under a still header', /\.pane \{[^}]*overflow-y: auto;/.test(css) && !/position: sticky/.test(css)],
    ['B17 rainfall shown in the readout, the table and the window\'s facts', /add\('rainfall', row\.precip, u\.precip\)/.test(app) && /th\('Rainfall', u\.precip\)/.test(app) && /'Most rainfall'/.test(app)],
  ];
  const bad = B.filter(([, okk]) => !okk).map(([nm]) => nm);
  ok(bad.length === 0, `the bugs on record stay fixed in the code: ${B.length} checked here (B7 above, B8 by palette.py and shoot.mjs, B13 to B16's page above, B6's sizes by shoot.mjs)${bad.length ? '; failing: ' + bad.join('; ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...mods];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's; 50,637 before the pass): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)}; none before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'outdoor-window.zip'); fs.rmSync(zip, { force: true });
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
ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}: plan 0011 D34, the lead's ruling on the measured 95,790; D5's 75,257 could not fit an app smaller than the face)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). NOTES.md keeps
// Open-Meteo's own address and the CC BY clause it quotes word for word.
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|behaviour\w*|recognis\w*|organis\w*|normalis\w*|analys(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|judgement\w*|for ever|amortis\w*|authoris\w*|categoris\w*|instalments?|artefacts?|cosy|cancell\w*|allotments?)\b/gi;
  const PHRASES = { 'NOTES.md': ['open-meteo.com/en/licence', 'provide a link to the licence'] };
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    read(f).split('\n').forEach((line, i) => {
      let l = line;
      for (const p of PHRASES[f] || []) l = l.split(p).join('');
      for (const m of l.matchAll(BRIT)) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files; Open-Meteo's address and the quoted CC BY clause in NOTES.md keep their words (B15)${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

// The app's own strings use only characters the face's cut draws (HOUSE.md 2.2's measured cmap)
{
  const R = [[0x20, 0x7e], [0xa0, 0xac], [0xae, 0x17f], [0x2009, 0x2009], [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e], [0x2026, 0x2026], [0x202f, 0x202f], [0x2032, 0x2033], [0x2212, 0x2212], [0x2264, 0x2265]];
  const inCut = (cp) => R.some(([a, b]) => cp >= a && cp <= b);
  const own = [...new Set([...[app, html, ...mods.map(read)].map((s, i) => (i === 1 ? htmlText(s) : strings(s).join(' '))).join(' ')].filter((ch) => ch.codePointAt(0) >= 0x20 && !inCut(ch.codePointAt(0))))];
  ok(own.length === 0, `the app's own strings use only characters the cut draws (no supplement)${own.length ? ': ' + own.join(' ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
