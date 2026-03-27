import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("id");

  if (!videoId) {
    return NextResponse.json({ error: "No video ID provided" }, { status: 400 });
  }

  try {
    // 1. Fetch the video page to find the timedtext URL
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await pageRes.text();

    // 2. Extract captions data from ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerResponseMatch) {
      throw new Error("Could not find player response in YouTube page");
    }

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return NextResponse.json({ error: "No subtitles found for this YouTube video" }, { status: 404 });
    }

    // 3. Prefer English (auto-generated or manual)
    const track = captionTracks.find((t: any) => t.languageCode === 'en') || captionTracks[0];
    const transcriptRes = await fetch(track.baseUrl + "&fmt=json3");
    const transcriptJson = await transcriptRes.json();

    // 4. Format to our TranscriptItem structure
    // startTime is in ms (matching the player's currentTime unit)
    const transcript = transcriptJson.events
      .filter((e: any) => e.segs)
      .map((e: any, i: number) => ({
        id: i,
        startTime: e.tStartMs,  // keep as ms — player compares against currentTime * 1000
        english: e.segs.map((s: any) => s.utf8).join(" ").trim(),
        translated: "",
      }))
      .filter((e: any) => e.english);

    return NextResponse.json({ transcript });
  } catch (error: any) {
    console.error("[YouTube Subtitle Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
