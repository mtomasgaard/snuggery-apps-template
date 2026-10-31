// Where the map comes from: the one list of sites this app shows pictures from. Every host here is
// listed in miniapp.json under network.resourceHosts, and tools/check.mjs fails if the two differ.
// To make your own online app from this one, change the host and the address below, list the same
// host in miniapp.json, and credit the site in About the way its terms ask (NOTES.md says how).

export const HOSTS = {
  usgs: 'basemap.nationalmap.gov',
};

/** The two layers, keyed as the layer switch's keys are (index.html). Both are USGS The National Map's cached
 *  map services: 256 px tiles in Web Mercator, levels 0 to 16, the whole world to level 8 and the
 *  United States and its territories beyond it (measured 2026-10-19; NOTES.md). */
export const LAYERS = {
  map: { service: 'USGSTopo', name: 'Topographic map' },
  imagery: { service: 'USGSImageryTopo', name: 'Imagery with the topographic map over it' },
};
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 16;            // the services' last level (scale 1:9028)
export const WORLD_MAX_ZOOM = 8;       // beyond this the services draw only the United States

/** The address of one tile: the ArcGIS cache's tile/{level}/{row}/{column}. */
export function tileUrl(layer, z, x, y) {
  return `https://${HOSTS.usgs}/arcgis/rest/services/${LAYERS[layer].service}/MapServer/tile/${z}/${y}/${x}`;
}

/** Where the services have detail beyond level 8, as longitude and latitude boxes drawn a little
 *  wide: the 48 states, Alaska (both sides of the 180th meridian), Hawaii, Puerto Rico and the
 *  Virgin Islands, Guam and the Northern Marianas, American Samoa. A tile outside every box is not
 *  asked for beyond level 8; the level-8 picture is shown enlarged and the app says why. */
export const COVERAGE = [
  { name: 'the 48 states', w: -125.5, e: -66.5, s: 24.0, n: 49.6 },
  { name: 'Alaska', w: -180, e: -129.5, s: 51.0, n: 71.6 },
  { name: 'Alaska', w: 172.0, e: 180, s: 51.0, n: 53.2 },
  { name: 'Hawaii', w: -160.6, e: -154.6, s: 18.8, n: 22.4 },
  { name: 'Puerto Rico and the Virgin Islands', w: -67.6, e: -64.4, s: 17.6, n: 18.6 },
  { name: 'Guam and the Northern Mariana Islands', w: 144.5, e: 146.2, s: 13.1, n: 20.7 },
  { name: 'American Samoa', w: -171.2, e: -168.0, s: -14.7, n: -11.0 },
];
export function covered(w, s, e, n) {
  return COVERAGE.some((b) => w <= b.e && e >= b.w && s <= b.n && n >= b.s);
}

/** The view Hello Map opens on: Yosemite Valley, El Capitan to Half Dome, at level 13. */
export const HOME = { lon: -119.5936, lat: 37.7390, zoom: 13 };
/** The whole-country key: the 48 states. */
export const COUNTRY = { w: -125.0, e: -66.9, s: 24.4, n: 49.4 };
