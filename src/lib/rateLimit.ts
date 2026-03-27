/**
 * Simple in-memory IP-based rate limiter for Next.js API routes.
 * Resets counters every `windowMs` milliseconds.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically evict expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export function checkRateLimit(key: string, options: RateLimitOptions = {}): boolean {
  const { windowMs = 60_000, max = 60 } = options;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return true;
  }

  entry.count += 1;
  return entry.count <= max;
}

/**
 * Extract the real client IP.
 *
 * Trust order (most-trusted first):
 *   1. x-real-ip  — set by Nginx/proxy; not spoofable if proxy is configured correctly
 *   2. First entry of x-forwarded-for — also set by proxy
 *
 * If neither header is present the connection comes directly (no proxy),
 * and we fall back to "unknown".  In both cases an attacker behind the
 * same proxy cannot inject a different IP because the *proxy* writes the
 * header, not the client.
 *
 * NOTE: if you deploy without a reverse proxy (plain Docker on a VPS
 * with direct internet exposure), clients CAN spoof these headers.
 * In that case, use a cloud WAF or set `TRUST_PROXY=false` and rely
 * solely on the TCP remote address (not yet available in Next.js edge
 * runtime, but can be passed via a custom server).
 */
export function getClientIp(req: Request): string {
  // x-real-ip is set by Nginx's `proxy_set_header X-Real-IP $remote_addr`
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // x-forwarded-for: "client, proxy1, proxy2" — take the leftmost
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }

  return "unknown";
}
