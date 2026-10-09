// Static checks for Running Dashboard (HOUSE.md section 7.1; ART.md section 8, item 31). Node, no
// dependencies but python3 for tools/art/palette.py; Global Weather's and World Oil & Gas's
// tools/check.mjs in shape, changed for a pane app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( and data path is relative, inside the folder, present;
//   4. js/ holds the three modules, fonts/ the house face, its OFL.txt and the ₂ supplement at the
//      sha256 HOUSE.md and NOTES.md pin; NOTES.md, TILES.md and About credit the face word for word;
//   5. the data is pinned: each of the 37 data files' sha256 and their concatenation's, as the data follow-up
//      rebuilt them (scripts/make_demo_running_dashboard.py --check rebuilds them byte for byte);
//   6. miniapp.json is valid, its name unchanged, its version 1.2.1 (plan 0012 package 4's pass, then the owner's filters; HOUSE 13);
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   8. the credits, word for word, as About's first paragraph under Sources and credits; no band, caption or
//      credit line on the front; OpenStreetMap's line under a map its data drew, and no other tile credit there
//      (HOUSE 4.15 exception 1);
//   9. the marketing camera's strings (HOUSE.md 7.4): the panes Now and Health as tabs built after the
//      snapshot parses, never in the static markup; the stored keys kept;
//  10. SI: no plain space between a digit and a unit in the strings the app writes; toFixed and
//      toLocaleString only in js/units.js; no Intl, no en-GB;
//  11. no transition anywhere, and only the house's three animations (the tracer, the card, About);
//  12. innerHTML only ever empties (the app had 15 other uses; the pass took Global Weather's rule);
//      no insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  13. style.css's zone and series tokens, the register's four (HOUSE 11.2) and js/palette.js's ramp equal
//      palette.py --json, which passes;
//  14. the look: the chrome tokens exactly in both themes, no accent, warning or shadow token; no
//      box-shadow, backdrop-filter, `transition: all`, uppercase, letter-spacing, monospace; one family;
//      no middle dot or em dash in the app's own strings; no →, ➤, ▸, ▾, ▴, ⓘ, Δ, ≈, ↑, ↓ or "..." in
//      shipped text; both theme-color metas; the two @font-face rules; the page's language and viewport; the
//      pane apps' type scale (HOUSE 11.1 rule 2);
//  15. the bugs on record (ART.md B1 to B17) stay fixed in the code;
//  16. budgets: app code at most 260,000 bytes (the lead's ruling of 2026-10-08 for plan 0012 package 4, on the
//      measured 259,002; after plan 0011 D32's 252,000 for the owner's six, D24's 245,000, D23's 244,000 and
//      the 236,521 held before the build, HOUSE.md 8 and D5), fonts/ at
//      most 160,000, the ZIP built exactly as build-zips.yml builds it at most 1,351,307 (the house rule for plan
//      0012 package 4: 1,081,046 before the pass × 1.25, above the 1,340,193 of plan 0011);
//  18. the pane-app register (HOUSE 11; plan 0012 P1 to P9 and the change list): every pane ends with the About
//      key; the pane pads the home indicator; plates, with halos, casings, dots and slider heads in --sheet; the
//      week's key number, its bar and key; the tone word in its color; Now's tiles; the Block in --done with the
//      planned fill; method sentences in folds; Example data. in the stamp; the header centered with the pane;
//      a passive touchstart listener; a chart follows only the pointer reading it;
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
const CODE_CAP = 260000, FONT_CAP = 160000, ZIP_CAP = 1351307; // ZIP_CAP: the lead's ruling for plan 0012 package 4, the house rule (1 081 046 B before the pass × 1.25, rounded down), above the app's own 1 340 193, so the cap rises to it (tools/DECISIONS.md). CODE_CAP: the lead's ruling of 2026-10-08 for plan 0012 package 4, 260 000 on the register's measured 259 002 (tools/DECISIONS.md); 252 000 before it, the lead's ruling for the owner's six (plan 0011 D32; tools/DECISIONS.md, "The owner's six"): the owner's features take precedence over the house budget, for exactly those six; 245 000 for the follow-up (D24), 244 000 after the build (D23), 236 521 held before it
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

// 3. References: relative, inside the folder, present
const app = read('app.js'), html = read('index.html'), css = read('style.css');
const mods = ['js/units.js', 'js/block.js', 'js/palette.js'];
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
  ok(bad.length === 0 && refs.length >= 8, `references: ${refs.length} (imports, src, href, url(), fetch()): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
  const reads = [...code(app, 'x.js').matchAll(/(?:fetch\(|\.src = )`?['"`](\.\/data\/[^'"`]+)['"`]/g)].map((m) => m[1]);
  ok(JSON.stringify(reads) === JSON.stringify(['./data/snapshot.json', './data/streams/${id}.json', './data/tiles/${z}/${tx}/${ty}.png']),
    `the data reads: ${reads.join(', ')} and nothing else`);
}

// 4. js/ and fonts/ hold exactly the contract's files; the face and its supplement
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort(), want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('js', ['block.js', 'palette.js', 'units.js']);
exactly('fonts', ['OFL.txt', 'ysabeau-office-gw.woff2', 'ysabeau-office-running-dashboard-extra.woff2']);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
const EXTRA_SHA = 'f9937497336f4bf70c2728bc020588ebdb2a952acdf7dc5e96f14b8377583268';
ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house face (${FONT_SHA.slice(0, 12)}…)`);
ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
  `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's copy, naming the face and carrying the OFL 1.1`);
ok(sha('fonts/ysabeau-office-running-dashboard-extra.woff2') === EXTRA_SHA && read('NOTES.md').includes(EXTRA_SHA) && read('NOTES.md').includes('U+2082'),
  `the supplement sha256 ${EXTRA_SHA.slice(0, 12)}… (U+2082 only, built by tools/art/font_extra.py), pinned in NOTES.md with its code point`);
const FONT_CREDIT = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(read('NOTES.md').includes(FONT_CREDIT) && read('TILES.md').includes(FONT_CREDIT) && html.includes(`Type: ${FONT_CREDIT}`) && !/geist/i.test(shipped.filter((f) => /\.(md|html|css|js)$/.test(f)).map(read).join('\n')),
  'the face is credited word for word in NOTES.md, TILES.md and About ("Type: …"); Geist is named in no shipped .md, .html, .css or .js file, ART.md included');

// 5. The data is pinned (the hashes as the data follow-up rebuilt it, tools/DECISIONS.md; ART.md section 6). Only the
// snapshot changed then (the body battery as a change, the coaching text's words); the streams and tiles are as before the pass.
const DATA_ALL = '871171cb856ae3da7ed869aa88a3cc335f7822ec01530fd47ae975d4eb13f0dc';
const DATA_SHA = {
  'data/snapshot.json': 'd47c5c1c41fbc0243d59ec9fcabc38ed3803e27c269c994bec614008bbb36434',
  'data/streams/demo-0203.json': '4a07c044fd9238f53374f8d203ad32d3399441b562fab3393159d1b38ecb53b2',
  'data/streams/demo-0221.json': '99bc1ad6ce5bfd45028c522e15a5dbd01ee7d50ee2ae1dbd9713e97a0f17ca90',
  'data/streams/demo-0237.json': '614c9e8d2c34d311c54923ce6c01416067dae1859d7e7c0990a818536b67a5c1',
  'data/streams/demo-0241.json': 'c0e9347438a631cee09d11518c11bb4cd99b75fdffb91fd1f3bf3147003125ec',
  'data/streams/demo-0244.json': 'b5f68558121bdff4f61cecbe968ca27a2f51dd7366b8f6d056437bdb17c06ad0',
  'data/streams/demo-0247.json': '5df0901a2dcac5decdaad453c537466ed67333b3b41ca9eb5ee5a32e32a32840',
  'data/tiles/12/1049/1520.png': 'd8e54fc19ed86d58764c0d328ce0de91906df9f646543f151adaf89736808061',
  'data/tiles/12/1049/1521.png': '2972956d8b63c0d5f0e9e676d21a9cf7758aa752465872b9c0ebd746d4b0b5b2',
  'data/tiles/12/1049/1522.png': 'a86ccb268bf058079d4eef558fcf2c228ccc17dd95e3c9afe2f1ee98edc389d8',
  'data/tiles/12/1050/1520.png': '5b5bce37e216361acbab0271e544356c27eccd1bb8c6a9b736a95b18348c7207',
  'data/tiles/12/1050/1521.png': '1a6cfd77f0a37297535f0e7163478cde257355d27a1c105e25102248081bcb73',
  'data/tiles/12/1050/1522.png': '1a0e2e627efbad6182c792c72c5206a512a07250cbb6d7f2b75483101af3b5d4',
  'data/tiles/12/1051/1520.png': '1ac0c3af2e2334acd58d0f22175c24069c497b22162570fdbbfd8e8be3d3d6e7',
  'data/tiles/12/1051/1521.png': '03553ac1915315f2053dff5c16dbed2cf573f2e16b4f551ba038907e3099469e',
  'data/tiles/12/1051/1522.png': 'ec20550e4f4dbc8d0812906f9d82b0566704821d949ecb3b04c43053e9030a11',
  'data/tiles/12/1235/1514.png': '2b47b08f07ce17753c416413df1ea9514bb55a309de3aa91f46dcac60a724c9c',
  'data/tiles/12/1235/1515.png': 'a15afa7638c9a1cb5c55c8350e14612fb4fad4d393165ca75130d454b8e74f4f',
  'data/tiles/12/1235/1516.png': 'd5610bb8675c8da09b610404544180bb86b8712adbfd4f124741265262d25ccb',
  'data/tiles/12/1236/1514.png': 'dd71731857814ad78315d19ef074dfb0f3b73ccbda7fd3dbbd3669746503f417',
  'data/tiles/12/1236/1515.png': '07423bb3ce9babb6c07b33c8568e4cc717e3f5f69bea66490e90878f63eeca24',
  'data/tiles/12/1236/1516.png': '957585026dbabf08d01760246d460422b713724bbea7fff32080bd333179b0d6',
  'data/tiles/12/1237/1514.png': '86990ccf90c7eb6543905eaa2989a969fa64ec933649ec8d6dedaec4f08ea300',
  'data/tiles/12/1237/1515.png': 'f3817e5c6636be6b4ee3a0284b6a5b028df9d96f2894a5477337e3a9d8736d35',
  'data/tiles/12/1237/1516.png': '2b8541198e5bfe446b99d76d9b157a920e4625ecc85e6b8bf2820a0414bf26db',
  'data/tiles/12/1238/1514.png': 'e45c563dcfebabae1a2b3df4ae2a2f87614ecc54da0d611a82112fc5cf01759f',
  'data/tiles/12/1238/1515.png': 'e19732d7c3941d7a70b30aa0935a31b962bb893bc4f06079e92704cf920eb991',
  'data/tiles/12/1238/1516.png': 'aa9052a4a47d7530d1bbf35255be7f55b3cd508ade095fd0b26a2bc5d15b4ee3',
  'data/tiles/13/2412/3077.png': '1b01b71436c22f8adace6f216f1f08e625d34b31d7ef74d1ab9ee555800dd4e3',
  'data/tiles/13/2412/3078.png': 'ade584a46a84f20ec6b3342e22d396f7b97687fbed81988a04f4c21e33d67054',
  'data/tiles/13/2412/3079.png': '1fe4a4cdb97b31bf862ad40b2382537ae97d93c794d1f0646e5421527c0b7b13',
  'data/tiles/13/2413/3077.png': 'd889a543916a963f85dff44c6e345c592738ca0700d7ceb9de3595870480640f',
  'data/tiles/13/2413/3078.png': '950d5ec6572b0335d260e9b79f5d62a3610723ebc07601f5981866763738390d',
  'data/tiles/13/2413/3079.png': 'e690e73cff0bf746a49c2eeee11b93dc4627cd531e343b97b34df5431f7034e5',
  'data/tiles/13/2414/3077.png': 'd50ebbd3b5a6e3909ab272a8e1840bfb910df72b78a9fa2ec9dc13011ff468f6',
  'data/tiles/13/2414/3078.png': '3c0bebc35f64e234a5bb5a3b20121bd296fd6b47cbe8c5fe8ea0f635cc6a02cc',
  'data/tiles/13/2414/3079.png': '504e0f1d1613ddccd8b2240bb372764ea38a3c530ba78a48723647fc83f8d48b',
};
{
  const data = shipped.filter((f) => f.startsWith('data/')).sort();
  const off = Object.entries(DATA_SHA).filter(([f, want]) => !fs.existsSync(path.join(APP, f)) || sha(f) !== want).map(([f]) => f);
  const all = crypto.createHash('sha256').update(Buffer.concat(data.map((f) => fs.readFileSync(path.join(APP, f))))).digest('hex');
  ok(off.length === 0 && JSON.stringify(data) === JSON.stringify(Object.keys(DATA_SHA).sort()) && all === DATA_ALL,
    `data/: the ${Object.keys(DATA_SHA).length} files as the data follow-up rebuilt them (concatenation ${all.slice(0, 8)}…${all.slice(-7)})${off.length ? ': changed ' + off.join(', ') : ''}`);
}

// 6. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Running Dashboard' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && mini.version === '1.2.1',
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

// 8. The credits, word for word, as About's first Sources and credits paragraph (HOUSE 4.15; plan 0012 F1, F8)
const CREDITS = 'Data: Garmin Connect. Coaching text: the coaching routine.';
{
  const src = html.slice(html.indexOf('<h3>Sources and credits</h3>'));
  ok(src.startsWith(`<h3>Sources and credits</h3>\n        <p id="about-credit-line" translate="no">${CREDITS}</p>`) && html.split(CREDITS).length === 2
    && !/id="credits"|class="credits"|id="band"|id="capline"|<footer/.test(html) && !/\$\('credits'\)|getElementById\('credits'\)|\$\('capline'\)|\$\('band'\)|'band'|function caption\(/.test(code(app, 'x.js')) && !/\.band\b|\.capline\b|\.credits\b/.test(code(css, 'x.css')),
    `the credits: "${CREDITS}" static, byte for byte, as About's first paragraph under Sources and credits (<p id="about-credit-line">); no band, caption line or credit line on the front, nothing in the code writes one`);
}
ok(/<p id="about-routes" hidden>Routes: &copy; OpenStreetMap contributors, under the Open Database License 1\.0/.test(html) && /const OSM = \(a\) => String\(a\.id\)\.startsWith\('demo-'\);/.test(app)
  && /mapcredit\.textContent = osmRoute && osmTiles \? `Route and map: \$\{TILE_CREDIT\.osm\}, ODbL\.` : osmRoute \? `Route: \$\{TILE_CREDIT\.osm\}, ODbL\.` : osmTiles \? `Map: \$\{TILE_CREDIT\.osm\}, ODbL\.` : '';/.test(app)
  && /const osmRoute = OSM\(a\), osmTiles = drawn && sources\.has\('osm'\);/.test(app) && /if \(mapcredit\.textContent\) wrap\.after\(mapcredit\); else mapcredit\.remove\(\);/.test(app)
  && !/Map tiles:/.test(strings(app).join('\n')) && /\.mapcredit \{ margin-top: 4px; font-size: 10\.5px; color: var\(--ink-2\); \}/.test(css),
  "OpenStreetMap's credit (HOUSE 4.15 exception 1, owner call 4): one 10.5 px line at the foot of a map its data drew, Route:, Map: or Route and map: © OpenStreetMap contributors, ODbL., and no element otherwise; keyed on the generator's demo- ids and the tiles' own sources; no Map tiles: credit on the front (USGS and Kartverket are in About); the routes' credit also in About");

// 9. The marketing camera's strings (HOUSE.md 7.4) and the stored keys
{
  const tabs = (app.match(/const TABS = \[([\s\S]*?)\];/) || ['', ''])[1];
  const built = /function buildTabs\(\) \{[\s\S]*?b\.setAttribute\('role', 'tab'\)/.test(app) && /stamp\(\);\s*buildTabs\(\);/.test(app);
  ok(/\['now', 'Now'\]/.test(tabs) && /\['health', 'Health'\]/.test(tabs) && built && !/>\s*(Now|Health)\s*</.test(code(html, 'x.html')) && /<nav class="tabs" id="tabs" role="tablist" aria-label="Panes" hidden><\/nav>/.test(html),
    'camera: the panes Now and Health are buttons with role tab, built by buildTabs() after the snapshot parses; the static markup holds no tab');
  const keys = [...app.matchAll(/localStorage\.(?:getItem|setItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  ok(keys.length === 4 && keys.filter((k) => k === 'STORE_KEY').length === 2 && keys.filter((k) => k === "'tl-loadunit'").length === 2 && /const STORE_KEY = 'running-dashboard\.ui\.v3';/.test(app),
    `storage: running-dashboard.ui.v3 and tl-loadunit, both still read and written, no key added (${keys.join(', ')})`);
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only in js/units.js; no Intl
{
  const UNIT = /\d (km\/h|km|min|h|m|bpm|spm|rpm|kg|kJ\/kg|ms|W|%|°C|cm|d|kcal|\/km)(?![\w/])/;
  const files = ['index.html', 'app.js', ...mods];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [htmlText(read(f))] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const fixedHits = [];
  for (const f of ['app.js', 'js/block.js', 'js/palette.js']) code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString|toLocaleDateString|toLocaleTimeString)\(|\bIntl\.|en-GB/.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  ok(fixedHits.length === 0 && !/\bIntl\.|toLocale/.test(code(read('js/units.js'), 'x.js')), `SI: toFixed only in js/units.js; no toLocale*, Intl or en-GB anywhere (B7, B11)${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Motion: no transition at all; only the tracer, the card and About animate, all under Reduce Motion
{
  const c = code(css, 'x.css');
  const anims = [...c.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]).sort();
  ok(!/transition\s*:/.test(c) && JSON.stringify(anims) === '["card-in","sheet-in","tracer-in"]' && /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important; transition-duration: 0s !important;/.test(c)
    && /reduced\.matches \? 'auto' : 'smooth'/.test(app) && !/behavior: 'smooth'/.test(app),
    `motion: no transition, the house's three animations (${anims.join(', ')}), every duration 0 s under Reduce Motion, smooth scrolling only without it; the Block never moves`);
}

// 12. innerHTML only ever empties
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)\s*([^;\n]*)/g)) uses.push([f, m[1], m[2].trim()]);
  const badUses = uses.filter((x) => x[1] !== '=' || x[2] !== "''");
  ok(badUses.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses, every one \`= ''\` (15 set markup from strings before the pass); no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. The data tokens and the ramp are palette.py's, and palette.py's checks pass
let PAL = null;
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  try { PAL = JSON.parse(json.stdout); } catch { PAL = null; }
  const c = code(css, 'x.css');
  const block = (scheme) => (scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing')));
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries((PAL || {})[s] || {})) if (k !== 'ramp' && k !== 'tint' && (block(s).match(new RegExp(`--${k}:\\s*(#[0-9a-f]{6})`)) || [])[1] !== v) off.push(`${s} --${k}`);
  let ramp = null;
  try { ramp = JSON.parse((read('js/palette.js').match(/export const RAMP = (\{.*\});/) || [])[1]); } catch { /* reported below */ }
  ok(PAL && off.length === 0 && ramp && JSON.stringify(ramp) === JSON.stringify({ light: PAL.light.ramp, dark: PAL.dark.ramp }) && Object.keys(PAL.light).length === 21,
    `style.css's 15 data tokens and the register's 4 per theme (--amount, the single-quantity slate, and --done, --up, --watch, --down, HOUSE 11.2) and js/palette.js's 9 ramp stops per theme equal palette.py --json${off.length ? ': differ ' + off.join(', ') : ''}`);
  const REG = { light: { done: '#1f5f99', up: '#17723e', watch: '#8a5a00', down: '#b42318' }, dark: { done: '#8cbcf0', up: '#6fd39a', watch: '#e0a340', down: '#ff9a8f' } };
  const regOff = [];
  for (const sc of ['light', 'dark']) for (const [k, v] of Object.entries(REG[sc])) if ((block(sc).match(new RegExp(`--${k}:\\s*(#[0-9a-f]{6})`)) || [])[1] !== v) regOff.push(`${sc} --${k}`);
  ok(regOff.length === 0, `the register's four meaning colors by name and value (HOUSE 11.2): ${Object.entries(REG.light).map(([k, v]) => `--${k} ${v} / ${REG.dark[k]}`).join(', ')}${regOff.length ? '; differ ' + regOff.join(', ') : ''}`);
  // the plan's tint (the owner's six, 2026-10-03): one strength for both themes, in its two CSS forms
  const tint = PAL && PAL.light.tint === PAL.dark.tint ? PAL.light.tint : null;
  const mixes = (c.match(/color-mix\(in srgb, var\(--c\) (\d+)%, transparent\)/g) || []).map((m) => Number(m.match(/(\d+)%/)[1]));
  ok(tint != null && new RegExp(`\\.tint \\{ fill-opacity: ${tint}; \\}`).test(c) && mixes.length === 1 && mixes[0] === Math.round(tint * 100) && /\.legend i\.plan, \.zbar\.plan span \{ background: color-mix/.test(c),
    `the plan's tint at palette.py's ${tint} in both themes: .tint's fill-opacity in the charts and the Block, ${mixes.join(', ')} % in color-mix() for the legend's swatch and the plan's zone bars`);
}

// 14. The look
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace|font-variant\s*:\s*small-caps|Georgia|serif\b(?<!sans-serif)/, 'monospace, small capitals or a serif']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, transition: all, uppercase, letter-spacing, monospace, small capitals or serif${found.length ? ': ' + found.join(', ') : ''} (B4, B12)`);
  const TOK = {
    light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const blockOf = (scheme) => (scheme === 'light' ? c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')) : c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing')));
  const tok = (scheme, name) => (blockOf(scheme).match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const off = [];
  for (const s of ['light', 'dark']) for (const [k, v] of Object.entries(TOK[s])) if (tok(s, k) !== v) off.push(`${s} --${k} ${tok(s, k)}`);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c)
    && /html, body \{[^}]*background: var\(--page\);/.test(c) && !/--accent|--glass|--shadow|--good|--warning|--serious|--critical|--surface|--text-|--hairline|--div-/.test(c + app),
  `the house's chrome tokens in both themes (HOUSE.md 3.1), the two curves and --face; html and body on --page; no accent, shadow, warning or stock token in the CSS or the code (B14)${off.length ? ': ' + off.join(', ') : ''}`);
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  ok(families.length === 2 && families.every((f) => f === "'Ysabeau Office'") && !/font:[^;]*(Helvetica|Arial|Roboto|SF Pro|BlinkMac|Geist)/.test(c) && !/font-family|\bfont: ?['"`\d]/.test(code(app, 'x.js')),
    "one family: two @font-face rules of 'Ysabeau Office' (the house file and the supplement), used through --face; no font string in the scripts (SVG text takes the page's face)");
  const dots = [], dashes = [];
  for (const f of ['app.js', ...mods]) for (const s of strings(read(f))) {
    if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
    if (s.includes('—')) dashes.push(`${f}: ${s.slice(0, 50)}`);
  }
  if (/·/.test(htmlText(html))) dots.push('index.html');
  if (/—|&mdash;/.test(code(html, 'x.html'))) dashes.push('index.html');
  ok(dots.length === 0, `no middle dot in any string the app writes (78 before the pass; tell 6)${dots.length ? ': ' + dots.join(' | ') : ''}`);
  ok(dashes.length === 0, `no em dash in the app's own strings (69 before the pass; tell 7; the coaching text's own are data)${dashes.length ? ': ' + dashes.join(' | ') : ''}`);
  const arrows = [];
  for (const f of web) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? htmlText(src) + code(src, f) : code(src, f);
    if (/[→➤▸▾▴ⓘΔ≈↑↓]|\\2(4D8|5B8|192)|&#x25B8;|&#x24D8;|&rarr;|&darr;|&uarr;/i.test(lit)) arrows.push(f);
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.js') ? lit.replace(/\[\.\.\.|\(\.\.\.|\{ \.\.\.|, \.\.\./g, '') : lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤, ▸, ▾, ▴, ⓘ, Δ, ≈, ↑ or ↓ (the face draws none of the last few; words instead) and no "..." in shipped text${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s, 'page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')} (--page ${tok('light', 'page')} / ${tok('dark', 'page')})`);
  ok(/@font-face \{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css)
    && /@font-face \{ font-family: 'Ysabeau Office'; src: url\(fonts\/ysabeau-office-running-dashboard-extra\.woff2\) format\('woff2'\); font-weight: 400 650; font-display: block; unicode-range: U\+2082; \}/.test(css)
    && (css.match(/@font-face/g) || []).length === 2, "@font-face: the house rule word for word, and the supplement's with unicode-range U+2082 only");
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html) && /<script type="module" src="\.\/app\.js"><\/script>/.test(html),
    'the page: lang="en-US", viewport-fit=cover without user-scalable, color-scheme light dark, app.js as a module');
  const px = [...c.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const offScale = px.filter((v) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 19, 21, 34].includes(v));
  const at34 = [...c.matchAll(/([^{}]+)\{[^}]*font-size: 34px/g)].map((m) => m[1].trim()), at21 = [...c.matchAll(/([^{}]+)\{[^}]*font-size: 21px/g)].map((m) => m[1].trim());
  ok(offScale.length === 0 && JSON.stringify(at34) === '[".hl-fig"]' && JSON.stringify(at21) === '[".readout-value"]',
    `type: sizes ${[...new Set(px)].sort((a, b) => a - b).join(', ')} px, the pane apps' scale (HOUSE 11.1 rule 2); 34 px only on the key number (.hl-fig), 21 px only on the readout card's value${offScale.length ? ': off the scale ' + offScale.join(', ') : ''}`);
}

// 15. The bugs on record (ART.md: B1 to B17) stay fixed in the code (most are also driven by tools/shoot.mjs)
{
  const B = [
    ['B1 stale is a sentence; an example says so in its place (HOUSE 11.1 rule 8)', /const lead = example \? 'Example data\.' : stale \? 'Stale\.' : null;/.test(app) && /el\('span', 'stale', lead\)/.test(app) && /const example = DATA\.activities\.length && DATA\.activities\.every\(\(a\) => OSM\(a\)\);/.test(app) && /\.stamp \.stale \{ color: var\(--ink\); \}/.test(css)],
    ['B2 <main> is not a live region; one polite live region', !/<main[^>]*aria-live/.test(html) && (html.match(/aria-live/g) || []).length === 1 && /<p class="sr" id="live" aria-live="polite"><\/p>/.test(html)],
    ['B3 a broken replacement keeps the data', /if \(DATA\) \{[\s\S]{0,300}Still showing the data from/.test(app)],
    ['B4 no monospace box, no Georgia key', !/<code|monospace|Georgia|ensureInfo/.test(app + css)],
    ['B5 no ⓘ machinery; How to read it', !/'info'|Explain this chart/.test(app) && /'How to read it'/.test(app)],
    ['B6 the stamp is a button that opens About', /<button class="stamp" id="stamp" type="button" aria-haspopup="dialog" aria-describedby="stamp-hint">/.test(html)],
    ['B8 no Load pane named', !/Load pane/.test(app + html)],
    ['B9 the race label anchored inside the chart', /'text-anchor': right \? 'end' : 'start'/.test(app) && /t\.getComputedTextLength\(\)/.test(app)],
    ['B10 no two-digit years, presets in words', !/getUTCFullYear\(\)\)\.slice\(2\)|'3 m'|'1 yr'/.test(app) && /\['3m', '3 months', 13\]/.test(app)],
    ['B12 sentence-case group heads', /groupHead\(main, 'Recovery and trends'\)/.test(app) && !/uppercase/.test(css)],
    ['B13 notes joined, never prefixed', /\[TE_WORD\[dt\.teLabel\], dt\.anTe \? `anaerobic \$\{f1\(dt\.anTe\)\}` : null\]\.filter\(Boolean\)\.join\(', '\)/.test(app)],
    ['B14 no slower/faster or threshold colors', !/'slower' : 'faster'|var\(--good\)|var\(--serious\)/.test(app)],
    ['B15 now and today in --ink-3', /class: m\.race \? 'tk halo' : 'tk mk halo'/.test(app) && /\.chartwrap \.mk \{ fill: var\(--ink-3\); \}/.test(css)],
    ['B16 the newest session\'s sentence', /'No evaluation written for this session yet\.'/.test(app) && !/written for sessions logged after/.test(app)],
  ];
  const bad = B.filter(([, okk]) => !okk).map(([n]) => n);
  ok(bad.length === 0, `the bugs on record stay fixed in the code: ${B.length} checked (B7, B11 under 10, B17 by shoot.mjs)${bad.length ? '; failing: ' + bad.join('; ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = ['index.html', 'style.css', 'app.js', ...mods];
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the lead's ruling of 2026-10-08 for plan 0012 package 4 on the measured 259,002; 252,000 before it, plan 0011 D32): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= FONT_CAP, `fonts/ ${fmt(fontBytes)} bytes (cap ${fmt(FONT_CAP)}; Geist's 74,128 before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'running-dashboard.zip'); fs.rmSync(zip, { force: true });
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
ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}: the house rule for plan 0012 package 4, 1,081,046 before the pass × 1.25; 1,340,193 before it)`);

// 17. US spelling in every shipped text file (fonts/OFL.txt is the upstream license, quoted whole). The
// demo's coaching text is US English since the data follow-up; its keys keep the spelling the code reads.
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|forevery\w*|behaviour\w*|recognis\w*|rasteris\w*|normalis\w*|quantis\w*|organis\w*|synchronis\w*|analys(?:ed|ing)|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey\w*|favour\w*|catalogue\w*|programme\w*|travell\w*|modell\w*|whilst|amongst|judgement\w*|for ever)\b/gi;
  const ALLOW = { 'data/snapshot.json': ['analysed'] };   // the race forecast's `analysed` key
  const hits = [];
  for (const f of texts.filter((x) => x !== 'fonts/OFL.txt')) {
    const allow = ALLOW[f] || [];
    read(f).split('\n').forEach((line, i) => {
      // the plan's `programme` key is the data's own spelling, read by the code as it is
      const l = line.replace(/\.programme\b|"programme"|`programme`|'programme'/g, '');
      for (const m of l.matchAll(BRIT)) if (!allow.includes(m[0])) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length - 1} shipped text files, the data's own words allowed by file${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
}

// 18. The pane-app register (HOUSE 11.1; plan 0012 P1 to P9 and the change list's items 2 to 16)
{
  const c = code(css, 'x.css'), a = code(app, 'x.js');
  ok(/const ABOUT_KEY = 'Sources, method and credits are in About\.';/.test(app) && /function aboutKey\(host\) \{\s*const b = el\('button', 'aboutlink', ABOUT_KEY\);\s*b\.type = 'button';\s*b\.onclick = \(\) => about\(true\);\s*host\.append\(b\);\s*\}/.test(app)
    && /PANES\(\)\[state\.tab\]\(pane\);\s*aboutKey\(pane\);/.test(app) && (a.match(/aboutKey\(/g) || []).length === 2
    && /\.aboutlink \{ display: block; margin: 14px 0 0; min-height: 44px; font-size: 12\.5px; color: var\(--ink-2\); text-decoration: underline; text-underline-offset: 3px; \}/.test(c),
  'every pane ends with the button "Sources, method and credits are in About.", 12.5 px --ink-2, underlined at 3 px, 44 px tall, opening About (render() adds it after the pane)');
  ok(/\.panebody \{ padding-top: 4px; padding-bottom: calc\(28px \+ env\(safe-area-inset-bottom\)\); \}/.test(c) && (c.match(/(^|\n)\.panebody \{/g) || []).length === 1,
    'the pane pads the home indicator itself: .panebody { padding-top: 4px; padding-bottom: calc(28px + env(safe-area-inset-bottom)) } (HOUSE 4.14, 11.1 rule 1; a phone row checks it)');
  ok(/\.sec \{ position: relative; margin-top: 12px; padding: 12px 12px 6px; border: 1px solid var\(--line\); border-radius: 8px; background: var\(--sheet\);/.test(c)
    && ['halo', 'casing', 'cdot', 'dot'].every((k) => new RegExp(`\\.${k} \\{[^}]*stroke: var\\(--sheet\\)`).test(c)) && /\.pdot \{[^}]*border: 2px solid var\(--sheet\)/.test(c)
    && /\.sec \{[^}]*--thumb: radial-gradient\(circle, var\(--ink\) 3\.6px, var\(--sheet\) 4px 6\.6px/.test(c) && /\.sec \.dual \{ --ring: var\(--sheet\); \}/.test(c) && !/stroke: 'var\(--page\)'/.test(app),
    'sections on plates (--sheet, a 1 px --line edge, radius 8 px, padding 12 px, 12 px apart); every halo, casing, cursor dot, sports dot, the profile\'s dot and the map slider\'s heads on a plate take --sheet (HOUSE 11.1 rule 4)');
  ok(/const Bw = blockWeeks\(DATA\.activities, DATA\.plan, today\), wk0 = Bw\.columns\[Bw\.now\];/.test(app) && /row\.append\(el\('span', 'hl-fig', kmU\(wk0\.km\)\)\);/.test(app)
    && /done\.style\.width = `\$\{Math\.min\(100, \(wk0\.km \/ wk0\.target\) \* 100\)\}%`;/.test(app) && /\.hl-fig \{ font-size: 34px; font-weight: 650; line-height: 1\.05; \}/.test(c)
    && /\.pbar \{[^}]*border: 1\.5px solid var\(--ink-2\);[^}]*background: color-mix\(in srgb, var\(--ink-2\) 14%, var\(--sheet\)\);/.test(c) && /\.pbar i \{[^}]*background: var\(--done\); \}/.test(c)
    && /function figure\(host, what, value, lead\)/.test(app) && !/'fig-what'|'fig-lead'|\.figure \{/.test(app + c),
    'Now opens on the week: its kilometers at 34 px (blockWeeks()\'s column at now, the Block\'s own figure) against the plan, a 10 px bar (--done inside an --ink-2 outline holding the 14 % fill) and its key; figure() is the key number everywhere (Plan\'s race day, a session\'s distance or time)');
  ok(/\.tone\.tone-good b, \.tone-good \.tw \{ color: var\(--up\); \}/.test(c) && /\.tone\.tone-warning b, \.tone-warning \.tw \{ color: var\(--watch\); \}/.test(c)
    && /\.tone\.tone-serious b, \.tone\.tone-critical b, \.tone-serious \.tw, \.tone-critical \.tw \{ color: var\(--down\); \}/.test(c)
    && /v\.append\(el\('b', null, toneSentence\(tone\)\)/.test(app) && /p\.append\(el\('b', 'tw', toneSentence\(tone\)\)/.test(app) && !/var\(--(up|watch|down)\)/.test(c.replace(/\.tone[^{]*\{[^}]*\}/g, '')),
    'the tone: only its word takes its color (--up on track, --watch watch, --down act now and stop; a note stays ink), never alone (the word says it); nothing else takes --up, --watch or --down (HOUSE 11.3)');
  ok(/const top = card\(null\), t = el\('dl', 'tiles'\), long = el\('dl', 'long'\);/.test(app) && /top\.classList\.add\('tilesec'\);/.test(app) && /r\.dataset\.label = label;/.test(app)
    && /dl\.tiles \{ display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; \}/.test(c) && /dl\.tiles dd b \{ display: block; font-size: 19px; font-weight: 650; line-height: 1\.25; \}/.test(c),
    'Now\'s facts as two-column tiles on their own plate, each value at 19 px 650 (HOUSE 11.1 rule 3); the long facts on a plate after the Block');
  ok(/\.blocksec \.ink:not\(\.tint\) \{ fill: var\(--done\); \}/.test(c) && /\.blocksec \.tint \{ fill: var\(--ink-2\); fill-opacity: 0\.14; \}/.test(c) && /\.blocksec \.outline \{ stroke: var\(--ink-2\); \}/.test(c)
    && /c\.append\(pkey\(\['k-done', 'Run'\], \['k-plan', B\.planned \? `Planned week\$\{race\}` : 'No plan in this snapshot'\]\)\);/.test(app) && !/ink is a run, an outline the plan/.test(app),
    'the Block: a run in --done, a planned week an --ink-2 outline holding its 14 % fill (HOUSE 11.1 rule 7), a key (Run, Planned week) in place of its sentence');
  ok(/function howTo\(c, text\)/.test(app) && ['Written ${a.updated', 'Plan written ${p.updated', 'The axis starts below the lowest reading', 'Derived from the VO₂ max estimate', 'From the watch’s record, averaged', 'weigh-in\')}, ${dayMon(rows[0].d)}'].every((w) => new RegExp(`howTo\\([a-z0-9]+, \\\`?'?[^\\n]*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(app))
    && /const note = \(text\) => \{ if \(text\.length > 64\) said\.push\(el\('p', null, text\)\); else area\.append\(help\(text\)\); \};/.test(app)
    && /c\.append\(help\('A plus is the agent slower than Garmin\.'\)\);/.test(app) && /body\.append\(el\('p', null, `Garmin’s times come from its VO₂ max estimate/.test(app),
    'method sentences into their section\'s How to read it fold (HOUSE 11.1 rule 9): the evaluation\'s and the plan\'s dates, the load chart\'s, VO₂ max\'s, Garmin\'s predictions, the session curves\' and each curve\'s long note, the weigh-ins\', the map\'s; the race method opens Why the numbers differ, the card keeps A plus is the agent slower than Garmin.');
  ok(/\.head \{[^}]*calc\(max\(16px, 50% - 364px\) \+ env\(safe-area-inset-right\)\) 0 calc\(max\(16px, 50% - 364px\) \+ env\(safe-area-inset-left\)\); \}/.test(c) && /\.filters, \.panebody \{ max-width: 760px; margin: 0 auto; padding: 0 calc\(16px \+ env\(safe-area-inset-right\)\) 0 calc\(16px \+ env\(safe-area-inset-left\)\); \}/.test(c),
    'the header centered with the pane: its sides max(16 px, 50 % − 364 px), so the name and the tabs start where the 760 px column\'s plates do (plan 0011\'s owed item; shoot.mjs measures it)');
  ok(/document\.addEventListener\('touchstart', \(\) => \{\}, \{ passive: true \}\);/.test(app),
    'a passive, empty touchstart listener on the document, so iOS draws the :active tints (plan 0011\'s owed item; a phone row checks it)');
  ok(/const other = \(ev\) => down && ev\.pointerId !== id;/.test(app) && (app.match(/if \(other\(ev\)\) return;/g) || []).length === 4,
    'a chart\'s readout follows only the pointer that is reading it: another pointer neither moves nor ends the read (Finances\' fix, plan 0012)');
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
