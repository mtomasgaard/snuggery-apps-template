// Seeded randomness: every prop, grid order and AI roll comes from here, so a seed replays a race.

/** mulberry32: a small, fast 32-bit PRNG. Returns a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string to a 32-bit seed (FNV-1a). */
export function hashSeed(str) {
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export const range = (rnd, a, b) => a + (b - a) * rnd();

/** Seeded 2D value noise, `octaves` octaves, base period `period` meters. Returns roughly [0, 1]. */
export function valueNoise2D(seed, period = 120, octaves = 3) {
  const SIZE = 256, table = new Float32Array(SIZE * SIZE), rnd = mulberry32(seed);
  for (let i = 0; i < table.length; i++) table[i] = rnd();
  const at = (ix, iz) => table[((iz & 255) << 8) | (ix & 255)];
  const one = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = at(ix, iz), b = at(ix + 1, iz), c = at(ix, iz + 1), d = at(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
  return (x, z) => {
    let sum = 0, amp = 1, norm = 0, p = period;
    for (let o = 0; o < octaves; o++) { sum += amp * one(x / p + o * 17.3, z / p - o * 9.1); norm += amp; amp *= 0.5; p *= 0.5; }
    return sum / norm;
  };
}
