// Static checks for World Oil & Gas (HOUSE.md section 7.1; step 21 of the pass's change list, in
// tools/DECISIONS.md). Node, no dependencies but python3 for tools/art/palette.py; Global Weather's and
// Shelf Atlas's tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment (B10);
//   3. every import / src / href / url( / fetch( and data path is relative, inside the folder, present;
//   4. data/ holds exactly the four files, js/ the three modules, fonts/ the house face and OFL.txt at
//      the sha256 HOUSE.md pins; NOTES.md and About credit the face word for word;
//   5. the data is untouched: each data file's sha256 is the one recorded before the pass;
//   6. miniapp.json is valid, its name unchanged;
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credit line: creditLine() over the sources gives the stock app's words, written whole to a <p> (B7);
//   9. the marketing camera's strings (HOUSE.md 7.4) with their roles; every localStorage key wog.*, the
//      keys read before the pass still read but the two retired, wog.focus added;
//  10. SI: no plain space between a digit and a unit in the strings the app writes; toFixed and
//      toLocaleString only in js/units.js; no Intl (dates and numbers are built by hand);
//  11. nothing that carries a year transitions;
//  12. no innerHTML (the app held Global Weather's rule before the pass and keeps it), no
//      insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  13. app.js's THEMES equals `python3 tools/art/palette.py --json`, and palette.py passes;
//  14. the look: the house's chrome tokens exactly, in both themes; no box-shadow, backdrop-filter,
//      `transition: all`, uppercase or letter-spacing; one family, no monospace, every script font string
//      naming "Ysabeau Office" first; no middle dot in a string the app writes but the credit line's
//      separator, no em dash in the app's own strings (B11), no →, ➤, ▸, ▾, ⓘ or "..." in shipped text;
//      both theme-color metas; the @font-face rule; the page's language and viewport;
//  15. the bugs on record stay fixed in the code: the Play key's marks toggled by attribute (B2), no
//      hatch pattern (B4), the browser's search clear button switched off (HOUSE 4.8);
//  16. budgets: app code ≤ 200,000 bytes (the house's cap; the art pass's estimate was 203,000, owner
//      call 1), app.js ≤ 150,000 (the app's own figure, which NOTES.md states), fonts/ ≤ 160,000, and the
//      ZIP built exactly as build-zips.yml builds it ≤ 2,622,870 (2,068,029 × 1.25 + 37,834 for the face;
//      HOUSE.md section 8) with index.html at its top;
//  17. US spelling in every shipped text file, the data's own words allowed by file and word.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creditLine } from '../js/data.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const CODE_CAP = 200000, APP_JS_CAP = 150000, FONT_CAP = 160000, ZIP_CAP = 2622870;
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

// 2. No URL in the app's own code (B10: five scheme addresses in the stock app.js)
const web = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const withUrls = web.filter((f) => /https?:\/\//i.test(read(f)));
ok(withUrls.length === 0, `no http(s):// in ${web.length} .html/.css/.js files${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);

// 3. References: relative, inside the folder, present
const app = read('app.js'), data = read('js/data.js'), html = read('index.html'), css = read('style.css');
{
  const refs = [];
  for (const f of web) {
    const src = code(read(f), f);
    for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) if (!m[1].startsWith('data:')) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"`]([^'"`$]+)['"`]/g)) if (!m[1].startsWith('data:')) refs.push([f, m[1], '.']);
    for (const m of src.matchAll(/['`]\.?\/?((?:data|fonts|js)\/[A-Za-z0-9_.-]+\.(?:json|jpg|woff2|js))['`]/g)) refs.push([f, m[1], '.']);
  }
  const bad = refs.filter(([f, r, dir]) => {
    if (r.startsWith('#')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || (r.split('/').includes('..') && !/^\.\.\/(js|fonts)\//.test(r))) return true;
    const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
    return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
  });
  ok(bad.length === 0 && refs.length > 0, `references: ${refs.length} (imports, src, href, url(), fetch(), data paths): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
  ok(/fetch\(`\.\/\$\{path\}`/.test(app) && /img\.src = `\.\/data\/\$\{spec\.file\}`/.test(app) && /\/\^\[\\w-\]\+\(\\\.\[\\w-\]\+\)\*\\\.\(jpe\?g\|png\|webp\)\$\/i\.test\(r\.file\)/.test(app),
    'the data reads: the three files of FILES by name, and the relief only by a plain image name inside data/');
}

// 4. data/, js/ and fonts/ hold exactly the contract's files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('data', ['fields.json', 'relief.jpg', 'snapshot.json', 'world.json']);
exactly('js', ['data.js', 'track.js', 'units.js']);
exactly('fonts', ['ysabeau-office-gw.woff2', 'OFL.txt']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/no font (is |ships|is loaded)/i.test(read('NOTES.md') + css),
  'the face is credited word for word in NOTES.md and in About ("Type: …"), and nothing says no font ships');

// 5. The data is untouched (the hashes recorded before the pass, ART.md section 8, now tools/DECISIONS.md)
const DATA_SHA = {
  'data/fields.json': '19f1a6459a2eaa2a0a37e6682d39a848e052d6aa736938563d887aa0aa44aa23',
  'data/relief.jpg': 'c92737899f1ee7722f05db2a4bf76cbc8a4419d3f13bbcd8f16f97731e7184c9',
  'data/snapshot.json': 'adb9e6ee40ba21274c471445c6c3f3ed09648f1263fe83f96739d03821db175c',
  'data/world.json': '926c3cb93f753f722379f751ba90de427fb05b121f2fe4dcf43958d7e0352c96',
};
for (const [f, want] of Object.entries(DATA_SHA)) ok(sha(f) === want, `${f} sha256 ${sha(f).slice(0, 8)}… as before the pass`);

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'World Oil & Gas' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && typeof mini.version === 'string' && mini.version,
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
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

// 8. The credit line (B7: the stock button cut it to "… Natural Earth · G…" at every phone width)
{
  const snap = JSON.parse(read('data/snapshot.json')), fl = JSON.parse(read('data/fields.json'));
  const line = creditLine([...snap.sources.map((s) => s.attribution), fl.source.attribution]);
  ok(line === 'Sources: Energy Institute via Our World in Data · Natural Earth · Global Energy Monitor'
    && /setText\(\$\('credits'\), l\.length \? creditLine\(l\) : ''\)/.test(app) && /<p class="credits" id="credits" translate="no"><\/p>/.test(html),
  `the credit line: creditLine(the sources) is "${line}", written whole to the <p id="credits">`);
}

// 9. The marketing camera's strings (HOUSE.md 7.4) and the stored keys
{
  const btn = (label) => new RegExp(`<button[^>]*aria-label="${label}"`).test(html);
  const playName = /\$\('btn-play'\)\.setAttribute\('aria-label', on \? 'Pause' : 'Play'\)/.test(app);
  ok(btn('Play') && playName && btn('Show the controls') && btn('Hide the controls') && btn('Previous year') && btn('Next year') && /role="slider"[^>]*aria-label="Year"/.test(html),
    'camera: the button Play (named Pause while playing), Show the controls and Hide the controls; the year keys and the Year slider keep their names');
  const store = Object.fromEntries([...(app.match(/const STORE = \{([\s\S]*?)\};/) || ['', ''])[1].matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const keys = Object.values(store);
  const direct = [...app.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim()).filter((d) => d !== 'k');
  const calls = [...app.matchAll(/\bstore\.(?:get|set)\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  const before = { view: 'wog.view', units: 'wog.units', mode: 'wog.mode', year: 'wog.year', sel: 'wog.sel', fields: 'wog.fields', status: 'wog.status', labels: 'wog.labels',
    follow: 'wog.follow', accum: 'wog.accum', setting: 'wog.setting', ftype: 'wog.ftype', size: 'wog.size', hl: 'wog.hl', depth: 'wog.depth', terrain: 'wog.terrain' };
  const unread = Object.entries(before).filter(([n, k]) => store[n] !== k || !new RegExp(`store\\.get\\(STORE\\.${n}\\)`).test(app));
  const retired = ['wog.legend', 'wog.rings'].filter((k) => keys.includes(k) || app.includes(`'${k}'`));
  ok(keys.every((k) => k.startsWith('wog.')) && direct.length === 0 && calls.every((d) => /^STORE\.\w+$/.test(d)) && unread.length === 0 && store.focus === 'wog.focus'
    && /store\.get\(STORE\.focus\) === '1'/.test(app) && retired.length === 0,
  `storage: ${keys.length} keys, all wog.*; every call goes through STORE; the 16 read before the pass still read${unread.length ? ` (not: ${unread.map((u) => u[0]).join(', ')})` : ''}; wog.focus added; wog.legend (the legend no longer folds) and wog.rings (the rim is always drawn, owner call 6) retired`);
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only in js/units.js; no Intl
{
  const UNIT = /\d (TWh\/yr|TWh|PWh|GWh|kboe\/d|Gboe|Sm³\/d|Sm³ o\.e\.\/d|Sm³ o\.e\.|Sm³|bbl\/d|bbl|boe\/d|boe|km|%|m|px)(?![\w/³])/;
  const files = ['index.html', 'app.js', 'js/data.js', 'js/track.js'];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [htmlText(read(f))] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const fixedHits = [];
  for (const f of ['app.js', 'js/data.js', 'js/track.js']) read(f).split('\n').forEach((l, i) => { if (!/^\s*(\/\/|\*|\/\*)/.test(l) && /\.(toFixed|toLocaleString)\(|\bIntl\./.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  ok(fixedHits.length === 0 && !/\bIntl\./.test(code(read('js/units.js'), 'x.js')), `SI: toFixed and toLocaleString only in js/units.js, and no Intl anywhere (B9)${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Nothing that carries a year transitions
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.(valid|lead|track|time-row|ledger)\b|#slider|#valid-time|#lead|#track|#ledger/.test(sel) && /(transition|animation)\s*:\s*(?!\s|none)/.test(body));
  const none = /\.valid, \.lead, \.track, \.track canvas \{ transition: none; animation: none; \}/.test(css);
  ok(moving.length === 0 && none, `no transition or animation on the track, the year, the lead or the Ledger${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and style.css says none on them)'}`);
}

// 12. No markup from strings
{
  const all = web.map((f) => code(read(f), f)).join('\n');
  const uses = [...all.matchAll(/\.innerHTML\s*[+]?=/g)].length;
  ok(uses === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(all),
    `innerHTML: ${uses} uses (the app held Global Weather's rule before the pass and keeps it); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. THEMES is palette.py's, and palette.py's checks pass
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  let same = false, n = 0;
  try {
    const themes = JSON.parse((app.match(/^const THEMES = (\{.*\});$/m) || [])[1]);
    same = JSON.stringify(JSON.parse(json.stdout)) === JSON.stringify(themes);
    n = themes.light.ramp.length + themes.dark.ramp.length;
  } catch { /* reported below */ }
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  ok(same, `app.js's THEMES equals python3 tools/art/palette.py --json (${n} ramp stops, both themes' plates, the Ledger's ink)`);
}

// 14. The look
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|font-variant\s*:\s*small-caps/, 'monospace or small capitals']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace or small capitals${found.length ? ': ' + found.join(', ') : ''} (B12)`);
  const TOK = {
    light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const blockOf = (scheme) => (scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing')));
  const tok = (scheme, name) => (blockOf(scheme).match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} --${k} ${tok(s, k)}`);
  const T = JSON.parse((app.match(/^const THEMES = (\{.*\});$/m) || ['', '{}'])[1] || '{}');
  const own = T.light && tok('light', 'ledger') === T.light.ledger && tok('dark', 'ledger') === T.dark.ledger && tok('light', 'chart-oil') === T.light.chart.oil && tok('dark', 'chart-gas') === T.dark.chart.gas && tok('light', 'sea') === T.light.sea && tok('dark', 'sea') === T.dark.sea;
  ok(off.length === 0 && own && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--glass|--shadow|--warn|--note-/.test(c),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; this app's --ledger, --chart-oil, --chart-gas and --sea equal THEMES; html and body on --page; no accent, glass, shadow or warning token${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const fontScripts = ['app.js', 'js/track.js', 'js/data.js'].flatMap((f) => strings(read(f)).filter((s) => /\d(\.\d+)?px\s/.test(s) && /[a-z]/i.test(s.replace(/\d+(\.\d+)?px/g, ''))).map((s) => [f, s]));
  const badFonts = fontScripts.filter(([, s]) => !/^['"`]\d{3} \d+(\.\d+)?px "Ysabeau Office", system-ui, -apple-system, sans-serif['"`]$/.test(s));
  ok(families.length === 1 && families[0] === "'Ysabeau Office'" && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro|BlinkMac)/.test(c) && !/BlinkMacSystemFont|Segoe UI/.test(app) && fontScripts.length >= 5 && badFonts.length === 0,
    `one family: the @font-face's 'Ysabeau Office' through --face; ${fontScripts.length} font strings in the scripts, each naming "Ysabeau Office" first${badFonts.length ? ': ' + badFonts.map((b) => b.join(' ')).join(' | ') : ''}`);
  const dots = [], dashes = [];
  for (const f of ['app.js', 'js/data.js', 'js/track.js', 'js/units.js']) for (const s of strings(read(f))) {
    if (s.includes('·') && !(f === 'js/data.js' && s.includes(".join(' · ')"))) dots.push(`${f}: ${s.slice(0, 50)}`);
    if (s.includes('—')) dashes.push(`${f}: ${s.slice(0, 50)}`);
  }
  if (htmlText(html).includes('·')) dots.push('index.html');
  if (htmlText(html).includes('—') || /&mdash;/.test(code(html, 'x.html'))) dashes.push('index.html');
  ok(dots.length === 0 && /export const creditLine = \(attributions\) => `Sources: \$\{\[\.\.\.new Set\(attributions\.map\(shortSource\)\)\]\.join\(' · '\)\}`;/.test(data),
    `no middle dot in any string the app writes but the credit line's separator (its words are fixed by the sources)${dots.length ? ': ' + dots.join(' | ') : ''}`);
  ok(dashes.length === 0, `no em dash in the app's own strings (B11; a source's name printed from the data keeps its own)${dashes.length ? ': ' + dashes.join(' | ') : ''}`);
  const arrows = [];
  for (const f of shipped.filter((x) => /\.(html|css|js)$/.test(x))) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? htmlText(src) + code(src, f) : code(src, f);
    if (/[→➤▸▾▴ⓘ]|\\2(4D8|5B8|192)|&#x25B8;|&#x24D8;/i.test(lit)) arrows.push(f);
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤, ▸, ▾ or ⓘ (the face draws none of the last three) and no "..." in the text the app shows${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, 'page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', 'page')} / ${tok('dark', 'page')})`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, "one @font-face: 'Ysabeau Office' from fonts/ysabeau-office-gw.woff2, weight 400–650, font-display: block");
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module');
}

// 15. The bugs on record stay fixed in the code (each is also driven by tools/shoot.mjs)
ok(/\$\('ico-play'\)\.toggleAttribute\('hidden', on\)/.test(app) && /\$\('ico-pause'\)\.toggleAttribute\('hidden', !on\)/.test(app) && !/\.hidden = on;\s*\$\('ico-pause'\)/.test(app),
  'B2: the Play key\'s two marks are toggled by the hidden attribute, never an SVG expando');
ok(!/hatchPattern|hatchInk|createPattern/.test(app) && !/hatched (in every year|before their own|over)/i.test(app + html), 'B4: no hatch pattern on the map, and no sentence promising one');
ok(/::-webkit-search-cancel-button \{ appearance: none; -webkit-appearance: none; \}/.test(css), "Find: the browser's search clear button switched off (HOUSE 4.8)");

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...shipped.filter((f) => /^js\/[^/]+\.js$/.test(f))];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
ok(size('app.js') <= APP_JS_CAP, `app.js ${fmt(size('app.js'))} bytes (the app's own cap, ${fmt(APP_JS_CAP)}, as NOTES.md states it)`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)})`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'world-oil-gas.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => /^(tools|screenshots|raw)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/, raw/ or dotfiles`);
console.log(`     stored in the ZIP: data/ ${fmt(stored((n) => n.startsWith('data/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, *.md ${fmt(stored((n) => n.endsWith('.md') && !n.includes('/')))}`);
ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}: 2,068,029 before the pass × 1.25 + 37,834 for the face)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). The
// data's words are the sources' and are printed as data: allowed by file and word, nowhere else.
{
  const BRIT = /\b(judgement|colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|forevery\w*|behaviour\w*|recognis\w*|rasteris\w*|normalis\w*|quantis\w*|organis\w*|synchronis\w*|ellipsis(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|for ever)\b/gi;
  const ALLOW = { 'data/fields.json': ['Harbour', 'Greys', 'Greymouth', 'Greylock'] };   // operators, owners and places, as the tracker spells them
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    const allow = ALLOW[f] || [];
    read(f).split('\n').forEach((line, i) => {
      // the sources' `licence` key is the data's own spelling, read by the code as it is
      const l = line.replace(/\bs\.licence\b|"licence"|`licence`|'licence'/gi, '');
      for (const m of l.matchAll(BRIT)) if (!allow.includes(m[0])) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files, the data's own words allowed by file${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
