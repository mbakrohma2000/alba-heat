// random.js — a small seeded random number generator (mulberry32) plus the
// helpers the procedural city and actor placement use. One job: make every
// random choice in the game reproducible from a single seed, so shot scenes
// and playtests always build the same Puerto Alba.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}

// Turn a query-string seed ("1", "marina", ...) into a stable 32-bit integer.
export function seedFromString(text) {
  let h = 2166136261 >>> 0;
  const s = String(text == null ? '1' : text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
