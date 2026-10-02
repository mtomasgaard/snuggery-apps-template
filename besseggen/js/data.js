import { int, unit } from './units.js';

// Loading. Six terrain binaries, one manifest, five GeoJSON layers and five editable JSON files.
//
// The binaries and the manifest are fetched once. The editable files are re-fetched whenever the
// page regains focus, so an edit made inside Snuggery shows up without a reload. Every editable
// file has a built-in fallback: a broken one produces a sentence on the plate, never a dead app.

// The files a person is expected to edit, and the only ones re-read on focus.
//
// There is deliberately no boat timetable file. The MS Gjende times change every season and have
// no open source with a license and a date, so the pipeline ships none and `about.json` carries a
// sentence instead. Fetching a file that is not meant to exist would log a 404 on every launch,
// so this list does not name one. The one sentence the app does say about the boat comes from
// about.json and is shown in the About panel, with no times and no link.
export const EDITABLE = ['waypoints', 'viewpoints', 'pace', 'colors', 'about'];

export const FALLBACK = {
  waypoints: { waypoints: [] },
  viewpoints: { viewpoints: [] },
  pace: {
    model: 'tobler',
    models: {
      tobler: { baseKmh: 6.0, note: '6*exp(-3.5*abs(slope+0.05)), Tobler 1993' },
      naismith: {
        flatKmh: 4.8, ascentMPerHour: 600,
        langmuir: { gentleDescentBonusMPerHour: 1800, steepDescentPenaltyMPerHour: 1800 },
      },
    },
    fitnessFactor: 1.0, restMinutesPerHour: 0,
  },
  colors: {
    light: {
      sky: '#dfe7ef', terrain: '#cfc6b4', terrainLow: '#9db183', water: '#9fb9cf',
      glacier: '#e8eef2', route: '#c0392b', routeAlt: '#2c3e50', marker: '#111418',
      contour20: '#00000018', contour100: '#00000038', slope30: '#e67e22', slope40: '#8e1f4f',
      sunlit: '#fffaf0', shadow: '#5a6b80', viewshed: '#3fa7a0',
    },
    dark: {
      sky: '#0d1218', terrain: '#565043', terrainLow: '#3c4a33', water: '#2d4257',
      glacier: '#7f8f9b', route: '#e8705f', routeAlt: '#9fb2c6', marker: '#f2f4f7',
      contour20: '#ffffff14', contour100: '#ffffff2e', slope30: '#d98a3a', slope40: '#b64770',
      sunlit: '#e9e3d4', shadow: '#1b2531', viewshed: '#4fd0c6',
    },
    elevationBands: [
      { toM: 1000, color: '#4a6b3f' }, { toM: 1400, color: '#908862' },
      { toM: 1800, color: '#b3a99a' }, { toM: 2400, color: '#f2f2f4' },
    ],
  },
  about: { notNavigation: 'This is a planning tool. It has no position fix and no live weather.' },
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

// A notice says what is wrong in the file's terms and does not apologize (HOUSE.md section 4.9).
async function getJSON(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try { return await res.json(); } catch { throw new Error('not valid JSON'); }
}

async function getBuffer(path, onBytes) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} could not be read (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  if (onBytes) onBytes(buf.byteLength);
  return buf;
}

export class DataSet {
  constructor() {
    this.manifest = null;
    this.levelBuffers = [];      // ArrayBuffer per level index
    this.geo = {};               // route, places, water, glaciers, rivers
    this.edit = {};              // the editable files, with fallbacks applied
    this.notices = [];           // human-readable "couldn't read data/x.json" lines
    this.bytes = 0;
  }

  note(msg) { if (!this.notices.includes(msg)) this.notices.push(msg); }

  async load(progress = () => {}) {
    try { this.manifest = await getJSON('data/manifest.json'); } catch (e) { throw new Error(`data/manifest.json could not be read (${e.message}).`); }
    const m = this.manifest;
    if (m.format !== 'besseggen-terrain/1') {
      this.note(`data/manifest.json says its format is "${m.format}"; it is read as besseggen-terrain/1.`);
    }

    // Terrain binaries, biggest first would be nicer for a progress bar but the level order is
    // what the manifest promises and keeping it makes the offsets trivially checkable.
    for (let i = 0; i < m.levels.length; i++) {
      const L = m.levels[i];
      progress(`Reading the terrain… ${i + 1} of ${m.levels.length}`);
      const buf = await getBuffer(`data/${L.file}`, (n) => { this.bytes += n; });
      if (buf.byteLength !== L.bytes) {
        this.note(`data/${L.file} is ${unit(int(buf.byteLength), 'bytes')}; the manifest says ${int(L.bytes)}.`);
      }
      this.levelBuffers[i] = buf;
    }

    progress('Reading the trail and the names…');
    const geoNames = ['route', 'places', 'water', 'glaciers', 'rivers'];
    await Promise.all(geoNames.map(async (name) => {
      try {
        this.geo[name] = await getJSON(`data/${name}.geojson`);
      } catch (err) {
        // rivers is explicitly optional in the data contract; the rest are not.
        if (name !== 'rivers') this.note(`data/${name}.geojson could not be read (${err.message}); that layer is missing.`);
        this.geo[name] = EMPTY_FC;
      }
    }));

    await this.refetchEditable(true);
    return this;
  }

  // Re-read only the files a person is expected to edit. cache: 'no-store' so Snuggery's own
  // edits are seen rather than a stale response.
  async refetchEditable(first = false) {
    const changed = [];
    await Promise.all(EDITABLE.map(async (name) => {
      let value;
      const head = `data/${name}.json `;
      this.notices = this.notices.filter((n) => !n.startsWith(head));
      try {
        value = await getJSON(`data/${name}.json`, { cache: 'no-store' });
        if (!value || typeof value !== 'object') throw new Error('not a JSON object');
      } catch (e) {
        // on a re-read, what was showing stays (HOUSE.md section 4.9)
        const kept = !first && this.edit[name];
        this.note(`${head}could not be read (${e.message}); ${kept ? 'the copy read before is kept' : "the app's own copy is used"}.`);
        value = kept || FALLBACK[name];
      }
      const before = this.edit[name] ? JSON.stringify(this.edit[name]) : null;
      const after = JSON.stringify(value);
      if (before !== after) changed.push(name);
      this.edit[name] = value;
    }));
    return first ? [] : changed;
  }
}

// Watch for the app coming back to the front. Snuggery keeps the web view alive, so this is the
// only moment an edit can be noticed without a reload.
export function onRegainFocus(fn) {
  let last = 0;
  const fire = () => {
    const now = Date.now();
    if (now - last < 400) return;      // focus and visibilitychange often arrive together
    last = now;
    fn();
  };
  window.addEventListener('focus', fire);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fire(); });
}
