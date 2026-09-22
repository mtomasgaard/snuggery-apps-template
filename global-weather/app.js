/* Global Weather — Snuggery mini-app.
 *
 * =============================================================================
 * SHAPE OF ./data/snapshot.json — the ONLY file that changes between updates.
 * Written by scripts/global_weather.py (see .github/workflows/refresh-global-weather.yml).
 * Whatever rewrites that file next year will not have read the conversation
 * that built it, so the contract lives here. Nothing in this file, index.html
 * or style.css needs to move when the data is replaced — including when a
 * LAYER is added or removed, which is the point of the `layers` block.
 *
 * {
 *   "schema": 2,                                 // bumped only on a breaking change
 *   "generatedAt": "2026-09-22T11:12:03Z",       // ISO 8601 UTC — when the job ran
 *   "source": {
 *     "name":        "NOAA Global Forecast System (GFS)",
 *     "detail":      "5 fields from the 0.25° product, sampled to 2°, …",
 *     "licence":     "Public domain — a work of the United States Government",
 *     "attribution": "Weather: NOAA Global Forecast System, sampled to 2°"
 *   },                                           //   printed on screen, see NOTES.md
 *   "model": "GFS",
 *   "run":   "2026-09-22T06:00:00Z",             // the model cycle the forecast comes from
 *   "grid": {                                    // a regular lat/lon grid, row-major
 *     "nx": 180, "ny": 91,                       //   180 columns × 91 rows
 *     "lon0": 0,  "dlon": 2,                     //   first column at 0°E, dlon EAST per column
 *     "lat0": 90, "dlat": -2                     //   first row at 90°N, |dlat| SOUTH per row
 *   },
 *   "encoding": {
 *     "value": "offset + step * byte ** power, per plane, as `layers` says",
 *     "order": "row-major from lat0 southwards, lon0 eastwards, one byte per point",
 *     "compression": "deflate",                  // each plane is zlib-compressed (RFC 1950)
 *                                                //   before base64; absent or "none" = raw bytes
 *     "delta": "previous-step"                   // planes of every step after the first hold
 *                                                //   (value − the previous step's value) mod 256;
 *                                                //   absent or "none" = absolute values
 *   },
 *   "layers": [{                                 // what the map can colour, in menu order
 *     "key": "wind", "label": "Wind",            //   `key` is the identity, `label` the chip
 *     "kind": "vector",                          //   "vector" = speed + dir, "scalar" = one plane
 *     "unit": "m/s", "level": "10 m above ground",
 *     "field": "UGRD/VGRD",                      //   the GRIB field(s) behind it
 *     "range": [0.04, 41.2],                     //   what it actually reached, before rounding
 *     "planes": {                                //   one byte a grid point, each
 *       "speed": { "offset": 0, "step": 0.25, "power": 1, "unit": "m/s" },
 *       "dir":   { "offset": 0, "step": 1.40625, "power": 1, "wrap": true,
 *                  "unit": "degrees the wind blows FROM, clockwise from north" }
 *     }
 *   }, …],                                       // a scalar layer has exactly one plane, "v"
 *   "steps": [{                                  // ascending in time, any count ≥ 1, any spacing
 *     "hours":     0,                            //   lead time in hours from `run`
 *     "validTime": "2026-09-22T06:00:00Z",       //   run + hours
 *     "planes": {                                //   keyed "<layer>.<plane>", every one declared
 *       "wind.speed": "<base64 of nx*ny bytes, packed as `encoding` says>",
 *       "wind.dir":   "…", "temp.v": "…", "rain.v": "…", …
 *     }
 *   }, …],
 *   "ask": [{                                    // flat rows for Snuggery's Ask About This Data.
 *     "place": "London", "country": "United Kingdom",
 *     "day": "Mon 21 Sep", "localNoon": "2026-09-21T12:00:00+01:00",
 *     "leadHours": 12, "speedMs": 5.4, "speedKmh": 19, "fromDirection": "SW",
 *     "fromDegrees": 233, "beaufort": 3, "wind": "Gentle breeze",
 *     "tempC": 14.2, "tempF": 58, "rainMmPerHour": 0.4, "rainfall": "Light rain",
 *     "cloudPercent": 88, "sky": "Overcast", "pressureHPa": 1004
 *   }, …]                                        // NEVER read by this app: it is a table for
 * }                                              // questions in words, not for drawing.
 *
 * A VALUE IS ONE BYTE: `offset + step * byte ** power`, with the numbers coming
 * from the plane's own entry in `layers`. `power` is 1 for everything except
 * rain, where 2 spends the bytes where the weather is — drizzle resolved to
 * hundredths of a millimetre an hour, and 65 mm/h still at the top of the byte.
 * `wrap: true` marks an angle, which goes round rather than clipping at 255.
 *
 * The delta-plus-deflate pair is what makes five global fields fit in a file a
 * phone can open. Hour to hour the weather barely moves, so the differences are
 * mostly zero and deflate packs them to roughly a third of the raw bytes. The
 * app refuses anything that fails the shape — a missing step, the wrong byte
 * count after unpacking, an error page written over the file — and says so on
 * screen rather than drawing an empty map.
 *
 * THE GLOBE HALF OF THIS FILE IS SHARED WITH THE GLOBAL WIND APP in
 * ../global-wind/app.js, which is this app with one field instead of five. They
 * are separate apps and separate ZIPs on purpose — a mini-app ships as one
 * folder — so a fix to the sphere, the land mask or the terminator belongs in
 * both. The data half is what differs: schema 1 there, schema 2 here.
 *
 * THE APP READS THE LAYERS, IT DOES NOT KNOW THEM. The chips, the legend, the
 * units button and the tapped readout are all built from `layers`. LOOKS below
 * gives the five shipped layers their colour scales and their units; a layer
 * that is not in it still draws, on a plain scale over its own `range`, which
 * is what makes "add a sixth field to the puller" a one-file change.
 *
 * -----------------------------------------------------------------------------
 * STATIC COMPANIONS in ./assets, never rewritten by the schedule:
 *   world.json    coastlines and country borders. Natural Earth, public domain.
 *   places.json   [{ "n": "London", "lon": -0.13, "lat": 51.51, "r": 1 }, …] where
 *                 r is the label tier, 1 shown first. GeoNames, CC BY 4.0 — the
 *                 credit line under the map is a condition of using it. Edit the
 *                 file freely; the app reads it as it finds it.
 * Both licences are in assets/LICENSES.md, and NOTES.md has the weather's.
 *
 * -----------------------------------------------------------------------------
 * NO VALUE EVER REACHES innerHTML. The only `.innerHTML` below is `= ''`, used
 * to empty a container; every piece of text is set with textContent or built as
 * a DOM node. There is no eval, no `new Function`, no postMessage, no
 * WebSocket, and no address is ever fetched but `./data/…` and `./assets/…`.
 * The two licence URIs printed in *About this data* are text on a page, which
 * is what CC BY asks for; nothing requests them.
 * ========================================================================== */

const STORE = {
  map: 'gwe.map', globe: 'gwe.globe', tab: 'gwe.tab', layer: 'gwe.layer',
  units: 'gwe.units', arrows: 'gwe.arrows', night: 'gwe.night', marker: 'gwe.marker',
};
const MAX_LAT = 85.05112878;   // where Web Mercator stops being finite
const DEG = Math.PI / 180;
const ARROW_SPACING = 30;      // CSS px between arrows, roughly
const HEAT_PX = 3;             // CSS px per colour sample, flat map
const GLOBE_PX = 3;            // CSS px per colour sample, globe
const PLAY_HOURS_PER_SEC = 5;  // playback speed: a day of forecast every ~5 s
const FLOAT_CACHE = 16;        // decoded planes kept in memory
const PATH_K = 4096;           // land paths are built in world units × PATH_K
const MAX_SCALE = 360 * 80;    // 80 px per degree of longitude
const STALE_HOURS = 30;        // a forecast older than this is stamped stale
const MASK_NX = 2048;          // the globe's land mask, in plate carrée
const MASK_NY = 1024;
const ANTARCTIC_EDGE = -84.6;  // Natural Earth stops here; see buildLandMask()

/* ── what each layer looks like ──────────────────────────────────────────── *
 * One entry per layer key the puller can write. `stops` is value → colour and
 * `alpha` is value → opacity, both in the layer's own unit; the legend, the
 * chips and the map are painted from these same numbers, so the scale under
 * the map is by construction the scale on it.
 *
 * Every scale is a single progression with no hue cycling: further along
 * always means more. And nothing is encoded by colour alone — wind is drawn as
 * arrow length and thickness too, and a tap gives the number in figures.
 *
 * A layer with no entry here (one you added to the puller) still draws, on the
 * plain scale at the bottom of this block, over the range the snapshot says it
 * reached.                                                                    */

const LOOKS = {
  wind: {
    /* Cool → warm → violet: stronger always reads as further along. */
    short: 'Wind',
    stops: [
      [0, [86, 115, 190]], [2, [70, 140, 205]], [4, [60, 175, 195]], [6, [70, 195, 150]],
      [8, [100, 205, 95]], [10, [165, 212, 60]], [12, [232, 210, 45]], [15, [250, 172, 45]],
      [18, [250, 125, 45]], [21, [240, 78, 55]], [25, [222, 45, 95]], [30, [195, 45, 165]],
      [36, [145, 45, 205]], [45, [100, 40, 190]], [60, [245, 225, 255]],
    ],
    /* Calm is nearly transparent so the map shows through where nothing is
     * happening; a gale is solid. */
    alpha: { at: [0, 10], from: 0.42, to: 0.82 },
    legend: [0, 36],
  },
  temp: {
    short: 'Temp',
    /* Violet through blue, green, yellow and orange to a dark red. Pale at
     * 0 °C, because freezing is the one boundary everybody reads off a map. */
    stops: [
      [-60, [40, 20, 70]], [-45, [68, 34, 128]], [-35, [62, 70, 170]], [-25, [58, 110, 200]],
      [-15, [78, 155, 218]], [-8, [126, 194, 232]], [0, [196, 226, 238]], [4, [168, 214, 178]],
      [10, [140, 200, 106]], [16, [206, 214, 78]], [22, [240, 196, 66]], [28, [240, 150, 54]],
      [34, [226, 100, 46]], [40, [200, 52, 48]], [50, [140, 20, 40]],
    ],
    alpha: { at: [0, 1], from: 0.78, to: 0.78 },
    legend: [-40, 45],
  },
  rain: {
    short: 'Rain',
    /* The radar progression, which is the one people have already learnt:
     * blue, green, yellow, red, magenta. */
    stops: [
      [0, [140, 190, 230]], [0.1, [120, 175, 225]], [0.4, [70, 140, 215]], [1, [45, 100, 200]],
      [2, [40, 165, 120]], [4, [90, 195, 70]], [7, [225, 205, 60]], [12, [240, 150, 45]],
      [20, [225, 70, 50]], [32, [190, 40, 120]], [50, [150, 40, 170]],
    ],
    /* Nothing at all below a fiftieth of a millimetre an hour: a dry world has
     * to look dry, or the layer says nothing. */
    alpha: { at: [0.02, 1.2], from: 0, to: 0.88 },
    legend: [0, 40],
  },
  cloud: {
    short: 'Cloud',
    /* One hue, opacity doing the work — the clearest scale there is. Grey on
     * the light map and white on the dark one, because a white veil over a
     * cream continent is not a veil. */
    stops: (dark) => (dark
      ? [[0, [232, 238, 246]], [100, [252, 253, 255]]]
      : [[0, [150, 162, 178]], [100, [88, 102, 122]]]),
    alpha: { at: [0, 100], from: 0, to: 0.75 },
    legend: [0, 100],
  },
  pressure: {
    short: 'Press.',
    /* Deep lows violet, the 1013 hPa middle near-neutral, highs warm. */
    stops: [
      [950, [70, 30, 120]], [975, [62, 80, 180]], [995, [95, 160, 215]], [1008, [186, 214, 226]],
      [1013, [238, 238, 234]], [1020, [236, 206, 140]], [1032, [232, 160, 70]],
      [1045, [200, 100, 40]], [1060, [150, 60, 30]],
    ],
    alpha: { at: [0, 1], from: 0.62, to: 0.62 },
    legend: [955, 1050],
  },
};

/* The scale a layer nobody wrote a look for is drawn on. */
const PLAIN = {
  stops: [[0, [60, 90, 170]], [0.5, [120, 190, 170]], [0.75, [235, 200, 80]], [1, [200, 60, 60]]],
  alpha: { at: [0, 1], from: 0.7, to: 0.7 },
};

/* Units, per layer key. The header button cycles the ACTIVE layer's list, so
 * it offers knots on the wind and °F on the temperature, and each layer
 * remembers its own choice. `f` multiplies, `o` is added after: °F is the only
 * one that needs both. `d` is how many decimals to print.
 *
 * A layer not named here is printed in whatever unit the snapshot says it is
 * in, unconverted — which is right, because nothing here knows what it means. */
const UNITS = {
  wind: [
    { id: 'ms', label: 'm/s', f: 1, d: 1 },
    { id: 'kmh', label: 'km/h', f: 3.6, d: 0 },
    { id: 'kt', label: 'kt', f: 1.943844, d: 0 },
    { id: 'mph', label: 'mph', f: 2.236936, d: 0 },
  ],
  temp: [
    { id: 'c', label: '°C', f: 1, d: 1 },
    { id: 'f', label: '°F', f: 1.8, o: 32, d: 0 },
  ],
  rain: [
    { id: 'mm', label: 'mm/h', f: 1, d: 2 },
    { id: 'in', label: 'in/h', f: 0.0393701, d: 3 },
  ],
  cloud: [{ id: 'pct', label: '%', f: 1, d: 0 }],
  pressure: [
    { id: 'hpa', label: 'hPa', f: 1, d: 0 },
    { id: 'inhg', label: 'inHg', f: 0.02952998, d: 2 },
  ],
};

const BEAUFORT = [
  [0.3, 'Calm'], [1.6, 'Light air'], [3.4, 'Light breeze'], [5.5, 'Gentle breeze'],
  [8.0, 'Moderate breeze'], [10.8, 'Fresh breeze'], [13.9, 'Strong breeze'],
  [17.2, 'Near gale'], [20.8, 'Gale'], [24.5, 'Strong gale'], [28.5, 'Storm'],
  [32.7, 'Violent storm'], [Infinity, 'Hurricane force'],
];
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/* The line that stays on screen. It says "sampled" because NOAA asks that
 * modified data is not presented as unaltered NOAA data, and it names GeoNames
 * and the licence because CC BY 4.0 makes that a condition rather than a
 * courtesy. NOTES.md says to keep both, and means it. */
const CREDITS = 'NOAA GFS, sampled · Natural Earth · GeoNames CC BY 4.0';

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const pad2 = (n) => String(n).padStart(2, '0');
const wrapLon = (lon) => ((lon + 180) % 360 + 360) % 360 - 180;

/* ── colour and alpha from a stop table ──────────────────────────────────── */

function rampAt(stops, value) {
  let k = 0;
  while (k < stops.length - 2 && stops[k + 1][0] <= value) k++;
  const [v0, c0] = stops[k];
  const [v1, c1] = stops[k + 1];
  const f = clamp((value - v0) / (v1 - v0), 0, 1);
  return [c0[0] + (c1[0] - c0[0]) * f,
          c0[1] + (c1[1] - c0[1]) * f,
          c0[2] + (c1[2] - c0[2]) * f];
}
function alphaAt(spec, value) {
  const [v0, v1] = spec.at;
  const f = v1 === v0 ? 1 : clamp((value - v0) / (v1 - v0), 0, 1);
  return spec.from + (spec.to - spec.from) * f;
}
/* ── inflate ─────────────────────────────────────────────────────────────── *
 * Every browser shipped since 2023 has DecompressionStream, and that native
 * path is the one that runs. The rest of this section is a small, complete
 * RFC 1950/1951 decoder for the ones that do not: no dependency, no minified
 * blob, nothing the app has to be trusted about. It decodes about a megabyte
 * a tenth of a second, which is fine for a fallback.                          */

function inflateRaw(src, expected) {
  const LENS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51,
                59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
                4, 5, 5, 5, 5, 0];
  const DISTS = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385,
                 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10,
                10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  /* The cap is the whole defence against a crafted plane. A few kilobytes of
   * deflate can describe gigabytes of output, so the decoder refuses to write
   * more bytes than the grid can hold: `expected` is nx*ny, which validate()
   * has already bounded. Without one, 16 MB is far more than any plane here. */
  const cap = expected || (1 << 24);
  let bitPos = 0;
  let out = new Uint8Array(Math.max(1024, expected || 1024));
  let outLen = 0;

  const bit = () => {
    const byte = src[bitPos >> 3];
    if (byte === undefined) throw new Error('the compressed data ends mid-symbol');
    const v = (byte >> (bitPos & 7)) & 1;
    bitPos++;
    return v;
  };
  const bits = (n) => { let v = 0; for (let i = 0; i < n; i++) v |= bit() << i; return v; };

  const grow = (extra) => {
    if (outLen + extra > cap) throw new Error('the compressed data expands past the grid');
    if (outLen + extra <= out.length) return;
    let size = out.length * 2;
    while (size < outLen + extra) size *= 2;
    if (size > cap) size = cap;
    const bigger = new Uint8Array(size);
    bigger.set(out.subarray(0, outLen));
    out = bigger;
  };

  /* Canonical Huffman, decoded a bit at a time — the shape of the tables is
   * "how many codes of each length" plus "the symbols in code order". */
  const build = (lengths, n) => {
    const count = new Int32Array(16);
    for (let i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    const offsets = new Int32Array(16);
    for (let len = 1; len < 15; len++) offsets[len + 1] = offsets[len] + count[len];
    const symbols = new Int32Array(n);
    for (let i = 0; i < n; i++) if (lengths[i]) symbols[offsets[lengths[i]]++] = i;
    return { count, symbols };
  };
  const decode = (table) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bit();
      const count = table.count[len];
      if (code - first < count) return table.symbols[index + (code - first)];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('the compressed data holds an impossible code');
  };

  let fixedLit = null, fixedDist = null;
  const fixed = () => {
    if (fixedLit) return;
    const lengths = new Uint8Array(288);
    for (let i = 0; i < 144; i++) lengths[i] = 8;
    for (let i = 144; i < 256; i++) lengths[i] = 9;
    for (let i = 256; i < 280; i++) lengths[i] = 7;
    for (let i = 280; i < 288; i++) lengths[i] = 8;
    fixedLit = build(lengths, 288);
    fixedDist = build(new Uint8Array(30).fill(5), 30);
  };

  const block = (lit, dist) => {
    for (;;) {
      const symbol = decode(lit);
      if (symbol === 256) return;
      if (symbol < 256) {
        grow(1);
        out[outLen++] = symbol;
      } else {
        const s = symbol - 257;
        if (s >= LENS.length) throw new Error('the compressed data holds an invalid length');
        const length = LENS[s] + bits(LEXT[s]);
        const d = decode(dist);
        if (d >= DISTS.length) throw new Error('the compressed data holds an invalid distance');
        const distance = DISTS[d] + bits(DEXT[d]);
        if (distance > outLen) throw new Error('the compressed data points before its start');
        grow(length);
        let from = outLen - distance;
        for (let i = 0; i < length; i++) out[outLen++] = out[from++];
      }
    }
  };

  for (;;) {
    const last = bit();
    const type = bits(2);
    if (type === 0) {                                   // stored
      bitPos = (bitPos + 7) & ~7;
      const at = bitPos >> 3;
      const length = src[at] | (src[at + 1] << 8);
      const check = src[at + 2] | (src[at + 3] << 8);
      if ((length ^ 0xffff) !== check) throw new Error('a stored block has a bad length');
      if (outLen + length > cap) throw new Error('the compressed data expands past the grid');
      grow(length);
      out.set(src.subarray(at + 4, at + 4 + length), outLen);
      outLen += length;
      bitPos = (at + 4 + length) << 3;
    } else if (type === 1) {                            // fixed Huffman
      fixed();
      block(fixedLit, fixedDist);
    } else if (type === 2) {                            // dynamic Huffman
      const nlit = bits(5) + 257;
      const ndist = bits(5) + 1;
      const nclen = bits(4) + 4;
      const clen = new Uint8Array(19);
      for (let i = 0; i < nclen; i++) clen[ORDER[i]] = bits(3);
      const codeTable = build(clen, 19);
      const lengths = new Uint8Array(nlit + ndist);
      for (let i = 0; i < nlit + ndist;) {
        const symbol = decode(codeTable);
        if (symbol < 16) {
          lengths[i++] = symbol;
        } else if (symbol === 16) {
          if (i === 0) throw new Error('the compressed data repeats nothing');
          const previous = lengths[i - 1];
          for (let n = 3 + bits(2); n > 0; n--) lengths[i++] = previous;
        } else if (symbol === 17) {
          for (let n = 3 + bits(3); n > 0; n--) lengths[i++] = 0;
        } else {
          for (let n = 11 + bits(7); n > 0; n--) lengths[i++] = 0;
        }
      }
      block(build(lengths.subarray(0, nlit), nlit),
            build(lengths.subarray(nlit), ndist));
    } else {
      throw new Error('the compressed data holds an unknown block type');
    }
    if (last) break;
  }
  return out.subarray(0, outLen);
}

/* zlib-wrapped deflate (RFC 1950) → bytes. */
function unzlib(bytes, expected) {
  if (bytes.length < 6) throw new Error('the compressed data is too short');
  const cmf = bytes[0], flg = bytes[1];
  if ((cmf & 0x0f) !== 8) throw new Error('the compressed data is not deflate');
  if (((cmf << 8) | flg) % 31) throw new Error('the compressed data has a bad header');
  if (flg & 0x20) throw new Error('the compressed data needs a preset dictionary');
  return inflateRaw(bytes.subarray(2), expected);
}

/* The native path, read chunk by chunk into a buffer of exactly the size the
 * grid needs. `new Response(stream).arrayBuffer()` would have been one line,
 * but it grows to whatever the stream produces, and a crafted plane of a few
 * kilobytes can ask for gigabytes — the tab dies before anything checks the
 * length. Reading it here means the cap is enforced as the bytes arrive. */
async function inflateNative(bytes, expected) {
  const cap = expected || (1 << 24);
  const out = new Uint8Array(cap);
  const reader = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate')).getReader();
  let outLen = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (outLen + value.length > cap) {
      reader.cancel().catch(() => {});
      throw new RangeError('the compressed data expands past the grid');
    }
    out.set(value, outLen);
    outLen += value.length;
  }
  return out.subarray(0, outLen);
}

async function inflate(bytes, expected) {
  if (typeof DecompressionStream === 'function') {
    try {
      return await inflateNative(bytes, expected);
    } catch (error) {
      /* A browser that cannot do this falls through to the decoder above. A
       * plane that expands past the cap is a different matter — that is the
       * snapshot's fault, not the browser's, and the decoder would only reach
       * the same wall more slowly, so it is not retried. */
      if (error instanceof RangeError) throw error;
    }
  }
  return unzlib(bytes, expected);
}

/* ── the weather field ───────────────────────────────────────────────────── */

function b64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* One entry of the snapshot's `layers`, with the app's half of it attached:
 * the colour scale, the units, and the byte↔value pair that both ends share. */
class Layer {
  constructor(described) {
    this.key = described.key;
    this.label = described.label || described.key;
    this.kind = described.kind === 'vector' ? 'vector' : 'scalar';
    this.unit = described.unit || '';
    this.level = described.level || '';
    this.field = described.field || '';
    this.range = Array.isArray(described.range) && described.range.length === 2
      ? described.range : null;
    this.planes = described.planes;
    // A vector layer is speed and direction, by contract; a scalar layer is one
    // plane, whatever it is called. Either way `main` is the plane the colour
    // scale, the legend and the tapped number are all about.
    this.main = this.kind === 'vector' ? 'speed' : Object.keys(this.planes)[0];
    this.spec = this.planes[this.main];
    this.units = UNITS[this.key] || [{ id: 'raw', label: this.unit, f: 1, d: 1 }];
    this.lut = null;
  }

  /* value → the byte that would hold it, fractionally. This is the index the
   * colour lookup is built on, so a scale that is coarse in storage is coarse
   * in colour too — and a quadratic plane like rain gets its resolution where
   * the weather is. */
  toByte(value) {
    const t = (value - this.spec.offset) / this.spec.step;
    const p = this.spec.power || 1;
    return p === 1 ? t : Math.pow(Math.max(t, 0), 1 / p);
  }
  fromByte(b) {
    const p = this.spec.power || 1;
    return this.spec.offset + this.spec.step * (p === 1 ? b : Math.pow(b, p));
  }

  /* The colour scale, resolved for this colour scheme. A layer nobody wrote a
   * look for gets the plain ramp, stretched over whatever the snapshot says it
   * reached — which is not pretty, but it is honest and it draws. */
  look(dark) {
    const found = LOOKS[this.key];
    if (found) {
      return {
        stops: typeof found.stops === 'function' ? found.stops(dark) : found.stops,
        alpha: found.alpha,
        legend: found.legend,
        short: found.short || this.label,
      };
    }
    const lo = this.range ? this.range[0] : this.fromByte(0);
    const hi = this.range ? this.range[1] : this.fromByte(255);
    return {
      stops: PLAIN.stops.map(([f, c]) => [lo + (hi - lo) * f, c]),
      alpha: PLAIN.alpha,
      legend: [lo, hi],
      short: this.label,
    };
  }
}

class WeatherField {
  constructor(snap) {
    const g = snap.grid;
    this.nx = g.nx; this.ny = g.ny; this.n = g.nx * g.ny;
    this.lon0 = g.lon0; this.dlon = g.dlon; this.lat0 = g.lat0; this.dlat = g.dlat;
    this.compression = (snap.encoding && snap.encoding.compression) || 'none';
    this.delta = (snap.encoding && snap.encoding.delta) || 'none';

    this.layers = snap.layers.map((d) => new Layer(d));
    this.byKey = new Map(this.layers.map((l) => [l.key, l]));
    this.planeKeys = [];
    this.tables = new Map();              // plane key → 256 values, one per byte
    for (const layer of this.layers) {
      for (const [name, spec] of Object.entries(layer.planes)) {
        const key = `${layer.key}.${name}`;
        this.planeKeys.push(key);
        const table = new Float32Array(256);
        const p = spec.power || 1;
        for (let b = 0; b < 256; b++) {
          table[b] = spec.offset + spec.step * (p === 1 ? b : Math.pow(b, p));
        }
        this.tables.set(key, table);
      }
    }
    // The wind's direction byte is only ever wanted as a sine and a cosine, so
    // it is turned into one once rather than 16,000 times a step.
    const dir = this.tables.get('wind.dir');
    if (dir) {
      this.SIN = new Float32Array(256);
      this.COS = new Float32Array(256);
      for (let b = 0; b < 256; b++) {
        this.SIN[b] = Math.sin(dir[b] * DEG);
        this.COS[b] = Math.cos(dir[b] * DEG);
      }
    }
    this.steps = snap.steps.map((s) => ({
      hours: s.hours, valid: Date.parse(s.validTime), packed: s.planes, planes: null,
    }));
    this.cache = new Map();               // "layer:step" → decoded values
  }

  async unpack(b64) {
    const bytes = b64ToBytes(b64);
    if (this.compression === 'none') return bytes;
    if (this.compression !== 'deflate') throw new Error(`unknown compression "${this.compression}"`);
    return inflate(bytes, this.n);
  }

  /* Unpack every plane of every step. Deltas chain, so this runs in order; it
   * yields to the page every few steps so a long forecast does not freeze it. */
  async load(onProgress) {
    const n = this.n;
    const previous = new Map();
    for (let k = 0; k < this.steps.length; k++) {
      const step = this.steps[k];
      const planes = {};
      for (const key of this.planeKeys) {
        const bytes = await this.unpack(step.packed[key]);
        if (bytes.length !== n) {
          throw new Error(`step ${k} ${key} unpacks to ${bytes.length} points, `
                        + `the grid has ${n}`);
        }
        const before = previous.get(key);
        if (this.delta === 'previous-step' && before) {
          for (let i = 0; i < n; i++) bytes[i] = (bytes[i] + before[i]) & 255;
        } else if (this.delta !== 'none' && this.delta !== 'previous-step') {
          throw new Error(`unknown delta scheme "${this.delta}"`);
        }
        previous.set(key, bytes);
        planes[key] = bytes;
      }
      step.planes = planes;
      step.packed = null;
      if (k % 4 === 3) {
        if (onProgress) onProgress(k + 1, this.steps.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  /* One layer's bytes at one step, as values: { u, v } for the wind, { v } for
   * everything else. Kept in a small FIFO cache, because a frame wants two
   * steps of the coloured layer and two of the wind. */
  values(layerKey, k) {
    const cacheKey = `${layerKey}:${k}`;
    let found = this.cache.get(cacheKey);
    if (found) return found;
    const layer = this.byKey.get(layerKey);
    const step = this.steps[k];
    const n = this.n;
    if (layer.kind === 'vector') {
      const S = step.planes[`${layerKey}.speed`];
      const D = step.planes[`${layerKey}.dir`];
      const speed = this.tables.get(`${layerKey}.speed`);
      const u = new Float32Array(n), v = new Float32Array(n);
      const SIN = this.SIN, COS = this.COS;
      for (let i = 0; i < n; i++) {
        const s = speed[S[i]];
        u[i] = -s * SIN[D[i]];           // the "from" direction → the vector it blows TO
        v[i] = -s * COS[D[i]];
      }
      found = { u, v };
    } else {
      const B = step.planes[`${layerKey}.${layer.main}`];
      const table = this.tables.get(`${layerKey}.${layer.main}`);
      const v = new Float32Array(n);
      for (let i = 0; i < n; i++) v[i] = table[B[i]];
      found = { v };
    }
    this.cache.set(cacheKey, found);
    if (this.cache.size > FLOAT_CACHE) this.cache.delete(this.cache.keys().next().value);
    return found;
  }

  /* The two arrays a raster pass reads: [values, null] for a scalar layer,
   * [u, v] for a vector one, whose magnitude is what gets coloured. */
  pair(layerKey, k) {
    const e = this.values(layerKey, k);
    return e.u ? [e.u, e.v] : [e.v, null];
  }

  /* Bilinear corners for one point. Longitude wraps, latitude clamps. */
  locate(lon, lat, out) {
    const nx = this.nx;
    let fi = (lon - this.lon0) / this.dlon;
    fi -= Math.floor(fi / nx) * nx;
    const fj = clamp((lat - this.lat0) / this.dlat, 0, this.ny - 1);
    const i0 = Math.floor(fi), j0 = Math.floor(fj);
    const i1 = (i0 + 1) % nx, j1 = Math.min(j0 + 1, this.ny - 1);
    out[0] = j0 * nx + i0; out[1] = j0 * nx + i1;
    out[2] = j1 * nx + i0; out[3] = j1 * nx + i1;
    out[4] = fi - i0; out[5] = fj - j0;
    return out;
  }

  /* Bilinear across the grid and linear in time between two steps — the same
   * two interpolations the puller does for the ask table, on the same bytes. */
  sample(layerKey, tt, lon, lat, out) {
    const last = this.steps.length - 1;
    const k0 = clamp(Math.floor(tt), 0, last);
    const k1 = Math.min(k0 + 1, last);
    const f = clamp(tt - k0, 0, 1);
    const L = this.locate(lon, lat, LOC);
    const a = this.pair(layerKey, k0);
    out[0] = mix(a[0], L);
    out[1] = a[1] ? mix(a[1], L) : 0;
    if (f > 0 && k1 !== k0) {
      const b = this.pair(layerKey, k1);
      out[0] += (mix(b[0], L) - out[0]) * f;
      if (a[1]) out[1] += (mix(b[1], L) - out[1]) * f;
    }
    return out;
  }
}

const LOC = new Float64Array(6);
function mix(arr, L) {
  const tx = L[4], ty = L[5];
  const top = arr[L[0]] + (arr[L[1]] - arr[L[0]]) * tx;
  const bottom = arr[L[2]] + (arr[L[3]] - arr[L[2]]) * tx;
  return top + (bottom - top) * ty;
}

/* ── snapshot validation ─────────────────────────────────────────────────── *
 * A dashboard that draws an empty map is worse than one that says what is
 * wrong, because a plausible blank gets believed. Everything the app depends
 * on is checked here, and the failure is written in words a person can act on. */

function validate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'the file is not a JSON object';
  if (d.schema !== 2) {
    if (typeof d.message === 'string') {
      return `the file holds a service's reply (“${d.message.slice(0, 200)}”) instead of weather `
           + 'data — check the token in the Shortcut';
    }
    if (d.schema === 1) {
      return 'it is a schema 1 snapshot — that is Global Wind\u2019s file, which holds wind '
           + 'and nothing else. This app\u2019s Shortcut row wants the data-global-weather '
           + 'branch; Global Wind keeps its own';
    }
    return `unexpected schema ${JSON.stringify(d.schema ?? null)}, wanted 2`;
  }
  const g = d.grid;
  if (!g || !Number.isInteger(g.nx) || !Number.isInteger(g.ny) || g.nx < 2 || g.ny < 2
      || ![g.lon0, g.lat0, g.dlon, g.dlat].every(Number.isFinite) || !g.dlon || !g.dlat) {
    return 'the grid description is missing or malformed';
  }
  const e = d.encoding || {};
  const compression = e.compression || 'none';
  if (compression !== 'none' && compression !== 'deflate') return `unknown compression "${compression}"`;
  if ((e.delta || 'none') !== 'none' && e.delta !== 'previous-step') return `unknown delta scheme "${e.delta}"`;

  if (!Array.isArray(d.layers) || !d.layers.length) return 'it declares no layers';
  if (d.layers.length > 16) return 'it declares more layers than a phone should draw';
  const planeKeys = [];
  const seen = new Set();
  for (const layer of d.layers) {
    if (!layer || typeof layer.key !== 'string' || !layer.key || layer.key.length > 40) {
      return 'a layer has no usable key';
    }
    if (seen.has(layer.key)) return `two layers are both called "${layer.key}"`;
    seen.add(layer.key);
    const planes = layer.planes;
    if (!planes || typeof planes !== 'object' || Array.isArray(planes)) {
      return `layer "${layer.key}" declares no planes`;
    }
    const names = Object.keys(planes);
    if (!names.length || names.length > 4) return `layer "${layer.key}" declares ${names.length} planes`;
    for (const name of names) {
      const spec = planes[name];
      if (!spec || !Number.isFinite(spec.offset) || !Number.isFinite(spec.step) || !spec.step
          || !(Number(spec.power || 1) > 0)) {
        return `layer "${layer.key}" plane "${name}" has no usable scale`;
      }
      planeKeys.push(`${layer.key}.${name}`);
    }
    if (layer.kind === 'vector' && !(names.includes('speed') && names.includes('dir'))) {
      return `layer "${layer.key}" says it is a vector but has no speed and dir`;
    }
  }
  if (planeKeys.length > 24) return 'it holds more planes than a phone should unpack';

  if (!Array.isArray(d.steps) || d.steps.length === 0) return 'it holds no forecast steps';
  const n = g.nx * g.ny;
  /* Two ceilings before anything is decoded. A grid or a step count big enough
   * to exhaust a phone's memory is a broken file, not a forecast, and the
   * unpacker would cheerfully start allocating for it. Four million points is
   * forty times the grid the job writes; 400 steps is far more than a GFS run
   * holds at any spacing. */
  if (n > 4_000_000) return 'the grid is too large for a phone';
  if (d.steps.length > 400) return 'it holds too many forecast steps';
  const want = compression === 'none' ? Math.ceil(n / 3) * 4 : -1;   // packed sizes vary
  /* Packed planes vary in size, but not upwards: deflate of one byte a point
   * cannot honestly beat the raw length by much, so twice it is a generous
   * ceiling that still refuses a 90 MB string arriving as one "step". */
  const cap64 = compression === 'deflate' ? 2 * Math.ceil(n / 3) * 4 : Infinity;
  for (let k = 0; k < d.steps.length; k++) {
    const s = d.steps[k];
    if (!s || !Number.isFinite(s.hours) || !Number.isFinite(Date.parse(s.validTime))) {
      return `step ${k} has no valid time`;
    }
    if (!s.planes || typeof s.planes !== 'object') return `step ${k} holds no planes`;
    for (const key of planeKeys) {
      const packed = s.planes[key];
      if (typeof packed !== 'string' || !packed.length
          || (want > 0 && packed.length !== want)) {
        return `step ${k} does not hold ${n} grid points of ${key}`;
      }
      if (packed.length > cap64) return `step ${k} ${key} is not a packed plane`;
    }
    if (k && !(Date.parse(s.validTime) > Date.parse(d.steps[k - 1].validTime))) {
      return 'the steps are not in time order';
    }
  }
  if (!Number.isFinite(Date.parse(d.generatedAt))) return 'generatedAt is missing';
  return null;
}

/* ── projections ─────────────────────────────────────────────────────────── *
 * Two of them. The Map tab is Web Mercator on a unit square, which is what
 * every slippy map is and what makes panning and zooming cheap. The Globe tab
 * is orthographic — the view from far enough away that the sphere reads as a
 * sphere — centred on wherever it has been turned to.                         */

const lonToX = (lon) => (lon + 180) / 360;
const xToLon = (x) => x * 360 - 180;
function latToY(lat) {
  const p = clamp(lat, -MAX_LAT, MAX_LAT) * DEG;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + p / 2)) / (2 * Math.PI);
}
function yToLat(y) {
  return (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / DEG;
}

/* ── state ───────────────────────────────────────────────────────────────── */

let snap = null;
let field = null;
let world = null;              // the raw assets/world.json, kept for the globe
let worldPaths = null;         // Mercator Path2Ds, for the Map tab
let sphere = null;             // per-point sines and cosines, for the Globe tab
let landMask = null;           // plate carrée land/sea, for the Globe tab
let places = [];
let t = 0;                     // step index, fractional while playing
let playing = false;
let tab = 'map';
let layerKey = '';
let unitChoice = {};           // layer key → unit id
let arrows = true;
let night = true;
let marker = null;             // { lon, lat }
const map = { cx: lonToX(0), cy: 0.5, scale: 0 };   // world units; scale = world width in CSS px
const globe = { lon: 0, lat: 20, r: 0 };            // degrees, degrees, radius in CSS px
let W = 0, H = 0, dpr = 1;
let pal = null;
let renderPending = false;
let loadGeneration = 0;
const problems = new Map();

const canvas = $('map');
const ctx = canvas.getContext('2d');
const wrap = $('map-wrap');
const slider = $('slider');

const activeLayer = () => (field ? field.byKey.get(layerKey) || field.layers[0] : null);

/* ── palette ─────────────────────────────────────────────────────────────── */

const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
function buildPalette() {
  const dark = darkMq.matches;
  pal = dark ? {
    outside: '#0b0e13', ocean: '#141b26', land: '#242d3a', coast: '#5c6c86', border: '#3a4656',
    grat: 'rgba(255,255,255,0.07)', arrow: 'rgba(255,255,255,0.93)', arrowHalo: 'rgba(0,0,0,0.5)',
    label: '#eef2f7', labelHalo: 'rgba(11,14,19,0.9)', marker: '#ffffff', markerRing: 'rgba(0,0,0,0.6)',
    limb: 'rgba(255,255,255,0.22)',
    oceanRgb: [20, 27, 38], landRgb: [36, 45, 58],
    nightRgb: [2, 4, 10], nightMax: 0.4,
    alphaScale: 1,
  } : {
    outside: '#eef0f4', ocean: '#d9e2ec', land: '#f4f1e9', coast: '#7f8c9c', border: '#b3bcc8',
    grat: 'rgba(0,0,0,0.07)', arrow: 'rgba(20,24,31,0.92)', arrowHalo: 'rgba(255,255,255,0.75)',
    label: '#14181f', labelHalo: 'rgba(255,255,255,0.9)', marker: '#14181f', markerRing: 'rgba(255,255,255,0.9)',
    limb: 'rgba(20,24,31,0.25)',
    oceanRgb: [217, 226, 236], landRgb: [244, 241, 233],
    nightRgb: [24, 34, 58], nightMax: 0.3,
    alphaScale: 0.92,
  };
}
buildPalette();

/* A colour lookup per layer, indexed by the byte the value is stored in, so
 * the map, the legend and the chips are all painted from one table. Rebuilt
 * when the colour scheme changes, because two of the scales answer to it. */
function buildLuts() {
  if (!field) return;
  const dark = darkMq.matches;
  for (const layer of field.layers) {
    const look = layer.look(dark);
    const lut = new Uint8ClampedArray(256 * 4);
    for (let b = 0; b < 256; b++) {
      const value = layer.fromByte(b);
      const rgb = rampAt(look.stops, value);
      const o = b * 4;
      lut[o] = rgb[0]; lut[o + 1] = rgb[1]; lut[o + 2] = rgb[2];
      lut[o + 3] = 255 * clamp(alphaAt(look.alpha, value) * pal.alphaScale, 0, 1);
    }
    layer.lut = lut;
  }
}
darkMq.addEventListener('change', () => {
  buildPalette();
  buildLuts();
  gcache = null;
  updateLegend();
  buildChips();
  requestRender();
});

/* ── where the sun is ────────────────────────────────────────────────────── *
 * The night side is not decoration: half the planet's weather happens in the
 * dark, and a forecast player that walks a day forward is much easier to read
 * when you can see the terminator crossing it. This is the usual low-precision
 * solar position — good to a fraction of a degree, which is a pixel or two of
 * terminator, and it costs no data because the time is already in hand.       */

function sunAt(ms) {
  const n = ms / 86400000 - 10957.5;                 // days from J2000.0
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG;
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  return { dec, lon: wrapLon(ra - gmst * 15) * DEG };
}

/* Daylight above, full night below, civil twilight in between — so the edge is
 * a band a few hundred kilometres wide rather than a hard line, which is what
 * it is. */
function nightFade(cosZenith) {
  if (cosZenith > 0.02) return 0;
  if (cosZenith < -0.12) return 1;
  return (0.02 - cosZenith) / 0.14;
}

/* ── world geometry ──────────────────────────────────────────────────────── */

function addLine(path, enc, close) {
  let x = 0, y = 0;
  for (let i = 0; i < enc.length; i += 2) {
    x += enc[i]; y += enc[i + 1];
    const px = lonToX(x / 100) * PATH_K, py = latToY(y / 100) * PATH_K;
    if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
  }
  if (close) path.closePath();
}
function buildWorldPaths(w) {
  const land = new Path2D(), borders = new Path2D();
  for (const poly of w.land) for (const ring of poly) addLine(land, ring, true);
  for (const line of w.borders) addLine(borders, line, false);
  return { land, borders };
}

/* The globe draws the same coastlines, but a sphere needs each point's sine
 * and cosine rather than its projected position, and it needs them every time
 * the world is turned. They are worked out once, here, and the rotation is
 * then eight multiplications a point. */
function encodeRing(enc) {
  const n = enc.length / 2;
  const trig = new Float32Array(n * 4);
  const edge = new Uint8Array(n);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) {
    x += enc[i * 2]; y += enc[i * 2 + 1];
    const lon = (x / 100) * DEG, lat = (y / 100) * DEG;
    trig[i * 4] = Math.sin(lat); trig[i * 4 + 1] = Math.cos(lat);
    trig[i * 4 + 2] = Math.sin(lon); trig[i * 4 + 3] = Math.cos(lon);
    // Natural Earth's Antarctica is cut off straight across the bottom, which
    // is invisible on a Mercator map and a fake coastline on a globe.
    edge[i] = y / 100 < ANTARCTIC_EDGE ? 1 : 0;
  }
  return { trig, edge, n };
}
function buildSphere(w) {
  const coast = [];
  for (const poly of w.land) for (const ring of poly) coast.push(encodeRing(ring));
  return { coast, borders: w.borders.map(encodeRing) };
}

/* Land or sea, in plate carrée, so the globe can ask one question per pixel
 * instead of clipping polygons against the horizon. Drawing the continents
 * into an off-screen grid once is both simpler and more robust than the
 * fold-the-far-side-outwards trick: a polygon that wraps round the back of the
 * world cannot turn the whole disc into land.
 *
 * Built the first time the Globe tab is opened, and not before — somebody who
 * only ever looks at the flat map never pays for it. */
function buildLandMask(w) {
  let cv;
  try {
    cv = document.createElement('canvas');
    cv.width = MASK_NX; cv.height = MASK_NY;
  } catch { return null; }
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) return null;
  c.fillStyle = '#000';
  c.fillRect(0, 0, MASK_NX, MASK_NY);
  const path = new Path2D();
  for (const poly of w.land) {
    for (const ring of poly) {
      let x = 0, y = 0;
      for (let i = 0; i < ring.length; i += 2) {
        x += ring[i]; y += ring[i + 1];
        const px = (x / 100 + 180) / 360 * MASK_NX;
        const py = (90 - y / 100) / 180 * MASK_NY;
        if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
      }
      path.closePath();
    }
  }
  c.fillStyle = '#fff';
  // Some rings run past ±180° rather than being cut at the date line, so the
  // same path is drawn a world to either side and the seam closes itself.
  for (const shift of [-MASK_NX, 0, MASK_NX]) {
    c.save();
    c.translate(shift, 0);
    c.fill(path, 'evenodd');
    c.restore();
  }
  let pixels;
  try {
    pixels = c.getImageData(0, 0, MASK_NX, MASK_NY).data;
  } catch { return null; }
  const mask = new Uint8Array(MASK_NX * MASK_NY);
  for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4] > 127 ? 1 : 0;
  // The source stops at 85.19°S, which would leave a hole at the south pole
  // exactly where Antarctica is. The last row that is inside the ice sheet is
  // copied down to the pole; nothing else lives there to be got wrong.
  const solid = Math.floor((90 - ANTARCTIC_EDGE + 0.4) / 180 * MASK_NY);
  for (let row = solid + 1; row < MASK_NY; row++) {
    mask.copyWithin(row * MASK_NX, solid * MASK_NX, (solid + 1) * MASK_NX);
  }
  return mask;
}
function needGlobeGeometry() {
  if (!world) return;
  if (!sphere) sphere = buildSphere(world);
  if (!landMask) { landMask = buildLandMask(world); gcache = null; }
}

/* ── the two views ───────────────────────────────────────────────────────── *
 * Each knows how to put a longitude and latitude on the screen, how to get one
 * back, what a drag and a pinch mean on it, and how to draw itself. Everything
 * else — the time player, the layers, the marker, the readout — is shared, and
 * switching tabs carries the centre of the world across so the globe opens
 * looking at whatever the map was looking at.                                 */

const V = () => VIEWS[tab];

/* — the flat map — */

const minScale = () => Math.max(160, W);

function clampMap() {
  map.scale = clamp(map.scale, minScale(), MAX_SCALE);
  map.cx -= Math.floor(map.cx);
  const half = H / (2 * map.scale);
  map.cy = map.scale <= H ? 0.5 : clamp(map.cy, half, 1 - half);
}
function screenToWorld(sx, sy) {
  return [map.cx + (sx - W / 2) / map.scale, map.cy + (sy - H / 2) / map.scale];
}
function worldToScreen(wx, wy) {           // the nearest copy of the world
  let dx = wx - map.cx;
  dx -= Math.round(dx);
  return [dx * map.scale + W / 2, (wy - map.cy) * map.scale + H / 2];
}
function worldCopies() {
  const xmin = map.cx - W / (2 * map.scale), xmax = map.cx + W / (2 * map.scale);
  const ks = [];
  for (let k = Math.floor(xmin); k < xmax; k++) ks.push(k);
  return ks;
}
function withWorldTransform(k, fn) {
  const s = map.scale / PATH_K;
  ctx.setTransform(dpr * s, 0, 0, dpr * s,
                   dpr * (W / 2 - (map.cx - k) * map.scale), dpr * (H / 2 - map.cy * map.scale));
  fn(s);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const MAP_VIEW = {
  fit() {
    if (map.scale) { clampMap(); return; }
    // First launch: fit 70°S–70°N to the height, which on a phone shows a
    // hemisphere of longitude. The globe button zooms out to the whole world.
    map.scale = H / (latToY(-70) - latToY(70));
    clampMap();
  },
  home() { map.scale = minScale(); map.cx = lonToX(0); map.cy = 0.5; clampMap(); },
  centre() { return { lon: xToLon(map.cx - Math.floor(map.cx)), lat: yToLat(map.cy) }; },
  adopt(c) {
    map.cx = lonToX(c.lon);
    map.cy = latToY(clamp(c.lat, -MAX_LAT, MAX_LAT));
    clampMap();
  },
  panBy(dx, dy) { map.cx -= dx / map.scale; map.cy -= dy / map.scale; clampMap(); },
  zoomBy(factor, sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    map.scale = clamp(map.scale * factor, minScale(), MAX_SCALE);
    map.cx = wx - (sx - W / 2) / map.scale;
    map.cy = wy - (sy - H / 2) / map.scale;
    clampMap();
  },
  pinchStart(g) { g.scale0 = map.scale; g.world0 = screenToWorld(g.mx, g.my); },
  pinchMove(g, ratio) {
    map.scale = clamp(g.scale0 * ratio, minScale(), MAX_SCALE);
    map.cx = g.world0[0] - (g.mx - W / 2) / map.scale;
    map.cy = g.world0[1] - (g.my - H / 2) / map.scale;
    clampMap();
  },
  project(lon, lat, out) {
    const p = worldToScreen(lonToX(lon), latToY(lat));
    out[0] = p[0]; out[1] = p[1]; out[2] = 1;
    return out;
  },
  unproject(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    if (wy < 0 || wy > 1) return null;
    return [xToLon(wx - Math.floor(wx)), yToLat(wy)];
  },
  save() { try { localStorage.setItem(STORE.map, JSON.stringify(map)); } catch { /* fine */ } },
  restore() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE.map) || 'null');
      if (v && [v.cx, v.cy, v.scale].every(Number.isFinite) && v.scale > 0) Object.assign(map, v);
    } catch { /* fine */ }
  },
  draw: drawMap,
};

/* — the globe — */

const gp = { lon: 0, sinLat: 0, cosLat: 1, sinLon: 0, cosLon: 1, r: 0, cx: 0, cy: 0 };
let gcache = null;

function syncGlobe() {
  globe.lat = clamp(globe.lat, -89.5, 89.5);
  globe.lon = wrapLon(globe.lon);
  globe.r = clamp(globe.r, Math.min(W, H) * 0.3, Math.min(W, H) * 12);
  gp.lon = globe.lon * DEG;
  gp.sinLat = Math.sin(globe.lat * DEG); gp.cosLat = Math.cos(globe.lat * DEG);
  gp.sinLon = Math.sin(gp.lon); gp.cosLon = Math.cos(gp.lon);
  gp.r = globe.r; gp.cx = W / 2; gp.cy = H / 2;
}

const GLOBE_VIEW = {
  fit() {
    if (!globe.r) {
      globe.r = Math.min(W, H) * 0.48;
      // Open looking at the reader's own side of the planet: the clock's offset
      // from UTC is fifteen degrees an hour, which is close enough to put their
      // continent on the disc. Nothing is asked of the device but the time.
      globe.lon = wrapLon(-new Date().getTimezoneOffset() / 4);
      globe.lat = 20;
    }
    syncGlobe();
  },
  home() { globe.r = Math.min(W, H) * 0.48; globe.lat = 20; syncGlobe(); },
  centre() { return { lon: globe.lon, lat: globe.lat }; },
  adopt(c) { globe.lon = c.lon; globe.lat = clamp(c.lat, -80, 80); syncGlobe(); },
  /* A drag turns the world under the finger: one pixel at the middle of the
   * disc is one radius-worth of angle, so the same gesture turns it less when
   * it has been zoomed into. */
  panBy(dx, dy) {
    const perPixel = 57.29578 / globe.r;
    globe.lon -= dx * perPixel;
    globe.lat += dy * perPixel;
    syncGlobe();
  },
  zoomBy(factor) { globe.r *= factor; syncGlobe(); },
  pinchStart(g) { g.r0 = globe.r; g.lon0 = globe.lon; g.lat0 = globe.lat; g.mx0 = g.mx; g.my0 = g.my; },
  pinchMove(g, ratio) {
    globe.r = g.r0 * ratio;
    const perPixel = 57.29578 / g.r0;
    globe.lon = g.lon0 - (g.mx - g.mx0) * perPixel;
    globe.lat = g.lat0 + (g.my - g.my0) * perPixel;
    syncGlobe();
  },
  project(lon, lat, out) {
    const rlat = lat * DEG, dlon = lon * DEG - gp.lon;
    const sinLat = Math.sin(rlat), cosLat = Math.cos(rlat);
    const cosD = Math.cos(dlon), sinD = Math.sin(dlon);
    const z = gp.sinLat * sinLat + gp.cosLat * cosLat * cosD;
    out[0] = gp.cx + gp.r * (cosLat * sinD);
    out[1] = gp.cy - gp.r * (gp.cosLat * sinLat - gp.sinLat * cosLat * cosD);
    out[2] = z >= 0 ? 1 : 0;
    return out;
  },
  unproject(sx, sy) {
    const X = (sx - gp.cx) / gp.r, Y = (gp.cy - sy) / gp.r;
    const r2 = X * X + Y * Y;
    if (r2 > 1) return null;
    const Z = Math.sqrt(1 - r2);
    const lat = Math.asin(clamp(Z * gp.sinLat + Y * gp.cosLat, -1, 1)) / DEG;
    const lon = wrapLon(globe.lon + Math.atan2(X, Z * gp.cosLat - Y * gp.sinLat) / DEG);
    return [lon, lat];
  },
  save() { try { localStorage.setItem(STORE.globe, JSON.stringify(globe)); } catch { /* fine */ } },
  restore() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE.globe) || 'null');
      if (v && [v.lon, v.lat, v.r].every(Number.isFinite) && v.r > 0) Object.assign(globe, v);
    } catch { /* fine */ }
  },
  draw: drawGlobe,
};

const VIEWS = { map: MAP_VIEW, globe: GLOBE_VIEW };

/* ── drawing ─────────────────────────────────────────────────────────────── */

function requestRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(render);
}

function render() {
  renderPending = false;
  if (!W || !H) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = pal.outside;
  ctx.fillRect(0, 0, W, H);
  V().draw();
}

/* The two steps either side of where the player is, and how far between them.
 * Everything that samples the weather asks this first. */
function frame() {
  const last = field.steps.length - 1;
  const k0 = clamp(Math.floor(t), 0, last);
  const k1 = Math.min(k0 + 1, last);
  return { k0, k1, f: k1 === k0 ? 0 : clamp(t - k0, 0, 1) };
}

/* — the flat map — */

function drawMap() {
  const top = Math.max(0, (0 - map.cy) * map.scale + H / 2);
  const bottom = Math.min(H, (1 - map.cy) * map.scale + H / 2);
  ctx.fillStyle = pal.ocean;
  ctx.fillRect(0, top, W, bottom - top);

  if (worldPaths) {
    for (const k of worldCopies()) withWorldTransform(k, () => {
      ctx.fillStyle = pal.land;
      ctx.fill(worldPaths.land, 'evenodd');
    });
  }
  if (field) drawMapLayer();
  if (night) drawMapNight();
  drawMapGraticule();
  if (worldPaths) {
    for (const k of worldCopies()) withWorldTransform(k, (s) => {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal.border; ctx.lineWidth = 0.7 / s; ctx.stroke(worldPaths.borders);
      ctx.strokeStyle = pal.coast;  ctx.lineWidth = 0.9 / s; ctx.stroke(worldPaths.land);
    });
  }
  if (field && arrows) drawMapArrows();
  drawPlaces();
  drawMarker();
}

/* Two off-screen grids, kept between frames: one for the colour layer and one
 * for the night wash. They are different sizes, so sharing a single canvas
 * would reallocate both of them on every frame. */
const scratches = new Map();
function scratch(name, cols, rows) {
  let s = scratches.get(name);
  if (!s || s.cv.width !== cols || s.cv.height !== rows) {
    const cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    const c = cv.getContext('2d');
    s = { cv, ctx: c, img: c.createImageData(cols, rows) };
    scratches.set(name, s);
  }
  return s;
}
function paintScratch(s, x, y, w, h) {
  s.ctx.putImageData(s.img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(s.cv, 0, 0, s.cv.width, s.cv.height, x, y, w, h);
}

function drawMapLayer() {
  const layer = activeLayer();
  if (!layer || !layer.lut) return;
  const cols = Math.ceil(W / HEAT_PX), rows = Math.ceil(H / HEAT_PX);
  const sheet = scratch('layer', cols, rows);
  const data = sheet.img.data;
  const { k0, k1, f } = frame();
  const A = field.pair(layer.key, k0);
  const B = f > 0 ? field.pair(layer.key, k1) : null;
  const vector = A[1] !== null;
  const nx = field.nx, ny = field.ny;
  const lut = layer.lut;
  const off = layer.spec.offset, invStep = 1 / layer.spec.step, power = layer.spec.power || 1;

  const ci0 = new Int32Array(cols), ci1 = new Int32Array(cols), cfx = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    let wx = map.cx + ((c + 0.5) * HEAT_PX - W / 2) / map.scale;
    wx -= Math.floor(wx);
    let fi = (xToLon(wx) - field.lon0) / field.dlon;
    fi -= Math.floor(fi / nx) * nx;
    const i0 = Math.floor(fi);
    ci0[c] = i0; ci1[c] = (i0 + 1) % nx; cfx[c] = fi - i0;
  }
  let o = 0;
  for (let r = 0; r < rows; r++) {
    const wy = map.cy + ((r + 0.5) * HEAT_PX - H / 2) / map.scale;
    if (wy < 0 || wy > 1) {
      for (let c = 0; c < cols; c++) { data[o + 3] = 0; o += 4; }
      continue;
    }
    const fj = clamp((yToLat(wy) - field.lat0) / field.dlat, 0, ny - 1);
    const j0 = Math.floor(fj), j1 = Math.min(j0 + 1, ny - 1), ty = fj - j0;
    const a = j0 * nx, b = j1 * nx;
    for (let c = 0; c < cols; c++) {
      const i0 = ci0[c], i1 = ci1[c], tx = cfx[c];
      const a0 = a + i0, a1 = a + i1, b0 = b + i0, b1 = b + i1;
      let value = interp(A[0], a0, a1, b0, b1, tx, ty);
      if (B) value += (interp(B[0], a0, a1, b0, b1, tx, ty) - value) * f;
      if (vector) {
        let second = interp(A[1], a0, a1, b0, b1, tx, ty);
        if (B) second += (interp(B[1], a0, a1, b0, b1, tx, ty) - second) * f;
        value = Math.sqrt(value * value + second * second);
      }
      let scaled = (value - off) * invStep;
      if (power !== 1) scaled = Math.pow(scaled > 0 ? scaled : 0, 1 / power);
      const index = (scaled < 0 ? 0 : scaled > 255 ? 255 : scaled + 0.5) | 0;
      const li = index * 4;
      data[o] = lut[li]; data[o + 1] = lut[li + 1]; data[o + 2] = lut[li + 2]; data[o + 3] = lut[li + 3];
      o += 4;
    }
  }
  paintScratch(sheet, 0, 0, cols * HEAT_PX, rows * HEAT_PX);
}

function interp(arr, a0, a1, b0, b1, tx, ty) {
  const top = arr[a0] + (arr[a1] - arr[a0]) * tx;
  const bottom = arr[b0] + (arr[b1] - arr[b0]) * tx;
  return top + (bottom - top) * ty;
}

/* Night on the flat map is its own wash rather than part of the colour pass,
 * because the map's ground is drawn as shapes, not as pixels. It is coarse on
 * purpose: a terminator is a smooth curve, and a six-pixel grid scaled up is
 * smoother than a fine one. */
const NIGHT_PX = 6;
function drawMapNight() {
  const sun = sunAt(field ? currentValidMs() : Date.now());
  const cols = Math.ceil(W / NIGHT_PX), rows = Math.ceil(H / NIGHT_PX);
  const sheet = scratch('night', cols, rows);
  const data = sheet.img.data;
  const sinDec = Math.sin(sun.dec), cosDec = Math.cos(sun.dec);
  const cosD = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    let wx = map.cx + ((c + 0.5) * NIGHT_PX - W / 2) / map.scale;
    wx -= Math.floor(wx);
    cosD[c] = Math.cos(xToLon(wx) * DEG - sun.lon);
  }
  const rgb = pal.nightRgb;
  let o = 0;
  for (let r = 0; r < rows; r++) {
    const wy = map.cy + ((r + 0.5) * NIGHT_PX - H / 2) / map.scale;
    if (wy < 0 || wy > 1) {
      for (let c = 0; c < cols; c++) { data[o + 3] = 0; o += 4; }
      continue;
    }
    const lat = yToLat(wy) * DEG;
    const p = Math.sin(lat) * sinDec, q = Math.cos(lat) * cosDec;
    for (let c = 0; c < cols; c++) {
      const shade = nightFade(p + q * cosD[c]) * pal.nightMax;
      data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2];
      data[o + 3] = 255 * shade;
      o += 4;
    }
  }
  paintScratch(sheet, 0, 0, cols * NIGHT_PX, rows * NIGHT_PX);
}

function drawMapGraticule() {
  const pxPerDeg = map.scale / 360;
  const g = pxPerDeg < 3 ? 30 : pxPerDeg < 12 ? 10 : pxPerDeg < 40 ? 5 : 2;
  ctx.strokeStyle = pal.grat;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const xmin = map.cx - W / (2 * map.scale), xmax = map.cx + W / (2 * map.scale);
  for (let lon = Math.floor(xToLon(xmin) / g) * g; lon <= xToLon(xmax); lon += g) {
    const sx = Math.round((lonToX(lon) - map.cx) * map.scale + W / 2) + 0.5;
    ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
  }
  for (let lat = -80; lat <= 80; lat += g) {
    const sy = Math.round((latToY(lat) - map.cy) * map.scale + H / 2) + 0.5;
    if (sy < 0 || sy > H) continue;
    ctx.moveTo(0, sy); ctx.lineTo(W, sy);
  }
  ctx.stroke();
}

/* Arrows on the flat map sit at fixed places in the WORLD, so they stay put
 * under a pan instead of swimming across the weather. */
const uvTmp = [0, 0];
function drawMapArrows() {
  if (!field.byKey.has('wind')) return;
  const n = Math.max(2, Math.round(Math.log2(map.scale / ARROW_SPACING)));
  const d = 1 / 2 ** n;                 // world units between arrows
  const cell = d * map.scale;           // CSS px between arrows
  const xmin = map.cx - W / (2 * map.scale) - d, xmax = map.cx + W / (2 * map.scale) + d;
  const ymin = Math.max(0, map.cy - H / (2 * map.scale) - d);
  const ymax = Math.min(1, map.cy + H / (2 * map.scale) + d);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let j = Math.floor(ymin / d); (j + 0.5) * d <= ymax; j++) {
    const wy = (j + 0.5) * d;
    if (wy < 0 || wy > 1) continue;
    const lat = yToLat(wy);
    if (Math.abs(lat) > MAX_LAT - 0.3) continue;
    const sy = (wy - map.cy) * map.scale + H / 2;
    for (let i = Math.floor(xmin / d); (i + 0.5) * d <= xmax; i++) {
      const wx = (i + 0.5) * d;
      const sx = (wx - map.cx) * map.scale + W / 2;
      field.sample('wind', t, xToLon(wx - Math.floor(wx)), lat, uvTmp);
      const u = uvTmp[0], v = uvTmp[1];
      drawArrow(sx, sy, Math.atan2(-v, u), Math.hypot(u, v), cell);
    }
  }
}

/* — the globe — */

function drawGlobe() {
  syncGlobe();
  needGlobeGeometry();
  drawGlobeSurface();
  drawGlobeGraticule();
  if (sphere) {
    const paths = globePaths();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.border; ctx.lineWidth = 0.7; ctx.stroke(paths.borders);
    ctx.strokeStyle = pal.coast; ctx.lineWidth = 0.9; ctx.stroke(paths.coast);
  }
  ctx.beginPath();
  ctx.arc(gp.cx, gp.cy, gp.r, 0, Math.PI * 2);
  ctx.strokeStyle = pal.limb; ctx.lineWidth = 1; ctx.stroke();
  if (field && arrows) drawGlobeArrows();
  drawPlaces();
  drawMarker();
}

/* Everything that only changes when the world is turned: which cells of the
 * raster are on the disc at all, where each one is on Earth, and whether it is
 * land. Playing the forecast never touches any of it, so a frame is then a
 * bilinear sample and a lookup per cell. */
function globeCells() {
  const key = `${globe.lon.toFixed(3)}|${globe.lat.toFixed(3)}|${globe.r.toFixed(2)}`
            + `|${W}|${H}|${landMask ? 1 : 0}`;
  if (gcache && gcache.key === key) return gcache;
  const x0 = Math.max(0, Math.floor(gp.cx - gp.r));
  const y0 = Math.max(0, Math.floor(gp.cy - gp.r));
  const x1 = Math.min(W, Math.ceil(gp.cx + gp.r));
  const y1 = Math.min(H, Math.ceil(gp.cy + gp.r));
  const cols = Math.max(1, Math.ceil((x1 - x0) / GLOBE_PX));
  const rows = Math.max(1, Math.ceil((y1 - y0) / GLOBE_PX));
  const n = cols * rows;
  const cell = {
    key, x0, y0, cols, rows,
    inside: new Uint8Array(n), land: new Uint8Array(n),
    lon: new Float32Array(n), lat: new Float32Array(n),
    X: new Float32Array(n), Y: new Float32Array(n), Z: new Float32Array(n),
  };
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const Y = (gp.cy - (y0 + (r + 0.5) * GLOBE_PX)) / gp.r;
    for (let c = 0; c < cols; c++, i++) {
      const X = (x0 + (c + 0.5) * GLOBE_PX - gp.cx) / gp.r;
      const r2 = X * X + Y * Y;
      if (r2 > 1) continue;
      const Z = Math.sqrt(1 - r2);
      const lat = Math.asin(clamp(Z * gp.sinLat + Y * gp.cosLat, -1, 1)) / DEG;
      const lon = wrapLon(globe.lon + Math.atan2(X, Z * gp.cosLat - Y * gp.sinLat) / DEG);
      cell.inside[i] = 1;
      cell.lon[i] = lon; cell.lat[i] = lat;
      cell.X[i] = X; cell.Y[i] = Y; cell.Z[i] = Z;
      if (landMask) {
        const mx = clamp(Math.floor((lon + 180) / 360 * MASK_NX), 0, MASK_NX - 1);
        const my = clamp(Math.floor((90 - lat) / 180 * MASK_NY), 0, MASK_NY - 1);
        cell.land[i] = landMask[my * MASK_NX + mx];
      }
    }
  }
  gcache = cell;
  return cell;
}

function drawGlobeSurface() {
  const cell = globeCells();
  const { cols, rows } = cell;
  const sheet = scratch('layer', cols, rows);
  const data = sheet.img.data;
  const layer = field ? activeLayer() : null;
  const lut = layer && layer.lut;
  let A = null, B = null, f = 0, vector = false;
  let off = 0, invStep = 1, power = 1;
  if (lut) {
    const fr = frame();
    f = fr.f;
    A = field.pair(layer.key, fr.k0);
    B = f > 0 ? field.pair(layer.key, fr.k1) : null;
    vector = A[1] !== null;
    off = layer.spec.offset; invStep = 1 / layer.spec.step; power = layer.spec.power || 1;
  }
  const nx = field ? field.nx : 0, ny = field ? field.ny : 0;
  const lon0 = field ? field.lon0 : 0, dlon = field ? field.dlon : 1;
  const lat0 = field ? field.lat0 : 0, dlat = field ? field.dlat : 1;

  // The sun, turned into the same frame the disc is drawn in, so the night
  // shade is three multiplications a pixel instead of two more trig calls.
  const sun = sunAt(field ? currentValidMs() : Date.now());
  const cosDec = Math.cos(sun.dec), sinDec = Math.sin(sun.dec);
  const sv = [cosDec * Math.cos(sun.lon), cosDec * Math.sin(sun.lon), sinDec];
  const sunX = -gp.sinLon * sv[0] + gp.cosLon * sv[1];
  const sunY = -gp.sinLat * gp.cosLon * sv[0] - gp.sinLat * gp.sinLon * sv[1] + gp.cosLat * sv[2];
  const sunZ = gp.cosLat * gp.cosLon * sv[0] + gp.cosLat * gp.sinLon * sv[1] + gp.sinLat * sv[2];
  const nightRgb = pal.nightRgb, nightMax = pal.nightMax;
  const ocean = pal.oceanRgb, land = pal.landRgb;

  const n = cols * rows;
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    if (!cell.inside[i]) { data[o + 3] = 0; continue; }
    const base = cell.land[i] ? land : ocean;
    let red = base[0], green = base[1], blue = base[2];
    if (lut) {
      const lon = cell.lon[i], lat = cell.lat[i];
      let fi = (lon - lon0) / dlon;
      fi -= Math.floor(fi / nx) * nx;
      const fj = clamp((lat - lat0) / dlat, 0, ny - 1);
      const i0 = Math.floor(fi), tx = fi - i0, i1 = (i0 + 1) % nx;
      const j0 = Math.floor(fj), ty = fj - j0, j1 = Math.min(j0 + 1, ny - 1);
      const a0 = j0 * nx + i0, a1 = j0 * nx + i1, b0 = j1 * nx + i0, b1 = j1 * nx + i1;
      let value = interp(A[0], a0, a1, b0, b1, tx, ty);
      if (B) value += (interp(B[0], a0, a1, b0, b1, tx, ty) - value) * f;
      if (vector) {
        let second = interp(A[1], a0, a1, b0, b1, tx, ty);
        if (B) second += (interp(B[1], a0, a1, b0, b1, tx, ty) - second) * f;
        value = Math.sqrt(value * value + second * second);
      }
      let scaled = (value - off) * invStep;
      if (power !== 1) scaled = Math.pow(scaled > 0 ? scaled : 0, 1 / power);
      const li = ((scaled < 0 ? 0 : scaled > 255 ? 255 : scaled + 0.5) | 0) * 4;
      const a = lut[li + 3] / 255;
      if (a > 0) {
        red += (lut[li] - red) * a;
        green += (lut[li + 1] - green) * a;
        blue += (lut[li + 2] - blue) * a;
      }
    }
    if (night) {
      const shade = nightFade(cell.X[i] * sunX + cell.Y[i] * sunY + cell.Z[i] * sunZ) * nightMax;
      if (shade > 0) {
        red += (nightRgb[0] - red) * shade;
        green += (nightRgb[1] - green) * shade;
        blue += (nightRgb[2] - blue) * shade;
      }
    }
    data[o] = red; data[o + 1] = green; data[o + 2] = blue; data[o + 3] = 255;
  }
  paintScratch(sheet, cell.x0, cell.y0, cols * GLOBE_PX, rows * GLOBE_PX);
}

/* Coastlines and borders on the sphere. A line is broken wherever it goes over
 * the horizon and picked up again where it comes back, which is all the
 * clipping a stroke needs — and the whole path is cached until the world is
 * turned, so playing the forecast never rebuilds it. */
let pathCache = null;
function globePaths() {
  const key = `${globe.lon.toFixed(3)}|${globe.lat.toFixed(3)}|${globe.r.toFixed(2)}|${W}|${H}`;
  if (pathCache && pathCache.key === key) return pathCache;
  pathCache = { key, coast: sphereRings(sphere.coast), borders: sphereRings(sphere.borders) };
  return pathCache;
}
function sphereRings(rings) {
  const path = new Path2D();
  const { sinLat, cosLat, sinLon, cosLon, r, cx, cy } = gp;
  for (const ring of rings) {
    const trig = ring.trig, edge = ring.edge;
    let pen = false;
    for (let i = 0, o = 0; i < ring.n; i++, o += 4) {
      if (edge[i]) { pen = false; continue; }
      const sLat = trig[o], cLat = trig[o + 1], sLon = trig[o + 2], cLon = trig[o + 3];
      const cosD = cLon * cosLon + sLon * sinLon;       // cos(lon − centre)
      const z = sinLat * sLat + cosLat * cLat * cosD;
      if (z < 0) { pen = false; continue; }
      const sinD = sLon * cosLon - cLon * sinLon;       // sin(lon − centre)
      const sx = cx + r * (cLat * sinD);
      const sy = cy - r * (cosLat * sLat - sinLat * cLat * cosD);
      if (pen) path.lineTo(sx, sy); else { path.moveTo(sx, sy); pen = true; }
    }
  }
  return path;
}

function drawGlobeGraticule() {
  ctx.strokeStyle = pal.grat;
  ctx.lineWidth = 1;
  const path = new Path2D();
  const out = [0, 0, 0];
  const line = (points) => {
    let pen = false;
    for (const [lon, lat] of points) {
      GLOBE_VIEW.project(lon, lat, out);
      if (!out[2]) { pen = false; continue; }
      if (pen) path.lineTo(out[0], out[1]); else { path.moveTo(out[0], out[1]); pen = true; }
    }
  };
  for (let lon = -180; lon < 180; lon += 30) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += 3) points.push([lon, lat]);
    line(points);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += 3) points.push([lon, lat]);
    line(points);
  }
  ctx.stroke(path);
}

/* Arrows on the globe sit on a screen grid rather than a world one: a grid of
 * meridians would crowd into a knot at the poles, and turning the world is a
 * deliberate gesture rather than something you do while reading. */
function drawGlobeArrows() {
  if (!field.byKey.has('wind')) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const step = ARROW_SPACING;
  const { sinLat: sinLat0, cosLat: cosLat0, r, cx, cy } = gp;
  for (let sy = cy - Math.ceil((cy - 0) / step) * step; sy < H + step; sy += step) {
    if (sy < -step || sy > H + step) continue;
    for (let sx = cx - Math.ceil((cx - 0) / step) * step; sx < W + step; sx += step) {
      const X = (sx - cx) / r, Y = (cy - sy) / r;
      const r2 = X * X + Y * Y;
      if (r2 > 0.988) continue;                  // the rim is too foreshortened to read
      const Z = Math.sqrt(1 - r2);
      const sinLat = clamp(Z * sinLat0 + Y * cosLat0, -1, 1);
      const lat = Math.asin(sinLat) / DEG;
      const dlon = Math.atan2(X, Z * cosLat0 - Y * sinLat0);
      const lon = wrapLon(globe.lon + dlon / DEG);
      field.sample('wind', t, lon, lat, uvTmp);
      const u = uvTmp[0], v = uvTmp[1];
      const speed = Math.hypot(u, v);
      // The wind blows along the ground, so its arrow has to be turned into
      // the screen with the local east and north, which tilt as the world does.
      const cosLat = Math.cos(lat * DEG);
      const sinD = Math.sin(dlon), cosD = Math.cos(dlon);
      const ex = cosD, ey = sinLat0 * sinD;
      const nxx = -sinLat * sinD, nyy = cosLat0 * cosLat + sinLat0 * sinLat * cosD;
      drawArrow(sx, sy, Math.atan2(-(u * ey + v * nyy), u * ex + v * nxx), speed, step);
    }
  }
}

/* — shared — */

function drawArrow(x, y, angle, spd, cell) {
  if (spd < 0.5) {                      // calm: a dot, because there is no direction to show
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = pal.arrow; ctx.fill();
    return;
  }
  const len = cell * clamp(0.28 + spd / 25 * 0.67, 0.28, 0.95);
  const lw = clamp(0.9 + spd / 12, 0.9, 3.2);
  const head = clamp(2.5 + lw * 1.5, 3, 8.5);
  const h = len / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-h, 0); ctx.lineTo(h, 0);
  ctx.moveTo(h - head, -head * 0.55); ctx.lineTo(h, 0); ctx.lineTo(h - head, head * 0.55);
  ctx.strokeStyle = pal.arrowHalo; ctx.lineWidth = lw + 2; ctx.stroke();
  ctx.strokeStyle = pal.arrow; ctx.lineWidth = lw; ctx.stroke();
  ctx.restore();
}

const projTmp = [0, 0, 0];
function drawPlaces() {
  if (!places.length) return;
  const zoom = tab === 'map' ? map.scale : globe.r * 4;
  const maxTier = zoom < 1100 ? 1 : zoom < 2800 ? 2 : zoom < 7500 ? 3 : 4;
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  const boxes = [];
  const view = V();
  for (const p of places) {
    if (p.r > maxTier) break;           // sorted by tier
    view.project(p.lon, p.lat, projTmp);
    if (!projTmp[2]) continue;
    const sx = projTmp[0], sy = projTmp[1];
    if (sx < -80 || sx > W + 80 || sy < -12 || sy > H + 12) continue;
    const tw = ctx.measureText(p.n).width;
    if (sx + 8 + tw > W - 2) continue;  // a label clipped by the edge is worse than none
    const box = [sx - 4, sy - 8, sx + 8 + tw, sy + 8];
    if (boxes.some((b) => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1])) continue;
    boxes.push(box);
    ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = pal.labelHalo; ctx.lineWidth = 3; ctx.strokeStyle = pal.labelHalo; ctx.stroke();
    ctx.fillStyle = pal.label; ctx.fill();
    ctx.strokeStyle = pal.labelHalo; ctx.lineWidth = 3; ctx.strokeText(p.n, sx + 6, sy);
    ctx.fillStyle = pal.label; ctx.fillText(p.n, sx + 6, sy);
  }
}

function drawMarker() {
  if (!marker) return;
  V().project(marker.lon, marker.lat, projTmp);
  if (!projTmp[2]) return;
  const sx = projTmp[0], sy = projTmp[1];
  ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.strokeStyle = pal.markerRing; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = pal.marker; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = pal.marker; ctx.fill();
}

/* ── formatting ──────────────────────────────────────────────────────────── */

const fmtWhen = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
/* The run label pairs a UTC hour with a date, so the date has to be UTC too —
 * formatting it locally gives "06Z Sep 20" for a run at 06:00 on the 21st,
 * which is a date nobody can act on. About shows the same instant in the
 * reader's own zone, with the zone named, which is the other half of it. */
const fmtDateUTC = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtFull = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

function fmtAgo(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
function unitFor(layer) {
  const list = layer.units;
  return list.find((u) => u.id === unitChoice[layer.key]) || list[0];
}
function convert(layer, value) {
  const u = unitFor(layer);
  return value * u.f + (u.o || 0);
}
function fmtValue(layer, value) {
  const u = unitFor(layer);
  return (value * u.f + (u.o || 0)).toFixed(u.d);
}
function fmtCoord(lat, lon) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}
function beaufort(spd) {
  for (let i = 0; i < BEAUFORT.length; i++) if (spd < BEAUFORT[i][0]) return `${BEAUFORT[i][1]} · Bf ${i}`;
  return 'Hurricane force · Bf 12';
}
/* A number in words, for the line under the tapped value. The bands are the
 * ones the puller writes into the ask table, so the map and a question in
 * words agree about what "overcast" means. */
function describe(layer, value, second) {
  if (layer.kind === 'vector') {
    const from = (Math.atan2(-second[0], -second[1]) / DEG + 360) % 360;
    const where = value < 0.5 ? 'No direction'
      : `From ${COMPASS[Math.round(from / 22.5) % 16]} (${Math.round(from)}°)`;
    return `${where} · ${beaufort(value)}`;
  }
  if (layer.key === 'rain') {
    return value < 0.05 ? 'Dry' : value < 0.3 ? 'Drizzle' : value < 1.5 ? 'Light rain'
      : value < 5 ? 'Rain' : value < 12 ? 'Heavy rain' : 'Downpour';
  }
  if (layer.key === 'cloud') {
    return value < 10 ? 'Clear' : value < 30 ? 'Mostly clear' : value < 60 ? 'Partly cloudy'
      : value < 85 ? 'Cloudy' : 'Overcast';
  }
  return layer.level || layer.label;
}

/* ── header, chips, legend, readout ──────────────────────────────────────── */

function setProblem(key, msg) {
  if (msg) problems.set(key, msg); else problems.delete(key);
  const box = $('error');
  if (!problems.size) { box.hidden = true; box.textContent = ''; return; }
  box.innerHTML = '';                        // empty it; the text below is a DOM node
  for (const m of problems.values()) {
    const p = document.createElement('div');
    p.textContent = m;
    box.append(p);
  }
  box.hidden = false;
}

/* The stamp is the reader's own clock — it answers "how old is what I am
 * looking at", which is the question a dashboard has to answer before any
 * number on it can be trusted. */
function updateStamp() {
  const el = $('stamp');
  if (!snap || !field) {
    el.textContent = 'No weather data';
    el.className = 'stamp stale';
    return;
  }
  const when = new Date(snap.generatedAt);
  const age = Date.now() - when.getTime();
  const run = new Date(snap.run);
  const lastValid = field.steps[field.steps.length - 1].valid;
  const runLabel = `${pad2(run.getUTCHours())}Z ${fmtDateUTC.format(run)}`;
  let text = `Updated ${pad2(when.getHours())}:${pad2(when.getMinutes())} · ${snap.model || 'GFS'} ${runLabel}`;
  let stale = false;
  if (Date.now() > lastValid) {
    text = `Forecast ran out ${fmtAgo(Date.now() - lastValid)} · ${text}`;
    stale = true;
  } else if (age > STALE_HOURS * 3600e3) {
    text = `Stale · ${text}`;
    stale = true;
  }
  el.textContent = text;
  el.className = 'stamp' + (stale ? ' stale' : '');
  el.title = when.toLocaleString();
}

/* The chips, built from the snapshot rather than from a list in here: a sixth
 * field added to scripts/global_weather.py turns up as a sixth chip. */
function buildChips() {
  const row = $('layerchips');
  row.innerHTML = '';                        // empty it; the buttons below are DOM nodes
  if (!field) return;
  const dark = darkMq.matches;
  for (const layer of field.layers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(layer.key === layerKey));
    const dot = document.createElement('span');
    dot.className = 'chipdot';
    const look = layer.look(dark);
    const [lo, hi] = look.legend;
    const parts = [];
    for (let s = 0; s <= 3; s++) {
      const value = lo + (hi - lo) * (s / 3);
      const rgb = rampAt(look.stops, value).map(Math.round);
      parts.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${(s / 3 * 100).toFixed(0)}%`);
    }
    dot.style.background = `linear-gradient(135deg, ${parts.join(', ')})`;
    const text = document.createElement('span');
    text.textContent = look.short || layer.label;
    button.append(dot, text);
    button.addEventListener('click', () => setLayer(layer.key));
    row.append(button);
  }
}

/* Round numbers, at most a handful, chosen in WHATEVER UNIT IS ON SCREEN
 * rather than converted from a fixed list: 0 5 10 … reads well in metres a
 * second and turns into 0 18 36 54 … in km/h, which is seven wide labels in
 * 220 points and collides. A layer stored on a curve — rain — gets the 1-2-5
 * ladder instead, so the drizzle end of the bar is labelled at all.
 *
 * `lo` and `hi` are the ends of the bar in the displayed unit, and so is what
 * comes back; the caller turns each one back into the layer's own unit to find
 * out where along the bar it goes. */
function legendTicks(layer, lo, hi) {
  const out = [lo];
  if ((layer.spec.power || 1) !== 1) {
    for (let e = -4; e <= 4; e++) {
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (v > lo && v < hi) out.push(v);
      }
    }
    out.push(hi);
    return out;
  }
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
  const step = steps.find((v) => (hi - lo) / v <= 6) ?? 1000;
  for (let v = Math.ceil(lo / step) * step; v < hi - step * 0.45; v += step) {
    if (v > lo + step * 0.45) out.push(v);
  }
  out.push(hi);
  return out;
}

function updateLegend() {
  const layer = activeLayer();
  if (!layer) return;
  const look = layer.look(darkMq.matches);
  const [lo, hi] = look.legend;
  const b0 = layer.toByte(lo), b1 = layer.toByte(hi);
  const pos = (v) => clamp((layer.toByte(v) - b0) / (b1 - b0), 0, 1);

  /* The bar is painted from the same stops and the same opacity as the map, so
   * a scale that fades out where nothing is happening fades out here too. */
  const parts = [];
  const seen = new Set();
  const addStop = (v) => {
    const at = pos(v);
    const keyed = at.toFixed(3);
    if (seen.has(keyed)) return;
    seen.add(keyed);
    const rgb = rampAt(look.stops, v).map(Math.round);
    const a = clamp(alphaAt(look.alpha, v) * pal.alphaScale, 0, 1);
    parts.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(2)}) ${(at * 100).toFixed(1)}%`);
  };
  addStop(lo);
  for (const [v] of look.stops) if (v > lo && v < hi) addStop(v);
  // A curved scale needs stops of its own, or the gradient straightens it out.
  if ((layer.spec.power || 1) !== 1) for (let s = 1; s < 12; s++) addStop(lo + (hi - lo) * (s / 12));
  addStop(hi);
  parts.sort((a, b) => parseFloat(a.split(' ').pop()) - parseFloat(b.split(' ').pop()));
  $('legend-bar').style.background = `linear-gradient(90deg, ${parts.join(', ')})`;

  const ticks = $('legend-ticks');
  ticks.innerHTML = '';                      // empty it; the spans below are DOM nodes
  const u = unitFor(layer);
  const shown = (v) => v * u.f + (u.o || 0);
  const back = (v) => (v - (u.o || 0)) / u.f;
  let placed = -1;
  const values = legendTicks(layer, shown(lo), shown(hi));
  values.forEach((value, n) => {
    const at = pos(back(value));
    const last = n === values.length - 1;
    if (n && !last && at - placed < 0.13) return;
    if (last && at - placed < 0.16 && ticks.lastChild) ticks.lastChild.remove();
    placed = at;
    const span = document.createElement('span');
    span.style.left = `${(at * 100).toFixed(1)}%`;
    if (at < 0.02) span.className = 'first';
    if (at > 0.98) span.className = 'last';
    span.textContent = Math.abs(value) >= 10 || Number.isInteger(value)
      ? String(Math.round(value)) : String(Number(value.toFixed(2)));
    ticks.append(span);
  });
  $('legend-name').textContent = layer.label;
  $('legend-unit').textContent = u.label;
  $('btn-units').textContent = u.label;
  $('btn-units').disabled = layer.units.length < 2;
}

/* The three sources' credits. The short line stays on screen because CC BY 4.0
 * asks for attribution wherever the material is used; the full statement is one
 * tap away in About, which is what "a reasonable manner" means on a phone map.
 * The sentence about sampling is not decoration either: NOAA asks that modified
 * data is not passed off as unaltered NOAA data, and this is sampled and
 * rounded to a byte a point. */
function updateCredits() {
  const source = (snap && snap.source) || {};
  $('credits').textContent = CREDITS;
  $('about-credits').textContent =
    `${source.attribution || 'Weather: NOAA Global Forecast System'}. `
    + `${source.licence || 'Public domain — a work of the United States Government'}. `
    + 'It is sampled and rounded here, so it is not unaltered NOAA data, and nothing on this '
    + 'screen is endorsed by NOAA. Coastlines: made with Natural Earth, public domain. '
    + 'City labels: © GeoNames (https://www.geonames.org/), CC BY 4.0 — '
    + 'https://creativecommons.org/licenses/by/4.0/. The full terms, and the '
    + 'no-warranty sentence that comes with them, are in assets/LICENSES.md inside the app.';
}

/* A tap gives the whole weather at that point, not just the layer on screen —
 * which is the difference between a map of one field and a weather app. */
const readTmp = [0, 0];
function updateReadout() {
  const box = $('readout');
  if (!marker || !field) { box.hidden = true; return; }
  const layer = activeLayer();
  field.sample(layer.key, t, marker.lon, marker.lat, readTmp);
  const vector = layer.kind === 'vector';
  const value = vector ? Math.hypot(readTmp[0], readTmp[1]) : readTmp[0];

  $('readout-where').textContent = fmtCoord(marker.lat, marker.lon);
  $('readout-number').textContent = fmtValue(layer, value);
  $('readout-unit').textContent = unitFor(layer).label;
  const arrow = $('readout-arrow');
  arrow.hidden = !vector;
  if (vector) {
    arrow.style.transform = `rotate(${(Math.atan2(-readTmp[1], readTmp[0]) / DEG).toFixed(0)}deg)`;
    // Calm has no direction to point in, but the gap it leaves keeps the
    // number from jumping sideways as the forecast plays.
    arrow.style.visibility = value < 0.5 ? 'hidden' : 'visible';
  }
  $('readout-sub').textContent = describe(layer, value, readTmp);

  const list = $('readout-all');
  list.innerHTML = '';                       // empty it; the rows below are DOM nodes
  for (const other of field.layers) {
    if (other.key === layer.key) continue;
    field.sample(other.key, t, marker.lon, marker.lat, readTmp);
    const v = other.kind === 'vector' ? Math.hypot(readTmp[0], readTmp[1]) : readTmp[0];
    const term = document.createElement('dt');
    term.textContent = other.label;
    const def = document.createElement('dd');
    def.textContent = `${fmtValue(other, v)} ${unitFor(other).label}`;
    list.append(term, def);
  }
  box.hidden = false;
}

function stepSpacing() {
  const h = field.steps.map((s) => s.hours);
  const gaps = new Set();
  for (let k = 1; k < h.length; k++) gaps.add(h[k] - h[k - 1]);
  if (gaps.size !== 1) return '';
  const g = [...gaps][0];
  return g === 1 ? ', hourly' : `, every ${g} h`;
}

function showAbout() {
  const list = $('about-list');
  list.innerHTML = '';                       // empty it; the rows below are DOM nodes
  const source = (snap && snap.source) || {};
  const rows = snap ? [
    ['Source', source.detail || source.name || '—'],
    ['Terms', source.licence || '—'],
    ['Model run', fmtFull.format(new Date(snap.run))],
    ['Updated', fmtFull.format(new Date(snap.generatedAt))],
    ['Forecast', `${field.steps.length} steps${stepSpacing()}, +${field.steps[0].hours} h to `
                 + `+${field.steps[field.steps.length - 1].hours} h`],
    ['Grid', `${field.nx} × ${field.ny} points, ${Math.abs(field.dlon)}° apart`],
  ] : [['Data', 'No snapshot could be read']];
  if (field) {
    for (const layer of field.layers) {
      const u = unitFor(layer);
      const reached = layer.range
        ? `${fmtValue(layer, layer.range[0])} to ${fmtValue(layer, layer.range[1])} ${u.label}`
        : 'in this forecast';
      rows.push([layer.label, `${layer.level || layer.field} · ${reached}`]);
    }
  }
  for (const [key, value] of rows) {
    const term = document.createElement('dt'); term.textContent = key;
    const def = document.createElement('dd'); def.textContent = value;
    list.append(term, def);
  }
  $('about').hidden = false;
}

/* ── time player ─────────────────────────────────────────────────────────── */

function currentValidMs() {
  const s = field.steps, last = s.length - 1;
  const k0 = clamp(Math.floor(t), 0, last), k1 = Math.min(k0 + 1, last);
  return s[k0].valid + (s[k1].valid - s[k0].valid) * clamp(t - k0, 0, 1);
}
function nearestStep(ms) {
  let best = 0, bd = Infinity;
  field.steps.forEach((s, k) => { const d = Math.abs(s.valid - ms); if (d < bd) { bd = d; best = k; } });
  return best;
}
function syncTimeUI() {
  const s = field.steps, last = s.length - 1;
  const k0 = clamp(Math.floor(t), 0, last), k1 = Math.min(k0 + 1, last);
  const f = clamp(t - k0, 0, 1);
  const ms = currentValidMs();
  const hours = s[k0].hours + (s[k1].hours - s[k0].hours) * f;
  $('valid-time').textContent = fmtWhen.format(new Date(ms));
  const rel = ms - Date.now();
  const relTxt = Math.abs(rel) < 1800e3 ? 'now' : rel > 0 ? `in ${fmtAgo(rel).replace(' ago', '')}` : fmtAgo(-rel);
  $('lead').textContent = `${relTxt} · +${Math.round(hours)} h`;
  if (document.activeElement !== slider) slider.value = String(Math.round(t));
}
function setTime(tt) {
  t = clamp(tt, 0, field.steps.length - 1);
  syncTimeUI();
  updateReadout();
  requestRender();
}
function buildTicks() {
  const el = $('ticks');
  el.innerHTML = '';                         // empty it; the spans below are DOM nodes
  const s = field.steps, last = s.length - 1;
  if (last < 1) return;
  let prevDay = null;
  let placed = -Infinity;                       // per cent along, of the last label drawn
  let partDay = false;                          // …and whether that label was the first
  // Three letters want about thirty points of track, which is a fifth of it on
  // a phone and a twentieth on a tablet, so the gap is measured rather than
  // guessed at.
  const room = Math.min(22, 3200 / Math.max(120, el.clientWidth));
  s.forEach((st, k) => {
    const d = new Date(st.valid);
    const day = d.toDateString();
    if (day === prevDay) return;
    prevDay = day;
    const at = k / last * 100;
    if (k > 0 && at > 94) return;               // no room for a label at the very end
    if (at - placed < room) {
      // Too close to read. The first label is whatever was left of the day the
      // run started in — an hour of it, if the run was late in the evening — so
      // it gives way to the first whole day; any other pair just waits, and the
      // next day along gets the label.
      if (!partDay) return;
      el.lastChild.remove();
    }
    const span = document.createElement('span');
    span.style.left = `${at.toFixed(2)}%`;
    span.textContent = fmtDay.format(d);
    placed = at;
    partDay = k === 0;
    el.append(span);
  });
}

function hoursAt(tt) {
  const s = field.steps, last = s.length - 1;
  const k0 = clamp(Math.floor(tt), 0, last), k1 = Math.min(k0 + 1, last);
  return s[k0].hours + (s[k1].hours - s[k0].hours) * clamp(tt - k0, 0, 1);
}
function indexAtHours(h) {
  const s = field.steps, last = s.length - 1;
  if (h <= s[0].hours) return 0;
  if (h >= s[last].hours) return last;
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].hours <= h) lo = mid; else hi = mid;
  }
  return lo + (h - s[lo].hours) / (s[hi].hours - s[lo].hours);
}

let lastFrame = 0;
function tick(now) {
  if (!playing) return;
  const elapsed = lastFrame ? now - lastFrame : 0;
  lastFrame = now;
  const s = field.steps;
  let h = hoursAt(t) + (elapsed / 1000) * PLAY_HOURS_PER_SEC;
  if (h >= s[s.length - 1].hours) h = s[0].hours;   // loop
  t = indexAtHours(h);
  syncTimeUI();
  updateReadout();
  render();
  requestAnimationFrame(tick);
}
function setPlaying(on) {
  if (!field) on = false;
  playing = on;
  $('ico-play').hidden = on;
  $('ico-pause').hidden = !on;
  $('btn-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  if (on) { lastFrame = 0; requestAnimationFrame(tick); }
  else setTime(Math.round(t));
}

/* ── layers and tabs ─────────────────────────────────────────────────────── */

function setLayer(key) {
  if (!field || !field.byKey.has(key)) return;
  layerKey = key;
  try { localStorage.setItem(STORE.layer, key); } catch { /* fine */ }
  for (const [n, button] of [...$('layerchips').children].entries()) {
    button.setAttribute('aria-pressed', String(field.layers[n].key === key));
  }
  updateLegend();
  updateReadout();
  requestRender();
}

function setTab(next) {
  if (next === tab) return;
  // Carry the middle of the world across, so the globe opens looking at
  // whatever the map was looking at, and the other way round.
  const centre = V().centre();
  tab = next;
  try { localStorage.setItem(STORE.tab, tab); } catch { /* fine */ }
  $('tab-map').setAttribute('aria-selected', String(tab === 'map'));
  $('tab-globe').setAttribute('aria-selected', String(tab === 'globe'));
  wrap.setAttribute('aria-labelledby', tab === 'map' ? 'tab-map' : 'tab-globe');
  V().fit();
  V().adopt(centre);
  V().save();
  requestRender();
}

/* ── loading ─────────────────────────────────────────────────────────────── */

async function loadSnapshot() {
  let data;
  try {
    const r = await fetch('./data/snapshot.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`data/snapshot.json could not be read (HTTP ${r.status})`);
    const text = await r.text();
    try { data = JSON.parse(text); } catch {
      const html = text.trim().startsWith('<');
      throw new Error('data/snapshot.json is not valid JSON'
        + (html ? ' — it looks like a web page was written over it' : ''));
    }
    const why = validate(data);
    if (why) throw new Error(`data/snapshot.json is not a Global Weather snapshot: ${why}`);
  } catch (e) {
    setProblem('snapshot', e.message);
    updateStamp();
    return;
  }
  setProblem('snapshot', null);
  if (snap && snap.generatedAt === data.generatedAt && snap.run === data.run) {
    updateStamp();
    return;
  }
  const gen = ++loadGeneration;
  const fresh = new WeatherField(data);
  data.steps = null;                            // the field holds the planes now
  const stamp = $('stamp');
  stamp.textContent = `Unpacking ${fresh.steps.length} steps…`;
  try {
    await fresh.load((done, total) => {
      if (gen === loadGeneration) stamp.textContent = `Unpacking ${done} of ${total} steps…`;
    });
  } catch (e) {
    if (gen !== loadGeneration) return;
    setProblem('snapshot', `data/snapshot.json is not a Global Weather snapshot: ${e.message}`);
    updateStamp();
    return;
  }
  if (gen !== loadGeneration) return;           // a newer load overtook this one
  const keepValid = field ? currentValidMs() : null;
  const wasPlaying = playing;
  playing = false;
  snap = data;
  field = fresh;
  if (!field.byKey.has(layerKey)) layerKey = field.layers[0].key;
  buildLuts();
  buildChips();
  slider.max = String(field.steps.length - 1);
  buildTicks();
  setTime(nearestStep(keepValid ?? Date.now()));
  setLayer(layerKey);
  updateStamp();
  updateCredits();
  if (wasPlaying) setPlaying(true);
}

async function loadStatic() {
  try {
    const r = await fetch('./assets/world.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const w = await r.json();
    if (!Array.isArray(w.land) || !Array.isArray(w.borders)) throw new Error('unexpected shape');
    world = w;
    worldPaths = buildWorldPaths(w);
    setProblem('world', null);
  } catch (e) {
    setProblem('world', `Coastlines could not be loaded (assets/world.json: ${e.message}) — the weather still shows.`);
  }
  try {
    const r = await fetch('./assets/places.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const p = await r.json();
    places = Array.isArray(p)
      ? p.filter((x) => x && typeof x.n === 'string' && Number.isFinite(x.lon) && Number.isFinite(x.lat))
          .map((x) => ({ n: x.n, lon: x.lon, lat: x.lat, r: Number.isFinite(x.r) ? x.r : 4 }))
          .sort((a, b) => a.r - b.r)
      : [];
  } catch { places = []; }
  requestRender();
}

/* ── gestures ────────────────────────────────────────────────────────────── */

const pointers = new Map();
let gesture = null;
let rect = null;

function startGesture() {
  const pts = [...pointers.values()];
  if (pts.length === 1) {
    gesture = { type: 'pan', x: pts[0].x, y: pts[0].y, sx: pts[0].x, sy: pts[0].y,
                moved: gesture ? gesture.moved : false, t0: performance.now() };
  } else if (pts.length >= 2) {
    const [a, b] = pts;
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), moved: true,
                mx: (a.x + b.x) / 2 - rect.left, my: (a.y + b.y) / 2 - rect.top };
    V().pinchStart(gesture);
  }
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  rect = canvas.getBoundingClientRect();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  startGesture();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.type === 'pan' && pointers.size === 1) {
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    gesture.x = e.clientX; gesture.y = e.clientY;
    if (Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 6) gesture.moved = true;
    V().panBy(dx, dy);
    requestRender();
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    gesture.mx = (a.x + b.x) / 2 - rect.left;
    gesture.my = (a.y + b.y) / 2 - rect.top;
    V().pinchMove(gesture, Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, gesture.d0));
    requestRender();
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const wasTap = gesture && gesture.type === 'pan' && !gesture.moved
                 && pointers.size === 1 && performance.now() - gesture.t0 < 400 && e.type === 'pointerup';
  pointers.delete(e.pointerId);
  if (pointers.size > 0) { startGesture(); return; }
  if (wasTap) onTap(e.clientX - rect.left, e.clientY - rect.top);
  gesture = null;
  V().save();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
for (const ev of ['gesturestart', 'gesturechange']) {
  wrap.addEventListener(ev, (e) => e.preventDefault());     // no page zoom on iOS
}

function zoomAt(sx, sy, factor) {
  V().zoomBy(factor, sx, sy);
  V().save();
  requestRender();
}

let lastTap = null, tapTimer = null;
function onTap(sx, sy) {
  const now = performance.now();
  if (lastTap && now - lastTap.t < 320 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 24) {
    clearTimeout(tapTimer); tapTimer = null; lastTap = null;
    zoomAt(sx, sy, 2);
    return;
  }
  lastTap = { x: sx, y: sy, t: now };
  tapTimer = setTimeout(() => {
    tapTimer = null;
    const p = V().unproject(sx, sy);
    marker = p ? { lon: Math.round(p[0] * 100) / 100, lat: Math.round(p[1] * 100) / 100 } : null;
    try { localStorage.setItem(STORE.marker, JSON.stringify(marker)); } catch { /* fine */ }
    updateReadout();
    requestRender();
  }, 330);
}

/* ── controls ────────────────────────────────────────────────────────────── */

$('tab-map').addEventListener('click', () => setTab('map'));
$('tab-globe').addEventListener('click', () => setTab('globe'));
$('zoom-in').addEventListener('click', () => zoomAt(W / 2, H / 2, 2));
$('zoom-out').addEventListener('click', () => zoomAt(W / 2, H / 2, 0.5));
$('zoom-home').addEventListener('click', () => { V().home(); V().save(); requestRender(); });
$('btn-arrows').addEventListener('click', () => {
  arrows = !arrows;
  $('btn-arrows').setAttribute('aria-pressed', String(arrows));
  try { localStorage.setItem(STORE.arrows, arrows ? '1' : '0'); } catch { /* fine */ }
  requestRender();
});
$('btn-night').addEventListener('click', () => {
  night = !night;
  $('btn-night').setAttribute('aria-pressed', String(night));
  try { localStorage.setItem(STORE.night, night ? '1' : '0'); } catch { /* fine */ }
  requestRender();
});
$('btn-units').addEventListener('click', () => {
  const layer = activeLayer();
  if (!layer || layer.units.length < 2) return;
  const at = layer.units.findIndex((u) => u.id === unitChoice[layer.key]);
  unitChoice[layer.key] = layer.units[(at + 1) % layer.units.length].id;
  try { localStorage.setItem(STORE.units, JSON.stringify(unitChoice)); } catch { /* fine */ }
  updateLegend();
  updateReadout();
});
$('stamp').addEventListener('click', showAbout);
$('about-close').addEventListener('click', () => { $('about').hidden = true; });
$('about').addEventListener('click', (e) => { if (e.target === $('about')) $('about').hidden = true; });
$('readout-close').addEventListener('click', () => {
  marker = null;
  try { localStorage.removeItem(STORE.marker); } catch { /* fine */ }
  updateReadout();
  requestRender();
});
$('btn-play').addEventListener('click', () => setPlaying(!playing));
$('btn-prev').addEventListener('click', () => { if (field) { setPlaying(false); setTime(Math.round(t) - 1); } });
$('btn-next').addEventListener('click', () => { if (field) { setPlaying(false); setTime(Math.round(t) + 1); } });
slider.addEventListener('input', () => { if (field) { if (playing) setPlaying(false); setTime(Number(slider.value)); } });

/* Live means re-render in place. Reads are fresh from disk, so this one
 * listener is what makes an app opened this morning show this morning's
 * numbers — and Snuggery fires the same event when a Shortcut delivers new
 * data while the app is open. The view, the marker, the units and the position
 * in the forecast all survive, because loadSnapshot() replaces the field
 * rather than rebuilding the page. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadSnapshot();
});

/* ── boot ────────────────────────────────────────────────────────────────── */

function resize() {
  const r = wrap.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  gcache = null;
  pathCache = null;
  MAP_VIEW.fit();
  GLOBE_VIEW.fit();
  syncGlobe();
  render();
}

try {
  const stored = JSON.parse(localStorage.getItem(STORE.units) || '{}');
  if (stored && typeof stored === 'object') unitChoice = stored;
  const savedLayer = localStorage.getItem(STORE.layer);
  if (typeof savedLayer === 'string' && savedLayer) layerKey = savedLayer;
  if (localStorage.getItem(STORE.tab) === 'globe') tab = 'globe';
  arrows = localStorage.getItem(STORE.arrows) !== '0';
  night = localStorage.getItem(STORE.night) !== '0';
  const m = JSON.parse(localStorage.getItem(STORE.marker) || 'null');
  if (m && Number.isFinite(m.lon) && Number.isFinite(m.lat)) marker = m;
} catch { /* fine */ }
MAP_VIEW.restore();
GLOBE_VIEW.restore();
$('btn-arrows').setAttribute('aria-pressed', String(arrows));
$('btn-night').setAttribute('aria-pressed', String(night));
$('tab-map').setAttribute('aria-selected', String(tab === 'map'));
$('tab-globe').setAttribute('aria-selected', String(tab === 'globe'));
wrap.setAttribute('aria-labelledby', tab === 'map' ? 'tab-map' : 'tab-globe');
updateCredits();
new ResizeObserver(resize).observe(wrap);
resize();
loadStatic();
loadSnapshot();

/* For a browser console and for tests, never for the app itself. */
window.__weather = {
  render() { const t0 = performance.now(); render(); return performance.now() - t0; },
  get state() {
    return { t, playing, tab, layer: layerKey, units: { ...unitChoice }, arrows, night, marker,
             map: { ...map }, globe: { ...globe },
             steps: field ? field.steps.length : 0,
             layers: field ? field.layers.map((l) => l.key) : [],
             schema: snap ? snap.schema : null };
  },
  setTab, setLayer,
  sample(key, lon, lat) { return field ? field.sample(key, t, lon, lat, [0, 0]) : null; },
  setTime(tt) { if (field) setTime(tt); },
  unzlib,
};
