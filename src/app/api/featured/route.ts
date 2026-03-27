import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export interface FeaturedTalk {
  title: string;
  presenter: string;
  url: string;
  thumbnail: string;
  duration: number;
}

// Module-level cache — persists across requests within one Node.js process
let cache: { talks: FeaturedTalk[]; expiresAt: number } | null = null;

function pickThumbnail(primaryImageSet: any[]): string {
  if (!Array.isArray(primaryImageSet) || primaryImageSet.length === 0) return "";
  const preferred = primaryImageSet.find(img => img.aspectRatioName === "16x9");
  return (preferred ?? primaryImageSet[0])?.url ?? "";
}

export async function GET() {
  // Fresh cache — serve immediately
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json({ talks: cache.talks });
  }

  try {
    const res = await fetch("https://www.ted.com/talks", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`TED responded ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const raw = $("#__NEXT_DATA__").html();
    if (!raw) throw new Error("__NEXT_DATA__ not found");

    const data = JSON.parse(raw);
    const rawTalks: any[] = data?.props?.pageProps?.talks ?? [];
    if (!Array.isArray(rawTalks)) throw new Error("Unexpected TED page structure");

    const talks: FeaturedTalk[] = rawTalks
      .filter(t => t.slug && t.title)
      .slice(0, 12)
      .map(t => ({
        title: String(t.title),
        presenter: String(t.presenterDisplayName ?? ""),
        url: `https://www.ted.com/talks/${t.slug}`,
        thumbnail: pickThumbnail(t.primaryImageSet),
        duration: typeof t.duration === "number" ? t.duration : 0,
      }));

    cache = { talks, expiresAt: Date.now() + 60 * 60 * 1000 };
    return NextResponse.json({ talks });
  } catch (err: any) {
    console.error("[featured]", err.message);
    // Stale-while-revalidate: return expired cache rather than a hard error
    if (cache) {
      return NextResponse.json({ talks: cache.talks });
    }
    return NextResponse.json({ talks: [] });
  }
}
