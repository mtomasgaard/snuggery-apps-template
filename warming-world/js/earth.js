// WebGL2 (DESIGN §5.2–§5.7): the context, the program, the R8 array texture of every frame (uploaded
// layer by layer as the decoder delivers them, never on the scrub path), the LUT, one draw, and
// context loss. No library. The app decides when to draw; this module never schedules anything.

import { VS, FS } from './shaders.js';

export function createEarth(canvas, { onLost, onRestored } = {}) {
  const E = { supported: false, lost: false, maxLayers: 0 };
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return E;
  E.supported = true;
  const loseExt = gl.getExtension('WEBGL_lose_context');
  let prog = null, vao = null, dataTex = null, lutTex = null, baseTex = null, climTex = null, absTex = null;
  let frames = null, L = 0, lut = null, base = new Int16Array(16200), clim = new Int16Array(16200 * 14), absLut = null;
  const stats = { uploads: 0, restores: 0, draws: 0 };

  function program() {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('shader link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function params(target) {
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function setup() {
    prog = program();
    vao = gl.createVertexArray();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    E.maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) || 256;
    if (lut) E.setLut(lut);
    E.setBase(base); E.setClim(clim); if (absLut) E.setAbsLut(absLut);
    if (frames) {
      // §5.7: one texImage3D of every layer from the CPU copy. Layers not yet decoded are zeros and
      // are never drawn, because a step is only shown once its layer is resident.
      allocate(frames);
    }
  }
  function allocate(data) {
    if (dataTex) gl.deleteTexture(dataTex);
    dataTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, dataTex);
    params(gl.TEXTURE_2D_ARRAY);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, 180, 90, L, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  }

  /** The CPU copy of every frame (L × 16 200 B) and the layer count; allocates the array texture. */
  E.setFrames = (cpu, layers) => {
    frames = cpu; L = layers;
    if (!E.lost) allocate(null);
  };
  /** Upload one decoded layer from the CPU copy (texSubImage3D, 16 200 B). */
  E.upload = (layer) => {
    if (E.lost || !dataTex) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, dataTex);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 180, 90, 1, gl.RED, gl.UNSIGNED_BYTE, frames.subarray(layer * 16200, (layer + 1) * 16200));
    stats.uploads++;
  };
  /** Replace every frame at once (a new snapshot, §12.3). */
  E.replaceFrames = (cpu, layers) => { frames = cpu; L = layers; if (!E.lost) allocate(frames); };
  E.setLut = (bytes) => {
    lut = bytes;
    if (E.lost) return;
    if (lutTex) gl.deleteTexture(lutTex);
    lutTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    params(gl.TEXTURE_2D);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  };

  /** Integer textures (plan 0012 3.3): R16I, nearest, uploaded whole on a change, never on a scrub. */
  function int16(unit, target, data, layers) {
    const t = gl.createTexture();
    gl.activeTexture(unit); gl.bindTexture(target, t); params(target);
    if (layers) gl.texImage3D(target, 0, gl.R16I, 180, 90, layers, 0, gl.RED_INTEGER, gl.SHORT, data);
    else gl.texImage2D(target, 0, gl.R16I, 180, 90, 0, gl.RED_INTEGER, gl.SHORT, data);
    return t;
  }
  /** The chosen baseline: each cell's mean in tenths, −32768 for none (all 0: GISS's own base). */
  E.setBase = (b) => { base = b; if (E.lost) return; if (baseTex) gl.deleteTexture(baseTex); baseTex = int16(gl.TEXTURE2, gl.TEXTURE_2D, b, 0); };
  /** The climatology's 14 planes in tenths. */
  E.setClim = (c) => { clim = c; if (E.lost) return; if (climTex) gl.deleteTexture(climTex); climTex = int16(gl.TEXTURE3, gl.TEXTURE_2D_ARRAY, c, 14); };
  E.setAbsLut = (bytes) => {
    absLut = bytes;
    if (E.lost) return;
    if (absTex) gl.deleteTexture(absTex);
    absTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, absTex); params(gl.TEXTURE_2D);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1024, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  };

  let cssW = 1;
  E.resize = (w, h, dpr) => {
    cssW = w;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  };
  /** u: the view's uniforms (proj.js, CSS px), layer, card [r, g, b] 0..255, m: { abs, baseOn, plane }. */
  E.draw = (u, layer, card, m = {}) => {
    if (E.lost || !dataTex || !lutTex || !baseTex || !climTex || !absTex) return false;
    const k = canvas.width / cssW;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog.p);
    const U = prog.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, dataTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, baseTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, climTex);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, absTex);
    gl.uniform1i(U.uData, 0); gl.uniform1i(U.uLut, 1); gl.uniform1i(U.uBase, 2); gl.uniform1i(U.uClim, 3); gl.uniform1i(U.uLutAbs, 4);
    gl.uniform1i(U.uAbs, m.abs ? 1 : 0); gl.uniform1i(U.uBaseOn, m.baseOn ? 1 : 0); gl.uniform1i(U.uClimLayer, m.plane || 0);
    gl.uniform1i(U.uProj, u.proj); gl.uniform1i(U.uLayer, layer);
    gl.uniform2f(U.uCenter, u.cx * k, canvas.height - u.cy * k);
    gl.uniform1f(U.uScale, u.scale * k);
    gl.uniform1f(U.uLam0, u.lam0); gl.uniform1f(U.uPhi0, u.phi0); gl.uniform1f(U.uPanY, u.panY);
    gl.uniform1f(U.uDpr, k);
    gl.uniform3f(U.uCard, card[0] / 255, card[1] / 255, card[2] / 255);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    stats.draws++;
    return true;
  };
  /** The drawn pixel at CSS (x, y), read in the same task as a draw (tests; preserveDrawingBuffer is off). */
  E.readPixel = (x, y) => {
    const k = canvas.width / cssW, out = new Uint8Array(4);
    gl.readPixels(Math.floor(x * k), canvas.height - 1 - Math.floor(y * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [out[0], out[1], out[2]];
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    E.lost = true;
    prog = vao = dataTex = lutTex = baseTex = climTex = absTex = null;   // every GL object is gone with the context
    if (onLost) onLost();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    E.lost = false;
    stats.restores++;
    setup();
    if (onRestored) onRestored();
  });
  E.loseContext = () => { if (loseExt) loseExt.loseContext(); return !!loseExt; };
  E.restoreContext = () => { if (loseExt) loseExt.restoreContext(); return !!loseExt; };
  E.stats = () => ({ ...stats, lost: E.lost, layers: L, maxLayers: E.maxLayers, gpuBytes: L * 16200 + 1024 + 32400 * 15 + 4096 });

  setup();
  return E;
}
