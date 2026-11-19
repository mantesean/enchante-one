/**
 * In-memory rate limit and result cache. PER INSTANCE ONLY: on serverless platforms each
 * instance has its own memory, so limits are approximate and the cache is not shared.
 */

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const CACHE_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 1000;

const hits = new Map<string, number[]>();

/** Sliding-window limiter. Returns true when the request is allowed. */
export function rateLimit(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.delete(key); // re-insert to keep Map order ≈ LRU
  hits.set(key, recent);
  if (hits.size > MAX_ENTRIES) hits.delete(hits.keys().next().value!);
  return true;
}

export class TtlCache<T> {
  private store = new Map<string, { expires: number; value: T }>();
  constructor(private ttlMs: number = CACHE_TTL_MS) {}

  get(key: string, now = Date.now()): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expires <= now) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    this.store.delete(key);
    this.store.set(key, { expires: now + this.ttlMs, value });
    if (this.store.size > MAX_ENTRIES) this.store.delete(this.store.keys().next().value!);
  }
}

export function resetLimitsForTests(): void {
  hits.clear();
}
