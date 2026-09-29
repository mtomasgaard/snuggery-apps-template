// Static checks for Snug Kart (DESIGN.md §17.2). Node, no dependencies:
//   1. files: the ZIP's contents stay within Snuggery's limits (count, depth, size, no symlinks);
//   2. no external URLs outside vendor/, and vendor/ byte-identical to ../anatomy/vendor/;
//   3. every import / src / href / fetch target is relative and stays inside the folder;
//   4. no borrowed names: a whole-word scan for a banned list, stored ROT13 so it never appears here;
//   5. the tracks in data/tracks.json pass the §5.2 checks (the table is printed);
//   6. the ZIP, built exactly as the template's workflow does, has index.html at its top and is < 3 MB.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE_DIRS = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);

// 1. Files (with the ZIP's exclusions)
const shipped = [];
let maxDepth = 0, symlinks = 0, biggest = 0;
(function walk(dir, depth) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = path.relative(APP, path.join(dir, e.name));
    if (depth === 0 && e.isDirectory() && EXCLUDE_DIRS.has(e.name)) continue;
    if (e.isSymbolicLink()) { symlinks++; continue; }
    if (e.isDirectory()) { maxDepth = Math.max(maxDepth, depth + 1); walk(path.join(dir, e.name), depth + 1); }
    else { shipped.push(rel); biggest = Math.max(biggest, fs.statSync(path.join(APP, rel)).size); }
  }
})(APP, 0);
ok(shipped.length <= 10000 && maxDepth <= 16 && symlinks === 0 && biggest <= 128 * 2 ** 20,
  `files: ${shipped.length} shipped, folder depth ${maxDepth}, ${symlinks} symlinks, largest ${(biggest / 1024).toFixed(0)} KB`);

// 2. No external URLs outside vendor/; vendor identical to the reviewed copy.
const text = shipped.filter((f) => /\.(html|js|css|json|md|txt)$/.test(f) && !f.startsWith('vendor/'));
// A scheme followed by a host, or a protocol-relative //host.tld/ — not the bare words of a rule.
const URL_RE = /\bhttps?:\/\/[a-z0-9[]|(?<![:\w/*])\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\//i;
const withUrls = text.filter((f) => URL_RE.test(fs.readFileSync(path.join(APP, f), 'utf8')));
ok(withUrls.length === 0, `no external URLs outside vendor/${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for (const f of ['three.module.js', 'three.core.js', 'three-LICENSE.txt']) {
  ok(sha(path.join(APP, 'vendor', f)) === sha(path.join(APP, '..', 'anatomy', 'vendor', f)), `vendor/${f} identical to ../anatomy/vendor/${f}`);
}
const vendorExtra = fs.readdirSync(path.join(APP, 'vendor')).filter((f) => !['three.module.js', 'three.core.js', 'three-LICENSE.txt'].includes(f));
ok(vendorExtra.length === 0, `vendor/ holds only three.js and its licence${vendorExtra.length ? ' (also: ' + vendorExtra.join(', ') + ')' : ''}`);

// 3. Relative paths only
const refs = [];
for (const f of shipped.filter((x) => /\.(html|js|css)$/.test(x) && !x.startsWith('vendor/'))) {
  const src = fs.readFileSync(path.join(APP, f), 'utf8');
  const RE = /(?:import\s[^'"]*?from\s*|import\(\s*|\bsrc=|\bhref=|fetchJSON\(|fetch\(|url\()\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(RE)) refs.push([f, m[1]]);
}
const badRefs = refs.filter(([f, r]) => {
  if (r.startsWith('#')) return false;                                   // an in-page fragment (<use href="#i-…">)
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/')) return true;  // a scheme or an absolute path
  const resolved = path.resolve(path.dirname(path.join(APP, f)), r.split('?')[0]);
  if (f.endsWith('.js') && /fetch/.test(r) === false && !r.startsWith('.') && !r.includes('/')) return false;
  return !resolved.startsWith(APP + path.sep) && !(f === 'js/main.js' && r.startsWith('data/'));
});
ok(badRefs.length === 0, `relative paths: ${refs.length} references${badRefs.length ? ', bad: ' + badRefs.map((b) => b.join(' → ')).join('; ') : ', all inside the folder'}`);
const missing = refs.filter(([f, r]) => !r.startsWith('#') && !fs.existsSync(path.resolve(f.startsWith('js/') && r.startsWith('data/') ? APP : path.dirname(path.join(APP, f)), r)));
ok(missing.length === 0, `every referenced file exists${missing.length ? ': missing ' + missing.map((b) => b.join(' → ')).join('; ') : ''}`);

// 4. Names. The list is ROT13 so that it never appears in plain text in this folder.
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
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
    if (!/\.(html|js|mjs|css|json|md|txt)$/.test(e.name) && !e.name.startsWith('.git')) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => { for (const m of line.matchAll(nameRe)) hits.push(`${rel}:${i + 1} (ROT13 "${rot13(m[0].toLowerCase())}")`); });
  }
})(APP);
ok(hits.length === 0, `no borrowed names (${banned.length} checked)${hits.length ? ':\n     ' + hits.join('\n     ') : ''}`);

// 5. Tracks
const { loadTracks } = await import(path.join(APP, 'js/track.js'));
try {
  const tracks = loadTracks(JSON.parse(fs.readFileSync(path.join(APP, 'data/tracks.json'), 'utf8')));
  console.log('     track            length   height        width      min radius   max grade  corridors');
  for (const t of tracks) {
    const v = t.validation;
    console.log(`     ${t.name.padEnd(15)} ${Math.round(v.length).toLocaleString('en-US').padStart(6)} m  ${v.minY.toFixed(1)}…${v.maxY.toFixed(1)} m`.padEnd(42) +
      `${Math.round(v.minW)}…${Math.round(v.maxW)} m`.padEnd(11) + `${v.minRadius.toFixed(1)} m`.padEnd(13) + `${(v.maxGrade * 100).toFixed(1)} %`.padEnd(11) +
      (v.crossover ? `one crossover, ${v.clearance.toFixed(1)} m clearance` : 'no overlap'));
  }
  ok(true, `tracks: ${tracks.length} pass radius, corridor, grade and grid checks`);
} catch (e) { ok(false, `tracks: ${e.message}`); }

// 6. The ZIP, exactly as .github/workflows/build-zips.yml builds it.
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'snug-kart.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const list = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
const size = fs.statSync(zip).size;
ok(list.includes('index.html'), `ZIP has index.html at its top (${list.length} entries)`);
ok(!list.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))), 'ZIP leaves out tools/, screenshots/ and dotfiles');
ok(size < 3 * 2 ** 20, `ZIP size ${(size / 1024).toFixed(0)} KB (${size} bytes; limit 3 MB)`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
