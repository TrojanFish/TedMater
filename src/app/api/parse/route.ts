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
    const ogImage = $('meta[property="og:image"]').attr('content');
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

    // Extract slug early — needed for transcript API fallback
    const slug = videoData.slug as string | undefined;

    // ── Helpers ──────────────────────────────────────────────────────────────
    /** Pick the best thumbnail from a primaryImageSet array */
    const pickThumbnail = (primaryImageSet: any[]): string => {
      if (!Array.isArray(primaryImageSet) || primaryImageSet.length === 0) return "";
      const preferred = primaryImageSet.find(img => img.aspectRatioName === "16x9");
      return (preferred ?? primaryImageSet[0])?.url ?? "";
    };

    /** Convert an array of TED paragraph objects → flat cue array */
    const parasToEnglishCues = (paras: any[]): any[] =>
      paras.flatMap((p: any) =>
        (p.cues || []).map((c: any) => ({
          id: String(c.time),
          startTime: c.time,
          endTime: c.time + (c.duration || 1000),
          text: (c.text || "").trim(),
        }))
      ).filter((c: any) => c.text);

    /** Parse a WebVTT string into cue objects */
    const vttToEnglishCues = (vtt: string): any[] => {
      const toMs = (s: string) => {
        const parts = s.trim().replace(",", ".").split(":");
        if (parts.length === 3)
          return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000;
        if (parts.length === 2)
          return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
        return 0;
      };
      const cues: any[] = [];
      let cur: any = null;
      for (const line of vtt.split("\n")) {
        if (line.includes("-->")) {
          const [s, e] = line.split("-->");
          cur = { startTime: toMs(s), endTime: toMs(e), text: "" };
          cues.push(cur);
        } else if (cur && line.trim() && !line.startsWith("WEBVTT") && !line.startsWith("NOTE") && !/^\d+$/.test(line.trim())) {
          cur.text += (cur.text ? " " : "") + line.trim();
        }
      }
      return cues.filter(c => c.text);
    };

    // ── 2. English transcript — try 5 paths in order ─────────────────────────
    let englishCues: any[] = [];

    // Path 1: transcriptData.translation.paragraphs (TED classic structure)
    const p1 = pageProps.transcriptData?.translation?.paragraphs;
    if (p1?.length) englishCues = parasToEnglishCues(p1);

    // Path 2: transcriptData.paragraphs (unwrapped — newer TED structure)
    if (!englishCues.length) {
      const p2 = pageProps.transcriptData?.paragraphs;
      if (p2?.length) englishCues = parasToEnglishCues(p2);
    }

    // Path 3: TED transcript JSON API  →  /talks/{slug}/transcript.json?language=en
    if (!englishCues.length && slug) {
      try {
        const apiRes = await fetch(
          `https://www.ted.com/talks/${slug}/transcript.json?language=en`,
          { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, signal: AbortSignal.timeout(10_000) }
        );
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const p3 =
            apiData.paragraphs ||
            apiData.translation?.paragraphs ||
            apiData.talk?.transcript?.paragraphs ||
            apiData.transcript?.paragraphs ||
            [];
          if (p3.length) englishCues = parasToEnglishCues(p3);
          console.log("[TED Parser] transcript API path 3:", englishCues.length, "cues");
        }
      } catch (e) { console.warn("[TED Parser] transcript API failed:", e); }
    }

    // Path 3b: Fetch /talks/{slug}/transcript page — newer TED talks store cues here
    if (!englishCues.length && slug) {
      try {
        const tpRes = await fetch(
          `https://www.ted.com/talks/${slug}/transcript?language=en`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (tpRes.ok) {
          const tpHtml = await tpRes.text();
          const $tp = cheerio.load(tpHtml);
          const tpJson = $tp("#__NEXT_DATA__").html();
          if (tpJson) {
            const tpData = JSON.parse(tpJson);
            const tpProps = tpData?.props?.pageProps;
            const tpParas =
              tpProps?.transcriptData?.translation?.paragraphs ||
              tpProps?.transcriptData?.paragraphs ||
              tpProps?.videoData?.transcript?.paragraphs ||
              tpProps?.talkTranscript?.paragraphs ||
              [];
            if (tpParas.length) {
              englishCues = parasToEnglishCues(tpParas);
              console.log("[TED Parser] transcript subpage path 3b:", englishCues.length, "cues");
            }
          }
        }
      } catch (e) { console.warn("[TED Parser] transcript subpage failed:", e); }
    }

    // Path 3c: Try transcript.json without language filter (some talks only return unlocalized)
    if (!englishCues.length && slug) {
      try {
        const apiRes = await fetch(
          `https://www.ted.com/talks/${slug}/transcript.json`,
          { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) }
        );
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const p3c = apiData.paragraphs || apiData.translation?.paragraphs || apiData.talk?.transcript?.paragraphs || [];
          if (p3c.length) {
            englishCues = parasToEnglishCues(p3c);
            console.log("[TED Parser] transcript API no-lang path 3c:", englishCues.length, "cues");
          }
        }
      } catch (e) { console.warn("[TED Parser] transcript.json no-lang failed:", e); }
    }

    // Path 4a: HLS metadata.json → subtitles[].webvtt (current TED CDN structure)
    if (!englishCues.length) {
      const metadataUrl: string | null =
        playerData?.resources?.hls?.metadata ||
        acmePlayerData?.resources?.hls?.metadata ||
        null;
      if (metadataUrl) {
        try {
          const metaRes = await fetch(metadataUrl, { signal: AbortSignal.timeout(10_000) });
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            const enSub = (metaData.subtitles || []).find((s: any) => s.code === "en");
            if (enSub?.webvtt) {
              const vttRes = await fetch(enSub.webvtt, { signal: AbortSignal.timeout(10_000) });
              if (vttRes.ok) englishCues = vttToEnglishCues(await vttRes.text());
              console.log("[TED Parser] HLS metadata VTT path 4a:", englishCues.length, "cues");
            }
          }
        } catch (e) { console.warn("[TED Parser] HLS metadata fetch failed:", e); }
      }
    }

    // Path 4b: HLS subtitle track embedded in playerData (older TED structure)
    if (!englishCues.length) {
      const subtitles =
        playerData?.resources?.hls?.subtitles ||
        acmePlayerData?.resources?.hls?.subtitles || [];
      const enSub = subtitles.find((s: any) => s.language === "en" || s.code === "en");
      if (enSub?.url || enSub?.webvtt) {
        try {
          const vttRes = await fetch(enSub.url || enSub.webvtt, { signal: AbortSignal.timeout(10_000) });
          if (vttRes.ok) englishCues = vttToEnglishCues(await vttRes.text());
          console.log("[TED Parser] HLS VTT path 4b:", englishCues.length, "cues");
        } catch (e) { console.warn("[TED Parser] VTT fetch failed:", e); }
      }
    }

    // Path 5: Regex scan for any JSON transcript blob inside the page data
    if (!englishCues.length) {
      try {
        const jsonStr = JSON.stringify(data);
        // Look for {"time":<ms>,"text":"..."} patterns — TED cue fingerprint
        const cueMatches = [...jsonStr.matchAll(/"time":(\d+),"(?:duration":\d+,)?"text":"([^"]+)"/g)];
        if (cueMatches.length > 10) {
          englishCues = cueMatches.map((m, i) => ({
            id: String(i), startTime: parseInt(m[1]), endTime: parseInt(m[1]) + 3000, text: m[2],
          }));
          console.log("[TED Parser] regex scan path 5:", englishCues.length, "cues");
        }
      } catch { /* ignore */ }
    }

    console.log("[TED Parser] englishCues total:", englishCues.length);

    // ── 3. Translated transcript ──────────────────────────────────────────────
    let translatedCues: any[] = [];
    let isTranslationMissing = false;

    if (targetLang && targetLang !== "en") {
      // Path A: fetch lang-specific page and extract __NEXT_DATA__
      try {
        const transRes = await fetch(`${url}?language=${targetLang}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15_000),
        });
        const transHtml = await transRes.text();
        const $t = cheerio.load(transHtml);
        const transDataJson = $t("#__NEXT_DATA__").html();
        if (transDataJson) {
          const tData = JSON.parse(transDataJson);
          const tPageProps = tData.props?.pageProps;
          const tParas =
            tPageProps?.transcriptData?.translation?.paragraphs ||
            tPageProps?.transcriptData?.paragraphs ||
            [];
          translatedCues = tParas.flatMap((p: any) => p.cues || []);
        }
      } catch (e) { console.warn("[TED Parser] translated page fetch failed:", e); }

      // Path B: TED transcript API for the target language
      if (!translatedCues.length && slug) {
        try {
          const apiRes = await fetch(
            `https://www.ted.com/talks/${slug}/transcript.json?language=${targetLang}`,
            { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) }
          );
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            const tParas = apiData.paragraphs || apiData.translation?.paragraphs || [];
            translatedCues = tParas.flatMap((p: any) => p.cues || []);
            console.log("[TED Parser] translation API path B:", translatedCues.length, "cues");
          }
        } catch (e) { console.warn("[TED Parser] translation API failed:", e); }
      }

      // Path C: HLS metadata.json → translated VTT (matches current TED CDN structure)
      if (!translatedCues.length) {
        const metadataUrl: string | null =
          playerData?.resources?.hls?.metadata ||
          acmePlayerData?.resources?.hls?.metadata ||
          null;
        if (metadataUrl) {
          try {
            const metaRes = await fetch(metadataUrl, { signal: AbortSignal.timeout(10_000) });
            if (metaRes.ok) {
              const metaData = await metaRes.json();
              const tSub = (metaData.subtitles || []).find(
                (s: any) => s.code === targetLang || s.code === targetLang.split("-")[0]
              );
              if (tSub?.webvtt) {
                const vttRes = await fetch(tSub.webvtt, { signal: AbortSignal.timeout(10_000) });
                if (vttRes.ok) {
                  const tCues = vttToEnglishCues(await vttRes.text());
                  // Convert to TED cue format (time in ms) for merging
                  translatedCues = tCues.map((c: any) => ({ time: c.startTime, text: c.text }));
                  console.log("[TED Parser] HLS metadata translated VTT path C:", translatedCues.length, "cues");
                }
              }
            }
          } catch (e) { console.warn("[TED Parser] HLS metadata translated fetch failed:", e); }
        }
      }

      if (!translatedCues.length) isTranslationMissing = true;
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
    // slug already declared above (extracted early for transcript API)

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
      thumbnail: (typeof playerData === 'object' ? playerData?.thumb : null) || 
                videoData.thumb || 
                videoData.image?.url || 
                videoData.heroImage?.url || 
                pickThumbnail(videoData.primaryImageSet || []) || 
                ogImage || 
                "",
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
