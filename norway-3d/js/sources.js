// Where every picture comes from: the five hosts in miniapp.json's network.resourceHosts, and the
// one address each kind of tile is asked for (the snow's is in js/snow.js, with its legend). HOSTS
// is the one list of hosts: tools/check.mjs holds it equal to miniapp.json's. Nothing here is fetched: each address becomes an
// <img> with crossOrigin = 'anonymous' (js/loader.js), which is all an online app may load, and the
// height tiles are read back through a canvas (js/hcore.js). NOTES.md says what each source is.

import { tileBox } from './geo.js';

export const HOSTS = {
  map: 'cache.kartverket.no',
  trails: 'wms.geonorge.no',
  dtm: 'hoydedata.no',
  terrarium: 'elevation-tiles-prod.s3.amazonaws.com',
  snow: 'kart.nve.no',
};

/** Kartverket's topographic map, three styles of one WMTS cache, 256 px tiles to z 18. */
export const MAP_STYLES = {
  topo: { layer: 'topo', name: 'Topographic', note: "Kartverket's map, as printed" },
  gray: { layer: 'topograatone', name: 'Gray', note: 'the same map in gray, which leaves the light to the sun' },
  raster: { layer: 'toporaster', name: 'Classic', note: 'the older N50 raster style' },
};
export const MAP_MAX_Z = 17;
export const mapUrl = (style, z, x, y) => `https://${HOSTS.map}/v1/wmts/1.0.0/${MAP_STYLES[style].layer}/default/webmercator/${z}/${y}/${x}.png`;

// Plain decimal for a bbox, never exponent notation: Besseggen's NOTES.md has the story of a
// northing in %g form that moved the box four meters.
const bboxOf = (z, x, y) => { const b = tileBox(z, x, y); return [b.x0, b.y0, b.x1, b.y1].map((v) => v.toFixed(2)).join(','); };

/** Turrutebasen's foot routes, drawn by Kartverket's WMS: every foot route in its pink, then the
 *  graded ones over it in their own colors (easy green, medium blue, demanding red, expert black).
 *  The service draws nothing above 1:1 000 000, so from z 10. */
export const TRAIL_MIN_Z = 10;
export const TRAIL_LAYERS = 'Fotrute,Enkel_fotrute,Middels_fotrute,Krevende_fotrute,Ekspert_fotrute';
export const trailUrl = (z, x, y) => `https://${HOSTS.trails}/skwms1/wms.friluftsruter2?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${TRAIL_LAYERS}&STYLES=&CRS=EPSG:3857&BBOX=${bboxOf(z, x, y)}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE`;

/** The far field: Mapzen's Terrarium tiles on AWS, 256 px, h = R*256 + G + B/256 - 32768. Over
 *  Norway the source is Kartverket's 10 m model (the tiles' x-amz-meta-x-imagery-sources header). */
export const TERRARIUM_MAX_Z = 12;
export const terrariumUrl = (z, x, y) => `https://${HOSTS.terrarium}/terrarium/${z}/${x}/${y}.png`;

/** The near field: Kartverket's 1 m terrain model (DTM1) from the hoydedata ImageServer, packed
 *  into an ordinary PNG by a raster function, 512 px over a Web Mercator tile from z 12 to 15
 *  (z 15 is 1.14 m a pixel at 61.5° N). The service ROUNDS a value to a byte and WRAPS it (mod 256),
 *  measured on 2026-10-16, so the height goes out at three scales, with v = 10 h + 1000 decimeters:
 *    R = round(v / 256), G = round(v / 16) mod 256, B = round(v) mod 256
 *  js/hcore.js puts v back together exactly from the three (NOTES.md: The heights). Over the sea
 *  the model reads 0 m; outside its coverage the pixel is the transparent color 253, 253, 253. */
export const DTM_MIN_Z = 12, DTM_MAX_Z = 15, DTM_PX = 512;
const v = { rasterFunction: 'BandArithmetic', rasterFunctionArguments: { Method: 0, BandIndexes: 'B1*10+1000' }, outputPixelType: 'F32' };
const band = (raster, expr) => ({ rasterFunction: 'BandArithmetic', rasterFunctionArguments: { Method: 0, BandIndexes: expr, ...(raster ? { Raster: raster } : {}) }, outputPixelType: 'U8' });
const RULE = encodeURIComponent(JSON.stringify({
  rasterFunction: 'CompositeBand',
  rasterFunctionArguments: { Rasters: [band(v, 'B1/256'), band(v, 'B1/16'), band(null, 'B1*10+1000')] },
  outputPixelType: 'U8',
}));
export const dtmUrl = (z, x, y) => `https://${HOSTS.dtm}/arcgis/rest/services/NHM_DTM_25833/ImageServer/exportImage?bbox=${bboxOf(z, x, y)}&bboxSR=3857&imageSR=3857&size=${DTM_PX},${DTM_PX}&format=png&renderingRule=${RULE}&f=image`;
