/**
 * Simple in-memory IP-based rate limiter for Next.js API routes.
 * Resets counters every `windowMs` milliseconds.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 min) */
  windowMs?: number;
  /** Max requests per window per IP (default: 60) */
  max?: number;
}

/**
 * Returns true if the request should be allowed, false if rate-limited.
 */
export function checkRateLimit(ip: string, options: RateLimitOptions = {}): boolean {
  const { windowMs = 60_000, max = 60 } = options;
  const now = Date.now();

  let entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(ip, entry);
    return true;
  }

  entry.count += 1;
  return entry.count <= max;
}

/** Extract client IP from Next.js request headers. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
