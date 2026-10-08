// Static checks for Global Wind: Global Weather's tools/check.mjs, copied by hand and changed for this
// app (one field, schema 1, the gw.* keys, its own budgets). Node, no dependencies but python3 for
// tools/art/palette.py:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( and data path is relative, inside the folder, present;
//   4. assets/ holds exactly world.json, places.json, LICENSES.md; data/ snapshot.json and
//      snapshot.sha256; fonts/ the one subset and OFL.txt, the subset's sha256 the one Global
//      Weather's ART.md names;
//   5. the data is untouched: data/snapshot.json's SHA-256 equals data/snapshot.sha256's line;
//   6. miniapp.json is valid, its version digits and dots and above the 1.1 plan 0012's pass started from;
//   7. no AI vendor or model name in any shipped text file (Warming World's list, stored ROT13; the
//      snapshot's planes skipped, its strings read);
//   8. the three credits, verbatim, in the CREDITS constant, written into About's first credits paragraph
//      (#about-credit-line) and nowhere on the front (plan 0012: no #credits, no source named outside About);
//   9. the marketing camera's strings: "Updated" written into the stamp, tabs whose text is Map and
//      Globe, buttons labelled Zoom in and Zoom out, every localStorage key gw.* and the seven keys
//      Global Wind 1.0 wrote still read;
//  10. SI: no plain space between a digit and a unit in strings the app writes; toFixed and
//      toLocaleString only in js/units.js and the allow-listed non-text uses;
//  11. no transition or animation on the track, the time row or the lead;
//  12. only `.innerHTML = ''` anywhere;
//  13. js/ramps.js equals the "wind" entry of `python3 tools/art/palette.py --json`, and palette.py
//      passes;
//  14. the look: no box-shadow, backdrop-filter, `transition: all`, uppercase or letter-spacing in
//      style.css; no middle dot in a string the app writes but CREDITS; no →, ➤ or "..." in shipped
//      text; both theme-color metas, each its theme's --page;
//  15. budgets: app code ≤ 200,000 bytes, fonts/ ≤ 160,000, and the ZIP built exactly as
//      build-zips.yml builds it ≤ 1,600,000 with index.html at its top and nothing else in it;
//  16. assets/LICENSES.md credits the face that ships and never says no font does; no British
//      spelling in any shipped text file (US English for a US audience), the snapshot's `licence`
//      key, which is data, excepted — with the two words Global Weather's sweep missed
//      ("millimetre", and "forevery" from a botched "for ever") now on the list;
//  17. the pair stays one voice: fonts/ and js/flow-math.js, flow.js, track.js, units.js are
//      byte-identical to ../global-weather's (skipped, and said so, when that folder is absent).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAMPS } from '../js/ramps.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
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
  for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
  for (const m of src.matchAll(/['`]\.?\/?((?:assets|data|fonts)\/[A-Za-z0-9_.-]+\.(?:json|woff2|md|sha256))['`]/g)) refs.push([f, m[1], '.']);
}
const bad = refs.filter(([f, r, dir]) => {
  if (r.startsWith('#') || r.startsWith('${')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
  const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0 && refs.length > 0, `references: ${refs.length} (imports, src, href, url(), fetch(), data paths): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4. assets/, data/ and fonts/ hold exactly the contract's files
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('assets', ['world.json', 'places.json', 'LICENSES.md']);
exactly('data', ['snapshot.json', 'snapshot.sha256']);
exactly('fonts', ['ysabeau-office-gw.woff2', 'OFL.txt']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the subset Global Weather's ART.md names (${FONT_SHA.slice(0, 12)}…)`);
ok(/Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')), 'fonts/OFL.txt names the face and carries the SIL Open Font License 1.1');
{
  const lic = read('assets/LICENSES.md');
  ok(/Ysabeau Office/.test(lic) && /SIL Open Font License 1\.1/.test(lic) && /fonts\/OFL\.txt/.test(lic) && !/no font/i.test(lic),
    'assets/LICENSES.md credits the face (Ysabeau Office, SIL Open Font License 1.1, fonts/OFL.txt) and never says no font is bundled');
}

// 5. The data is untouched
{
  const want = read('data/snapshot.sha256').trim().split(/\s+/)[0];
  const have = sha('data/snapshot.json');
  ok(have === want, `data/snapshot.json sha256 ${have.slice(0, 8)}…${have.slice(-6)} equals data/snapshot.sha256's line`);
}

// 6. miniapp.json (HOUSE §13: compared segment by segment, a missing segment 0)
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Global Wind' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && typeof mini.version === 'string'
    && /^\d+(\.\d+){1,2}$/.test(mini.version) && newer(mini.version, '1.1'),
  `miniapp.json: "${mini.name}" ${mini.version} (above the 1.1 this pass started from), entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 7. No AI vendor or model name in shipped text (Warming World's list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt|sha256)$/.test(f));
const noPlanes = (k, v) => (k === 'planes' ? undefined : v);
const named = texts.filter((f) => namesRe.test(f === 'data/snapshot.json' ? JSON.stringify(JSON.parse(read(f), noPlanes)) : read(f)));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files${named.length ? ': ' + named.join(', ') : ''}`);

// 8. The three credits
const app = read('app.js');
const credits = (app.match(/^const CREDITS = '([^']*)';$/m) || [])[1];
{
  const html = read('index.html');
  const front = html.slice(0, html.indexOf('<div class="about"')).replace(/<!--[\s\S]*?-->/g, '');
  const firstPara = /<h3>Sources and credits<\/h3>\s*<p id="about-credit-line" translate="no"><\/p>/.test(html);
  const written = /\$\('about-credit-line'\)\.textContent = CREDITS;/.test(app) && !/\$\('credits'\)/.test(app);
  const named = front.match(/NOAA|GFS|GeoNames|Natural Earth|CC BY|Ysabeau|Thalmann/g) || [];
  ok(credits === 'NOAA GFS, sampled · Natural Earth · GeoNames CC BY 4.0' && firstPara && written && !/id="credits"/.test(html) && !named.length,
    `the credit line: CREDITS is "${credits}", written into #about-credit-line, the first paragraph under About's Sources and credits; no #credits in index.html, and no source named on the front${named.length ? ' (found ' + named.join(', ') + ')' : ''}`);
}

// 9. The marketing camera's strings and keys
{
  const html = read('index.html');
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  const zooms = ['Zoom in', 'Zoom out'].every((l) => new RegExp(`<button[^>]*aria-label="${l}"`).test(html));
  const stamp = /const updated = `Updated /.test(app) && /el\.append\(document\.createTextNode\(updated\)\)/.test(app);
  const store = Object.fromEntries([...(app.match(/const STORE = \{([\s\S]*?)\};/) || ['', ''])[1].matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const keys = Object.values(store);
  // every localStorage call names a STORE key, or is the one-line store(key, value) helper whose callers do
  const direct = [...new Set([...app.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim()))]
    .filter((d) => !(d === 'key' && /const store = \(key, value\) => \{ try \{ localStorage\.setItem\(key, value\)/.test(app)));
  direct.push(...[...app.matchAll(/\bstore\(\s*([^,)]+),/g)].map((m) => m[1].trim()));
  const today = ['gw.view', 'gw.globe', 'gw.tab', 'gw.units', 'gw.heat', 'gw.night', 'gw.marker'];
  const read8 = today.every((k) => { const name = Object.keys(store).find((n) => store[n] === k); return name && new RegExp(`localStorage\\.getItem\\(STORE\\.${name}\\)`).test(app); });
  ok(JSON.stringify(tabs) === '["Map","Globe"]' && zooms && stamp,
    `camera: tabs ${JSON.stringify(tabs)}, buttons labelled "Zoom in" and "Zoom out" ${zooms ? 'present' : 'MISSING'}, the stamp writes "Updated …" ${stamp ? 'yes' : 'NO'}`);
  ok(keys.length >= 10 && keys.every((k) => k.startsWith('gw.')) && direct.every((d) => /^STORE\.\w+$/.test(d)) && read8,
    `storage: ${keys.length} keys, all gw.* (${keys.join(', ')}); every localStorage call goes through STORE; the seven keys Global Wind 1.0 wrote are still read`);
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only where allowed
{
  const UNIT = /\d (°C|°F|%|m\/s|km\/h|mm\/h|in\/h|hPa|inHg|kt|mph|h|d|km|min|s)(?![\w/])/;
  const files = ['index.html', 'app.js', ...shipped.filter((f) => /^js\/[^/]+\.js$/.test(f))];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);   // an interpolation counts as a number
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  // the allowed non-text uses: the globe's cache keys, and the test hooks' rounding of numbers
  const ALLOW = [/const key = `\$\{globe\.lon\.toFixed\(3\)\}/, /globe\.r\.toFixed\(2\)\}/, /flowMs: \+f\.flowMs\.toFixed\(3\)/, /return \+s\[Math\.min/];
  const fixedHits = [];
  for (const f of files.filter((x) => x.endsWith('.js') && x !== 'js/units.js')) {
    code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l) && !ALLOW.some((a) => a.test(l))) fixedHits.push(`${f}:${i + 1}`); });
  }
  ok(fixedHits.length === 0, `SI: toFixed/toLocaleString only in js/units.js and ${ALLOW.length} allow-listed non-text uses${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Nothing that carries a step transitions
const css = read('style.css');
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.(valid|lead|track)\b|#slider|#valid-time|#lead|#track/.test(sel)
    && /(transition|animation)\s*:\s*(?!\s|none)/.test(body));
  const none = rules.some(([sel, body]) => /\.valid, \.lead, \.track, \.track canvas/.test(sel) && /transition: none; animation: none/.test(sel + body));
  ok(moving.length === 0 && none, `no transition or animation on the track, the time row or the lead${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and style.css says none on them)'}`);
}

// 12. innerHTML only ever empties
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)\s*([^;\n]*)/g)) uses.push([f, m[1], m[2].trim()]);
  const badUses = uses.filter((u) => u[1] !== '=' || u[2] !== "''");
  ok(badUses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses, every one \`= ''\`; no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. The ramps are palette.py's, and palette.py's checks pass
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  let same = false;
  try { same = JSON.stringify({ wind: JSON.parse(json.stdout).wind }) === JSON.stringify(RAMPS); } catch { /* reported below */ }
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  ok(same && Object.keys(RAMPS).join() === 'wind', `js/ramps.js equals the "wind" entry of python3 tools/art/palette.py --json (${Object.values(RAMPS).reduce((n, l) => n + l.light.length + l.dark.length, 0)} stops)`);
  ok(/const LOOK = \{ stops: \(dark\) => RAMPS\.wind\[dark \? 'dark' : 'light'\], alpha: RAMPS\.wind\.alpha/.test(app), 'LOOK takes its stops and alpha rule from js/ramps.js');
}

// 14. The look
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase or letter-spacing${found.length ? ': ' + found.join(', ') : ''}`);
  const dots = [];
  for (const f of ['app.js', ...shipped.filter((x) => /^js\/[^/]+\.js$/.test(x))]) for (const s of strings(read(f))) if (s.includes('·') && !s.startsWith("'NOAA GFS, sampled")) dots.push(`${f}: ${s.slice(0, 50)}`);
  const htmlText = code(read('index.html'), 'index.html').replace(/<[^>]+>/g, ' ');
  if (htmlText.includes('·')) dots.push('index.html');
  ok(dots.length === 0, `no middle dot in any string the app writes but CREDITS${dots.length ? ': ' + dots.join(' | ') : ''}`);
  const arrows = [];
  for (const f of shipped.filter((x) => /\.(html|css|js)$/.test(x))) {
    const src = read(f);
    if (/[→➤]/.test(f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.md') ? '' : code(src, f))) arrows.push(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? code(src, f).replace(/<[^>]+>/g, ' ') : '';
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤ or "..." in the text the app shows (html, css and js strings; the .md files quote them only to forbid them)${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const tok = (scheme) => {
    const block = scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'));
    return (block.match(/--page:\s*(#[0-9a-f]{6})/i) || [])[1];
  };
  const metas = [...read('index.html').matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s)), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light')} / ${tok('dark')})`);
  ok(/@font-face\s*\{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;/.test(css),
    "@font-face: 'Ysabeau Office' from fonts/ysabeau-office-gw.woff2, weight 400–650, font-display: block");
}

// 15. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...shipped.filter((f) => /^js\/[^/]+\.js$/.test(f))];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= 200000, `app code ${fmt(codeBytes)} bytes (budget 200,000): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= 160000, `fonts/ ${fmt(fontBytes)} bytes (budget 160,000)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'global-wind.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data/ ${fmt(stored((n) => n.startsWith('data/')))}, assets/ ${fmt(stored((n) => n.startsWith('assets/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, *.md ${fmt(stored((n) => n.endsWith('.md') && !n.includes('/')))}`);
ok(zsize <= 1600000, `ZIP size ${fmt(zsize)} bytes (budget 1,600,000)`);

// 16. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole)
{
  const BRIT = /\b(judgement|colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|forevery\w*|behaviour\w*|recognis\w*|rasteris\w*|normalis\w*|quantis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|for ever)\b/i;
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt' && x !== 'data/snapshot.json')) {
    read(f).split('\n').forEach((line, i) => {
      const l = line.replace(/source\.licence|"licence":|snapshot's `licence`/g, '');
      const m = l.match(BRIT);
      if (m) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 2} shipped text files${hits.length ? ': ' + hits.slice(0, 12).join(', ') : ''}`);
}

// 17. The pair stays one voice: the face and the four shared modules are Global Weather's, byte for byte
{
  const SIB = path.resolve(APP, '..', 'global-weather');
  const SHARED = ['fonts/ysabeau-office-gw.woff2', 'fonts/OFL.txt', 'js/flow-math.js', 'js/flow.js', 'js/track.js', 'js/units.js'];
  if (!fs.existsSync(SIB)) console.log('skip ../global-weather is not here, so the shared files were not compared');
  else {
    const differ = SHARED.filter((f) => !fs.existsSync(path.join(SIB, f)) || !fs.readFileSync(path.join(APP, f)).equals(fs.readFileSync(path.join(SIB, f))));
    ok(differ.length === 0, `the pair's shared files are byte-identical to ../global-weather's (${SHARED.join(', ')})${differ.length ? '; differ: ' + differ.join(', ') : ''}`);
  }
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
