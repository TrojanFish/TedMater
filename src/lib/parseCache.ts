/**
 * Simple in-process LRU cache for parsed TED page results.
 * TTL: 1 hour | Capacity: 100 entries (~50-200 KB each)
 */

const TTL_MS = 60 * 60 * 1000;
const MAX_SIZE = 100;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /** Return the cached value even if expired — used as stale fallback on upstream errors. */
  getStale(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= MAX_SIZE) {
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

export const parseCache = new LRUCache<unknown>();
