// WebGL2 (DESIGN §5.1–5.5): two contexts. #relief draws the four R8 relief textures as a shading overlay;
// #gl draws every earthquake from one columnar buffer in one call, the window, floor, fade, trace,
// corridor and arrivals all uniforms. Both share one loss and restore path. The relief keeps only the
// JPEG bytes: each is decoded to an ImageBitmap, uploaded and closed, and decoded again after a context
// loss, so about 85 MB of decoded pixels are never held alongside the textures (DESIGN §5.5).

import { POINT_VS, POINT_FS, RELIEF_VS, RELIEF_FS } from './shaders.js';
import { LABS, DEPTHS } from './ramp.js';
import { wx, wy } from './data.js';

const OPTS = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };

function program(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function context(canvas, init, onLost, onRestored) {
  const gl = canvas.getContext('webgl2', OPTS);
  if (!gl) return null;
  const C = { gl, canvas, lost: false, r: null };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); C.lost = true; C.r = null; onLost(); });
  canvas.addEventListener('webglcontextrestored', () => { C.lost = false; C.r = init(gl); onRestored(); });
  C.r = init(gl);
  C.lose = () => { const x = gl.getExtension('WEBGL_lose_context'); if (x) { x.loseContext(); setTimeout(() => x.restoreContext(), 400); } return !!x; };
  return C;
}
function viewport(K, w, h, dpr) {
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (K.canvas.width !== W || K.canvas.height !== H) { K.canvas.width = W; K.canvas.height = H; K.canvas.style.width = w + 'px'; K.canvas.style.height = h + 'px'; }
  K.gl.viewport(0, 0, W, H);
  K.gl.clearColor(0, 0, 0, 0); K.gl.clear(K.gl.COLOR_BUFFER_BIT);
}

export function createGL(reliefCanvas, pointCanvas, onLost, onRestored) {
  const G = { data: null, relief: null, maxPt: 64, stats: { draws: 0 } };

  // the earthquakes
  let histUp = 0;
  const initPoints = (gl) => {
    const prog = program(gl, POINT_VS, POINT_FS);
    G.maxPt = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
    histUp = 0;
    const r = { prog, vao: gl.createVertexArray(), buf: gl.createBuffer(), ibuf: gl.createBuffer(), cap: 0, n: 0 };
    if (G.data) upload(gl, r, G.data.C, G.data.I);
    return r;
  };
  function upload(gl, r, C, I) {
    const need = C.n;
    if (need > r.cap) {
      r.cap = Math.max(need, C.nh + 60000, Math.ceil(r.cap * 1.5));
      gl.bindBuffer(gl.ARRAY_BUFFER, r.buf);
      gl.bufferData(gl.ARRAY_BUFFER, r.cap * 12, gl.STATIC_DRAW);
      histUp = 0;
      gl.bindVertexArray(r.vao);
      const cols = [[4, gl.UNSIGNED_INT, 1], [2, gl.UNSIGNED_SHORT, 0], [2, gl.UNSIGNED_SHORT, 0], [2, gl.UNSIGNED_SHORT, 0], [1, gl.UNSIGNED_BYTE, 1], [1, gl.UNSIGNED_BYTE, 1]];
      let off = 0;
      cols.forEach(([size, type, int], loc) => {
        gl.enableVertexAttribArray(loc);
        if (int) gl.vertexAttribIPointer(loc, 1, type, 0, off); else gl.vertexAttribPointer(loc, 1, type, false, 0, off);
        off += size * r.cap;
      });
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ibuf);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, r.buf);
    const H = C.H.cols, keys = ['t', 'x', 'y', 'd', 'm', 'f'], w = [4, 2, 2, 2, 1, 1];
    let off = 0;
    keys.forEach((k, j) => {
      if (histUp !== C.nh) gl.bufferSubData(gl.ARRAY_BUFFER, off, H[k]);
      if (C.n > C.nh) gl.bufferSubData(gl.ARRAY_BUFFER, off + C.nh * w[j], C[k].subarray(C.nh));
      off += w[j] * r.cap;
    });
    histUp = C.nh;
    gl.bindVertexArray(r.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I.order, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    r.n = C.n;
  }
  G.points = context(pointCanvas, initPoints, () => onLost('points'), () => onRestored('points'));
  if (!G.points) return null;
  G.setData = (C, I) => { G.data = { C, I }; const K = G.points; if (K.r && !K.lost) upload(K.gl, K.r, C, I); };

  G.drawPoints = (w, h, dpr, U) => {
    const K = G.points;
    if (!K || K.lost || !K.r) return false;
    const gl = K.gl, r = K.r, u = r.prog.u;
    viewport(K, w, h, dpr);
    if (!r.n) return true;
    gl.useProgram(r.prog.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1ui(u.uT0, U.t0); gl.uniform1ui(u.uT1, U.t1); gl.uniform1ui(u.uTrace0, U.trace0);
    gl.uniform1ui(u.uMmin, U.floor); gl.uniform1ui(u.uLive, U.live); gl.uniform1ui(u.uNewFrom, U.newFrom);
    gl.uniform1i(u.uNoMag, U.noMag ? 1 : 0); gl.uniform1i(u.uFade, U.fade); gl.uniform1i(u.uSecOn, U.sec ? 1 : 0);
    gl.uniform2f(u.uCenter, U.cx, U.cy); gl.uniform2f(u.uCanvas, w, h);
    gl.uniform1f(u.uScale, U.s); gl.uniform1f(u.uDpr, dpr); gl.uniform1f(u.uK, U.k); gl.uniform1f(u.uMaxPt, G.maxPt);
    gl.uniform1f(u.uNewT, U.newT); gl.uniform1f(u.uNewSpan, U.newSpan || 1);
    gl.uniform3fv(u.uLab, LABS.flat()); gl.uniform1fv(u.uDep, DEPTHS); gl.uniform3fv(u.uInk, U.ink);
    if (U.sec) {
      gl.uniform3fv(u.uSecA, U.sec.a); gl.uniform3fv(u.uSecN, U.sec.n);
      gl.uniform1f(u.uSecHalf, U.sec.half); gl.uniform1f(u.uSecLen, U.sec.len);
    }
    gl.bindVertexArray(r.vao);
    gl.drawElements(gl.POINTS, r.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    G.stats.draws++;
    G.last = { ...U, n: r.n };
    return true;
  };

  // the relief
  const initRelief = (gl) => {
    const r = { prog: program(gl, RELIEF_VS, RELIEF_FS), quads: [] };
    if (G.relief) setTimeout(() => uploadRelief().then(() => onRestored('relief')), 0);
    return r;
  };
  const decode = async (q) => {
    try { return await createImageBitmap(q.blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); } catch {
      const img = new Image(); img.src = `assets/${q.meta.file}`; await img.decode(); return img;
    }
  };
  let upGen = 0;
  async function uploadRelief() {
    const K = G.reliefCtx, gen = ++upGen, quads = [];
    if (!K) return;
    for (const q of G.relief) {
      const src = await decode(q);
      if (K.lost || !K.r || gen !== upGen) { if (src.close) src.close(); return; }
      quads.push(reliefQuad(K.gl, src, q.meta));
      if (src.close) src.close();
    }
    K.r.quads = quads;
  }
  function reliefQuad(gl, img, meta) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, meta.width, meta.height, 0, gl.RED, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const X0 = wx(meta.west), X1 = wx(meta.east), Y0 = wy(meta.north), Y1 = wy(meta.south);
    const vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([X0, Y0, 0, 0, X1, Y0, 1, 0, X0, Y1, 0, 1, X1, Y1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    // the CONUS tile holds 3DEP's land in Canada and Mexico too: fade its edges over 0.5° so it ends softly
    const edge = meta.key === 'conus' ? [0.5 / (meta.east - meta.west), 0.5 / (meta.north - meta.south)] : [0, 0];
    return { tex, vao, n: meta.neutral / 255, edge };
  }
  G.reliefCtx = context(reliefCanvas, initRelief, () => onLost('relief'), () => onRestored('relief'));
  G.setRelief = (list) => { G.relief = list; return uploadRelief(); };
  G.drawRelief = (w, h, dpr, U) => {
    const K = G.reliefCtx;
    if (!K || K.lost || !K.r) return false;
    const gl = K.gl, r = K.r, u = r.prog.u;
    viewport(K, w, h, dpr);
    if (!U.on) return true;
    gl.useProgram(r.prog.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uCenter, U.cx, U.cy); gl.uniform2f(u.uCanvas, w, h); gl.uniform1f(u.uScale, U.s);
    gl.uniform1f(u.uDark, U.dark); gl.uniform1f(u.uLight, U.light); gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const q of r.quads) {
      gl.bindTexture(gl.TEXTURE_2D, q.tex); gl.uniform1f(u.uN, q.n); gl.uniform2f(u.uEdge, q.edge[0], q.edge[1]);
      gl.bindVertexArray(q.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
    return true;
  };
  G.live = () => !G.points.lost && (!G.reliefCtx || !G.reliefCtx.lost);
  return G;
}
