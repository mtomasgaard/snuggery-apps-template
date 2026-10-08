// Static checks for Earth's History (DESIGN §13). Node, no dependencies:
//   1. files: what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships;
//   3. every import / src / href / url( target and every data file the code names is relative,
//      inside the folder, and exists;
//   4. data/ holds exactly the fixed names of tools/CONTRACT.md plus the maps the manifest names;
//   5. miniapp.json is valid, at 1.1 (plan 0012; 1.0 before, HOUSE.md 13);
//   6. no AI vendor or product name in any shipped text file (the list is stored ROT13);
//   7. the app code is within its 250,000-byte budget (DESIGN §10);
//   8. the ZIP, built exactly as the template's build-zips.yml builds it, has index.html at its top and
//      is ≤ 8,000,000 bytes (its size is printed).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE_DIRS = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');

// 1. What the ZIP ships (build-zips.yml leaves out dotfiles and these top-level folders)
const shipped = [];
let maxDepth = 0, symlinks = 0, biggest = ['', 0], total = 0;
(function walk(dir, depth) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name), rel = path.relative(APP, abs);
    if (depth === 0 && e.isDirectory() && EXCLUDE_DIRS.has(e.name)) continue;
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
const code = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const withUrls = code.filter((f) => /https?:\/\//i.test(fs.readFileSync(path.join(APP, f), 'utf8')));
ok(withUrls.length === 0, `no http(s):// in ${code.length} .html/.css/.js files${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);

// 3. Relative references, all inside the folder, all present
const refs = [];
for (const f of code) {
  const src = fs.readFileSync(path.join(APP, f), 'utf8');
  const RE = /(?:import\s[^'"]*?from\s*|import\(\s*|\bsrc=|\bhref=|fetch\(|url\()\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(RE)) refs.push([f, m[1], path.dirname(f)]);
  // data.js builds its paths as base + 'name': every such literal must exist in data/.
  for (const m of src.matchAll(/base \+ '([A-Za-z0-9_./-]+\.(?:json|bin|webp))'/g)) refs.push([f, m[1], 'data']);
  for (const m of src.matchAll(/createLoader\('([^']+)'\)/g)) refs.push([f, m[1], '.']);
}
const bad = refs.filter(([, r, dir]) => {
  if (r.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
  const resolved = path.resolve(APP, dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0, `references: ${refs.length} (imports, src, href, url(), data files) — ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4. data/ holds exactly the claimed files
const FIXED = ['manifest.json', 'plates.bin', 'plates.json', 'coast.bin', 'coast.json', 'places.json', 'climate.bin', 'climate.json',
  'elevation.bin', 'elevation.json', 'curves.json', 'timescale.json', 'story.json', 'about.json'];
const manifest = JSON.parse(fs.readFileSync(path.join(APP, 'data/manifest.json'), 'utf8'));
const claimed = new Set([...FIXED, manifest.proxy.file, ...manifest.slices.map((s) => s.file)].map((f) => 'data/' + f));
const inData = shipped.filter((f) => f.startsWith('data/'));
const stray = inData.filter((f) => !claimed.has(f)), missing = [...claimed].filter((f) => !inData.includes(f));
ok(stray.length === 0 && missing.length === 0, `data/: ${inData.length} files = ${FIXED.length} fixed names + the proxy + ${manifest.slices.length} maps the manifest names${stray.length ? '; stray: ' + stray.join(', ') : ''}${missing.length ? '; missing: ' + missing.join(', ') : ''}`);

// 5. miniapp.json
let mini = null;
try { mini = JSON.parse(fs.readFileSync(path.join(APP, 'miniapp.json'), 'utf8')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Earth\'s History' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && mini.version === '1.1',
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 6. No AI vendor or product name in shipped text (story_check.py's list, stored ROT13 here), model family
//    names included: a build note naming the model that reviewed it would tell a stranger how it was made
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
const named = texts.filter((f) => namesRe.test(fs.readFileSync(path.join(APP, f), 'utf8')));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files${named.length ? ': ' + named.join(', ') : ''}`);

// 7. The code budget
const codeBytes = code.reduce((n, f) => n + fs.statSync(path.join(APP, f)).size, 0);
const perFile = code.map((f) => `${f} ${fmt(fs.statSync(path.join(APP, f)).size)}`).join(', ');
ok(codeBytes <= 250000, `app code ${fmt(codeBytes)} bytes (budget 250,000): ${perFile}`);

// 8. The ZIP, exactly as .github/workflows/build-zips.yml builds it
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'earth-history.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const list = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').filter((f) => !f.endsWith('/'));
const size = fs.statSync(zip).size;
ok(list.includes('index.html'), `ZIP has index.html at its top (${list.length} files)`);
ok(list.length === shipped.length && !list.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
ok(size <= 8000000, `ZIP size ${fmt(size)} bytes (cap 8,000,000)`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
