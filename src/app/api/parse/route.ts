import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jwt from "jsonwebtoken";
import * as cheerio from "cheerio";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TedUrlSchema = z.string().url().regex(/ted\.com\/talks\//);

export async function POST(req: NextRequest) {
  try {
    const { url, targetLang = "zh-cn" } = await req.json();

    const validation = TedUrlSchema.safeParse(url);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid TED Talk URL" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
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

    console.log("[TED Parser] hlsUrl:", hlsUrl, "| mp4Url:", mp4Url);

    // 2. Transcript Alignment
    const transcriptData = pageProps.transcriptData || {};
    const englishParagraphs = transcriptData.translation?.paragraphs || [];
    const englishCues = englishParagraphs.flatMap((p: any) => (p.cues || []));

    let translatedCues: any[] = [];
    let isTranslationMissing = false;

    if (targetLang && targetLang !== "en") {
      try {
        const transRes = await fetch(`${url}?language=${targetLang}`, { headers: { "User-Agent": "Mozilla/5.0" } });
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
      let tCue = translatedCues.find((tc: any) => Math.abs(tc.time - eCue.time) < 1000);
      return { id: idx, startTime: eCue.time, english: eCue.text, translated: tCue ? tCue.text : "" };
    });

    // Prefer MP4 to avoid HLS CORS issues in the browser
    // Prefer HLS from hls.ted.com because it has CORS enabled. 
    // py.tedcdn.com MP4s often return 403 Forbidden.
    let finalVideoUrl = mp4Url || hlsUrl;
    let finalIsHls = !mp4Url && !!hlsUrl;

    if (hlsUrl && hlsUrl.includes("hls.ted.com")) {
      finalVideoUrl = hlsUrl;
      finalIsHls = true;
    }

    return NextResponse.json({
      title: videoData.title,
      presenter: videoData.presenterDisplayName,
      description: videoData.description,
      thumbnail: videoData.playerData?.thumb || videoData.thumb || "",
      videoUrl: finalVideoUrl,
      downloadUrl: mp4Url,
      isHls: finalIsHls,
      transcript: mergedSentences,
      isTranslationMissing,
      needsTranscription: englishCues.length === 0
    });
  } catch (error: any) {
    console.error("TED Parser Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
