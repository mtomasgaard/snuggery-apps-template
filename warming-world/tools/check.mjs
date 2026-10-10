// Static checks for Warming World (DESIGN §16). Node, no dependencies; US Quakes' tools/check.mjs in
// shape (copied, then changed for this app):
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / fetch( / url( and every data path the code names is relative, inside
//      the folder and present;
//   4. assets/ holds exactly world.json, places.json, about.json and climatology.json (plan 0012 3.3: the
//      1951–1980 climatology for Absolute, ≤ 120,000 bytes, readable by js/measure.js); data/ only
//      snapshot.json; fonts/ exactly archivo-ww.woff2 and OFL.txt;
//   5. miniapp.json is valid, version 1.2 (plan 0012 D21–D22; HOUSE §13);
//   6. no AI vendor or model name in any shipped text file, DESIGN.md and ART.md included (US Quakes'
//      list, stored ROT13; the snapshot's base64 maps are skipped, its strings are read);
//   7. js/ramp.js: its stops equal ART.md's table; DESIGN §7.1's constraints (lightness symmetric within
//      0.02 at every 0.1 °C to 4, falling from 0 to each end, chroma at 0 ≤ 0.02; under deutan and protan
//      simulation (Machado 2009) ΔE(OKLab) ≥ 0.15 between −4 and +4, ≥ 0.08 between ±1 and 0, and the
//      ends ≥ 0.08 from both hatch grays); the map scale ±4 and the stripes scale ±1.5; and Absolute's
//      ramp (plan 0012 D21, ART "The temperature ramp"): Global Weather's RAMPS.temp, light and dark, stop
//      for stop (global-weather/js/ramps.js, or the hash recorded here where a copy has no Global
//      Weather); the scale −50 … +50 °C with 0 °C, the slate stop, at the LUT's and the bar's middle; in
//      gamut (8-bit sRGB stops, by construction now); in each theme and under normal, deutan, protan and
//      tritan vision every 0.1 °C ≥ 0.10 from both hatch grays (≥ 0.02 under the simulations: the hatch is
//      a pattern as well), every eighth of the legend a step of ΔE ≥ 0.02 and the ends ≥ 0.10 apart
//      (Global Weather's own rules), and every value ≥ 0.05 from the theme's card (the limb's ring and the
//      map's outline part the Earth from the card where a value comes near it). 3.3's "lightness rises at
//      every 1 °C" and "10 °C steps within a factor 1.75" are dropped: the owner's ramp is centered on 0,
//      pale (light) or dark (dark) at 0 °C, and not perceptually even, by design;
//   7b. the credit (HOUSE §4.15, plan 0012 change list item 1): no credit line on the front
//      (index.html has no legend-credit or credits element), the constant unchanged in js/readout.js,
//      and About writes it as #about-credit-line;
//   8. every chrome color token in style.css, both themes, has OKLCh chroma < 0.001; index.html's two
//      theme-color metas are each theme's --page;
//   9. app code (index.html, style.css, js/*.js) ≤ 230,500 bytes (the lead's ruling, plan 0012 D21–D22; 223,000 for 1.1); data/snapshot.json ≤ 1,500,000;
//      fonts/ ≤ 250,000;
//  10. the ZIP, built exactly as build-zips.yml builds it, has index.html at its top and is ≤ 2,000,000
//      bytes (every size printed).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { STOPS, rampLab, oklabToLinear, MAP_SCALE, STRIPES_SCALE, HATCH_GROUND, HATCH_LINE, ABS_STOPS, absRGB, buildAbsLut, ABS_LO, ABS_HI } from '../js/ramp.js';
import { checkClim } from '../js/measure.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');

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
const code = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const withUrls = code.filter((f) => /https?:\/\//i.test(read(f)));
ok(withUrls.length === 0, `no http(s):// in ${code.length} .html/.css/.js files${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);

// 3. References: relative, inside the folder, present
const refs = [];
for (const f of code) {
  const src = read(f);
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
  for (const m of src.matchAll(/['`]((?:assets|data|fonts)\/[A-Za-z0-9_.-]+\.(?:json|bin|woff2))['`]/g)) refs.push([f, m[1], '.']);
}
const bad = refs.filter(([f, r, dir]) => {
  if (r.startsWith('#') || r.startsWith('${')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
  // url() in style.css resolves against the stylesheet; imports against the module's folder
  const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0 && refs.length > 0, `references: ${refs.length} (imports, src, href, url(), fetch(), data paths) — ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4. assets/, data/ and fonts/ hold exactly the contract's files
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.length} files: ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : ` — found ${have.join(', ')}`}`);
};
exactly('assets', ['world.json', 'places.json', 'about.json', 'climatology.json']);
{
  const raw = read('assets/climatology.json'), bad = checkClim(JSON.parse(raw));
  ok(!bad && raw.length <= 120000, `assets/climatology.json ${fmt(Buffer.byteLength(raw))} bytes (cap 120,000), ${bad || 'readable by js/measure.js'}: ${JSON.parse(raw).source.name}`);
}
exactly('data', ['snapshot.json']);
exactly('fonts', ['archivo-ww.woff2', 'OFL.txt']);

// 5. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Warming World' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && mini.version === '1.2',
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 6. No AI vendor or model name in shipped text (US Quakes' list, ROT13, model family names included)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
const noPlanes = (k, v) => (k === 'planes' ? undefined : v);
const named = texts.filter((f) => namesRe.test(f === 'data/snapshot.json' ? JSON.stringify(JSON.parse(read(f), noPlanes)) : read(f)));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files${named.length ? ': ' + named.join(', ') : ''}`);

// 7. The ramp (ART.md's table, DESIGN §7.1's constraints)
{
  const row = (label) => ((read('ART.md').match(new RegExp(`^\\| ${label} \\|([^\\n]+)`, 'm')) || [, ''])[1]).split('|').map((x) => x.trim()).filter(Boolean)
    .map((x) => Number(x.replace('−', '-').replace('+', '')));
  const art = [row('°C'), row('L'), row('C'), row('h')];
  const same = art[0].length === 9 && STOPS.length === 9 && STOPS.every((s, i) => s.every((v, j) => Math.abs(v - art[j][i]) < 1e-9));
  ok(same, `js/ramp.js's nine stops equal ART.md's table (°C ${art[0].join(' ')})`);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const enc = (x) => { x = Math.min(1, Math.max(0, x)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
  const linToLab = ([r, g, b]) => {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  // Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear sRGB (tools/art/ramp.py's)
  const CVD = { normal: null,
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]] };
  const sim = (lab, m) => {
    let rgb = oklabToLinear(...lab).map((c) => lin(enc(c)));
    if (m) rgb = m.map((r) => Math.min(1, Math.max(0, r[0] * rgb[0] + r[1] * rgb[1] + r[2] * rgb[2])));
    return linToLab(rgb);
  };
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let sym = 0, mono = true;
  for (let k = 0; k <= 40; k++) {
    sym = Math.max(sym, Math.abs(rampLab(k / 10)[0] - rampLab(-k / 10)[0]));
    if (k) mono = mono && rampLab(k / 10)[0] < rampLab((k - 1) / 10)[0] && rampLab(-k / 10)[0] < rampLab(-(k - 1) / 10)[0];
  }
  const c0 = Math.hypot(rampLab(0)[1], rampLab(0)[2]);
  ok(sym <= 0.02 && mono && c0 <= 0.02, `ramp: max |L(+v) − L(−v)| ${sym.toFixed(4)} (≤ 0.02), lightness falls from 0 to each end ${mono}, chroma at 0 ${c0.toFixed(4)} (≤ 0.02)`);
  const hatch = [HATCH_GROUND, HATCH_LINE].map((c) => linToLab(c.map((v) => lin(v / 255))));
  for (const [name, m] of Object.entries(CVD)) {
    const s = (v) => sim(rampLab(v), m);
    const ends = dE(s(-4), s(4)), n1 = dE(s(-1), s(0)), p1 = dE(s(1), s(0));
    const hz = Math.min(...[-4, 4].flatMap((v) => hatch.map((h) => dE(s(v), sim(h, m)))));
    ok(ends >= 0.15 && n1 >= 0.08 && p1 >= 0.08 && hz >= 0.08, `ramp under ${name} vision: ΔE(−4, +4) ${ends.toFixed(3)} (≥ 0.15), ΔE(−1, 0) ${n1.toFixed(3)}, ΔE(+1, 0) ${p1.toFixed(3)} (≥ 0.08), ends to the hatch ${hz.toFixed(3)} (≥ 0.08)`);
  }
  ok(MAP_SCALE === 4 && STRIPES_SCALE === 1.5, `scales: the map ±${MAP_SCALE} °C, the stripes ±${STRIPES_SCALE} °C`);
  // Absolute's ramp (plan 0012 D21): Global Weather's temperature colors, stop for stop, then its checks
  const GW = path.join(APP, '..', 'global-weather', 'js', 'ramps.js');
  const flat = (t) => JSON.stringify(['light', 'dark'].map((th) => t[th].map(([v, c]) => [v, c])));
  const PIN = '99678e686e48fc80a3c4fdfcc3d5b61ceeb1b59d26484dca4941fd3af5f8bd18';   // sha256 of flat(RAMPS.temp), 2026-10-10
  const mine = flat(ABS_STOPS), hash = createHash('sha256').update(mine).digest('hex');
  if (fs.existsSync(GW)) {
    const { RAMPS } = await import(GW);
    ok(mine === flat(RAMPS.temp), `Absolute's stops are Global Weather's RAMPS.temp, light and dark, ${ABS_STOPS.light.length} stops each (−50 … +48 °C), stop for stop (sha256 ${hash.slice(0, 12)}…)`);
  } else ok(hash === PIN, `Absolute's stops: no global-weather/ in this copy, so the hash recorded here: ${hash.slice(0, 12)}… (${hash === PIN ? 'equal' : 'differs'})`);
  const lutL = buildAbsLut(false), lutD = buildAbsLut(true), at = (lut, i) => Array.from(lut.slice(i * 4, i * 4 + 3)).join();
  ok(ABS_LO === -50 && ABS_HI === 50 && at(lutL, 500) === ABS_STOPS.light[16][1].join() && ABS_STOPS.light[16][0] === 0 && at(lutD, 500) === ABS_STOPS.dark[16][1].join()
    && at(lutL, 0) === ABS_STOPS.light[0][1].join() && at(lutL, 1000) === ABS_STOPS.light[40][1].join() && at(lutD, 1000) === ABS_STOPS.dark[40][1].join(),
    `Absolute's scale ${ABS_LO} … +${ABS_HI} °C, centered: the LUT's entry 500 of 0 … 1000 is 0 °C, Global Weather's slate (light ${at(lutL, 500)}, dark ${at(lutD, 500)}); −50 °C its coldest stop, +50 °C its warmest (+48)`);
  const all = [...ABS_STOPS.light, ...ABS_STOPS.dark].flatMap((x) => x[1]);
  ok(all.every((c) => Number.isInteger(c) && c >= 0 && c <= 255), `temperature ramp in sRGB's gamut: ${all.length / 3} stops of 8-bit sRGB, interpolated in sRGB (by construction since D21)`);
  const card = { light: [190, 190, 190], dark: [48, 48, 48] };
  const cssCard = [...read('style.css').matchAll(/--card:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
  ok(cssCard.join() === '#bebebe,#303030', `the cards measured against are style.css's --card (${cssCard.join(', ')})`);
  for (const th of ['light', 'dark']) {
    for (const [name, m] of Object.entries({ ...CVD, tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]] })) {
      const s8 = (c) => { let l = c.map((v) => lin(v / 255)); if (m) l = m.map((r) => Math.min(1, Math.max(0, r[0] * l[0] + r[1] * l[1] + r[2] * l[2]))); return linToLab(l); };
      const s = (v) => s8(absRGB(v, th === 'dark'));
      let hz = 9, cd = [9, 0];
      for (let t = -500; t <= 500; t++) { const c = s(t / 10); hz = Math.min(hz, ...[HATCH_GROUND, HATCH_LINE].map((h) => dE(c, s8(h)))); const d = dE(c, s8(card[th])); if (d < cd[0]) cd = [d, t / 10]; }
      const eighths = Array.from({ length: 8 }, (_, k) => dE(s(-50 + k * 12.5), s(-50 + (k + 1) * 12.5))), ends = dE(s(-50), s(48));
      const hzMin = m ? 0.02 : 0.10;
      ok(hz >= hzMin && Math.min(...eighths) >= 0.02 && ends >= 0.10 && (m || cd[0] >= 0.05),
        `temperature ramp, ${th}, ${name} vision: to the hatch ≥ ${hz.toFixed(3)} (≥ ${hzMin}); every eighth a step of ΔE ≥ ${Math.min(...eighths).toFixed(3)} (≥ 0.02); ends ${ends.toFixed(3)} apart (≥ 0.10); nearest the card ${cd[0].toFixed(3)} at ${cd[1]} °C${m ? ' (printed)' : ' (≥ 0.05)'}`);
    }
  }
}

// 7b. The credit is About's, not the front's (HOUSE §4.15; plan 0012 change list item 1)
{
  const html = read('index.html'), rd = read('js/readout.js'), ab = read('js/about.js');
  const constant = /\.replace\(\/\^Temperature:\\s\*\/, 'Data: '\)\.replace\(\/ Surface Temperature Analysis \\\(\/, ' \('\)/.test(rd);
  ok(!/legend-credit|id="credits"/.test(html) && !/legend-credit/.test(read('style.css')) && constant && /about-credit-line/.test(ab),
    'the credit: no credit element on the front (index.html, style.css), the constant unchanged (js/readout.js creditLine), written into About as #about-credit-line');
}

// 8. The chrome is gray: every color token in style.css, both themes, has OKLCh chroma < 0.001
{
  const css = read('style.css');
  const tokens = [...css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)];
  const toLab = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = c.map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
  const worst = tokens.reduce((w, t) => Math.max(w, Math.hypot(...toLab(t[2]))), 0);
  const names = new Set(tokens.map((t) => t[1]));
  ok(tokens.length >= 20 && worst < 0.001, `chrome: ${tokens.length} color tokens (${names.size} names, both themes) in style.css, highest OKLCh chroma ${worst.toFixed(5)} (< 0.001)`);
  // the browser's bar: one theme-color per scheme in index.html, each that theme's --page
  const pages = tokens.filter((t) => t[1] === '--page').map((t) => t[2].toLowerCase());
  const metas = [...read('index.html').matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  const want = { light: pages[0], dark: pages[1] };
  ok(metas.length === 2 && metas.every(([sch, c]) => c === want[sch] && Math.hypot(...toLab(c)) < 0.001),
    `theme-color: ${metas.map(([sch, c]) => `${sch} ${c}`).join(', ')} (--page ${want.light} / ${want.dark})`);
}

// 9. Budgets
// SI spacing (the owner's rule 3; review R-5): no plain space between a digit and °C, % or km in any
// string the app writes (js/, index.html), in About's prose, or, since the lead's pass, in what the
// pipeline writes for the screen (CREDITS.txt, the snapshot's credit lines and ask rows). units.si stays,
// for a live snapshot made before that pass.
{
  const SI = /\d (°C|%|km)\b|\d (°C)/;
  const siFiles = ['index.html', ...code.filter((f) => /^js\/[^/]+\.js$/.test(f)), 'assets/about.json', 'CREDITS.txt', 'data/snapshot.json'];
  const hits = [];
  for (const f of siFiles) read(f).split('\n').forEach((l, i) => { const body = f.endsWith('.js') ? l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\/\/ .*$/, '') : l; if (SI.test(body)) hits.push(`${f}:${i + 1}`); });
  ok(hits.length === 0, `SI spacing: no plain space before °C, % or km in ${siFiles.length} files the app writes its text in${hits.length ? ': ' + hits.join(', ') : ''}`);
}
const codeFiles = code.filter((f) => f === 'index.html' || f === 'style.css' || /^js\/[^/]+\.js$/.test(f));
const codeBytes = codeFiles.reduce((n, f) => n + fs.statSync(path.join(APP, f)).size, 0);
ok(codeBytes <= 230500, `app code ${fmt(codeBytes)} bytes (budget 230,500, the lead's ruling for 1.2 of 2026-10-10 on the measured 229,889, plan 0012 D21–D22; 223,000 for 1.1; DESIGN's estimate 110,000): ${codeFiles.map((f) => `${f} ${fmt(fs.statSync(path.join(APP, f)).size)}`).join(', ')}`);
const snapBytes = fs.statSync(path.join(APP, 'data/snapshot.json')).size;
ok(snapBytes <= 1500000, `data/snapshot.json ${fmt(snapBytes)} bytes (cap 1,500,000)`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + fs.statSync(path.join(APP, f)).size, 0);
ok(fontBytes <= 250000, `fonts/ ${fmt(fontBytes)} bytes (cap 250,000)`);

// 10. The ZIP, exactly as .github/workflows/build-zips.yml builds it
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'warming-world.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pre) => entries.filter((p) => p[7].startsWith(pre)).reduce((n, p) => n + Number(p[2]), 0);
const size = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && !names.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored: data/ ${fmt(stored('data/'))}, assets/ ${fmt(stored('assets/'))}, fonts/ ${fmt(stored('fonts/'))}, app code ${fmt(entries.filter((p) => codeFiles.includes(p[7])).reduce((n, p) => n + Number(p[2]), 0))}, *.md ${fmt(entries.filter((p) => p[7].endsWith('.md')).reduce((n, p) => n + Number(p[2]), 0))}`);
ok(size <= 2000000, `ZIP size ${fmt(size)} bytes (cap 2,000,000; the plan's target about 1.3 MB)`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
