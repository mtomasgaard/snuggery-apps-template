// The height decoder, off the main thread (the owner allowed workers for online apps on
// 2026-10-16). The main thread loads each height tile as a CORS <img> (the only way an online app
// may), turns it into an ImageBitmap and hands it over; this worker reads its pixels through an
// OffscreenCanvas, decodes them (js/hcore.js) and computes the normal map, and hands the arrays
// back, transferred, not copied. It fetches nothing.

import { decodeTile } from './hcore.js';

let canvas = null, ctx = null;
self.onmessage = (e) => {
  const { id, kind, z, y, bitmap } = e.data;
  try {
    const n = bitmap.width;
    if (!canvas || canvas.width !== n) {
      canvas = new OffscreenCanvas(n, n);
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    ctx.clearRect(0, 0, n, n);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const px = ctx.getImageData(0, 0, n, n).data;
    const t0 = performance.now();
    const r = decodeTile(kind, z, y, px, n);
    const ms = performance.now() - t0;
    const transfer = [r.h.buffer];
    if (r.nrm) transfer.push(r.nrm.buffer);
    self.postMessage({ id, ok: true, n, ms, ...r }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
