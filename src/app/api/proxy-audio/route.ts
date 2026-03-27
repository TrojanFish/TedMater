import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  if (!checkRateLimit(getClientIp(req), { windowMs: 60_000, max: 30 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const audioUrl = searchParams.get("url");

  if (!audioUrl) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  try {
    console.log("[Audio Proxy] Fetching (Mobile Simulation):", audioUrl);
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
      console.error("[Audio Proxy] Blocked! Received HTML instead of binary.");
      throw new Error("TED Blocked proxy (Received HTML). Please try fallback.");
    }

    // Use streaming for large files
    const stream = response.body;
    console.log(`[Audio Proxy] Success, streaming back ${contentType || 'data'}...`);

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
      url: audioUrl 
    }, { status: 500 });
  }
}
