import { NextRequest, NextResponse } from "next/server";

// Validate YouTube video ID: 11 alphanumeric chars (plus - and _)
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Max valid timestamp: 12 hours in ms
const MAX_TS_MS = 12 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("id");

  if (!videoId || !YT_ID_RE.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  try {
    // 1. Fetch the video page to find the timedtext URL
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await pageRes.text();

    // 2. Extract captions data from ytInitialPlayerResponse
    // YouTube inlines this on one line; using [\s\S]+? instead of the ES2018-only /s flag
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});/);
    if (!playerResponseMatch) {
      throw new Error("Could not find player response in YouTube page");
    }

    let playerResponse: any;
    try {
      playerResponse = JSON.parse(playerResponseMatch[1]);
    } catch {
      throw new Error("Failed to parse YouTube player response JSON");
    }
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return NextResponse.json({ error: "No subtitles found for this YouTube video" }, { status: 404 });
    }

    // 3. Prefer English (auto-generated or manual)
    const track = captionTracks.find((t: any) => t.languageCode === 'en') || captionTracks[0];
    if (!track?.baseUrl) {
      return NextResponse.json({ error: "No valid caption track URL" }, { status: 404 });
    }
    const transcriptRes = await fetch(track.baseUrl + "&fmt=json3", {
      signal: AbortSignal.timeout(10_000),
    });
    const transcriptJson = await transcriptRes.json();

    // 4. Format to our TranscriptItem structure
    // startTime is in ms (matching the player's currentTime unit)
    const transcript = (transcriptJson.events ?? [])
      .filter((e: any) => e.segs && typeof e.tStartMs === "number")
      .map((e: any, i: number) => ({
        id: i,
        startTime: e.tStartMs,  // keep as ms — player compares against currentTime * 1000
        english: e.segs.map((s: any) => s.utf8 ?? "").join(" ").trim(),
        translated: "",
      }))
      .filter((e: any) => e.english && e.startTime >= 0 && e.startTime <= MAX_TS_MS);

    return NextResponse.json({ transcript });
  } catch (error: any) {
    console.error("[YouTube Subtitle Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
