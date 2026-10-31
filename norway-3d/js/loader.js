// Every tile arrives here, as an <img> with crossOrigin = 'anonymous' (the only way an online app
// may take a picture from an approved host, and the only way its pixels can be read back). The
// loader is a priority queue with caps, because a 3D view wants hundreds of tiles and a phone on a
// mobile network should never have more than a handful in flight:
//
//   at most MAX_TOTAL requests in flight, and at most PER_HOST to one host (NOTES.md: Budgets);
//   every frame states what it still wants (want()); anything queued and no longer wanted is
//   dropped before it is sent, so a fast pan never leaves a backlog of tiles for places already
//   left behind; the most wanted (the lowest priority number) goes first;
//   a failed tile is retried twice, after 2 s and 8 s, then left alone for the session;
//   a request that has not answered in TIMEOUT_MS is given up and counts as a failure, so a hung
//   connection can never hold one of the six lanes for good;
//   a tile wanted only AHEAD of the view (a priority of AHEAD_PRIO or more, js/terrain.js) goes after
//   every tile in view and may take at most MAX_TOTAL - VIEW_LANES lanes, so two are always free
//   for the view the moment it wants something.

export const MAX_TOTAL = 6;
export const VIEW_LANES = 2;
const AHEAD_PRIO = 100;
const PER_HOST = { 'hoydedata.no': 4 };      // the slow, dynamic one: leave two lanes for the map
const DEFAULT_PER_HOST = 6;
export const TIMEOUT_MS = 25000;

export class Loader {
  constructor(onAnyLoad) {
    this.items = new Map();       // key -> item
    this.gen = 0;
    this.inflight = 0;
    this.aheadInflight = 0;
    this.byHost = new Map();
    this.onAnyLoad = onAnyLoad;
    this.timer = 0;
    this.stats = { started: 0, loaded: 0, failed: 0, dropped: 0, retried: 0, byHost: {}, peakInflight: 0, firstAt: 0, ms: [], prefetchStarted: 0, peakPrefetch: 0 };
  }
  /** Begin a frame's statement of what it wants. */
  frame() { this.gen++; }
  /** Want `key` (from `url` on `host`) this frame; `prio` lower is sooner. Returns the item. */
  want(key, url, host, prio, done) {
    let it = this.items.get(key);
    if (!it) {
      it = { key, url, host, prio, done, state: 'queued', tries: 0, until: 0, gen: this.gen, img: null };
      this.items.set(key, it);
    } else {
      // the first statement of a frame sets the priority, later ones in the same frame can only raise it
      if (it.state === 'queued') { it.prio = it.gen === this.gen ? Math.min(prio, it.prio) : prio; it.done = done; }
      it.gen = this.gen;
    }
    return it;
  }
  state(key) { const it = this.items.get(key); return it ? it.state : null; }
  /** Send what fits under the caps, most wanted first; drop what nobody wanted this frame. */
  pump() {
    const now = performance.now();
    const q = [];
    let wake = Infinity;
    for (const it of this.items.values()) {
      if (it.state !== 'queued') continue;
      if (it.gen !== this.gen) { this.items.delete(it.key); this.stats.dropped++; continue; }
      if (it.until > now) { wake = Math.min(wake, it.until); continue; }
      q.push(it);
    }
    // a retry waiting out its pause gets a frame when the pause is over, even if nothing else moves
    if (wake < Infinity && !this.timer && this.onAnyLoad) this.timer = setTimeout(() => { this.timer = 0; this.onAnyLoad(null, false); }, wake - now + 5);
    if (!q.length || this.inflight >= MAX_TOTAL) return this.inflight;
    q.sort((a, b) => a.prio - b.prio);
    for (const it of q) {
      if (this.inflight >= MAX_TOTAL) break;
      if (it.prio >= AHEAD_PRIO && this.inflight >= MAX_TOTAL - VIEW_LANES) break;
      const h = this.byHost.get(it.host) || 0;
      if (h >= (PER_HOST[it.host] || DEFAULT_PER_HOST)) continue;
      this._start(it);
    }
    return this.inflight;
  }
  get pending() {
    let n = 0;
    for (const it of this.items.values()) if (it.state === 'queued' || it.state === 'loading') n++;
    return n;
  }
  /** The tiles still to come for the view itself (not those asked for ahead of it). */
  get pendingView() {
    let n = 0;
    for (const it of this.items.values()) if ((it.state === 'queued' || it.state === 'loading') && it.prio < AHEAD_PRIO) n++;
    return n;
  }
  _start(it) {
    it.state = 'loading';
    it.ahead = it.prio >= AHEAD_PRIO;
    this.inflight++;
    if (it.ahead) { this.aheadInflight++; this.stats.prefetchStarted++; this.stats.peakPrefetch = Math.max(this.stats.peakPrefetch, this.aheadInflight); }
    this.stats.peakInflight = Math.max(this.stats.peakInflight, this.inflight);
    this.byHost.set(it.host, (this.byHost.get(it.host) || 0) + 1);
    this.stats.started++;
    const hs = this.stats.byHost[it.host] || (this.stats.byHost[it.host] = { started: 0, loaded: 0, failed: 0, ms: 0 });
    hs.started++;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const t0 = performance.now();
    let over = false;
    const timer = setTimeout(() => { if (over) return; this.stats.timedOut = (this.stats.timedOut || 0) + 1; img.onload = img.onerror = null; img.src = ''; finish(false); }, TIMEOUT_MS);
    const finish = (ok) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      this.inflight--;
      if (it.ahead) this.aheadInflight--;
      this.byHost.set(it.host, this.byHost.get(it.host) - 1);
      const ms = performance.now() - t0;
      if (ok) {
        it.state = 'done'; it.img = null;
        this.stats.loaded++; hs.loaded++; hs.ms += ms;
        if (!this.stats.firstAt) this.stats.firstAt = performance.now();
        if (this.stats.ms.length < 4000) this.stats.ms.push(Math.round(ms));
        try { it.done(img, null); } catch (e) { console.error(e); }
      } else if (++it.tries < 3) {
        it.state = 'queued'; it.until = performance.now() + (it.tries === 1 ? 2000 : 8000);
        this.stats.retried++;
      } else {
        it.state = 'failed'; this.stats.failed++; hs.failed++;
        try { it.done(null, 'failed'); } catch (e) { console.error(e); }
      }
      if (this.onAnyLoad) this.onAnyLoad(it, ok);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = it.url;
  }
  /** Forget a finished tile, so that it is fetched again the next time it is wanted. */
  forget(key) { const it = this.items.get(key); if (it && (it.state === 'done' || it.state === 'failed')) this.items.delete(key); }
}
