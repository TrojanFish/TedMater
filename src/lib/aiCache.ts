/**
 * LRU cache for AI responses (word definitions and sentence analyses).
 *
 * These are deterministic — the same input always produces the same output —
 * so we can cache them indefinitely up to the eviction limit.
 *
 * Capacity: 500 entries (each is a few KB of JSON)
 * TTL: 24 hours
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SIZE = 500;

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
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= MAX_SIZE) {
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }
}

export const aiCache = new LRUCache<unknown>();

/** Build a stable cache key for a `define` request. */
export function defineKey(text: string, context: string): string {
  // Use first 80 chars of context — enough to distinguish usage but avoids
  // near-identical sentences producing separate cache entries.
  return `define::${text.toLowerCase().trim()}::${context.slice(0, 80)}`;
}

/** Build a stable cache key for an `analyze` request. */
export function analyzeKey(text: string): string {
  return `analyze::${text.trim()}`;
}
