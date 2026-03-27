import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  // Segments are requested heavily during HLS playback; allow higher limit per IP
  if (!checkRateLimit(getClientIp(req), { windowMs: 60_000, max: 600 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const segUrl = searchParams.get("url");

  if (!segUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  if (!isAllowedUrl(segUrl)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const upstreamHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Referer": "https://www.ted.com/",
    "Origin": "https://www.ted.com",
  };

  // Forward Range header so partial-content / seeking works
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  try {
    const upstream = await fetch(segUrl, {
      headers: upstreamHeaders,
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: upstream.status });
    }

    const resHeaders = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "video/mp2t",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    });

    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentLength) resHeaders.set("Content-Length", contentLength);
    if (contentRange) resHeaders.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: upstream.status, // preserve 206 Partial Content
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error("[proxy-segment]", err);
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
