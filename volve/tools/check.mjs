// Static checks for Volve (HOUSE.md section 7.1): Norne Reservoir's, carried to Volve with the seismic (plan 0012
// D10, D11, D14) and Equinor's terms. Node, no dependencies but python3 for tools/art/palette.py:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / url( / fetch( and data path is relative, inside the folder, present;
//   4. data/ holds exactly the fourteen files the pipeline writes (Equinor's dated terms among them), fonts/
//      the house face and OFL.txt, js/ the seven modules (js/seismic.js Volve's own; js/gesture.js since 1.2, D18);
//      the face's and OFL.txt's sha256 are the house's; NOTES.md and About credit the face;
//   5. the data is untouched: each data file's sha256 is the one the pipeline committed (the app never
//      writes data/), and the facts About states from seismic.json are still what it says;
//   6. miniapp.json is valid, "Volve" at version 1.2 (HOUSE 13; plan 0012 D18 to D20: the section's zoom, the axes' lock, the tall stop), its description naming neither Equinor nor
//      a former partner (Equinor's terms, clause 4);
//   7. no AI vendor or model name in any shipped text file (the house list, stored ROT13);
//   8. the credit line, word for word, in the CREDIT constant written to About's #about-credit-line, its
//      first Sources and credits paragraph; no #credits and no other credit on the front (HOUSE 4.15); the
//      terms' address and dated copy in About; Equinor's and the partners' names only in About and the
//      data (clause 4), never on the front, in miniapp.json or in the README's Volve entry and row;
//   8b. the depths as delivered (plan 0012 D11): the seismic's sample depth is z.first + k z.step and the
//      section's rows are the axis's own depths, the traces' map points the survey's grid less the model's
//      center; no other term enters either;
//   9. the marketing camera's strings (HOUSE 7.4): "Oil saturation" written only by app.js (never in
//      index.html), the property words Oil and Pressure as role="radio", "Show the whole field" a button,
//      "Play production history" and "Pause" the Play key's names, "Show the controls" the ghost key, the
//      grip's three names (all kept from Norne Reservoir); every localStorage key under volve-viewer:v1;
//  10. SI: no plain space between a digit and a unit in strings the app writes; toFixed and
//      toLocaleString only in js/units.js;
//  11. no transition or animation on the track, the time row or the lead;
//  12. innerHTML only ever `= ''`; no insertAdjacentHTML, outerHTML, document.write, eval, new Function;
//  13. config.json's colormaps, colormapsDark and wellColors and style.css's chart, cut and plate tokens
//      equal tools/art/palette.py's, and palette.py passes;
//  14. the tells: no box-shadow, backdrop-filter, text-shadow, `transition: all`, uppercase or
//      letter-spacing; no middle dot, →, ➤ or "..." in what the app writes; both theme-color metas;
//      the @font-face rule word for word; the house's chrome tokens in both themes; one family, no
//      monospace; every script font string names "Ysabeau Office" first;
//  15. budgets: app code ≤ CODE_CAP, fonts/ ≤ 160,000, the ZIP built exactly as build-zips.yml builds it ≤
//      ZIP_CAP, with index.html at its top and nothing else in it. Both caps are the lead's rulings of
//      2026-10-07 (plan 0012 3.4c): code 322 500 B (the 2026-10-08 ruling for 1.1; 312 000 for 1.0), ZIP 33 600 000 B;
//  16. US spelling in every shipped text file, the data's own words (data/) excepted, and the title of
//      Equinor's terms quoted exactly.
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
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ',');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');

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
const model = JSON.parse(read('data/model.json'));
{
  const refs = [];
  for (const f of web) {
    const src = code(read(f), f);
    for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\(|loadJSON\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
    for (const m of src.matchAll(/['`]\.?\/?((?:data|fonts)\/[A-Za-z0-9_.-]+\.(?:json|woff2|bin|txt))['`]/g)) refs.push([f, m[1], '.']);
  }
  for (const k of Object.keys(model.files)) refs.push(['data/model.json', `data/${model.files[k]}`, '.']);
  const bad = refs.filter(([f, r, dir]) => {
    if (r.startsWith('#') || r.startsWith('${')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
    const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
    return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
  });
  ok(bad.length === 0 && refs.length > 0, `references: ${refs.length} (imports, src, href, url(), fetch and loadJSON, model.json's files): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
}

// 4. The folder contract and the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
exactly('data', ['ATTRIBUTION.txt', 'TERMS-Volve-2026-10-07.txt', 'dynamic.bin', 'geometry.bin', 'horizons.bin', 'ijk.bin', 'model.json', 'neighbours.bin', 'production.json', 'seismic.bin', 'seismic.json', 'static.bin', 'validation.json', 'wellpaths.json']);
exactly('fonts', ['ysabeau-office-gw.woff2', 'OFL.txt']);
exactly('js', ['units.js', 'data.js', 'track.js', 'section.js', 'pane.js', 'seismic.js', 'gesture.js']);
{
  const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
  const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
  ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house's (${FONT_SHA.slice(0, 12)}…)`);
  ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
    `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's (${OFL_SHA.slice(0, 12)}…), names the face and carries the OFL 1.1`);
  const LINE = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
  const notes = read('NOTES.md');
  ok(notes.includes(LINE) && html.includes(`Type: ${LINE}`) && !/no font/i.test(notes) && !/no font/i.test(html),
    'the font credit line, word for word, in NOTES.md and in About (prefixed "Type: "); neither says no font ships');
}

// 5. The data is untouched (sha256 as the pipeline committed them, part 1 and the OPM run; tools/DECISIONS.md)
{
  const PIN = {
    'data/ATTRIBUTION.txt': '41ddd08e01b9625382615de6715029a8dfffdd8acdd663fdb180fffcc13263aa',
    'data/TERMS-Volve-2026-10-07.txt': '406119e6523c7624bf28106342982dbb09042adb9c18ac8b2cabc285a8c0e606',
    'data/dynamic.bin': '7eeb2cbb4f56df9b28145372f7c69bb4e48c6636800f5c8c33734f55c50456e6',
    'data/geometry.bin': '5b633569066251267ecf73fef8b4a73354ccae7160e356d5eece4dfa8ee395dc',
    'data/horizons.bin': 'ff9de5dbd758606b00e358b254cd0afaf865f8132689f0d9bbc0c52eb961e9a5',
    'data/ijk.bin': '814da77af9d028311f5657c454bb71816918628aa46120cfb4ea630186163e6e',
    'data/model.json': '5e12cadbe9a681c4452dbf9364ed5ad7fd4c478a8c7af79bd270b759327e2b9e',
    'data/neighbours.bin': '8995d4fae2150785bbee1bbd2fda832a62f68505473d714075981d6a20deccfe',
    'data/production.json': 'acb1786312a62f400d5262d7e0802bf3ef228fcaf7507246d1f0bf8e5232b8e9',
    'data/seismic.bin': '6db335d88a45ce26869eed1c4ca4a0ada0665addf06e14f7dc5c91d05b4fb7a1',
    'data/seismic.json': '2392c1ae13abfa7f96839989deb2b3a948cbb82d4b2643610410ae3f5aa1cf38',
    'data/static.bin': '1fd644a2fd8dc12b8c60bfbca621633c11f6c9262e6cd9015ef61ebff969e0b2',
    'data/validation.json': '439cbbfc3820bbb0992644eef9c93a615844668585a2fbe11946fbbf0fd4af4d',
    'data/wellpaths.json': 'e017abea10f66436863329f8861e0b9872556b513dcdb43859ee8f208cd9cad1',
  };
  const changed = Object.keys(PIN).filter((f) => sha(f) !== PIN[f]);
  ok(changed.length === 0, `the fourteen data files are byte-identical to the pipeline's committed ones${changed.length ? ': changed ' + changed.join(', ') : ''}`);
  // what About writes in its own words from seismic.json and validation.json, still true of them
  const sm = JSON.parse(read('data/seismic.json')), v = JSON.parse(read('data/validation.json'));
  const facts = [
    [/^mean sea level \(inferred: the header's processing list includes tidal statics; the header does not state a datum\)/.test(sm.z.datum), 'z.datum: sea level, inferred from tidal statics'],
    [/62\.5 m and more\) within 0\.05 dB/.test(sm.antiAlias.passBand) && /^at least 50 dB down/.test(sm.antiAlias.stopBand), 'the anti-alias filter: 62.5 m within 0.05 dB, 50 dB down at the new Nyquist'],
    [/ST10010/.test(sm.horizons.source) && /2011/.test(sm.horizons.source) && /adjusted to the wells/.test(sm.horizons.source) && /not tied to it/.test(sm.horizons.source), 'the horizons: ST10010, 2011, adjusted to the wells, not tied'],
    [sm.crop.verticalMarginM === 500 && sm.crop.lateralMarginM === 250 && sm.amplitude.zeroCode === 128 && /^A POSITIVE SAMPLE/.test(sm.polarity), 'the crop margins, the zero code, the polarity line'],
    [v.pass === true && v.end === '2016-10-01' && v.static.DEPTH.maxAbsDiff === 0 && v.static.PORO.maxAbsDiff === 0, 'validation: passed, to 1 Oct 2016, depth and porosity equal'],
  ];
  ok(facts.every((f) => f[0]), `About's own words from the data still hold: ${facts.map((f) => `${f[1]} ${f[0] ? 'yes' : 'NO'}`).join('; ')}`);
}

// 6. miniapp.json
const PARTNERS = /equinor|statoil|exxon|bayerngas|licen[cs]e partners/i;   // Equinor's terms, clause 4: never to market anything
{
  let mini = null;
  try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
  if (mini) ok(mini.schemaVersion === 1 && mini.name === 'Volve' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && mini.version === '1.2' && !PARTNERS.test(mini.description),
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters, naming neither Equinor nor a former partner`);
}

// 7. No AI vendor or model name in shipped text (the house list, ROT13, copied from Global Weather's check)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
{
  const named = texts.filter((f) => namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files (ART.md and NOTES.md included)${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credit line, the terms, and the names kept to About and the data (Equinor's terms, clause 4)
{
  const credit = (app.match(/^const CREDIT = '([^']*)';$/m) || [])[1];
  ok(credit === 'Data: the Volve field data set, © Equinor ASA and the former Volve license partners, under Equinor’s Terms and conditions for licence to data - Volve; not connected with, sponsored or endorsed by them' && /\$\('about-credit-line'\)\.textContent = CREDIT;/.test(app)
    && (app.match(/textContent = CREDIT;/g) || []).length === 1,
    `the credit line: CREDIT is "${credit}", written once, to About's #about-credit-line`);
  const about = html.indexOf('<div class="about" id="about"'), front = code(html.slice(0, about), 'index.html');
  const firstP = (html.slice(html.indexOf('<h3>Sources and credits</h3>')).match(/<p[^>]*>/) || [''])[0];
  const credits = ['Equinor', 'ExxonMobil', 'Bayerngas', 'license partners', 'Ysabeau Office by', 'Terms and conditions'].filter((w) => front.includes(w));
  ok(!/id="credits"/.test(html) && !/'credits'/.test(app) && about > 0 && credits.length === 0 && firstP === '<p id="about-credit-line" translate="no">',
    `no #credits; nothing on the front carries a credit or names Equinor or a partner${credits.length ? ': ' + credits.join(', ') : ''}; #about-credit-line is About's first Sources and credits paragraph (HOUSE 4.15, F1)`);
  ok(/\$\('about-source'\)\.textContent = model\.source;/.test(app), "About carries model.json's source sentence verbatim (textContent, never retyped)");
  ok(html.includes('Terms: equinoropendata.blob.core.windows.net/disclaimers/HRS%20and%20Terms%20and%20conditions%20for%20license%20to%20data%20-%20Volve.pdf, with a dated copy in data/TERMS-Volve-2026-10-07.txt') && read('data/TERMS-Volve-2026-10-07.txt').includes('equinoropendata.blob.core.windows.net/disclaimers/HRS%20and%20Terms%20and%20conditions%20for%20license%20to%20data%20-%20Volve.pdf')
    && /ExxonMobil Exploration & Production Norway AS and Bayerngas Norge AS \(or their successors\)/.test(app) && /not connected with, sponsored or endorsed by Equinor or the former Volve license partners/.test(app) && /indexOf\('What we changed'\)/.test(app),
  "About: the terms' address (as the dated copy gives it, without its scheme) and the dated copy, both former partners named, the non-endorsement, and ATTRIBUTION.txt's own statement of every change");
  // where Equinor's name may stand: About (app.js's writeAbout and CREDIT, index.html after the About div), the data, NOTES.md and ART.md (the folder's
  // documentation); nowhere else the app writes, and not in the README's lines for Volve
  const named = [];
  for (const f of ['js/units.js', 'js/data.js', 'js/track.js', 'js/section.js', 'js/pane.js', 'js/seismic.js', 'js/gesture.js', 'style.css', 'config.json']) if (PARTNERS.test(code(read(f), f))) named.push(f);
  const readme = fs.existsSync(path.join(APP, '..', 'README.md')) ? fs.readFileSync(path.join(APP, '..', 'README.md'), 'utf8') : '';
  const entry = (readme.match(/### Volve\n[\s\S]*?(?=\n### |\n---)/) || [''])[0], row = (readme.match(/^\| Volve \|.*$/gm) || []).join('\n');
  if (PARTNERS.test(entry.replace(/\[`?volve\/[^\]]*\]\([^)]*\)/g, ''))) named.push("README.md's Volve entry");
  if (PARTNERS.test(row)) named.push("README.md's Volve row");
  ok(named.length === 0 && entry.length > 0 && row.length > 0, `Equinor's and the partners' names only in About, the data and the folder's own notes (clause 4): not in the app's other files, its settings, the README's Volve entry or rows${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8b. The depths and places as delivered (plan 0012 D11): nothing shifted, stretched or tied
{
  const seis = read('js/seismic.js');
  ok(/export const depthOf = \(g, k\) => g\.z0 \+ k \* g\.dz;/.test(seis) && /const t = \(depths\[r\] - g\.z0\) \/ g\.dz;/.test(seis) && /ox: meta\.origin\[0\] - center\[0\], oy: meta\.origin\[1\] - center\[1\]/.test(seis)
    && /depths\[r\] = ax\.Z\(\(y0 \+ r \+ 0\.5\) \/ dpr\) \+ ax\.datum;/.test(app) && /sectionAxis\(sec, box, fitEx, model\.center\[2\], win\)/.test(app) && /viewAxis\(sec, b, v, model\.center\[2\], place, lim\)/.test(app) && /viewAxis\(sec, SEC\.fbox, SEC\.home, model\.center\[2\], SEC\.place, SEC\.lim\)/.test(app) && !/\b(tie|shift|offset)Depth|datumShift|seisShift/i.test(code(app, 'app.js') + code(seis, 'x.js')),
  "depths as delivered: a sample's depth is z.first + k z.step, a row's is the axis's own, fitted or held (the model's datum, center[2], the one constant), the traces' map points the survey's grid less the model's center; no shift, tie or offset term anywhere");
}

// 9. The marketing camera's strings (HOUSE 7.4) and the stored keys
{
  const cfg = JSON.parse(read('config.json'));
  const prop = (k) => cfg.properties.find((p) => p.key === k) || {};
  ok(!/oil saturation/i.test(html) && prop('SOIL').label === 'Oil saturation' && cfg.defaultProperty === 'SOIL' && /\$\('legend-name'\)\.textContent = p\.label;/.test(app),
    'camera: "Oil saturation" is config.json\'s default label, written by app.js into the legend once every file is in, and appears nowhere in index.html');
  ok(prop('SOIL').short === 'Oil' && prop('PRESSURE').short === 'Pressure' && /b\.setAttribute\('role', 'radio'\)/.test(app) && /b\.textContent = p\.short \|\| p\.label;/.test(app),
    'camera: the property words "Oil" and "Pressure" are role="radio" buttons named by their text');
  const fits = [...html.matchAll(/<button[^>]*aria-label="Show the whole field"/g)].length;
  ok(fits === 1 && !/aria-label="Reset view"/.test(html), `camera: one <button> named "Show the whole field" (${fits})`);
  const pauses = [...(html + app).matchAll(/'Pause'|"Pause"/g)].length;
  ok(/aria-label="Play production history"/.test(html) && /on \? 'Pause' : 'Play production history'/.test(app) && pauses === 1,
    `camera: the Play key is named "Play production history" at rest and "Pause" while playing, and nothing else is named Pause (${pauses})`);
  ok(/<button[^>]*class="ghost"[^>]*aria-label="Show the controls"[^>]*aria-keyshortcuts="Escape"/.test(html) && /aria-label="Hide the controls"/.test(html),
    'camera: the ghost key is named exactly "Show the controls" (aria-keyshortcuts Escape); the entry key "Hide the controls"');
  ok(/const GRIP = \['Show more controls', 'Show all controls', 'Hide the extra controls'\];/.test(app), "camera: the grip's three names are the stock three");
  const STORE = (app.match(/^const STORE = \{(.*)\};$/m) || ['', ''])[1];
  const direct = [...app.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim()).filter((d) => d !== 'key');
  const viaStore = [...app.matchAll(/\bstore\(\s*([^,)]+),/g)].map((m) => m[1].trim());
  const fields = (app.match(/for \(const k of (\[[^\]]+\])\) if \(k in s\) S\[k\] = s\[k\];/) || [])[1];
  const rest = ['s.sheet', 's.cut', 's.vf', 's.cam', 's.explode', 's.section', 's.seis'].every((k) => app.includes(k));
  ok(/state: LS_KEY, focus: `\$\{LS_KEY\}:focus`, units: `\$\{LS_KEY\}:units`/.test(STORE) && /const LS_KEY = 'volve-viewer:v1';/.test(app)
    && [...direct, ...viaStore].every((d) => /^STORE\.\w+$/.test(d)) && fields === "['prop', 'frame', 'exag', 'wells', 'labels', 'edges', 'well']" && rest
    && !/:hint/.test(code(app, 'app.js')),
  `storage: volve-viewer:v1 holds the view (${fields}, sheet, cut, vf, cam, explode, the section and the seismic's display); :focus and :units beside it; every call through STORE`);
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only in js/units.js
{
  const UNIT = /\d (bar|psi|m|ft|km|mi|mD|Sm³\/d|bbl\/d|Mscf\/d|%|px)(?![\w/])/;
  const files = ['index.html', 'app.js', 'js/units.js', 'js/data.js', 'js/track.js', 'js/section.js', 'js/pane.js', 'js/seismic.js', 'js/gesture.js'];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const fixedHits = [];
  for (const f of files.filter((x) => x.endsWith('.js') && x !== 'js/units.js')) code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  ok(fixedHits.length === 0, `SI: toFixed and toLocaleString only in js/units.js${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. Nothing that carries a step transitions
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.(valid|lead|track)\b|#slider|#valid|#lead|#track/.test(sel) && /(transition|animation)\s*:\s*(?!\s|none)/.test(body));
  const none = rules.some(([sel, body]) => /\.valid, \.lead, \.track, \.track canvas/.test(sel) && /transition: none; animation: none/.test(sel + body));
  ok(moving.length === 0 && none, `no transition or animation on the track, the time row or the lead${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and style.css says none on them)'}`);
}

// 12. innerHTML only ever empties (the stock app had five markup builds; the house pass rebuilt them as DOM)
{
  const uses = [];
  for (const f of shipped.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)\s*([^;\n]*)/g)) uses.push([f, m[1], m[2].trim()]);
  const bad = uses.filter((u) => u[1] !== '=' || u[2] !== "''");
  ok(bad.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses, every one \`= ''\`; no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 13. The palette: config.json and style.css carry palette.py's values, and palette.py passes
{
  const TEMPLATE = path.dirname(APP);
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8', cwd: TEMPLATE });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8', cwd: TEMPLATE });
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  let pal = null; try { pal = JSON.parse(json.stdout); } catch { /* reported below */ }
  const cfg = JSON.parse(read('config.json'));
  const same = pal && ['colormaps', 'colormapsDark', 'wellColors'].every((k) => JSON.stringify(cfg[k]) === JSON.stringify(pal[k]));
  ok(!!same, `config.json's colormaps, colormapsDark and wellColors equal palette.py --json (${pal ? Object.keys(pal.colormaps).length : 0} scales, ${pal ? Object.values(pal.colormaps).concat(Object.values(pal.colormapsDark)).reduce((n, s) => n + s.length, 0) : 0} stops)`);
  // plan 0012 D16: plasma for pressure and viridis for the rock, matplotlib's tables, the same stops in both themes;
  // the saturations, the categories, the layers and the seismic exactly as 1.0 stored them (their sha256)
  const D16 = ['pressure', 'rock', 'depth'], ENDS = { plasma: ['#0d0887', '#f0f921'], viridis: ['#440154', '#fde725'] };
  const d16 = D16.every((k) => { const s = cfg.colormaps[k], e = ENDS[k === 'pressure' ? 'plasma' : 'viridis']; return s && s.length === 33 && JSON.stringify(s) === JSON.stringify(cfg.colormapsDark[k]) && s[0] === e[0] && s[32] === e[1]; });
  const keptKeys = Object.keys(cfg.colormaps).filter((k) => !D16.includes(k));
  const kept = crypto.createHash('sha256').update(JSON.stringify(keptKeys.map((k) => [k, cfg.colormaps[k], cfg.colormapsDark[k]]))).digest('hex');
  ok(d16 && kept === '931a2947bfe9bfcb9dd35c4dfdbfce74157f0bd006868ae582ddf18558e18c6e',
    `D16: ${D16.join(', ')} are plasma (pressure) and viridis, 33 stops, one set for both themes; ${keptKeys.join(', ')} as 1.0 stored them (sha256 ${kept.slice(0, 12)})`);
  const plate = html.slice(html.indexOf('<main class="plate"'), html.indexOf('</main>')), inst = (html.match(/<div class="instruments" id="instruments">([\s\S]*?)<\/div>/) || [])[1] || '';
  ok(/<span class="compass" id="north" role="img" aria-label="North arrow"><svg[^>]*aria-hidden="true"><circle[^>]*\/><g id="needle"><path class="n"[^>]*\/><path[^>]*\/><\/g><text id="north-n">N<\/text><\/svg><\/span>/.test(plate) && !/north|needle/.test(inst) && /id="scale"/.test(inst)
    && /keepOut\(\) \{\n  const out = \[\];\n  for \(const id of \['readout', 'keys', 'focus-exit', 'north'\]\)/.test(app) && /\$\('focus-exit'\), \$\('north'\)\]\)/.test(app),
    'D17: the compass in the plate (its disc, a two-tone needle, the N), named "North arrow" until app.js says where north is; the instrument line holds the scale alone; labels and the card keep off the compass');
  const c = code(css, 'x.css'), light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')), dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'));
  const tok = (block, name) => ((block.match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1] || '').trim().toLowerCase();
  const sig = run.stdout.match(/light: ink (#[0-9a-f]{6})[\s\S]*?water \(ink at ([\d.]+)\)[\s\S]*?dark: ink (#[0-9a-f]{6})[\s\S]*?water \(ink at ([\d.]+)\)/);
  const ground = run.stdout.match(/light: ground (#[0-9a-f]{6})[\s\S]*?dark: ground (#[0-9a-f]{6})/);
  const chartOk = pal && ['oil', 'water', 'gas'].every((k) => tok(light, `chart-${k}`) === pal.chart.light[k] && tok(dark, `chart-${k}`) === pal.chart.dark[k]);
  ok(!!(chartOk && sig && ground && tok(light, 'cut') === sig[1] && Number(tok(light, 'cut-water-a')) === Number(sig[2]) && tok(dark, 'cut') === sig[3] && Number(tok(dark, 'cut-water-a')) === Number(sig[4])
    && tok(light, 'plate') === ground[1] && tok(dark, 'plate') === ground[2]),
  `style.css: --chart-*, --cut (${tok(light, 'cut')} / ${tok(dark, 'cut')}), --cut-water-a and --plate (${tok(light, 'plate')} / ${tok(dark, 'plate')}) are palette.py's`);
}

// 14. The look: the tells, the tokens, the face
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/text-shadow/, 'text-shadow'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/font-variant[^;]*small-caps/, 'small capitals'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `style.css: no box-shadow, backdrop-filter, text-shadow, transition: all, uppercase, small capitals or letter-spacing${found.length ? ': ' + found.join(', ') : ''}`);
  const sizes = [...c.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => +m[1]), weights = [...c.matchAll(/font-weight:\s*(\d+)/g)].map((m) => +m[1]);
  ok(sizes.every((s) => [10.5, 11, 11.5, 12.5, 13.5, 15, 21].includes(s)) && weights.every((w) => [400, 560, 600, 620, 650].includes(w)),
    `type: every size on the house scale (${[...new Set(sizes)].sort((a, b) => a - b).join(', ')} px), every weight in the cut (${[...new Set(weights)].sort().join(', ')})`);
  const dots = [], arrows = [];
  for (const f of ['app.js', 'js/units.js', 'js/data.js', 'js/track.js', 'js/section.js', 'js/pane.js', 'js/seismic.js', 'js/gesture.js']) for (const s of strings(read(f))) if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
  if (code(html, 'index.html').replace(/<[^>]+>/g, ' ').includes('·')) dots.push('index.html');
  ok(dots.length === 0, `no middle dot in any string the app writes${dots.length ? ': ' + dots.join(' | ') : ''}`);
  for (const f of web) {
    const src = read(f);
    if (/[→➤]/.test(f.endsWith('.js') ? strings(src).join('\n') : code(src, f))) arrows.push(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? code(src, f).replace(/<[^>]+>/g, ' ') : '';
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤ or "..." in the text the app shows${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')), dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'));
  const tok = (block, name) => ((block.match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1] || '').trim();
  const HOUSE = {
    light: { page: '#ffffff', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },   // the page white (HOUSE 12, D6)
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const off = [];
  for (const [scheme, block] of [['light', light], ['dark', dark]]) for (const [k, v] of Object.entries(HOUSE[scheme])) if (tok(block, k).toLowerCase() !== v) off.push(`${scheme} --${k} ${tok(block, k)}`);
  ok(off.length === 0 && tok(light, 'draw') === 'cubic-bezier(0.2, 0, 0, 1)' && tok(light, 'sheet-in') === 'cubic-bezier(0.32, 0.72, 0, 1)' && tok(light, 'face') === "'Ysabeau Office', system-ui, -apple-system, sans-serif"
    && /color-scheme: light;/.test(light) && /color-scheme: dark;/.test(dark) && /html, body \{[^}]*background: var\(--page\)/.test(c),
  `chrome tokens: the house's seven in both themes, --draw, --sheet-in, --face, color-scheme per theme, html and body on --page${off.length ? ': ' + off.join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === HOUSE[s].page), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')}`);
  ok(/@font-face\s*\{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css) && (css.match(/@font-face/g) || []).length === 1,
    "@font-face: one rule, 'Ysabeau Office' from fonts/ysabeau-office-gw.woff2, weight 400–650, font-display: block");
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((f) => f !== "'Ysabeau Office'");
  const fontShorts = [...c.matchAll(/\bfont:\s*([^;]+);/g)].map((m) => m[1]).filter((f) => !/var\(--face\)|inherit/.test(f));
  ok(families.length === 0 && fontShorts.length === 0 && !/monospace|ui-monospace/i.test(c), `one family: every font through --face, no monospace${families.length + fontShorts.length ? ': ' + families.concat(fontShorts).join(', ') : ''}`);
  const scriptFonts = [];
  for (const f of ['app.js', 'js/track.js', 'js/section.js']) for (const s of strings(read(f))) if (/\d(\.\d)?px\s/.test(s) && /[a-z]/i.test(s.replace(/\d+(\.\d+)?px/, ''))) scriptFonts.push([f, s]);
  ok(scriptFonts.length > 0 && scriptFonts.every(([, s]) => /px "Ysabeau Office"/.test(s)), `script font strings name "Ysabeau Office" first (${scriptFonts.length}: ${scriptFonts.map(([f, s]) => `${f} ${s.slice(0, 40)}`).join(' | ')})`);
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html),
    'index.html: lang en-US, viewport-fit=cover without user-scalable=no, color-scheme light dark');
}

// 15. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
{
  const codeFiles = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f) && !f.startsWith('data/') && !f.startsWith('vendor/'));
  const size = (f) => fs.statSync(path.join(APP, f)).size;
  const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
  // Volve's caps, the lead's rulings of 2026-10-07 (plan 0012 3.4c): Norne Reservoir 2.3's code (255 443 B,
  // cap 256 000) plus js/seismic.js, the section's survey lines, seismic layer and horizons, About's seismic
  // and terms; nothing cut to fit. Past a cap, the figure is reported, never cut to.
  const CODE_CAP = 370000;   // the lead's fourth ruling, 2026-10-10: 369 523 B after 1.2's D18 to D20 (zoom, the lock, the tall stop); 322 500 for 1.1, 312 000 for 1.0
  ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the lead's ruling for 1.2 of 2026-10-10; Norne Reservoir 2.5's code is 299,880 of its 300,500): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
  const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
  ok(fontBytes <= 160000, `fonts/ ${fmt(fontBytes)} bytes (budget 160,000; 0 before the pass)`);
  const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
  const zip = path.join(work, 'volve.zip'); fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
  const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n');
  const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
  const names = entries.map((p) => p.slice(7).join(' '));
  const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
  const zsize = fs.statSync(zip).size;
  ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
  ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => /^(tools|screenshots|pipeline|scripts)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
    `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/, pipeline/, scripts/ or dotfiles`);
  console.log(`     stored in the ZIP: data/ ${fmt(stored((n) => n.startsWith('data/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, config.json and miniapp.json ${fmt(stored((n) => /^(config|miniapp)\.json$/.test(n)))}, *.md ${fmt(stored((n) => n.endsWith('.md') && !n.includes('/')))}`);
  const ZIP_CAP = 33600000;   // the lead's ruling, 2026-10-07: the data alone is 33.2 MB deflated, which the pipeline owns
  ok(zsize <= ZIP_CAP, `ZIP size ${fmt(zsize)} bytes (cap ${fmt(ZIP_CAP)}, the lead's ruling of 2026-10-07; data/ is ${fmt(stored((n) => n.startsWith('data/')))} of it, the pipeline's)`);
}

// 16. US spelling in every shipped text file; the data's own words (data/) excepted, and the title of Equinor's terms
{
  const BRIT = /\b(judgement|colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|forevery\w*|behaviour\w*|recognis\w*|rasteris\w*|normalis\w*|quantis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|for ever|organis\w*|visualis\w*|initialis\w*)\b/i;
  // the cell connections file is named neighbours.bin, so model.json's key and the code that reads it keep
  // the word; Equinor's terms are titled "Terms and conditions for licence to data - Volve", quoted exactly
  const ALLOW = /neighbours\.bin|\['geometry', 'neighbours'|neighbours: NA|bufs\.neighbours|"neighbours":|the data's `neighbours`|Terms and conditions for licence to data - Volve|HRS%20and%20Terms%20and%20conditions%20for%20license|for licence to data/g;
  const hits = [];
  const mine = texts.filter((x) => x !== 'fonts/OFL.txt' && !x.startsWith('data/'));
  for (const f of mine) {
    read(f).split('\n').forEach((line, i) => { const m = line.replace(ALLOW, '').match(BRIT); if (m) hits.push(`${f}:${i + 1} ${m[0]}`); });
  }
  ok(hits.length === 0, `US spelling in ${mine.length} shipped text files${hits.length ? ': ' + hits.slice(0, 12).join(', ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
