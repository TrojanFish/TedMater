/**
 * Simple in-process LRU cache for parsed TED page results.
 * Prevents hammering the TED website when multiple users watch the same talk.
 *
 * TTL: 1 hour — stale enough to be safe, fresh enough for URL changes.
 * Capacity: 100 entries — each entry is ~50-200 KB of JSON.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
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

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= MAX_SIZE) {
      // Evict oldest entry (first key in insertion order)
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

// Module-level singleton — persists for the lifetime of the Node.js process
export const parseCache = new LRUCache<unknown>();
