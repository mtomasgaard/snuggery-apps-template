// Static checks for Shelf Atlas (HOUSE.md section 7.1; step 20 of the pass's change list, in
// tools/DECISIONS.md). Node, no dependencies but python3 for tools/art/palette.py; Global Weather's
// tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( and data path is relative, inside the folder, present;
//   4. data/ holds exactly geo.json, snapshot.json, bathy.png; js/ the three modules; fonts/ the house
//      face and OFL.txt, both at the sha256 HOUSE.md pins; NOTES.md credits the face;
//   5. the data is the data follow-up's rebuild: each data file's sha256 is the one tools/DECISIONS.md records;
//   6. miniapp.json is valid, its name unchanged;
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credit line: built from the snapshot's sources by creditLine(), written to #credits, and for
//      the shipped snapshot exactly the stock app's words;
//   9. the marketing camera's strings (HOUSE.md 7.4) with their roles; every localStorage key sa.*, the
//      keys read before the pass still read, sa.focus and the rings' `peaks` added, two retired;
//  10. SI: no plain space between a digit and a unit in the strings the app writes; toFixed and
//      toLocaleString only in js/units.js;
//  11. nothing that carries a month transitions;
//  12. no innerHTML (the app holds Global Weather's rule) and no insertAdjacentHTML, outerHTML,
//      document.write, eval or new Function;
//  13. app.js's THEMES equals `python3 tools/art/palette.py --json`, and palette.py passes;
//  14. the look: the house's chrome tokens exactly, in both themes; no box-shadow, backdrop-filter,
//      `transition: all`, uppercase or letter-spacing; one family, no monospace, every script font string
//      naming "Ysabeau Office" first; no middle dot in a string the app writes but the credit line's
//      separator; no →, ➤ or "..." in shipped text; both theme-color metas; the @font-face rule;
//  15. budgets: app code ≤ 200,000 bytes (the house's cap, the lead's ruling in plan 0011 D15; the
//      app's own 150 KB was never enforced), fonts/ ≤ 160,000, and the ZIP built exactly as build-zips.yml builds
//      it ≤ 2,413,130 (1,900,237 × 1.25 + 37,834 for the face; HOUSE.md section 8) with index.html at its top;
//  16. US spelling in every shipped text file, the data's own words allow-listed by file and word.
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
const CODE_CAP = 200000, FONT_CAP = 160000, ZIP_CAP = 2413130;
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);

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

// 3. References: relative, inside the folder, present
const refs = [];
for (const f of web) {
  const src = code(read(f), f);
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) if (!m[1].startsWith('data:')) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"`]([^'"`$]+)['"`]/g)) if (!m[1].startsWith('data:')) refs.push([f, m[1], '.']);
  for (const m of src.matchAll(/['`]\.?\/?((?:data|fonts|js)\/[A-Za-z0-9_.-]+\.(?:json|png|woff2|js))['`]/g)) refs.push([f, m[1], '.']);
}
for (const n of ['geo.json', 'snapshot.json']) if (/fetchJSON\('/.test(read('app.js')) && read('app.js').includes(`fetchJSON('${n}')`)) refs.push(['app.js', `data/${n}`, '.']);
const bad = refs.filter(([f, r, dir]) => {
  if (r.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..') && !/^\.\.\/(js|fonts)\//.test(r)) return true;
  const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0 && refs.length > 0, `references: ${refs.length} (imports, src, href, url(), fetch(), data paths): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
ok(/fetch\(`\.\/data\/\$\{name\}`/.test(read('app.js')) && /fetch\(`\.\/data\/\$\{meta\.file\}`/.test(read('app.js')) && /\^\[\\w\.-\]\+\\\.png\$/.test(read('app.js')),
  'the data reads: ./data/geo.json and ./data/snapshot.json by name, and the bathymetry file only by a plain .png name inside data/');

// 4. data/, js/ and fonts/ hold exactly the contract's files
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('data', ['bathy.png', 'geo.json', 'snapshot.json']);
exactly('js', ['data.js', 'track.js', 'units.js']);
exactly('fonts', ['ysabeau-office-gw.woff2', 'OFL.txt']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && read('index.html').includes(`Type: ${FONT_CREDIT}`) && !/no font (is |ships|is loaded)/i.test(read('NOTES.md') + read('style.css')),
  'the face is credited word for word in NOTES.md and in About ("Type: …"), and nothing says no font ships');

// 5. The data is the data follow-up's rebuild (2026-10-02, tools/DECISIONS.md): the pipeline reading each DBF in its
// declared encoding, the fetchers' prose in US English, and the sources as they stood that day. The pass left the
// data untouched; the hashes it recorded before it began are in tools/DECISIONS.md.
const DATA_SHA = {
  'data/bathy.png': 'a97b5bf5e64900ca241628c0f8b10c90256f3bf7c5b75929288d206eb9fb4b51',
  'data/geo.json': '4dc10f498ef23a2a5c441386b40e839ae222a8df5fe6df96cd1235895b0b1448',
  'data/snapshot.json': 'ea6c01e73f4370b756e0193d9982bc35c676a7a042814918150951b153b11932',
};
for (const [f, want] of Object.entries(DATA_SHA)) ok(sha(f) === want, `${f} sha256 ${sha(f).slice(0, 8)}… is the data follow-up's rebuild`);

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Shelf Atlas' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && typeof mini.version === 'string' && mini.version,
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 7. No AI vendor or model name in shipped text (Global Weather's list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
const named = texts.filter((f) => namesRe.test(read(f)));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files${named.length ? ': ' + named.join(', ') : ''}`);

// 8. The credit line
const app = read('app.js'), data = read('js/data.js');
{
  const snap = JSON.parse(read('data/snapshot.json'));
  const line = creditLine(snap);
  ok(line === 'Natural Earth · Marine Regions CC BY · EMODnet CC BY · Sodir NLOD · NSTA · Danish Energy Agency · NLOG'
    && /\$\('credits'\)\.textContent = creditLine\(snap\);/.test(app) && /<p class="credits" id="credits" translate="no"><\/p>/.test(read('index.html')),
  `the credit line: creditLine(snapshot) is "${line}", written whole to the <p id="credits"> (B3: it was a cut-off button)`);
}

// 9. The marketing camera's strings (HOUSE.md 7.4) and the stored keys
{
  const html = read('index.html');
  const btn = (label) => new RegExp(`<button[^>]*aria-label="${label}"`).test(html);
  const radio = (word) => new RegExp(`<button type="button" role="radio" data-m="\\w+" aria-checked="\\w+">${word}</button>`).test(html);
  const playName = /\$\('btn-play'\)\.setAttribute\('aria-label', on \? 'Pause' : 'Play'\)/.test(app);
  ok(btn('Play') && playName && btn('Back one year') && radio('Rate') && radio('Cumulative') && btn('Show the controls') && btn('Hide the controls')
    && !/aria-label="(Rate|Cumulative)"/.test(html) && (html.match(/>Rate</g) || []).length === 1,
  'camera: the button Play (Pause while playing), the button Back one year, the radios Rate and Cumulative by their own text with no aria-label, Show the controls and Hide the controls');
  const store = Object.fromEntries([...(app.match(/const STORE = \{([\s\S]*?)\};/) || ['', ''])[1].matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const keys = Object.values(store);
  const direct = [...app.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim()).filter((d) => d !== 'key');
  const calls = [...app.matchAll(/\b(?:store|recall|recallJSON)\(\s*([^,)]+)/g)].map((m) => m[1].trim()).filter((d) => d !== 'key');
  const before = ['sa.view', 'sa.month', 'sa.qty', 'sa.units', 'sa.countries', 'sa.sel', 'sa.layers', 'sa.mode'];
  const readNow = before.every((k) => { const n = Object.keys(store).find((x) => store[x] === k); return n && new RegExp(`recall(JSON)?\\(STORE\\.${n}\\)`).test(app); });
  const retired = ['sa.speed', 'sa.key'].filter((k) => keys.includes(k) || app.includes(`'${k}'`));
  ok(keys.every((k) => k.startsWith('sa.')) && direct.length === 0 && calls.every((d) => /^STORE\.\w+$/.test(d)) && readNow && store.focus === 'sa.focus'
    && /recall\(STORE\.focus\) === '1'/.test(app) && /\[\.\.\.LAYERS, 'peaks'\]/.test(app) && retired.length === 0,
  `storage: ${keys.length} keys, all sa.* (${keys.join(', ')}); every call goes through STORE; the eight read before the pass still read; sa.focus and peaks added; sa.speed (the speed key, owner call 3) and sa.key (the stock legend's key) retired`);
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only in js/units.js
{
  const UNIT = /\d (Sm³\/d|Sm³ o\.e\.\/d|Sm³ o\.e\.|Sm³|bbl\/d|bbl|scf\/d|scf|boe\/d|boe|km|mm|in|%|m|px)(?![\w/³])/;
  const files = ['index.html', 'app.js', 'js/data.js', 'js/track.js'];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, "'")] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const fixedHits = [];
  for (const f of ['app.js', 'js/data.js', 'js/track.js']) code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  ok(fixedHits.length === 0, `SI: toFixed and toLocaleString only in js/units.js${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Nothing that carries a month transitions
const css = read('style.css');
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.(valid|lead|track|time-row)\b|#slider|#valid-time|#lead|#track/.test(sel) && /(transition|animation)\s*:\s*(?!\s|none)/.test(body));
  const none = /\.valid, \.lead, \.track, \.track canvas \{ transition: none; animation: none; \}/.test(css);
  ok(moving.length === 0 && none, `no transition or animation on the track, the month or the lead${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and style.css says none on them)'}`);
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
  ok(same, `app.js's THEMES equals python3 tools/art/palette.py --json (${n} ramp stops, both themes' plates)`);
}

// 14. The look
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|font-variant\s*:\s*small-caps/, 'monospace or small capitals']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace or small capitals${found.length ? ': ' + found.join(', ') : ''}`);
  const TOK = {
    light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const blockOf = (scheme) => (scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing')));
  const tok = (scheme, name) => (blockOf(scheme).match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} --${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const fontScripts = ['app.js', 'js/track.js', 'js/data.js'].flatMap((f) => strings(read(f)).filter((s) => /\d(\.\d+)?px\s/.test(s) && /[a-z]/i.test(s.replace(/\d+(\.\d+)?px/g, ''))).map((s) => [f, s]));
  const badFonts = fontScripts.filter(([, s]) => !/^['"`]\d{3} \d+(\.\d+)?px "Ysabeau Office", system-ui, -apple-system, sans-serif['"`]$/.test(s));
  ok(families.length === 1 && families[0] === "'Ysabeau Office'" && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro)/.test(c) && fontScripts.length >= 3 && badFonts.length === 0,
    `one family: the @font-face's 'Ysabeau Office' through --face; ${fontScripts.length} font strings in the scripts, each naming "Ysabeau Office" first${badFonts.length ? ': ' + badFonts.map((b) => b.join(' ')).join(' | ') : ''}`);
  const dots = [];
  for (const f of ['app.js', 'js/data.js', 'js/track.js', 'js/units.js']) for (const s of strings(read(f))) if (s.includes('·') && !(f === 'js/data.js' && s === "' · '")) dots.push(`${f}: ${s.slice(0, 50)}`);
  if (code(read('index.html'), 'index.html').replace(/<[^>]+>/g, ' ').includes('·')) dots.push('index.html');
  ok(dots.length === 0 && /export const creditLine = \(snap\) => \[\.\.\.new Set\(allSources\(snap\)\.map\(shortSource\)\)\]\.join\(' · '\);/.test(data),
    `no middle dot in any string the app writes but the credit line's separator (its words are fixed by the sources)${dots.length ? ': ' + dots.join(' | ') : ''}`);
  const arrows = [];
  for (const f of shipped.filter((x) => /\.(html|css|js)$/.test(x))) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? code(src, f).replace(/<[^>]+>/g, ' ') : code(src, f);
    if (/[→➤▸▾▴]/.test(lit)) arrows.push(f);
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤, ▸, ▾ or "..." in the text the app shows (html, css and js strings)${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...read('index.html').matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, 'page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', 'page')} / ${tok('dark', 'page')})`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && (css.match(/@font-face/g) || []).length === 1, "one @font-face: 'Ysabeau Office' from fonts/ysabeau-office-gw.woff2, weight 400–650, font-display: block");
  ok(/<html lang="en-US">/.test(read('index.html')) && /viewport-fit=cover/.test(read('index.html')) && !/user-scalable/.test(read('index.html')) && /<meta name="color-scheme" content="light dark">/.test(read('index.html')),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark');
}

// 15. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...shipped.filter((f) => /^js\/[^/]+\.js$/.test(f))];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the house's, plan 0011 D15): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)})`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'shelf-atlas.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data/ ${fmt(stored((n) => n.startsWith('data/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, *.md ${fmt(stored((n) => n.endsWith('.md') && !n.includes('/')))}`);
ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}: 1,900,237 before the pass × 1.25 + 37,834 for the face)`);

// 16. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). The
// data's words are the regulators' and are printed as data: allowed by file and word, nowhere else.
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|forevery\w*|behaviour\w*|recognis\w*|rasteris\w*|normalis\w*|quantis\w*|organis\w*|synchronis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|for ever)\b/gi;
  const ALLOW = {
    'data/snapshot.json': ['Harbour'],                       // an operator (the data follow-up swept the fetchers' own prose)
    'data/geo.json': ['CENTRE', 'Centre', 'Harbour'],        // pipeline and platform names, an operator
  };
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    const allow = ALLOW[f] || [];
    read(f).split('\n').forEach((line, i) => {
      // the sources' `licence` key is the data's own spelling, read by the code as it is
      // and three licenses keep their publishers' names (NLOD's, NSTA's, and the UK's Open Government Licence)
      const l = line.replace(/\bs\.licence\b|\blicence: |"licence"|`licence`|'licence'|NSTA Open User Licence|Norwegian Licence for Open Government Data|Government Licence/gi, '');
      for (const m of l.matchAll(BRIT)) if (!allow.includes(m[0])) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files, the data's own words allowed by file${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
