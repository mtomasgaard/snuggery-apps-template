// Stage 2: the export network, as a flat 2D map — never the 3D camera. UTM 32 is stretched a
// thousand kilometres from its meridian, so this panel carries its own lon/lat copy of the data
// and draws it in Web Mercator. Lengths are measured along the real route, not off this map.
//
// Loaded on demand by topside.js the first time the row is switched on; if the file is missing,
// createNetwork returns null and the row switches itself back off. Nothing in stage 1 imports it.

const TAU = Math.PI * 2;
const merc = (lon, lat) => [lon, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI];

// ---------------------------------------------------------------- the pipeline's file, adapted
// pipeline/build_topside.py writes the publisher's own vocabulary — pipelines[] with parts[],
// terminals[], nodes[], norneRoutePath — and this panel draws lines[] and points[]. The whole
// translation lives here, in one function, so the shipped data file stays the pipeline's byte for
// byte and no wording is invented anywhere else. Facts that the file states are copied verbatim;
// the only strings composed here are the pipeline attribute rows, and each names its source field.
const num = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : null);

function pipelineFacts(p) {
  const f = {};
  if (p.medium) f.Medium = p.medium;
  if (p.dimension) f.Dimension = p.dimension + '″';
  if (p.from || p.to) f.Route = (p.from || '—') + ' → ' + (p.to || '—');
  if (num(p.lengthKm)) f.Length = num(p.lengthKm) + ' km, measured along the published route';
  if (p.system) f.System = p.system;
  if (p.operator) f.Operator = p.operator;
  if (p.phase) f.Status = p.phase;
  return f;
}

function normalise(D) {
  if (Array.isArray(D.lines) && Array.isArray(D.points)) return D;  // already the panel's own shape
  if (!Array.isArray(D.pipelines) || !Array.isArray(D.terminals)) return null;

  const routeIds = new Set(D.norneRoute || []);
  const lines = [];
  for (const p of D.pipelines) {
    if (routeIds.has(p.id)) continue;               // drawn once, from norneRoutePath, highlighted
    const parts = p.parts || [];
    parts.forEach((pts, i) => {
      if (!Array.isArray(pts) || pts.length < 2) return;
      lines.push({
        id: parts.length > 1 ? p.id + '#' + i : p.id,
        name: p.name, kind: 'trunk', km: p.lengthKm, from: p.from, to: p.to,
        pts, facts: pipelineFacts(p),
      });
    });
  }
  const rp = D.norneRoutePath;
  const route = [];
  if (rp && Array.isArray(rp.points) && rp.points.length > 1) {
    const segs = (rp.segments || []).map((s) => s.name + ' (' + num(s.lengthKm) + ' km)').join('; ');
    const facts = { Route: 'Norne riser base → Norne/Heidrun tee → Kalstø landfall' };
    if (num(rp.lengthKm)) facts.Length = num(rp.lengthKm) + ' km, measured along the published route';
    if (segs) facts.Segments = segs;
    if (D.routeNote) facts.Note = D.routeNote;
    lines.push({ id: 'norne-route', name: 'Norne’s gas route', kind: 'norne', km: rp.lengthKm, pts: rp.points, facts });
    route.push('norne-route');
  }

  const points = [];
  for (const n of D.nodes || []) {
    const kind = /\/HEIDRUN T$/.test(n.name) ? 'tee' : n.name === 'NORNE FPSO' ? 'origin' : 'offshore';
    points.push({ id: n.id, name: n.name, kind, lon: n.lon, lat: n.lat, facts: n.facts || {} });
  }
  for (const t of D.terminals) {
    const kind = t.refinery ? 'refinery' : t.name === 'KALSTØ' ? 'landfall' : 'terminal';
    // No fact is composed here. The file's own Note already says the true thing — that no line is
    // drawn *from Norne* to a refinery — and a stronger claim would be false: the Directorate
    // publishes real pipelines into Mongstad from other fields, and this panel draws them.
    points.push({ id: t.id, name: t.name, kind, lon: t.lon, lat: t.lat, facts: t.facts || {} });
  }

  const fpso = (D.nodes || []).find((n) => n.name === 'NORNE FPSO');
  const oil = D.oilExport || null;
  let oilLeg = null;
  if (oil && fpso) {
    const facts = {};
    if (oil.note) facts['What is drawn'] = oil.note;
    const e = oil.eurostat || {};
    for (const k of ['gas', 'oil']) {
      const b = e[k];
      if (!b) continue;
      const top = (b.top || []).map((t) => t.country + ' ' + t.value.toLocaleString('en-GB')).join(', ');
      facts[b.product + ' from Norway to the EU-27, ' + b.year] =
        b.eu27.toLocaleString('en-GB') + ' ' + b.unit + (top ? ' — ' + top : '');
    }
    if (D.sources && D.sources.trade) facts.Source = D.sources.trade;
    oilLeg = { fromId: fpso.id, bearingDeg: 288, lengthDeg: 3.4, label: oil.label, facts };
  }

  return {
    ...D,
    note: (D.crs && D.crs.note) || D.note || '',
    coast: D.coast || [], lines, points, route, oilLeg,
  };
}

export async function createNetwork(ctx) {
  let D;
  try {
    const r = await fetch('data/topside-network.json', { cache: 'no-store' });
    if (!r.ok) return null;
    D = normalise(await r.json());
    if (!D || D.schemaVersion !== 1 || D.kind !== 'norne-topside-network') return null;
  } catch { return null; }

  const root = document.getElementById('net');
  if (!root) return null;
  root.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'nethead';
  const h = document.createElement('h2'); h.textContent = 'Where the gas goes';
  const close = document.createElement('button');
  close.className = 'icon'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close the export network map');
  head.append(h, close);
  const key = document.createElement('div');
  key.className = 'netkey';
  key.innerHTML = '<span><i style="--c:var(--accent)"></i>Norne’s gas route</span>'
    + '<span><i style="--c:var(--muted)"></i>other trunk lines</span>'
    + '<span><i class="dot" style="--c:var(--ink)"></i>terminal</span>'
    + '<span><i class="dot ring" style="--c:var(--c-oil)"></i>refinery, not connected to Norne</span>';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Map of the gas route from Norne to the Kalstø landfall and on to Emden, '
    + 'with the other Norwegian trunk lines, the onshore terminals and the coastline. Drag to pan, pinch or scroll to zoom.');
  const foot = document.createElement('div');
  foot.className = 'netfoot';
  foot.textContent = D.note + ' Tap a line or a place for its facts.';
  const card = document.createElement('div');
  card.className = 'netcard'; card.hidden = true;
  root.append(head, key, canvas, foot, card);

  const state = { open: false, scale: 1, ox: 0, oy: 0, sel: null, anim: 0 };
  const pts = [];
  for (const L of D.lines) for (const p of L.pts) pts.push(merc(p[0], p[1]));
  for (const p of D.points) pts.push(merc(p.lon, p.lat));
  const bx0 = Math.min(...pts.map((p) => p[0])), bx1 = Math.max(...pts.map((p) => p[0]));
  const by0 = Math.min(...pts.map((p) => p[1])), by1 = Math.max(...pts.map((p) => p[1]));
  const routeIds = new Set(D.route || []);
  const NAMED_KINDS = new Set(['origin', 'tee', 'landfall', 'refinery']);
  const endNames = new Set();
  for (const L of D.lines) { if (L.from) endNames.add(String(L.from).toUpperCase()); if (L.to) endNames.add(String(L.to).toUpperCase()); }
  // a named place beats an unlabelled neighbour a few pixels away, which is what a finger means
  const isBig = (p) => NAMED_KINDS.has(p.kind) || endNames.has(p.name.toUpperCase());
  // Label priority. The route's own end points come first: at a small canvas Mongstad's dot is a
  // couple of pixels from the line, and if a refinery wins the collision the picture reads as
  // "Norne's gas goes to Mongstad" — which the data does not say and NLOD §6 forbids drawing.
  const RANK = { origin: 0, landfall: 1, tee: 2, refinery: 3 };
  const ordered = [...D.points].sort((a, b) => (RANK[a.kind] ?? (isBig(a) ? 4 : 5)) - (RANK[b.kind] ?? (isBig(b) ? 4 : 5)));
  const origin = D.points.find((p) => p.id === (D.oilLeg && D.oilLeg.fromId)) || D.points[0];

  let W = 1, H = 1, dpr = 1, fit = { k: 1, x: 0, y: 0 };
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const pad = 22;
    const k = Math.min((W - pad * 2) / (bx1 - bx0), (H - pad * 2) / (by1 - by0));
    fit = { k, x: (W - (bx1 - bx0) * k) / 2 - bx0 * k, y: (H - (by1 - by0) * k) / 2 + by1 * k };
  }
  const toScreen = (lon, lat) => {
    const m = merc(lon, lat);
    return [(m[0] * fit.k + fit.x) * state.scale + state.ox, (fit.y - m[1] * fit.k) * state.scale + state.oy];
  };
  // One palette read per frame. These are getComputedStyle(document.documentElement) calls and they
  // used to sit inside the per-point and per-label loops, which is about a thousand of them a frame.
  const PAL = { rule: '', muted: '', accent: '', ink: '', oil: '', gas: '', glass: '', face: '' };
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, f) => (cs.getPropertyValue(n).trim() || f);
    PAL.rule = v('--rule', '#C9D2D5'); PAL.muted = v('--muted', '#5A6A73');
    PAL.accent = v('--accent', '#A8740F'); PAL.ink = v('--ink', '#15222A');
    PAL.oil = v('--c-oil', '#2E8B4E'); PAL.gas = v('--c-gas', '#C8423A');
    PAL.glass = v('--glass', 'rgba(255,255,255,0.8)'); PAL.face = v('--face-narrow', 'system-ui');
  }
  // The only animated thing on this map is the gas export route, so a fluid that is not gas — water,
  // water injected, oil — must leave it still.
  const gasFlowing = () => { const f = ctx.flow && ctx.flow(); return !!(f && f.on && f.fluids && f.fluids.includes('gas')); };

  function draw() {
    const g = canvas.getContext('2d');
    readPalette();
    placed.length = 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineJoin = 'round'; g.lineCap = 'round';

    g.strokeStyle = PAL.rule; g.lineWidth = 1;
    for (const c of D.coast) {
      g.beginPath();
      c.forEach((p, i) => { const s = toScreen(p[0], p[1]); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); });
      g.stroke();
    }
    const muted = PAL.muted, accent = PAL.accent, ink = PAL.ink;
    for (const pass of [0, 1]) {
      for (const L of D.lines) {
        const isRoute = routeIds.has(L.id);
        if ((pass === 1) !== isRoute) continue;
        g.strokeStyle = isRoute ? accent : muted;
        g.lineWidth = isRoute ? 2.6 : 1.2;
        g.globalAlpha = isRoute ? 1 : 0.55;
        g.setLineDash([]);
        g.beginPath();
        L.pts.forEach((p, i) => { const s = toScreen(p[0], p[1]); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); });
        g.stroke();
        if (isRoute && gasFlowing()) {                       // the same marks as the field view
          g.strokeStyle = PAL.gas;
          g.lineWidth = 3.2; g.globalAlpha = 0.95;
          g.setLineDash([7, 27]);
          g.lineDashOffset = -state.anim;
          g.stroke();
          g.setLineDash([]);
        }
        g.globalAlpha = 1;
      }
    }
    // places, in label priority: the route's own ends and the refineries must not lose their name
    // to an unlabelled neighbour a few pixels away (Mongstad sits 20 km from Sture).
    for (const p of ordered) {
      const s = toScreen(p.lon, p.lat);
      if (s[0] < -40 || s[0] > W + 40 || s[1] < -40 || s[1] > H + 40) continue;
      const big = isBig(p);
      const refinery = p.kind === 'refinery';
      const col = refinery ? PAL.oil : p.kind === 'origin' ? accent : ink;
      const rad = state.sel === p.id ? 5.5 : big ? 3.6 : 2.2;
      g.globalAlpha = big ? 1 : 0.5;
      if (refinery) {
        // Hollow, with a short leader out to its name. A filled dot a few pixels from the route
        // reads as the route's destination, and no published route connects Norne to a refinery.
        g.strokeStyle = col; g.lineWidth = 1.6;
        g.beginPath(); g.arc(s[0], s[1], rad + 1.2, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(s[0] + rad + 3, s[1]); g.lineTo(s[0] + 10, s[1]); g.stroke();
      } else {
        g.fillStyle = col;
        g.beginPath(); g.arc(s[0], s[1], rad, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      if (big || state.sel === p.id) label(g, p.name, s[0] + (refinery ? 12 : 7), s[1] + 4, col, 'left', state.sel === p.id);
    }
    // the oil leg: a dashed arrow that ends in a label, and in nothing else
    if (origin && D.oilLeg) {
      const a = toScreen(origin.lon, origin.lat);
      const th = (D.oilLeg.bearingDeg || 250) * Math.PI / 180;
      const len = (D.oilLeg.lengthDeg || 3) * fit.k * state.scale;
      const b = [a[0] + Math.sin(th) * len, a[1] - Math.cos(th) * len];
      g.strokeStyle = PAL.oil; g.lineWidth = 2; g.setLineDash([6, 5]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.setLineDash([]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.beginPath();
      g.moveTo(b[0], b[1]);
      g.lineTo(b[0] - Math.cos(ang - 0.4) * 11, b[1] - Math.sin(ang - 0.4) * 11);
      g.lineTo(b[0] - Math.cos(ang + 0.4) * 11, b[1] - Math.sin(ang + 0.4) * 11);
      g.closePath(); g.fillStyle = PAL.oil; g.fill();
      // The label runs away from the arrow's tail, so a long string never lies across the vessel
      // it came from (the FPSO's own label sits a few pixels to the right of the same point).
      const lx = b[0] + Math.cos(ang) * 6, ly = b[1] + Math.sin(ang) * 6 + 16;
      label(g, D.oilLeg.label, lx, ly, PAL.oil, b[0] < a[0] ? 'right' : 'left', true);
    }
  }
  const placed = [];
  function label(g, text, x, y, col, align, force) {
    g.font = '600 11px ' + PAL.face;
    const w = g.measureText(text).width;
    const bx = align === 'centre' ? x - w / 2 - 4 : align === 'right' ? x - w - 5 : x - 3;
    const box = { x: bx, y: y - 12, w: w + 8, h: 16 };
    if (!force && placed.some((r) => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y)) return false;
    placed.push(box);
    g.fillStyle = PAL.glass;
    g.fillRect(box.x, box.y + 1, box.w, box.h - 1);
    g.fillStyle = col;
    g.fillText(text, bx + 4, y);
    return true;
  }

  function showCard(item, facts, title) {
    card.innerHTML = '';
    const h3 = document.createElement('h3'); h3.textContent = title;
    const dl = document.createElement('dl');
    for (const k in facts) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = facts[k];
      dl.append(dt, dd);
    }
    const x = document.createElement('button');
    x.className = 'icon'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Close');
    x.style.cssText = 'position:absolute;right:4px;top:2px';
    x.addEventListener('click', () => { card.hidden = true; state.sel = null; draw(); });
    card.style.position = 'absolute';
    card.append(x, h3, dl);
    card.hidden = false;
  }
  function pick(x, y) {
    let best = null, bd = 16;
    for (const p of D.points) {
      const s = toScreen(p.lon, p.lat);
      const d = Math.hypot(s[0] - x, s[1] - y) - (isBig(p) ? 5 : 0);
      if (d < bd) { bd = d; best = { id: p.id, title: p.name, facts: p.facts }; }
    }
    if (!best) {
      bd = 12;
      for (const L of D.lines) {
        for (let i = 0; i + 1 < L.pts.length; i++) {
          const a = toScreen(L.pts[i][0], L.pts[i][1]), b = toScreen(L.pts[i + 1][0], L.pts[i + 1][1]);
          const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
          const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
          const d = Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
          if (d < bd) { bd = d; best = { id: L.id, title: L.name, facts: L.facts }; }
        }
      }
    }
    if (!best && origin && D.oilLeg) {
      const a = toScreen(origin.lon, origin.lat);
      const th = (D.oilLeg.bearingDeg || 250) * Math.PI / 180;
      const len = (D.oilLeg.lengthDeg || 3) * fit.k * state.scale;
      const b = [a[0] + Math.sin(th) * len, a[1] - Math.cos(th) * len];
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
      if (Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)) < 14) best = { id: 'oil-leg', title: D.oilLeg.label, facts: D.oilLeg.facts };
    }
    if (!best) { card.hidden = true; state.sel = null; draw(); return null; }
    state.sel = best.id;
    showCard(best.id, best.facts, best.title);
    draw();
    return best.id;
  }

  // pointer: drag to pan, wheel or pinch to zoom
  const ptrs = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (ptrs.size === 1) drag = { x: e.offsetX, y: e.offsetY, moved: false };
    if (ptrs.size === 2) { pinch = pinchOf(); if (drag) drag.moved = true; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (ptrs.size === 1 && drag) {
      if (Math.hypot(e.offsetX - drag.x, e.offsetY - drag.y) > 5) drag.moved = true;
      if (!drag.moved) return;
      state.ox += e.offsetX - prev[0]; state.oy += e.offsetY - prev[1];
      draw();
    } else if (ptrs.size === 2 && pinch) {
      const now = pinchOf();
      zoomAt(now.x, now.y, now.d / Math.max(1, pinch.d));
      state.ox += now.x - pinch.x; state.oy += now.y - pinch.y;
      pinch = now; draw();
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0 && drag) { if (!drag.moved) pick(drag.x, drag.y); drag = null; }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); draw(); }, { passive: false });
  function pinchOf() {
    const [a, b] = [...ptrs.values()];
    return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
  }
  function zoomAt(x, y, f) {
    const k = Math.max(0.8, Math.min(14, state.scale * f)) / state.scale;
    state.ox = x - (x - state.ox) * k; state.oy = y - (y - state.oy) * k;
    state.scale *= k;
  }

  const onKey = (e) => { if (e.key === 'Escape' && state.open) ctx.onClose(); };
  close.addEventListener('click', () => ctx.onClose());
  document.addEventListener('keydown', onKey);
  new ResizeObserver(() => { if (state.open) { layout(); draw(); } }).observe(canvas);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.open) draw(); });

  let raf = 0, tDrew = 0;
  const NET_FPS = 30;                    // the same cap topside.js puts on the 3D flow
  function tick(now) {
    raf = 0;
    if (!state.open) return;
    const flowing = gasFlowing() && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && document.visibilityState === 'visible';
    if (!flowing) return;
    if (now - tDrew >= 1000 / NET_FPS - 1) { tDrew = now; state.anim = (now / 22) % 1000; draw(); }
    raf = requestAnimationFrame(tick);
  }

  return {
    open() {
      root.hidden = false;
      state.open = true;
      layout(); draw();
      if (!raf) raf = requestAnimationFrame(tick);
    },
    close() {
      root.hidden = true; state.open = false; card.hidden = true; state.sel = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    kick() { if (!state.open) return; draw(); if (!raf) raf = requestAnimationFrame(tick); },
    pick,
    // where a named place sits on screen, so a test can tap it where a finger would
    screenOf(id) {
      const p = D.points.find((x) => x.id === id || x.name.toUpperCase() === String(id).toUpperCase());
      if (!p) return null;
      const s = toScreen(p.lon, p.lat);
      const r = canvas.getBoundingClientRect();
      return [Math.round(r.left + s[0]), Math.round(r.top + s[1]), p.name];
    },
    // the panel's own projection, so a test can ask how far apart two things are *as drawn*
    project(lon, lat) {
      const s = toScreen(lon, lat);
      const r = canvas.getBoundingClientRect();
      return [r.left + s[0], r.top + s[1]];
    },
    state() {
      return {
        open: state.open, scale: +state.scale.toFixed(3), selected: state.sel,
        coastLines: D.coast.length, lines: D.lines.map((l) => ({ id: l.id, km: l.km, pts: l.pts.length, route: routeIds.has(l.id) })),
        points: D.points.length, refineries: D.points.filter((p) => p.kind === 'refinery').map((p) => p.name),
        fixture: !!D.fixture,
      };
    },
  };
}
