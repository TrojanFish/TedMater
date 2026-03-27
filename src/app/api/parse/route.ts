import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jwt from "jsonwebtoken";
import * as cheerio from "cheerio";
import { z } from "zod";
import { parseCache } from "@/lib/parseCache";

export const dynamic = "force-dynamic";

const TedUrlSchema = z.string().url().regex(/ted\.com\/talks\//);

export async function POST(req: NextRequest) {
  // Declare cacheKey outside try so the catch block can use it for stale fallback
  let cacheKey = "";
  try {
    const { url, targetLang = "zh-cn" } = await req.json();

    const validation = TedUrlSchema.safeParse(url);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid TED Talk URL" }, { status: 400 });
    }

    // Cache key includes targetLang so different translations are cached separately
    cacheKey = `${url}::${targetLang}`;
    const cached = parseCache.get(cacheKey);
    if (cached) {
      console.log("[TED Parser] cache hit:", cacheKey);
      return NextResponse.json(cached);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TED page: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const nextDataJson = $("#__NEXT_DATA__").html();

    if (!nextDataJson) {
      throw new Error("Could not find __NEXT_DATA__ on the page.");
    }

    const data = JSON.parse(nextDataJson);
    const pageProps = data.props.pageProps;

    if (!pageProps || !pageProps.videoData) {
      throw new Error("Video data not found in page properties.");
    }

    const videoData = pageProps.videoData;

    // Aggressive Metadata Extraction — handle both object and serialized string cases
    let playerData = videoData.playerData || {};
    if (typeof playerData === "string") {
      try { playerData = JSON.parse(playerData); } catch { playerData = {}; }
    }
    
    let acmePlayerData = videoData.acmePlayerData || {};
    if (typeof acmePlayerData === "string") {
      try { acmePlayerData = JSON.parse(acmePlayerData); } catch { acmePlayerData = {}; }
    }

    const resources = (playerData.resources || acmePlayerData.resources || videoData.resources || {});
    
    // Known path: HLS
    let hlsUrl: string | null =
      resources.hls?.stream || resources.hls?.main || null;

    // Known path: MP4 (highest bitrate)
    const allH264: any[] = [...(resources.h264 || [])];
    let mp4Url: string | null = null;
    if (allH264.length > 0) {
      const sorted = allH264.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      mp4Url = sorted[0].file || null;
    }

    // Native downloads fallback
    if (!mp4Url && videoData.nativeDownloads) {
      const dl = videoData.nativeDownloads;
      mp4Url = dl.high || dl.medium || dl.low || null;
    }

    // Last-resort: search metadata blob
    if (!hlsUrl && !mp4Url && videoData.metadata) {
      const meta = videoData.metadata;
      hlsUrl = meta.hls?.stream || meta.hls?.main || null;
      if (!mp4Url && meta.h264) {
        const sorted = meta.h264.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        mp4Url = sorted[0]?.file || null;
      }
    }

    // Regex scan fallback
    if (!hlsUrl && !mp4Url) {
      const jsonStr = JSON.stringify(data);
      const m3u8Match = jsonStr.match(/https?:\\?\/\\?\/[^"\\]+\.m3u8[^"\\]*/);
      if (m3u8Match) hlsUrl = m3u8Match[0].replace(/\\\//, '/').replace(/\\/g, '');
      const mp4Match = jsonStr.match(/https?:\\?\/\\?\/[^"\\]+\.mp4[^"\\]*/);
      if (mp4Match) mp4Url = mp4Match[0].replace(/\\\//, '/').replace(/\\/g, '');
    }

    console.log("[TED Parser] resolved video sources — hlsUrl:", !!hlsUrl, "| mp4Url:", !!mp4Url);

    // 2. Transcript Alignment
    let englishCues: any[] = []; // Initialize englishCues here

    // Try to get transcript from transcriptData (more reliable for new videos)
    const pageTranscript = pageProps.transcriptData?.translation;
    if (pageTranscript && pageTranscript.paragraphs) {
      pageTranscript.paragraphs.forEach((p: any) => {
        if (p.cues) {
          p.cues.forEach((c: any) => {
            englishCues.push({
              id: c.time.toString(),
              startTime: c.time,           // ms — matches player's currentTime * 1000
              endTime: c.time + (c.duration || 1000),
              text: c.text
            });
          });
        }
      });
    }

    // Try to get transcript from playerData (HLS subtitles)
    if (englishCues.length === 0) {
      const subtitles = videoData.playerData?.resources?.hls?.subtitles || videoData.acmePlayerData?.resources?.hls?.subtitles || [];
      const englishSub = subtitles.find((s: any) => s.language === 'en');
      if (englishSub) {
        try {
          const vttRes = await fetch(englishSub.url, { signal: AbortSignal.timeout(10_000) });
          const vttText = await vttRes.text();
          // Basic VTT parsing (simplified for this example, full parser would be more complex)
          const lines = vttText.split('\n');
          let currentCue: any = null;
          for (const line of lines) {
            if (line.includes('-->')) {
              // Parse VTT timestamps to milliseconds
              const toMs = (s: string) => {
                const parts = s.trim().split(':');
                if (parts.length === 3) {
                  return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000;
                } else if (parts.length === 2) {
                  return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
                }
                return 0;
              };
              const [startStr, endStr] = line.split('-->');
              const start = toMs(startStr);
              const end = toMs(endStr);
              currentCue = { startTime: start, endTime: end, text: '' };
              englishCues.push(currentCue);
            } else if (currentCue && line.trim() !== '' && !line.startsWith('WEBVTT') && !line.startsWith('NOTE')) {
              currentCue.text += (currentCue.text ? ' ' : '') + line.trim();
            }
          }
        } catch (e) {
          console.warn("Failed to fetch or parse VTT subtitles", e);
        }
      }
    }

    let translatedCues: any[] = [];
    let isTranslationMissing = false;

    if (targetLang && targetLang !== "en") {
      try {
        const transRes = await fetch(`${url}?language=${targetLang}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
        const transHtml = await transRes.text();
        const $t = cheerio.load(transHtml);
        const transDataJson = $t("#__NEXT_DATA__").html();
        if (transDataJson) {
          const tData = JSON.parse(transDataJson);
          const tParas = tData.props.pageProps.transcriptData?.translation?.paragraphs || [];
          translatedCues = tParas.flatMap((p: any) => (p.cues || []));
          if (translatedCues.length === 0) isTranslationMissing = true;
        } else {
          isTranslationMissing = true;
        }
      } catch (e) { 
        console.warn("Translation failed", e);
        isTranslationMissing = true;
      }
    }

    const mergedSentences = englishCues.map((eCue: any, idx: number) => {
      // eCue.startTime and tc.time are both in ms
      const tCue = translatedCues.find((tc: any) => Math.abs(tc.time - eCue.startTime) < 1000);
      return { id: idx, startTime: eCue.startTime, english: eCue.text, translated: tCue ? tCue.text : "" };
    });

    // Route video through server-side proxy:
    //  • HLS (hls.ted.com) — wrap with /api/proxy-m3u8 so Chinese users and
    //    all browsers avoid CDN CORS/GFW blocks entirely.
    //  • MP4 (py.tedcdn.com) — often 403 from server; fall back to direct URL
    //    so the browser can try, and if that also fails the hidden-video capture
    //    uses the proxied HLS anyway.
    let finalVideoUrl: string | null = null;
    let finalIsHls = false;

    if (hlsUrl) {
      finalVideoUrl = `/api/proxy-m3u8?url=${encodeURIComponent(hlsUrl)}`;
      finalIsHls = true;
    } else if (mp4Url) {
      finalVideoUrl = mp4Url;
      finalIsHls = false;
    }

    // Recursive search for "service": "YouTube" or "video_id"
    const findYoutubeId = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      
      // Check directly
      if (obj.service === 'YouTube' && obj.code) return obj.code;
      if (obj.video_id && typeof obj.video_id === 'string' && obj.video_id.length === 11) return obj.video_id;
      
      // Handle stringified player data common in TED Next.js props
      if (typeof obj.playerData === 'string' && obj.playerData.includes('{')) {
        try {
          const inner = JSON.parse(obj.playerData);
          const found = findYoutubeId(inner);
          if (found) return found;
        } catch (e) {}
      }
      
      for (const key in obj) {
        if (key === 'playerData' && typeof obj[key] === 'string') continue; // Handled above
        const found = findYoutubeId(obj[key]);
        if (found) return found;
      }
      return null;
    };

    const youtubeId = findYoutubeId(videoData);
    const slug = videoData.slug;

    // Build alternative sources
    const transcribeSources = [];
    if (mp4Url) {
      transcribeSources.push(`/api/proxy-audio?url=${encodeURIComponent(mp4Url)}`);
    }
    // Podcast guess pattern (often more permissive)
    if (slug) {
      transcribeSources.push(`/api/proxy-audio?url=${encodeURIComponent(`https://www.ted.com/talks/${slug}/download?audio=true`)}`);
    }
    
    // Fallbacks: If proxy gets 403, the client will try these raw URLs. 
    // They might fail CORS, but podcasts often don't, and if the client is on mobile/PWA, it might succeed.
    if (mp4Url) {
      transcribeSources.push(mp4Url);
    }
    if (slug) {
      transcribeSources.push(`https://www.ted.com/talks/${slug}/download?audio=true`);
    }

    const result = {
      title: videoData.title,
      presenter: videoData.presenterDisplayName || videoData.presenter,
      description: videoData.description,
      thumbnail: videoData.playerData?.thumb || videoData.thumb || "",
      videoUrl: finalVideoUrl,
      hlsUrl: hlsUrl,   // raw CDN URL for server-side audio extraction
      audioUrl: mp4Url ? `/api/proxy-audio?url=${encodeURIComponent(mp4Url)}` : null,
      transcribeUrl: transcribeSources[0] || null,
      transcribeSources,
      youtubeId,
      youtubeTranscriptUrl: youtubeId ? `/api/youtube-subtitles?id=${youtubeId}` : null,
      slug,
      downloadUrl: mp4Url ? `/api/proxy-audio?url=${encodeURIComponent(mp4Url)}` : null,
      isHls: finalIsHls,
      transcript: mergedSentences,
      isTranslationMissing,
      needsTranscription: englishCues.length === 0,
    };

    parseCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("TED Parser Error:", error);
    // Return stale cache on upstream failure rather than a hard error
    const stale = parseCache.getStale(cacheKey);
    if (stale) {
      console.warn("[TED Parser] Returning stale cache due to error:", error.message);
      return NextResponse.json(stale);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
