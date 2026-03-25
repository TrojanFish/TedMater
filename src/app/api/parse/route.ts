import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";

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

    // Aggressive Metadata Extraction — try known paths first, then regex fallback
    const playerData = videoData.playerData || {};
    const acmePlayerData = videoData.acmePlayerData || {};
    const resources = playerData.resources || {};
    const acmeResources = acmePlayerData.resources || {};

    // Known path: HLS
    let hlsUrl: string | null =
      acmeResources.hls?.stream || acmeResources.hls?.main ||
      resources.hls?.stream || resources.hls?.main || null;

    // Known path: MP4 (highest bitrate)
    const allH264: any[] = [...(resources.h264 || []), ...(acmeResources.h264 || [])];
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

    // HLS that is actually MP4
    if (hlsUrl?.endsWith(".mp4")) { mp4Url = mp4Url || hlsUrl; hlsUrl = null; }

    // Last-resort: regex scan of the entire JSON blob for video URLs
    if (!hlsUrl && !mp4Url) {
      const jsonStr = JSON.stringify(data);
      const m3u8Match = jsonStr.match(/https?:\\?\/\\?\/[^"\\]+\.m3u8[^"\\]*/);
      if (m3u8Match) hlsUrl = m3u8Match[0].replace(/\\\//, '/').replace(/\\/g, '');
      const mp4Match = jsonStr.match(/https?:\\?\/\\?\/[^"\\]+\.mp4[^"\\]*/);
      if (mp4Match) mp4Url = mp4Match[0].replace(/\\\//, '/').replace(/\\/g, '');
    }

    console.log("[TED Parser] hlsUrl:", hlsUrl, "| mp4Url:", mp4Url);

    // 2. Transcript Alignment
    const englishParagraphs = pageProps.transcriptData?.translation?.paragraphs || [];
    const englishCues = englishParagraphs.flatMap((p: any) => (p.cues || []));

    let translatedCues: any[] = [];
    try {
      if (targetLang && targetLang !== "en") {
        const transRes = await fetch(`${url}?language=${targetLang}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const transHtml = await transRes.text();
        const $t = cheerio.load(transHtml);
        const transDataJson = $t("#__NEXT_DATA__").html();
        if (transDataJson) {
          const tData = JSON.parse(transDataJson);
          const tParas = tData.props.pageProps.transcriptData?.translation?.paragraphs || [];
          translatedCues = tParas.flatMap((p: any) => (p.cues || []));
        }
      }
    } catch (e) { console.warn("Translation failed", e); }

    const mergedSentences = englishCues.map((eCue: any, idx: number) => {
      let tCue = translatedCues.find((tc: any) => Math.abs(tc.time - eCue.time) < 1000);
      return { id: idx, startTime: eCue.time, english: eCue.text, translated: tCue ? tCue.text : "" };
    });

    // Prefer MP4 to avoid HLS CORS issues in the browser
    return NextResponse.json({
      title: videoData.title,
      presenter: videoData.presenterDisplayName,
      description: videoData.description,
      thumbnail: videoData.playerData?.thumb || "",
      videoUrl: mp4Url || hlsUrl,
      downloadUrl: mp4Url,
      isHls: !mp4Url && !!hlsUrl,
      transcript: mergedSentences,
    });
  } catch (error: any) {
    console.error("TED Parser Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
