// Loading and validating every data file against tools/CONTRACT.md, and the .bin decoders.
//
// Decoders take (json, ArrayBuffer) and never fetch, so tools/test_plates.mjs runs them in Node on
// files read from disk. Loaders fetch relative paths only. A file that fails its check throws an
// Error whose message names the file; app.js shows it on screen rather than drawing a blank.
//
// Loading order (DESIGN §5.8, §10): manifest + timescale → the proxy sheet and the saved stop's
// map (earth.js), with curves, story and about fetched alongside → plates, coasts, places;
// climate.bin on the first climate lens, tap or city; elevation.bin on the first tap or city.

const TYPES = { uint8: Uint8Array, int16: Int16Array, uint16: Uint16Array, uint32: Uint32Array, float32: Float32Array };

function fail(file, msg) { throw new Error(`${file}: ${msg}`); }
function need(cond, file, msg) { if (!cond) fail(file, msg); }

export async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  try { return await r.json(); } catch (e) { throw new Error(`${path}: not valid JSON (${e.message})`); }
}
export async function fetchBin(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.arrayBuffer();
}

/** TypedArray views on one ArrayBuffer, one per section, checked against the buffer (CONTRACT §0). */
function sections(file, json, buf, order) {
  const out = {};
  let end = 0;
  for (const name of order) {
    const s = json.sections && json.sections[name];
    need(s, file, `section ${name} missing`);
    const T = TYPES[s.type];
    need(T, file, `section ${name} has unknown type ${s.type}`);
    need(s.offset % 4 === 0 && s.offset >= end, file, `section ${name} offset ${s.offset} not aligned or overlapping`);
    end = s.offset + s.count * T.BYTES_PER_ELEMENT;
    need(end <= buf.byteLength, file, `section ${name} runs past the end (${end} > ${buf.byteLength})`);
    out[name] = new T(buf, s.offset, s.count);
  }
  need(end === buf.byteLength, file, `size ${buf.byteLength} bytes, layout says ${end}`);
  return out;
}

/* ── manifest.json (CONTRACT §1, as built §18) ── */
export function validateManifest(m) {
  const F = 'manifest.json';
  need(m && m.schema === 1 && m.count === 90 && Array.isArray(m.slices) && m.slices.length === 90, F, 'expected schema 1 and 90 slices');
  for (const k of ['surface', 'proxy', 'axis', 'units', 'tile_rules']) need(m[k], F, `missing ${k}`);
  need(m.surface.width === 1024 && m.surface.height === 512, F, 'surface maps must be 1024 × 512');
  need(m.proxy.cols === 10 && m.proxy.rows === 9 && m.proxy.cell_width === 256 && m.proxy.cell_height === 128, F, 'proxy sheet must be 10 × 9 cells of 256 × 128');
  need(Array.isArray(m.axis.knots) && m.axis.knots.length >= 2 && m.axis.break_ma > 0, F, 'axis knots missing');
  let prev = -1;
  m.slices.forEach((s, i) => {
    need(s.i === i, F, `slice ${i} has i = ${s.i}`);
    need(typeof s.age_ma === 'number' && s.age_ma > prev, F, `slice ${i}: ages must ascend`);
    prev = s.age_ma;
    need(/^surface\/m\d\d\.webp$/.test(s.file), F, `slice ${i}: bad file ${s.file}`);
    need(typeof s.rotation_ma === 'number' && typeof s.map === 'number' && typeof s.label === 'string', F, `slice ${i}: fields missing`);
    need(s.ics && typeof s.ics.period === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s.ics.colour), F, `slice ${i}: ics missing`);
    need(s.tiles && 'temperature' in s.tiles && 'co2' in s.tiles && 'sea_level' in s.tiles && 'land' in s.tiles, F, `slice ${i}: tiles missing`);
    need((s.climate === null) === (s.climate_age_ma === null) && (s.elevation === null) === (s.elevation_age_ma === null), F, `slice ${i}: climate/elevation fields disagree`);
  });
  need(m.slices[0].age_ma === 0, F, 'slice 0 must be today');
  return m;
}

/* ── timescale.json (CONTRACT §9) ── */
export function validateTimescale(t, manifest) {
  const F = 'timescale.json';
  need(t && Array.isArray(t.units) && t.units.length > 0 && Array.isArray(t.card_periods), F, 'units missing');
  const byId = new Map();
  for (const u of t.units) {
    need(typeof u.id === 'string' && typeof u.name === 'string' && typeof u.begin_ma === 'number' && typeof u.end_ma === 'number', F, `unit ${u.id} incomplete`);
    byId.set(u.id, u);
  }
  if (manifest) {
    for (const s of manifest.slices) {
      for (const r of ['eon', 'era', 'period', 'subperiod', 'epoch', 'age']) {
        const id = s.ics[r];
        need(id == null || byId.has(id), F, `map ${s.map}: unit ${id} not in timescale.json`);
      }
    }
  }
  const periods = t.units.filter((u) => u.rank === 'Period').sort((a, b) => b.begin_ma - a.begin_ma);
  return { ...t, byId, periods };
}

/* ── plates.bin + plates.json (CONTRACT §3) ── */
const PLATE_SECTIONS = ['ring_start', 'ring_count', 'ring_begin', 'ring_end', 'ring_area', 'ring_plate', 'ring_anchor', 'vertices', 'rotations'];
export function decodePlates(json, buf) {
  const F = 'plates.bin';
  need(json && Array.isArray(json.plates) && Array.isArray(json.times), 'plates.json', 'plates or times missing');
  const P = json.plates.length, R = json.rings, V = json.vertices, S = json.slices;
  need(S === 90 && json.times.length === 90, 'plates.json', 'expected 90 slices');
  const s = sections(F, json, buf, PLATE_SECTIONS);
  need(s.ring_start.length === R && s.ring_anchor.length === 2 * R && s.vertices.length === 2 * V, F, 'ring or vertex counts disagree with plates.json');
  need(s.rotations.length === S * 2 * P * 4, F, `rotations: ${s.rotations.length} values, expected ${S * 2 * P * 4}`);
  need(json.quaternion && json.quaternion.scale === 32767 && json.vertex_scale.q === 32767, 'plates.json', 'unexpected quantisation');
  for (let r = 0; r < R; r++) {
    need(s.ring_start[r] + s.ring_count[r] <= V && s.ring_count[r] >= 3, F, `ring ${r} out of range`);
    need(s.ring_plate[r] < P, F, `ring ${r} plate index ${s.ring_plate[r]} ≥ ${P}`);
  }
  return {
    P, R, V, S, plates: json.plates, times: json.times, arrowMinArea: json.arrow_min_area_km2,
    ringStart: s.ring_start, ringCount: s.ring_count, ringBegin: s.ring_begin, ringEnd: s.ring_end,
    ringArea: s.ring_area, ringPlate: s.ring_plate, ringAnchor: s.ring_anchor, vertices: s.vertices,
    rotations: s.rotations, lonScale: json.vertex_scale.lon / 32767, latScale: json.vertex_scale.lat / 32767,
  };
}

/* ── coast.bin + coast.json (CONTRACT §4) ── */
export function decodeCoast(json, buf, plates) {
  const F = 'coast.bin';
  const s = sections(F, json, buf, ['seg_start', 'seg_count', 'seg_begin', 'seg_plate', 'vertices']);
  const N = json.pieces, V = json.vertices;
  need(s.seg_start.length === N && s.vertices.length === 2 * V, F, 'piece or vertex counts disagree with coast.json');
  for (let k = 0; k < N; k++) {
    need(s.seg_start[k] + s.seg_count[k] <= V && s.seg_count[k] >= 2, F, `piece ${k} out of range`);
    need(!plates || s.seg_plate[k] < plates.P, F, `piece ${k} plate index out of range`);
  }
  return {
    N, V, segStart: s.seg_start, segCount: s.seg_count, segBegin: s.seg_begin, segPlate: s.seg_plate,
    vertices: s.vertices, lonScale: json.vertex_scale.lon / 32767, latScale: json.vertex_scale.lat / 32767,
  };
}

/* ── places.json (CONTRACT §5) ── */
export function validatePlaces(p, plates) {
  const F = 'places.json';
  need(p && Array.isArray(p.places) && p.places.length === p.count, F, 'places missing');
  for (const q of p.places) {
    need(typeof q.n === 'string' && typeof q.lon === 'number' && typeof q.lat === 'number', F, `place ${q.n} incomplete`);
    need(!plates || (q.pi < plates.P && plates.plates[q.pi] === q.plate), F, `place ${q.n}: plate index ${q.pi} does not name plate ${q.plate}`);
  }
  return p;
}

/* ── climate.bin + climate.json (CONTRACT §6) ── */
export function decodeClimate(json, buf) {
  const F = 'climate.bin';
  const g = json && json.grid;
  need(g && g.nx === 96 && g.ny === 73 && json.slice_bytes === 7008 && json.count === 109, 'climate.json', 'unexpected grid');
  need(json.fields.length === 2 && json.fields[0].key === 'temperature' && json.fields[1].key === 'rain', 'climate.json', 'fields must be temperature, rain');
  need(buf.byteLength === 2 * 109 * 7008, F, `size ${buf.byteLength}, expected ${2 * 109 * 7008}`);
  return { json, bytes: new Uint8Array(buf), fields: json.fields, grid: g, slices: json.slices };
}
/** One slice-field's 7,008 bytes, a view (no copy) — what earth.js uploads as the R8 texture. */
export function climateBytes(c, field, s) {
  const f = field === 'rain' ? 1 : 0;
  return c.bytes.subarray((f * 109 + s) * 7008, (f * 109 + s + 1) * 7008);
}
export function decodeClimateByte(fieldSpec, b) {
  if (b === fieldSpec.nodata) return null;
  return fieldSpec.offset + fieldSpec.step * b ** fieldSpec.power;
}
/** Bilinear over the four surrounding nodes, each decoded from its byte first (DESIGN §8). */
export function climateAt(c, field, s, lat, lon) {
  const f = field === 'rain' ? 1 : 0, spec = c.fields[f], g = c.grid;
  const base = (f * 109 + s) * 7008;
  const fx = ((((lon - g.lon0) % 360) + 360) % 360) / g.dlon;
  const fy = (g.lat0 - lat) / -g.dlat;
  const c0 = Math.floor(fx) % g.nx, c1 = (c0 + 1) % g.nx, tx = fx - Math.floor(fx);
  const r0 = Math.max(0, Math.min(g.ny - 1, Math.floor(fy))), r1 = Math.min(g.ny - 1, r0 + 1), ty = Math.max(0, Math.min(1, fy - r0));
  const v = (r, cc) => decodeClimateByte(spec, c.bytes[base + r * g.nx + cc]);
  const a = v(r0, c0), b = v(r0, c1), d = v(r1, c0), e = v(r1, c1);
  if ([a, b, d, e].some((x) => x == null)) return null;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
}

/* ── elevation.bin + elevation.json (CONTRACT §7) ── */
export function decodeElevation(json, buf) {
  const F = 'elevation.bin';
  const g = json && json.grid;
  need(g && g.nx === 180 && g.ny === 91 && json.slice_bytes === 16380 && json.count === 109, 'elevation.json', 'unexpected grid');
  need(Array.isArray(json.codes) && json.codes.length === 10, 'elevation.json', 'expected 10 codes');
  need(buf.byteLength === 109 * 16380, F, `size ${buf.byteLength}, expected ${109 * 16380}`);
  return { json, bytes: new Uint8Array(buf), codes: json.codes, grid: g, slices: json.slices };
}
/** The class of the nearest node of the 2° grid, or null (DESIGN §8). */
export function elevationAt(e, s, lat, lon) {
  const g = e.grid;
  const col = ((Math.round((lon - g.lon0) / g.dlon) % g.nx) + g.nx) % g.nx;
  const row = Math.max(0, Math.min(g.ny - 1, Math.round((g.lat0 - lat) / -g.dlat)));
  const code = e.bytes[s * 16380 + row * g.nx + col];
  return code === e.json.nodata ? null : e.codes[code];
}

/* ── curves.json, story.json, about.json: the curves strip, the sheet and About ── */
export function validateCurves(c) {
  const F = 'curves.json';
  need(c && c.grid && c.grid.n === 751 && c.series, F, 'grid of 751 points expected');
  for (const [k, s] of Object.entries(c.series)) {
    for (const [kk, arr] of Object.entries(s)) if (Array.isArray(arr) && kk !== 'native_ma' && !kk.endsWith('_ma')) need(arr.length === 751, F, `${k}.${kk} has ${arr.length} points`);
  }
  for (const k of ['temperature_c', 'co2_ppm', 'co2_model_ppm', 'sea_level_m']) need(c.series[k], F, `series ${k} missing`);
  return c;
}
export function validateStory(s) {
  const F = 'story.json';
  need(s && Array.isArray(s.periods) && Array.isArray(s.events) && Array.isArray(s.look_for) && Array.isArray(s.sources) && s.prologue, F, 'periods, events, look_for, sources, prologue expected');
  const ids = new Set(s.sources.map((x) => x.id));
  for (const item of [...s.periods, ...s.events, ...s.look_for, s.prologue]) {
    for (const id of item.sources || []) need(ids.has(id), F, `source ${id} not listed`);
  }
  return s;
}
export function validateAbout(a) {
  need(a && typeof a.title === 'string' && Array.isArray(a.sources) && Array.isArray(a.caveats), 'about.json', 'title, sources, caveats expected');
  return a;
}

/* ── the loader: what app.js calls ── */
export function createLoader(base = 'data/') {
  const once = new Map();
  const memo = (key, fn) => { if (!once.has(key)) once.set(key, fn().catch((e) => { once.delete(key); throw e; })); return once.get(key); };
  const L = {
    manifest: () => memo('manifest', async () => validateManifest(await fetchJSON(base + 'manifest.json'))),
    timescale: () => memo('timescale', async () => validateTimescale(await fetchJSON(base + 'timescale.json'), await L.manifest())),
    plates: () => memo('plates', async () => {
      const [j, b] = await Promise.all([fetchJSON(base + 'plates.json'), fetchBin(base + 'plates.bin')]);
      return decodePlates(j, b);
    }),
    coast: () => memo('coast', async () => {
      const [j, b, p] = await Promise.all([fetchJSON(base + 'coast.json'), fetchBin(base + 'coast.bin'), L.plates()]);
      return decodeCoast(j, b, p);
    }),
    places: () => memo('places', async () => validatePlaces(await fetchJSON(base + 'places.json'), await L.plates())),
    climate: () => memo('climate', async () => {
      const [j, b] = await Promise.all([fetchJSON(base + 'climate.json'), fetchBin(base + 'climate.bin')]);
      return decodeClimate(j, b);
    }),
    elevation: () => memo('elevation', async () => {
      const [j, b] = await Promise.all([fetchJSON(base + 'elevation.json'), fetchBin(base + 'elevation.bin')]);
      return decodeElevation(j, b);
    }),
    curves: () => memo('curves', async () => validateCurves(await fetchJSON(base + 'curves.json'))),
    story: () => memo('story', async () => validateStory(await fetchJSON(base + 'story.json'))),
    about: () => memo('about', async () => validateAbout(await fetchJSON(base + 'about.json'))),
    /** The path of a map file relative to the page. */
    mapPath: (file) => base + file,
  };
  return L;
}
