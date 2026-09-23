// Loading. Six terrain binaries, one manifest, five GeoJSON layers and five editable JSON files.
//
// The binaries and the manifest are fetched once. The editable files are re-fetched whenever the
// page regains focus, so an edit made inside Snuggery shows up without a reload. Every editable
// file has a built-in fallback: a broken one produces a one-line notice, never a dead app.

// The files a person is expected to edit, and the only ones re-read on focus.
//
// There is deliberately no boat timetable file. The MS Gjende times change every season and have
// no open source with a licence and a date, so the pipeline ships none and `about.json` carries a
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
      contour20: '#00000018', contour100: '#00000038', slope30: '#e67e22', slope40: '#c0392b',
      sunlit: '#fffaf0', shadow: '#5a6b80', viewshed: '#3fa7a0',
    },
    dark: {
      sky: '#0d1218', terrain: '#565043', terrainLow: '#3c4a33', water: '#2d4257',
      glacier: '#7f8f9b', route: '#e8705f', routeAlt: '#9fb2c6', marker: '#f2f4f7',
      contour20: '#ffffff14', contour100: '#ffffff2e', slope30: '#d98a3a', slope40: '#e06a54',
      sunlit: '#e9e3d4', shadow: '#1b2531', viewshed: '#4fd0c6',
    },
    elevationBands: [
      { toM: 1000, color: '#4a6b3f' }, { toM: 1400, color: '#8a8158' },
      { toM: 1800, color: '#9b9182' }, { toM: 2400, color: '#f2f2f4' },
    ],
  },
  about: { notNavigation: 'This is a planning tool. It has no position fix and no live weather.' },
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

async function getJSON(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function getBuffer(path, onBytes) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
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
    progress(0.02, 'Reading the manifest');
    this.manifest = await getJSON('data/manifest.json');
    const m = this.manifest;
    if (m.format !== 'besseggen-terrain/1') {
      this.note(`Unexpected terrain format "${m.format}" — reading it as besseggen-terrain/1.`);
    }

    // Terrain binaries, biggest first would be nicer for a progress bar but the level order is
    // what the manifest promises and keeping it makes the offsets trivially checkable.
    const total = m.levels.reduce((s, L) => s + L.bytes, 0);
    let done = 0;
    for (let i = 0; i < m.levels.length; i++) {
      const L = m.levels[i];
      progress(0.05 + 0.65 * (done / total), `Reading terrain at ${L.res} m`);
      const buf = await getBuffer(`data/${L.file}`, (n) => { this.bytes += n; });
      if (buf.byteLength !== L.bytes) {
        this.note(`data/${L.file} is ${buf.byteLength} bytes, the manifest says ${L.bytes}.`);
      }
      this.levelBuffers[i] = buf;
      done += L.bytes;
    }

    progress(0.75, 'Reading the trail and the names');
    const geoNames = ['route', 'places', 'water', 'glaciers', 'rivers'];
    await Promise.all(geoNames.map(async (name) => {
      try {
        this.geo[name] = await getJSON(`data/${name}.geojson`);
      } catch (err) {
        // rivers is explicitly optional in the data contract; the rest are not.
        if (name !== 'rivers') this.note(`Couldn't read data/${name}.geojson — that layer is missing.`);
        this.geo[name] = EMPTY_FC;
      }
    }));

    progress(0.9, 'Reading the editable files');
    await this.refetchEditable(true);
    progress(1, 'Ready');
    return this;
  }

  // Re-read only the files a person is expected to edit. cache: 'no-store' so Snuggery's own
  // edits are seen rather than a stale response.
  async refetchEditable(first = false) {
    const changed = [];
    await Promise.all(EDITABLE.map(async (name) => {
      let value;
      try {
        value = await getJSON(`data/${name}.json`, { cache: 'no-store' });
        if (!value || typeof value !== 'object') throw new Error('not an object');
        const i = this.notices.indexOf(`Couldn't read data/${name}.json — using built-in defaults.`);
        if (i >= 0) this.notices.splice(i, 1);
      } catch {
        this.note(`Couldn't read data/${name}.json — using built-in defaults.`);
        value = FALLBACK[name];
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
