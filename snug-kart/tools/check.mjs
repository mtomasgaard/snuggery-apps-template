// Static checks for Snug Kart (DESIGN.md §17.2; HOUSE.md 7.1, Global Weather's tools/check.mjs in
// shape, changed for a game). Node, no dependencies but python3 for tools/art/palette.py:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no external address in any shipped text file outside vendor/ (fonts/OFL.txt, the upstream
//      license quoted whole, excepted), and vendor/ byte-identical to ../anatomy/vendor/;
//   3. every import / src / href / url( / fetch( target is relative, inside the folder, present;
//   4. data/, fonts/ and vendor/ hold exactly their files; the face's and OFL.txt's sha256 are the
//      house's; NOTES.md credits the face and never says no font ships;
//   5. the data is untouched: both data files' sha256 are the values recorded before the pass;
//   6. miniapp.json is valid and still names "Snug Kart";
//   7. no borrowed names (the game's own list) and no AI vendor or model name (the house list), both
//      stored ROT13 so neither appears here;
//   8. the credits, word for word: three.js and the face in About, NOTES.md and DESIGN.md;
//   9. the marketing camera's string: one button whose text is exactly "Race"; every localStorage
//      access in js/store.js under snugkart:v1:, and today's three keys still read;
//  10. SI: no plain space between a digit and a unit in strings the game writes; toFixed and
//      toLocaleString only in js/units.js and the test hook's allow-listed non-text uses;
//  11. nothing that carries a number transitions (the race card, the record row, the captions);
//  12. innerHTML never set, and no insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  13. js/palette.js's TONES equals `python3 tools/art/palette.py --json`, and palette.py passes;
//  14. the look: the house tokens in both themes, one @font-face word for word, no other face and no
//      monospace, canvas text in the house face, no box-shadow, text-shadow, drop-shadow,
//      backdrop-filter, transition: all, uppercase or letter-spacing; no middle dot, →, ➤ or "...";
//      both theme-color metas;
//  15. the tracks in data/tracks.json pass the §5.2 checks (the table is printed);
//  16. budgets: app code (outside vendor/ and data/) at the held cap, fonts/ ≤ 160 000, and the ZIP
//      built exactly as build-zips.yml builds it ≤ 720 806 (and under the game's own 3 MB), with
//      index.html at its top and nothing else in it;
//  17. US spelling in every shipped text file, the data's names excepted (Harbour Loop, its id);
//  18. screenshots/app.png, the README's picture, unchanged.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TONES } from '../js/palette.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));

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

// 2. No external address outside vendor/; vendor/ identical to the reviewed copy
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f) && !f.startsWith('vendor/'));
const web = shipped.filter((f) => /\.(html|css|js)$/.test(f) && !f.startsWith('vendor/'));
// In .html, .css and .js not even the bare scheme (HOUSE.md 7.1); in the documents, a scheme or a
// protocol-relative //host followed by a host (DESIGN.md names the rule's words).
const URL_RE = /\bhttps?:\/\/[a-z0-9[]|(?<![:\w/*])\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\//i;
const withUrls = texts.filter((f) => f !== 'fonts/OFL.txt' && (/\.(html|css|js)$/.test(f) ? /https?:\/\//i : URL_RE).test(read(f)));
ok(withUrls.length === 0, `no external address in ${texts.length - 1} shipped text files outside vendor/, no http(s):// at all in .html, .css or .js (fonts/OFL.txt is the upstream license, quoted whole)${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);
const VENDOR = ['three.module.js', 'three.core.js', 'three-LICENSE.txt'];
for (const f of VENDOR) ok(sha(`vendor/${f}`) === crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, '..', 'anatomy', 'vendor', f))).digest('hex'), `vendor/${f} identical to ../anatomy/vendor/${f}`);

// 3. References: relative, inside the folder, present
const refs = [];
for (const f of web) {
  const src = code(read(f), f);
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\(|fetchJSON\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
}
const bad = refs.filter(([, r, dir]) => {
  if (r.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/')) return true;
  const resolved = path.resolve(APP, dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0 && refs.length > 20, `references: ${refs.length} (imports, src, href, url(), fetch()): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4. data/, fonts/ and vendor/ hold exactly their files; the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('data', ['racers.json', 'tracks.json']);
exactly('fonts', ['ysabeau-office-gw.woff2', 'OFL.txt']);
exactly('vendor', VENDOR);
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house's (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')), `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's (${OFL_SHA.slice(0, 12)}…), the SIL Open Font License 1.1`);

// 5. The data is untouched
const DATA = { 'data/tracks.json': '057541fb37ebf8f2420772c55c14c7b495c28f69304569f1273a96179f8a88ec', 'data/racers.json': '87dc6a99679ed050ffdc261b0adba4b4dee4b15c9b661d087eb795a919734846' };
for (const [f, want] of Object.entries(DATA)) ok(sha(f) === want, `${f} sha256 ${sha(f).slice(0, 8)}…${sha(f).slice(-6)} is the value recorded before the pass`);

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Snug Kart' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && typeof mini.version === 'string' && mini.version,
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 7. Names. The game's own list of borrowed names, and the house's list of AI vendor and model names.
{
  const BANNED_ROT13 = ['znevb', 'yhvtv', 'avagraqb', 'lbfuv', 'xbbcn', 'objfre', 'crnpu', 'gbnq', 'jnevb', 'jnyhvtv', 'qnvfl', 'ebfnyvan', 'qbaxrl xbat',
    'ynxvgh', 'furyy', 'onanan', 'fgne', 'zhfuebbz', 'envaobj ebnq', 'ohyyrg ovyy', 'oybbcre', 'fcval', 'gujbzc', 'obb',
    'zvav-gheob', 'tenaq cevk', '50pp', '100pp', '150pp', '200pp', 'fhcre ubea', 'cvenaun', 'obbzrenat sybjre',
    'sver sybjre', 'tbyqra zhfuebbz', 'vgrz obk'];
  const banned = BANNED_ROT13.map(rot13);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const nameRe = new RegExp(`(?<![A-Za-z0-9])(?:${banned.map(esc).join('|')})(?![A-Za-z0-9])`, 'gi');
  const hits = [];
  (function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), rel = path.relative(APP, p);
      if (rel === 'vendor' || rel.startsWith('tools/.work') || rel.startsWith('tools/node_modules') || e.name === '.DS_Store') continue;
      if (e.isDirectory()) { scan(p); continue; }
      if (!/\.(html|js|mjs|css|json|md|txt|py)$/.test(e.name) && !e.name.startsWith('.git')) continue;
      read(rel).split('\n').forEach((line, i) => { for (const m of line.matchAll(nameRe)) hits.push(`${rel}:${i + 1} (ROT13 "${rot13(m[0].toLowerCase())}")`); });
    }
  })(APP);
  ok(hits.length === 0, `no borrowed names (${banned.length} checked, tools/ included)${hits.length ? ':\n     ' + hits.join('\n     ') : ''}`);
  const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
  const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
  const named = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f) && namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in the shipped text files, vendor/ included${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credits, word for word
const html = read('index.html');
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
{
  ok(html.includes(`<p>Type: ${FONT_CREDIT}</p>`) && html.includes('<p>3D: three.js r186, MIT License, as follows.</p>') && /fetch\('vendor\/three-LICENSE\.txt'\)/.test(read('js/main.js')),
    'About carries the face\'s credit line word for word and three.js\'s, and prints vendor/three-LICENSE.txt as text');
  const notes = read('NOTES.md'), design = read('DESIGN.md');
  ok(notes.includes(FONT_CREDIT) && design.includes(FONT_CREDIT) && !/no font/i.test(notes), 'NOTES.md and DESIGN.md carry the face\'s credit line word for word; NOTES.md never says no font ships');
  ok(/REVISION = '186'/.test(fs.readFileSync(path.join(APP, 'vendor/three.core.js'), 'utf8').slice(0, 400)), 'vendor/three.core.js is r186, as About says');
}

// 9. The marketing camera's string and the stored keys
{
  const buttons = [...code(html, 'index.html').matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  const race = buttons.filter((t) => /^race$/i.test(t));
  ok(/<button id="btn-race" class="solid">Race<\/button>/.test(html) && race.length === 1 && !/aria-label="Race"/i.test(html),
    `camera: one button whose whole text is "Race" (#btn-race; ${race.length} in the markup); "Race again" does not match a whole-label search`);
  const store = read('js/store.js');
  const others = web.filter((f) => f !== 'js/store.js' && /localStorage|sessionStorage/.test(code(read(f), f)));
  const main = read('js/main.js');
  ok(/const PREFIX = 'snugkart:v1:';/.test(store) && others.length === 0
    && /store\.load\('settings'/.test(main) && /store\.save\('settings'/.test(main) && /loadRaw\(`best:\$\{trackId\}`\)/.test(store) && /save\(`best:\$\{trackId\}`/.test(store)
    && /store\.loadRaw\('hints'\)/.test(main) && /store\.save\('hints'/.test(main),
  `storage: every access in js/store.js under snugkart:v1: (settings, best:<track>, hints still read and written)${others.length ? '; also in ' + others.join(', ') : ''}`);
}

// 10. SI notation in what the game writes; toFixed and toLocaleString only where allowed
{
  const UNIT = /\d (m|km|%|s|ms|fps|m\/s|°)(?![\w/])/;
  const files = ['index.html', ...web.filter((f) => f.endsWith('.js'))];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const ALLOW = [/jsMs: \+G\.stats\.js\.toFixed\(2\), fps: \+G\.stats\.fps\.toFixed\(1\)/, /opacity: \+vk\.material\.opacity\.toFixed\(2\)/];
  const fixedHits = [];
  for (const f of files.filter((x) => x.endsWith('.js') && x !== 'js/units.js')) {
    code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l) && !ALLOW.some((a) => a.test(l))) fixedHits.push(`${f}:${i + 1}`); });
  }
  ok(fixedHits.length === 0, `SI: toFixed/toLocaleString only in js/units.js and the test hook's ${ALLOW.length} allow-listed lines${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Nothing that carries a number transitions
const css = read('style.css'), c = code(css, 'x.css');
{
  const rules = [...c.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /#card|#pos-n|#pos-of|#lap\b|#rtime|#last|#strip|#record|#caption|#res-place|#res-lead|#res-list|\.chart-cap/.test(sel)
    && /(transition|animation)\s*:\s*(?!\s*none)/.test(body));
  const none = /#card \*, #strip \{ transition: none; animation: none; \}/.test(c) && /#record, #record b, #caption, #racer-name, #racer-line \{ transition: none; animation: none; \}/.test(c);
  ok(moving.length === 0 && none, `no transition or animation on the race card, the record row, the captions or the results' figures${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and style.css says none on them)'}`);
}

// 12. No value reaches markup as markup
{
  const all = web.map((f) => code(read(f), f)).join('\n');
  ok(!/\.innerHTML\s*\+?=/.test(all) && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(all),
    'innerHTML never set (the settings are buttons with text, B14); no insertAdjacentHTML, outerHTML, document.write, eval or new Function');
}

// 13. The racers' tones are palette.py's, and palette.py's checks pass
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  let same = false;
  try { same = JSON.stringify(JSON.parse(json.stdout)) === JSON.stringify(TONES); } catch { /* reported below */ }
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  ok(same, `js/palette.js TONES equals python3 tools/art/palette.py --json (${Object.keys(TONES.light).length} racers, two themes)`);
}

// 14. The look
{
  const banned = [[/box-shadow/, 'box-shadow'], [/text-shadow/, 'text-shadow'], [/drop-shadow/, 'drop-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform/, 'text-transform'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|Menlo/, 'monospace']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, text-shadow, drop-shadow, backdrop-filter, transition: all, text-transform, letter-spacing or monospace${found.length ? ': ' + found.join(', ') : ''}`);
  const TOK = {
    light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)'));
  const dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('}', c.indexOf('@media (prefers-color-scheme: dark)') + 40) + 1);
  const tokOk = (block, t) => Object.entries(t).every(([k, v]) => new RegExp(`--${k}:\\s*${v};`, 'i').test(block));
  ok(tokOk(light, TOK.light) && tokOk(dark, TOK.dark) && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(light) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(light)
    && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(light) && /html, body \{[^}]*background: var\(--page\)/.test(c),
  'the house chrome tokens in both themes, --draw, --sheet-in and --face as HOUSE.md 3.1 gives them; html and body on var(--page)');
  ok((c.match(/@font-face/g) || []).length === 1 && /@font-face\s*\{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(c),
    "one @font-face: 'Ysabeau Office' from fonts/ysabeau-office-gw.woff2, weight 400–650, font-display: block");
  const families = [...c.matchAll(/font-family\s*:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((v) => v !== "'Ysabeau Office'");
  const shorthand = [...c.matchAll(/(?<![\w-])font\s*:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((v) => !/var\(--face\)$/.test(v) && v !== 'inherit');
  ok(families.length === 0 && shorthand.length === 0, `one family in the CSS, through --face${families.length + shorthand.length ? ': ' + [...families, ...shorthand].join(' | ') : ''}`);
  const scriptFonts = [];
  for (const f of web.filter((x) => x.endsWith('.js'))) {
    const src = code(read(f), f);
    for (const m of src.matchAll(/\.font\s*=\s*([^;]+);/g)) if (!/\$\{FONT\}/.test(m[1])) scriptFonts.push(`${f}: ${m[1].slice(0, 40)}`);
    if (/fillText|strokeText/.test(src) && f !== 'js/chart.js') scriptFonts.push(`${f} draws text`);
  }
  ok(scriptFonts.length === 0 && /const FONT = '"Ysabeau Office", system-ui, sans-serif';/.test(read('js/chart.js')) && /document\.fonts\.load\('560 10\.5px "Ysabeau Office"'\)/.test(read('js/main.js')),
    `canvas text: only js/chart.js draws it, every font string through FONT, which names "Ysabeau Office" first; boot waits for the face${scriptFonts.length ? ': ' + scriptFonts.join(' | ') : ''}`);
  const dots = [], arrows = [];
  for (const f of web) {
    const src = read(f), lit = f.endsWith('.js') ? strings(src).join('\n') : code(src, f).replace(/<[^>]+>/g, ' ');
    if (lit.includes('·') || / — /.test(lit)) dots.push(f);
    if (/[→➤]/.test(lit) || /\w\.\.\.(?!\w)|\.\.\.\s/.test(lit.replace(/\.\.\.[A-Za-z(]/g, ''))) arrows.push(f);
  }
  ok(dots.length === 0, `no middle dot and no spaced em dash in any string the game writes (it has no credit constant on screen; B4, B10)${dots.length ? ': ' + dots.join(', ') : ''}`);
  ok(arrows.length === 0, `no →, ➤ or "..." in the text the game shows${arrows.length ? ': ' + arrows.join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === TOK[s].page), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${TOK.light.page} / ${TOK.dark.page})`);
  ok(/<html lang="en-US">/.test(html) && /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/.test(html) && !/user-scalable|maximum-scale/.test(html),
    'index.html: lang="en-US", the viewport without user-scalable or maximum-scale (B1)');
  ok(!/aria-live/.test(html.replace('<p id="live" class="sr" aria-live="polite"></p>', '')) && /<p id="live" class="sr" aria-live="polite"><\/p>/.test(html),
    'one polite live region, and the place is not one (B6)');
}

// 15. Tracks
{
  const { loadTracks } = await import(path.join(APP, 'js/track.js'));
  try {
    const tracks = loadTracks(JSON.parse(read('data/tracks.json')));
    console.log('     track            length   height        width      min radius   max grade  corridors');
    for (const t of tracks) {
      const v = t.validation;
      console.log(`     ${t.name.padEnd(15)} ${Math.round(v.length).toLocaleString('en-US').padStart(6)} m  ${v.minY.toFixed(1)}…${v.maxY.toFixed(1)} m`.padEnd(42) +
        `${Math.round(v.minW)}…${Math.round(v.maxW)} m`.padEnd(11) + `${v.minRadius.toFixed(1)} m`.padEnd(13) + `${(v.maxGrade * 100).toFixed(1)} %`.padEnd(11) +
        (v.crossover ? `one crossover, ${v.clearance.toFixed(1)} m clearance` : 'no overlap'));
    }
    ok(true, `tracks: ${tracks.length} pass radius, corridor, grade and grid checks`);
  } catch (e) { ok(false, `tracks: ${e.message}`); }
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
// The code cap: the game was already over the house's 200 000 B when the pass started, so it is
// held at that size (plan 0011 D5, D19) until the lead rules on the measured figure.
const CODE_CAP = 244000; // the lead's ruling on the build's measured 240 048 B (plan 0011 D20; tools/DECISIONS.md); held at 220 070 before it
const codeFiles = web.filter((f) => !f.startsWith('data/'));
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the lead's ruling, plan 0011 D20; 220,070 held before it; outside vendor/ and data/): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= 160000, `fonts/ ${fmt(fontBytes)} bytes (budget 160,000)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'snug-kart.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').filter((n) => !n.endsWith('/'));
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html') && names.length === shipped.length && names.every((n) => shipped.includes(n)),
  `ZIP has index.html at its top and holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
ok(zsize <= 720806 && zsize < 3 * 2 ** 20, `ZIP size ${fmt(zsize)} bytes (cap 720,806: 546,378 × 1.25 + 37,834 for the face; the game's own limit 3 MB)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole;
// the track's name "Harbour Loop", its id and ground `harbour` and the identifiers that read them are data)
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|forevery\w*|behaviour\w*|recognis\w*|rasteris\w*|normalis\w*|quantis\w*|organis\w*|initialis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|for ever|cosy|kerbs?|tyres?)\b/i;
  const DATA_NAMES = /Harbour Loop|`harbour`|'harbour'|"harbour"|harbourProps|race-harbour|best:harbour/g;
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    read(f).split('\n').forEach((line, i) => { const m = line.replace(DATA_NAMES, '').match(BRIT); if (m) hits.push(`${f}:${i + 1} ${m[0]}`); });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files${hits.length ? ': ' + hits.slice(0, 12).join(', ') : ''}`);
}

// 18. The README's picture
ok(sha('screenshots/app.png') === '6568ae797c44d88b07c0d4204c0361b9e9b3680c435ef13e046de2ff3629239c', 'screenshots/app.png (the README\'s picture) unchanged');

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
