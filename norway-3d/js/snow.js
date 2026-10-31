// Snow from seNorge: NVE's and MET Norway's modeled snow depth for the day, on a 1 km grid, drawn
// by NVE's WMS as a picture in its legend's eight colors (kart.nve.no, the fifth approved host).
// The app reads each picture back through a canvas and turns every color into its class, then the
// class into how white the ground is drawn: bare ground none, under 25 cm a thin cover, and from
// 50 cm the full white. NOTES.md: Snow. It is a model, not an observation.

import { tileBox } from './geo.js';
import { HOSTS } from './sources.js';

export const SNOW_HOST = HOSTS.snow;
export const SNOW_MAX_Z = 9;            // 1 km cells: z 9 is 290 m a pixel at 61.5° N, enough
// The legend of layer sd (seNorgeGridLegend/sd.png), read on 2026-10-16: the color of each class.
export const SNOW_CLASSES = [
  { rgb: [204, 245, 122], words: 'Bare ground', cm: [0, 0], amount: 0 },
  { rgb: [217, 255, 255], words: 'Under 25', cm: [0, 25], amount: 0.5 },
  { rgb: [179, 255, 255], words: '25 to 50', cm: [25, 50], amount: 0.78 },
  { rgb: [128, 235, 255], words: '50 to 100', cm: [50, 100], amount: 0.95 },
  { rgb: [64, 204, 255], words: '100 to 150', cm: [100, 150], amount: 1 },
  { rgb: [0, 153, 255], words: '150 to 200', cm: [150, 200], amount: 1 },
  { rgb: [0, 25, 255], words: '200 to 400', cm: [200, 400], amount: 1 },
  { rgb: [0, 0, 153], words: 'Over 400', cm: [400, Infinity], amount: 1 },
];

const bbox = (z, x, y) => { const b = tileBox(z, x, y); return [b.x0, b.y0, b.x1, b.y1].map((v) => v.toFixed(2)).join(','); };
export const snowUrl = (date, z, x, y) => `https://${SNOW_HOST}/enterprise/services/seNorgeGrid_png/ImageServer/WMSServer?service=WMS&version=1.3.0&request=GetMap&layers=sd&styles=&crs=EPSG:3857&bbox=${bbox(z, x, y)}&width=256&height=256&format=image/png&transparent=true&time=${date}`;

let canvas = null;
/** A loaded picture to { amount: Uint8Array (0..255 white), cls: Uint8Array (255 = no data) }. */
export function decodeSnow(img) {
  const n = 256;
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = n; canvas.height = n; }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, n, n);
  ctx.drawImage(img, 0, 0, n, n);
  const px = ctx.getImageData(0, 0, n, n).data;
  const amount = new Uint8Array(n * n), cls = new Uint8Array(n * n);
  let covered = 0;
  for (let i = 0; i < n * n; i++) {
    const p = i * 4;
    if (px[p + 3] < 128) { cls[i] = 255; continue; }
    let best = 0, bd = Infinity;
    for (let k = 0; k < SNOW_CLASSES.length; k++) {
      const c = SNOW_CLASSES[k].rgb, d = (px[p] - c[0]) ** 2 + (px[p + 1] - c[1]) ** 2 + (px[p + 2] - c[2]) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    cls[i] = best;
    amount[i] = Math.round(SNOW_CLASSES[best].amount * 255);
    if (best) covered++;
  }
  return { amount, cls, covered };
}
