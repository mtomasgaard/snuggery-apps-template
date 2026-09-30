// WebGL2: the program, textures, the cache of full maps, the blend, uniforms, draw, context loss
// (DESIGN §5). No library; Norne Reservoir's program() helper; the app decides when to draw.
//
// Slots (§5.5): A is the map being shown (or left), B the map arriving, uMix 0 → 1 over the blend.
// Each slot is { kind: 'full', stop, tex } or { kind: 'proxy', stop } (a cell of the proxy sheet).

import { VS, FS, FREEZE_FS } from './shader.js';
import { easeInOut } from './util.js';

const CACHE_MAX = 8;                  // §5.8: 8 full-map textures, least recently used out
const FROZEN_W = 1024, FROZEN_H = 512;

export function createEarth(canvas, opts) {
  const E = { supported: false, lost: false };
  let gl = null, loseExt = null;
  let prog = null, freezeProg = null, vao = null, fbo = null;
  let dummy = null, dummyR8 = null, proxyTex = null, climTex = null, lutTex = null;
  let frozen = [null, null], frozenNext = 0;
  const cache = new Map();            // stop → texture, in least-recently-used-first order
  let A = null, B = null, mix = 0, blendT0 = 0, blendMs = 0;
  let current = -1, previews = false, prefetch = [];
  let running = null, generation = 0;
  let proxyReady = false, proxyLoading = null;
  let climate = null;                 // { bytes: Uint8Array(7008), lut: Uint8Array(1024) } kept for a restore
  const stats = { decodes: 0, uploads: 0, dropped: 0, evicted: 0, freezes: 0, fallbackDecodes: 0, restores: 0 };

  gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return E;
  E.supported = true;
  loseExt = gl.getExtension('WEBGL_lose_context');

  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('shader link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  function tex2D(w, h, internal, format, type, data, filter, wrapS) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function setup() {
    prog = program(VS, FS);
    freezeProg = program(VS, FREEZE_FS);
    vao = gl.createVertexArray();
    fbo = gl.createFramebuffer();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    // Every sampler always has a complete texture bound, so no unit is ever "not renderable".
    dummy = tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 56, 76, 255]), gl.NEAREST, gl.CLAMP_TO_EDGE);
    dummyR8 = tex2D(1, 1, gl.R8, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]), gl.NEAREST, gl.CLAMP_TO_EDGE);
    frozen = [null, null];
    if (climate) E.setClimate(climate.bytes, climate.lut);
  }
  setup();

  /* ── loading full maps (§5.8): one load at a time, and the next one is always chosen afresh — the
     stop on screen first, then the prefetch list in its order (the maps ahead of a drag or of play,
     or a settled stop's neighbours). A load the view has left is dropped after its fetch (before any
     decode) or after its decode (before upload), so the map under the finger waits for at most one
     load and never for a queue of maps the drag has passed. During the opening only previews show. ── */
  const wanted = (stop) => stop === current || prefetch.includes(stop);
  function nextJob() {
    if (current >= 0 && !previews && !cache.has(current)) return current;
    for (const s of prefetch) if (!cache.has(s)) return s;
    return -1;
  }
  function pump() {
    if (running || E.lost) return;
    const stop = nextJob();
    if (stop < 0) return;
    load(stop);
  }
  async function decode(blob) {
    try {
      return { src: await createImageBitmap(blob, { imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }), done(s) { s.close(); } };
    } catch {
      stats.fallbackDecodes++;
      const url = URL.createObjectURL(blob), img = new Image();
      img.src = url;
      await img.decode();
      return { src: img, done() { URL.revokeObjectURL(url); } };
    }
  }
  async function load(stop) {
    const gen = generation;
    running = { stop };
    try {
      const res = await fetch(opts.mapPath(opts.manifest.slices[stop].file));
      if (!res.ok) throw new Error(`${opts.manifest.slices[stop].file}: HTTP ${res.status}`);
      const blob = await res.blob();
      if (gen !== generation || !wanted(stop)) { stats.dropped++; return; }
      const d = await decode(blob);
      stats.decodes++;
      if (gen !== generation || !wanted(stop) || E.lost) { d.done(d.src); stats.dropped++; return; }
      upload(stop, d.src);
      d.done(d.src);
      arrived(stop);
    } catch (e) {
      if (opts.onError) opts.onError(e);
    } finally {
      running = null;
      pump();
    }
  }
  function upload(stop, src) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    cache.set(stop, t);
    stats.uploads++;
    evict();
  }
  function evict() {
    for (const [stop, t] of cache) {
      if (cache.size <= CACHE_MAX) break;
      if ((A && A.tex === t) || (B && B.tex === t)) continue;
      gl.deleteTexture(t);
      cache.delete(stop);
      stats.evicted++;
    }
  }
  function touch(stop) { const t = cache.get(stop); cache.delete(stop); cache.set(stop, t); return t; }
  function arrived(stop) {
    if (stop !== current) return;
    // Under a moving finger the preview gives way at once (the same map, sharper; §5.7), else it fades.
    setTarget({ kind: 'full', stop, tex: touch(stop) }, opts.arriveMs());
    opts.onChange();
  }

  /* ── the proxy sheet (§5.7): uploaded once at startup ── */
  E.loadProxy = () => {
    if (proxyLoading) return proxyLoading;
    const gen = generation;
    proxyLoading = (async () => {
      const res = await fetch(opts.mapPath(opts.manifest.proxy.file));
      if (!res.ok) throw new Error(`${opts.manifest.proxy.file}: HTTP ${res.status}`);
      const d = await decode(await res.blob());
      if (gen !== generation || E.lost) { d.done(d.src); return; }
      proxyTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, proxyTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, d.src);
      d.done(d.src);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      proxyReady = true;
      if (!A && current >= 0) { A = slotFor(current); opts.onChange(); }
    })().finally(() => { proxyLoading = null; });
    return proxyLoading;
  };

  /* ── slots and the blend (§5.5) ── */
  function slotFor(stop) {
    if (cache.has(stop)) return { kind: 'full', stop, tex: touch(stop) };
    return proxyReady ? { kind: 'proxy', stop } : null;
  }
  const same = (a, b) => a && b && a.kind === b.kind && a.stop === b.stop && a.tex === b.tex;
  function setTarget(t, fade) {
    if (!t) return;
    const heading = B || A;
    if (same(heading, t)) return;
    if (!A || fade <= 0) { A = t; B = null; mix = 0; return; }
    if (B) freeze();
    B = t; mix = 0; blendT0 = performance.now(); blendMs = fade;
  }
  function freeze() {
    stats.freezes++;
    let t = frozen[frozenNext];
    if (!t) {
      t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 11, gl.RGBA8, FROZEN_W, FROZEN_H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      frozen[frozenNext] = t;
    }
    frozenNext ^= 1;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, FROZEN_W, FROZEN_H);
    gl.useProgram(freezeProg.p);
    bindSlots(freezeProg.u);
    gl.uniform1f(freezeProg.u.uMix, mix);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.generateMipmap(gl.TEXTURE_2D);
    A = { kind: 'full', stop: -1, tex: t };
    B = null; mix = 0;
  }
  function bindSlot(unit, s) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, s && s.kind === 'full' ? s.tex : dummy);
  }
  function bindSlots(u) {
    bindSlot(0, A); bindSlot(1, B);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, proxyTex || dummy);
    gl.uniform1i(u.uTexA, 0); gl.uniform1i(u.uTexB, 1); gl.uniform1i(u.uProxy, 2);
    const cell = (s) => (s && s.kind === 'proxy' ? [s.stop % 10, Math.floor(s.stop / 10)] : [-1, -1]);
    gl.uniform2fv(u.uCellA, cell(A)); gl.uniform2fv(u.uCellB, cell(B));
    gl.uniform1f(u.uHasA, A ? 1 : 0); gl.uniform1f(u.uHasB, B ? 1 : 0);
  }

  /**
   * Show a stop. fade: cross-fade ms (0 = at once). A stop whose full map is not cached shows its
   * preview cell at once, and its full map is loaded next (§5.7).
   */
  E.show = (stop, fade = 0) => {
    current = stop;
    if (E.lost) return;
    setTarget(slotFor(stop), fade);
    evict();
    pump();
  };
  /** The opening runs on the previews alone: no full map is loaded until it ends (§19). */
  E.setPreviews = (on) => { previews = on; if (!on) pump(); };
  /** The maps to load after the one on screen, in order: ahead of a drag or of play, or a settled stop's neighbours. */
  E.setPrefetch = (stops) => { prefetch = stops.filter((s) => s >= 0 && s < opts.manifest.count && s !== current); pump(); };
  /** Advance the blend; true while it still needs frames. */
  E.tick = (now) => {
    if (!B) return false;
    const k = blendMs > 0 ? Math.min(1, (now - blendT0) / blendMs) : 1;
    mix = easeInOut(k);
    if (k >= 1) { A = B; B = null; mix = 0; evict(); return false; }
    return true;
  };
  E.blending = () => !!B;
  E.ready = (stop) => cache.has(stop);
  E.showing = () => { const s = B || A; return s ? { kind: s.kind, stop: s.stop } : null; };

  /* ── the climate lens (§5.6): one slice-field as an R8 texture and its LUT (lut.js), set by app.js ── */
  E.setClimate = (bytes, lut) => {
    climate = bytes && lut ? { bytes, lut } : null;
    if (E.lost) return;
    if (climTex) { gl.deleteTexture(climTex); climTex = null; }
    if (lutTex) { gl.deleteTexture(lutTex); lutTex = null; }
    if (!climate) return;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    climTex = tex2D(96, 73, gl.R8, gl.RED, gl.UNSIGNED_BYTE, bytes, gl.LINEAR, gl.REPEAT);
    lutTex = tex2D(256, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, lut, gl.LINEAR, gl.CLAMP_TO_EDGE);
  };

  /* ── draw ── */
  let cssW = 1, cssH = 1;
  E.resize = (w, h, dpr) => {
    cssW = w; cssH = h;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  };
  /** p: { mode, cx, cy, scale (CSS px), lam0, phi0 (rad), panY, space, glow ([r,g,b] 0..1), lens, fade (0..1) } */
  E.draw = (p) => {
    if (E.lost) return;
    const k = canvas.width / cssW;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog.p);
    const u = prog.u;
    bindSlots(u);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, climTex || dummyR8);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, lutTex || dummy);
    gl.uniform1i(u.uClim, 3); gl.uniform1i(u.uLut, 4);
    gl.uniform1i(u.uLens, p.lens && climTex ? 1 : 0);
    gl.uniform2f(u.uCenter, p.cx * k, canvas.height - p.cy * k);
    gl.uniform1f(u.uScale, p.scale * k);
    gl.uniform1i(u.uMode, p.mode === 'map' ? 1 : 0);
    gl.uniform1f(u.uLam0, p.lam0); gl.uniform1f(u.uPhi0, p.phi0); gl.uniform1f(u.uPanY, p.panY);
    gl.uniform1f(u.uMix, B ? mix : 0);
    gl.uniform3fv(u.uSpace, p.space); gl.uniform3fv(u.uGlow, p.glow);
    gl.uniform1f(u.uFade, p.fade == null ? 1 : p.fade);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* ── context loss (§5.10) ── */
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    E.lost = true;
    generation++;
    cache.clear();                      // every GL object is gone with the context
    A = B = null; mix = 0;
    proxyTex = climTex = lutTex = null; proxyReady = false; proxyLoading = null;
    frozen = [null, null];
    if (opts.onLost) opts.onLost();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    E.lost = false;
    stats.restores++;
    setup();
    E.loadProxy().then(() => { if (current >= 0) E.show(current, 0); if (opts.onRestored) opts.onRestored(); }).catch((e) => opts.onError && opts.onError(e));
  });
  E.loseContext = () => { if (loseExt) loseExt.loseContext(); return !!loseExt; };
  E.restoreContext = () => { if (loseExt) loseExt.restoreContext(); return !!loseExt; };

  E.state = () => ({
    cached: [...cache.keys()], running: running ? running.stop : null, prefetch: [...prefetch],
    A: A && { kind: A.kind, stop: A.stop }, B: B && { kind: B.kind, stop: B.stop }, mix: +mix.toFixed(3),
    proxy: proxyReady, lost: E.lost, ...stats,
    gpuMiB: +((cache.size * 1024 * 512 * 4 * 4 / 3 + (proxyReady ? 2560 * 1152 * 4 : 0) + frozen.filter(Boolean).length * 1024 * 512 * 4 * 4 / 3) / 2 ** 20).toFixed(1),
  });
  return E;
}
