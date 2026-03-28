import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// SSRF protection — only TED CDN domains allowed (same list as proxy-m3u8 and extract-audio)
const ALLOWED_HOSTS = [
  "hls.ted.com",
  "tedcdn.com",      // matches *.tedcdn.com (py.tedcdn.com, pa.tedcdn.com, etc.)
  "assets.ted.com",
  "pa.tedcdn.com",
  "py.tedcdn.com",
  "download.ted.com",
  "www.ted.com",     // /talks/*/download endpoint
  "akamaihd.net",   // matches tedcdnpa-a.akamaihd.net etc.
];

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
  if (!checkRateLimit(getClientIp(req), { windowMs: 60_000, max: 30 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const audioUrl = searchParams.get("url");

  if (!audioUrl) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  // SSRF guard — reject requests to disallowed hosts
  if (!isAllowedUrl(audioUrl)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(audioUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept": "audio/*,video/*,*/*",
        "Referer": "https://www.ted.com/",
        "Connection": "keep-alive"
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error("[Audio Proxy] Upstream Error:", response.status, response.statusText);
      throw new Error(`Upstream ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error("TED Blocked proxy (Received HTML). Please try fallback.");
    }

    // Reject suspiciously large responses (>500 MB) to prevent server OOM
    const contentLength = response.headers.get("content-length");
    const MAX_BYTES = 500 * 1024 * 1024;
    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      throw new Error("Response too large");
    }

    // Use streaming for large files
    const stream = response.body;

    const headers = new Headers();
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "public, max-age=3600");
    // Add content-disposition if a filename is desired, but for ASR we just need the stream
    
    return new NextResponse(stream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[Audio Proxy Error]:", error);
    return NextResponse.json({
      error: "Audio Proxy failed",
      details: error.message,
    }, { status: 500 });
  }
}
