// Static checks for Finances (HOUSE.md section 7.1; ART.md; tools/DECISIONS.md, item 17). Node, no
// dependencies but python3 for tools/art/palette.py; Running Dashboard's tools/check.mjs in shape, changed
// for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( is relative, inside the folder, present; the one data read;
//   4. js/ holds the two modules, fonts/ the house face and its OFL.txt at the sha256 HOUSE.md pins, and
//      no supplement; NOTES.md and About credit the face word for word;
//   5. the data is pinned: the four data files' sha256 as they were before the pass;
//   6. miniapp.json is valid, its name unchanged, its description without a spaced em dash (B25);
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credits, word for word: the two constants, one written to the band on every pane;
//   9. the marketing camera's strings (HOUSE.md 7.4): the panes Overview and Spending as tabs built after
//      the snapshot parses, never in the static markup; the three stored keys kept, every access in try (B13);
//  10. SI: no plain space between a digit and a unit in the strings the app writes; toFixed and
//      toLocaleString only in js/units.js; no Intl, no en-GB, no nb-NO (B1, B3);
//  11. no transition anywhere, and only the house's three animations (the tracer, the card, About);
//  12. innerHTML never set (the app had 36 assignments, 2 of them markup from strings); no insertAdjacentHTML,
//      outerHTML, document.write, eval or new Function;
//  13. style.css's data tokens equal palette.py --json, which passes;
//  14. the look: the chrome tokens exactly in both themes, no accent, warning, shadow or stock token; no
//      box-shadow, backdrop-filter, `transition: all`, uppercase, letter-spacing, monospace; one family; no
//      middle dot, em dash or bullet in the app's own strings; no →, ➤, ▸, ▾, ▴ or "..." in shipped text,
//      PROMPT.md included (B23); both theme-color metas; the @font-face rule; the page's language and viewport;
//  15. the bugs on record (ART.md's B1 to B25, now in tools/DECISIONS.md) stay fixed in the code;
//  16. budgets: app code at most 200,000 bytes (the house's), fonts/ at most 160,000, the ZIP built exactly
//      as build-zips.yml builds it at most 125,304 (69,976 × 1.25 plus 37,834 for the face; plan 0011 D5, D26);
//  17. US spelling in every shipped text file, the data's own words allowed by file and word.
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
const CODE_CAP = 200000, FONT_CAP = 160000, ZIP_CAP = 131000 /* the lead's ruling on the build's measured 128 025 B (plan 0011 D27; tools/DECISIONS.md); 125 304 by D5's formula before it */;
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
const mods = ['js/units.js', 'js/balance.js'];
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
  ok(bad.length === 0 && refs.length >= 6, `references: ${refs.length} (imports, src, href, url(), fetch()): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} to ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
  const dataPaths = [...new Set(web.flatMap((f) => [...code(read(f), f).matchAll(/\.\/data\/[\w./-]+/g)].map((m) => m[0])))];
  ok(/const DATA_URL = '\.\/data\/snapshot\.json';/.test(app) && /fetch\(`\$\{DATA_URL\}\?t=\$\{Date\.now\(\)\}`/.test(app) && JSON.stringify(dataPaths) === '["./data/snapshot.json"]',
    `the data read: ${dataPaths.join(', ')} through DATA_URL, and nothing else`);
}

// 4. js/ and fonts/ hold exactly the contract's files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('js', ['balance.js', 'units.js']);
exactly('fonts', ['OFL.txt', 'ysabeau-office-gw.woff2']);
exactly('data', ['snapshot.json']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/no font ships|system font only/i.test(read('NOTES.md')),
  'the face is credited word for word in NOTES.md (the app\'s credits file) and About ("Type: …"); nothing says no font ships');

// 5. The data is pinned: the four files as they were before the pass (ART.md section 6). The pipeline's
// own check, `python3 scripts/make_demo_finances.py --check` (from Template/finances), rebuilds the snapshot.
const DATA_SHA = {
  'data/snapshot.json': '5d1c30a33c44213a5a56edfe5b787fc523c2c80414e64b6d1c72085d36085be0',
  'assets.json': '03ff325ae6655f0c6f127b572da62a2037d5278b3ae5d62f307409ae89f92e1c',
  'holdings.json': '6301079e6000f87e83ddcde779f9df78b68394e1bfca0b6eafc3748583d2bb86',
  'categories.json': '7d6e4a2f8ab3600e5e53ccc1facd0a74b1c1340fe397557a775184251a8ba60b',
};
{
  const off = Object.entries(DATA_SHA).filter(([f, want]) => !fs.existsSync(path.join(APP, f)) || sha(f) !== want).map(([f]) => f);
  ok(off.length === 0, `the data: ${Object.keys(DATA_SHA).join(', ')} byte-identical to before the pass${off.length ? '; changed: ' + off.join(', ') : ''}`);
}

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Finances' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && !/—/.test(mini.description) && typeof mini.version === 'string' && mini.version,
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters, no em dash (B25)`);
}

// 7. No AI vendor or model name in shipped text (Global Weather's list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
{
  const named = texts.filter((f) => namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credits, word for word: two constants (owner call 6), one written to the band, and the band only by them
const CREDITS = {
  example: 'Accounts, holdings and loans: invented for this example. Home index: Statistics Norway, table 07221 (NLOD).',
  real: 'Accounts: your banks, through Enable Banking (PSD2). Home index: Statistics Norway, table 07221 (NLOD).',
};
ok(app.includes(`  example: '${CREDITS.example}',\n  real: '${CREDITS.real}',`) && /\$\('credits'\)\.textContent = snap\.synthetic \? CREDITS\.example : CREDITS\.real;/.test(app)
  && (app.match(/\$\('credits'\)/g) || []).length === 1 && html.includes('<p class="credits" id="credits"></p>'),
  `the credits: "${CREDITS.example}" on the example data, "${CREDITS.real}" on a copy's own, written once into the band`);

// 9. The marketing camera's strings (HOUSE.md 7.4) and the stored keys
{
  const tabs = (app.match(/const TABS = \[([\s\S]*?)\];/) || ['', ''])[1];
  const built = /function buildTabs\(\) \{[\s\S]*?b\.setAttribute\('role', 'tab'\)/.test(app) && /stamp\(\);\s*buildTabs\(\);/.test(app) && /baseSnap = parsed;[\s\S]{0,200}boot\(\);/.test(app);
  ok(/\['overview', 'Overview'\]/.test(tabs) && /\['spending', 'Spending'\]/.test(tabs) && built && !/>\s*(Overview|Spending)\s*</.test(code(html, 'x.html')) && /<nav class="tabs" id="tabs" role="tablist" aria-label="Panes" hidden><\/nav>/.test(html),
    'camera: the panes Overview and Spending are buttons with role tab, built by buildTabs() after the snapshot parses and validates; the static markup holds no tab');
  const raw = [...app.matchAll(/localStorage\.(getItem|setItem|removeItem)\(/g)].length;
  const helpers = /function stored\(key, fallback\) \{\s*try \{ const v = localStorage\.getItem\(key\);[^\n]*\} catch \{ return fallback; \}\s*\}/.test(app)
    && /function store\(key, value\) \{\s*try \{ localStorage\.setItem\(key, value\); \} catch/.test(app);
  const keys = ['STORE_TAB', 'STORE_RANGE', 'STORE_BASIS'].every((k) => new RegExp(`stored\\(${k}`).test(app) && new RegExp(`store\\(${k}`).test(app));
  ok(raw === 2 && helpers && keys && /const STORE_TAB = 'fin\.tab';/.test(app) && /const STORE_RANGE = 'fin\.range';/.test(app) && /const STORE_BASIS = 'fin\.basis';/.test(app),
    'storage: fin.tab, fin.range and fin.basis, each still read and written, every access inside try/catch in stored() and store() (B13), no key added');
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only in js/units.js; no Intl
{
  const UNIT = /\d (kr|NOK|%|h|min|EUR|USD)(?![\w/])/;
  const files = ['index.html', 'app.js', ...mods];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [htmlText(read(f))] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const fixedHits = [];
  for (const f of ['app.js', 'js/balance.js']) code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString|toLocaleDateString|toLocaleTimeString)\(|\bIntl\.|en-GB|nb-NO/.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  ok(fixedHits.length === 0 && !/\bIntl\.|toLocale|en-GB|nb-NO/.test(code(read('js/units.js'), 'x.js')), `SI: toFixed only in js/units.js; no toLocale*, Intl, en-GB or nb-NO anywhere (B1, B3)${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Motion: no transition at all; only the tracer, the card and About animate, all under Reduce Motion
{
  const c = code(css, 'x.css');
  const anims = [...c.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]).sort();
  ok(!/transition\s*:/.test(c) && JSON.stringify(anims) === '["card-in","sheet-in","tracer-in"]' && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important; transition-duration: 0s !important;/.test(c)
    && !/behavior: 'smooth'|scrollTo\(\{/.test(app),
    `motion: no transition, the house's three animations (${anims.join(', ')}), every duration 0 s under Reduce Motion; no smooth scrolling; the Balance never moves`);
}

// 12. innerHTML never set
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)/g)) uses.push([f, m[1]]);
  ok(uses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses (36 before the pass, 2 of them markup from strings); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. The data tokens are palette.py's, and palette.py's checks pass
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  let PAL = null;
  try { PAL = JSON.parse(json.stdout); } catch { PAL = null; }
  const c = code(css, 'x.css');
  const block = (scheme) => (scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing')));
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries((PAL || {})[s] || {})) if ((block(s).match(new RegExp(`--${k}:\\s*(#[0-9a-f]{6})`)) || [])[1] !== v) off.push(`${s} --${k}`);
  ok(PAL && off.length === 0 && Object.keys(PAL.light).length === 7 && Object.keys(PAL.dark).length === 7,
    `style.css's 7 data tokens per theme (--series-1 to -6, --amount) equal palette.py --json${off.length ? ': differ ' + off.join(', ') : ''}`);
}

// 14. The look
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|font-variant\s*:\s*small-caps|Georgia|serif\b(?<!sans-serif)/, 'monospace, small capitals or a serif'], [/linear-gradient\(\s*(?:to |180deg|0deg)/, 'a gradient wash']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace, small capitals, serif or gradient wash${found.length ? ': ' + found.join(', ') : ''} (B16, B19)`);
  const TOK = {
    light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const blockOf = (scheme) => (scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing')));
  const tok = (scheme, name) => (blockOf(scheme).match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} --${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--glass|--shadow|--pos\b|--neg\b|--warn|--bad|--surface|--card|--chip|--ink-dim|--ink-faint|--line-soft/.test(c + app),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page; no accent, shadow, warning or stock token in the CSS or the code (B4, B5, B17, B19)${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  ok(families.length === 1 && families[0] === "'Ysabeau Office'" && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro|BlinkMac)/.test(c) && !/font-family|\bfont: ?['"`\d]/.test(code(app + read('js/balance.js'), 'x.js')),
    "one family: one @font-face rule of 'Ysabeau Office', used through --face; no font string in the scripts (SVG text takes the page's face)");
  const dots = [], dashes = [], bullets = [];
  for (const f of ['app.js', ...mods]) for (const s of strings(read(f))) {
    if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
    if (s.includes('—')) dashes.push(`${f}: ${s.slice(0, 50)}`);
    if (s.includes('•')) bullets.push(`${f}: ${s.slice(0, 50)}`);
  }
  if (/·/.test(htmlText(html))) dots.push('index.html');
  if (/—|&mdash;/.test(code(html, 'x.html'))) dashes.push('index.html');
  ok(dots.length === 0, `no middle dot in any string the app writes (B7; tell 6)${dots.length ? ': ' + dots.join(' | ') : ''}`);
  ok(dashes.length === 0 && bullets.length === 0, `no em dash in the app's own strings, no "—" for an absent value (B8; the data's own are shown as written), no bullet (the data's masks print as "ending 4417", B24)${dashes.length + bullets.length ? ': ' + [...dashes, ...bullets].join(' | ') : ''}`);
  const arrows = [];
  for (const f of [...web, ...shipped.filter((x) => /\.md$/.test(x))]) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? htmlText(src) + code(src, f) : f.endsWith('.css') ? code(src, f) : src;
    if (/[→➤▸▾▴ⓘ]|\\2(4D8|5B8|192)|&#x25B8;|&rarr;/i.test(lit)) arrows.push(f);
    if (!f.endsWith('.md') && /\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤, ▸, ▾, ▴ or ⓘ in shipped text, the .md files included (B19, B23), and no "..." in the app's${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, 'page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', 'page')} / ${tok('dark', 'page')}) (B21)`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, '@font-face: the house rule word for word, and no other');
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module (B21)');
  const px = [...c.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const off2 = px.filter((v) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 21, 16].includes(v));
  ok(off2.length === 0 && /\.search \{[^}]*font-size: 16px;/.test(c) && (c.match(/font-size: 16px/g) || []).length === 1,
    `type sizes: ${[...new Set(px)].sort((a, b) => a - b).join(', ')} px, the house scale and the search field's 16 px (iOS zooms into a smaller field)${off2.length ? ': off the scale ' + off2.join(', ') : ''}`);
}

// 15. The bugs on record (ART.md's change list, now in tools/DECISIONS.md: B1 to B25) stay fixed in the code
{
  const B = [
    ['B2 axes through units.axis(), never "m" for million', /axis\(lo, hi, snap\.currency\)/.test(app) && !/krAxis|\}m`/.test(app)],
    ['B3 today is the phone\'s day', !/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(app) && /export function todayIso/.test(read('js/units.js'))],
    ['B4 stale is a sentence', /el\('span', 'lead', lead\)/.test(app) && /\.stamp \.lead \{ color: var\(--ink\); \}/.test(css) && !/\.stale/.test(css)],
    ['B10 meta words drop repeats; masks as "ending"', /function meta\(name, words\)/.test(app) && /`ending \$\{m\.replace\(\/\\D\/g, ''\)\}`/.test(app)],
    ['B11 the spending window starts the day after `from`', /span\(plusDays\(s\.from, 1\), s\.to\)/.test(app)],
    ['B12 a broken replacement keeps the data', /if \(snap\) \{[\s\S]{0,300}Still showing the data from/.test(app) && !/\$\('main'\)\.hidden = true/.test(app)],
    ['B14 a finger waits: tap or slide, never on pointerdown', /if \(ev\.pointerType === 'touch'\) at = \[ev\.clientX, ev\.clientY\]/.test(app) && /\.chartwrap svg \{[^}]*touch-action: pan-y;/.test(css) && !/attachHover|\.tip \{|'tip'/.test(app + css)],
    ['B15 plurals', !/\$\{[^}]+\} days`|days ago`/.test(app) && /export function days\(n\)/.test(read('js/units.js'))],
    ['B17 no color for direction', !/'pos'|'neg'|var\(--(pos|neg)\)|style\.color/.test(app)],
    ['B18 the example sentence in About and the stamp, not on Overview', !/These are example numbers shipped with the app/.test(app) && /add\('Example data'/.test(app) && /'Example data\.'/.test(app)],
    ['B19 no title attribute for information, no disclosure triangles', !/\.title = |\btitle=|<details|<summary/.test(app + html)],
    ['B22 consent in US English', /'Authorize again with BankID before then\.'/.test(app) && !/authoris/i.test(app + html)],
    ['B25 miniapp.json without the em dash', mini && !/—/.test(mini.description)],
  ];
  const bad = B.filter(([, okk]) => !okk).map(([n]) => n);
  ok(bad.length === 0, `the bugs on record stay fixed in the code: ${B.length} checked here (B1, B7, B8, B16, B21, B23, B24 above; B5, B6, B9, B13, B20 by shoot.mjs and test_balance.mjs)${bad.length ? '; failing: ' + bad.join('; ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...mods];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's; 103,178 before the pass): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)}; none before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'finances.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => /^(tools|screenshots|scripts)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data and the three JSON files ${fmt(stored((n) => n.endsWith('.json') && n !== 'miniapp.json'))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, *.md ${fmt(stored((n) => n.endsWith('.md') && !n.includes('/')))}`);
ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}: 69,976 before the pass × 1.25 plus 37,834 for the face, plan 0011 D5; the lead's ruling on the measured 128,025, D27)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). The data's
// own words stay as the pipeline writes them until the data follow-up (owner call 2).
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|behaviour\w*|recognis\w*|organis\w*|analys(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|judgement\w*|for ever|amortis\w*|authoris\w*|categoris\w*|instalments?|artefacts?)\b/gi;
  const ALLOW = {
    'data/snapshot.json': ['amortised', 'modelled', 'Instalment', 'INSTALMENT'],
    'categories.json': ['categorises', 'CENTRE', 'INSTALMENT', 'Uncategorised'],
    'assets.json': ['modelled', 'Modelled'],
  };
  const PHRASES = { 'NOTES.md': ['Norwegian Licence for Open Government Data'] };   // a proper name
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    const allow = ALLOW[f] || [];
    read(f).split('\n').forEach((line, i) => {
      let l = line;
      for (const p of PHRASES[f] || []) l = l.split(p).join('');
      for (const m of l.matchAll(BRIT)) if (!allow.includes(m[0])) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files, the data's own words allowed by file (B22)${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
