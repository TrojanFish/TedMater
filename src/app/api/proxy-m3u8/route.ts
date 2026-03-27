import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// SSRF protection — only TED CDN domains are allowed
const ALLOWED_HOSTS = ["hls.ted.com", "tedcdn.com", "assets.ted.com", "pa.tedcdn.com"];

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith("." + h))
    );
  } catch {
    return false;
  }
}

function resolveUrl(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, base).toString();
}

function proxyM3u8Url(abs: string) {
  return `/api/proxy-m3u8?url=${encodeURIComponent(abs)}`;
}

/**
 * Rewrite M3U8 manifest:
 *  - Sub-playlist (.m3u8) lines → route through server proxy (CORS/GFW bypass)
 *  - Segment (.ts / .fmp4) lines → direct CDN absolute URLs (saves server bandwidth)
 *  - URI="..." attributes (EXT-X-KEY, EXT-X-MAP, etc.) → same logic
 */
function rewriteM3u8(text: string, baseUrl: string): string {
  return text
    .split("\n")
    .map(line => {
      const trimmed = line.trim();

      // Rewrite URI="..." inside tag lines
      if (trimmed.startsWith("#") && trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          const abs = resolveUrl(uri, baseUrl);
          return `URI="${abs.includes(".m3u8") ? proxyM3u8Url(abs) : abs}"`;
        });
      }

      // Pass through empty lines and other tags unchanged
      if (!trimmed || trimmed.startsWith("#")) return line;

      // URL lines: sub-playlists proxy through server; segments go direct to CDN
      const abs = resolveUrl(trimmed, baseUrl);
      return abs.includes(".m3u8") ? proxyM3u8Url(abs) : abs;
    })
    .join("\n");
}

export async function GET(req: NextRequest) {
  if (!checkRateLimit(getClientIp(req), { windowMs: 60_000, max: 120 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const m3u8Url = searchParams.get("url");

  if (!m3u8Url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  if (!isAllowedUrl(m3u8Url)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(m3u8Url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://www.ted.com/",
        "Origin": "https://www.ted.com",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: upstream.status });
    }

    const text = await upstream.text();
    // Use the final (post-redirect) URL as base so relative paths resolve correctly
    const finalBase = upstream.url || m3u8Url;
    const rewritten = rewriteM3u8(text, finalBase);

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
      },
    });
  } catch (err: any) {
    console.error("[proxy-m3u8]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}
