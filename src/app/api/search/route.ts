import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export interface SearchResult {
  title: string;
  presenter: string;
  url: string;
  thumbnail: string;
  duration: number; // seconds
  description: string;
}

// Short-lived cache: same query within 60 s returns cached results
const cache = new Map<string, { results: SearchResult[]; expiresAt: number }>();

function pickThumbnail(talk: any): string {
  // primaryImageSet: [{url, width}, ...]
  if (Array.isArray(talk.primaryImageSet) && talk.primaryImageSet.length > 0) {
    // Pick largest available
    const sorted = [...talk.primaryImageSet].sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0].url || "";
  }
  return (
    talk.thumbnailUrl ||
    talk.thumbnail ||
    talk.image?.url ||
    talk.image ||
    ""
  );
}

function pickDuration(talk: any): number {
  return (
    talk.duration ||
    talk.mediaDuration ||
    talk.video?.duration ||
    0
  );
}

function pickPresenter(talk: any): string {
  return (
    talk.presenterDisplayName ||
    talk.speakerName ||
    talk.speaker?.name ||
    talk.presenter ||
    ""
  );
}

function pickDescription(talk: any): string {
  return talk.description || talk.tagline || talk.metaDescription || "";
}

/**
 * Walk an object tree looking for things that look like TED talk records.
 * A valid talk record must have both `slug` (string with underscores) and `title`.
 */
function extractTalksFromTree(node: any, depth = 0): any[] {
  if (depth > 8 || !node || typeof node !== "object") return [];

  // Direct hit: this node looks like a talk
  if (
    typeof node.slug === "string" &&
    node.slug.length > 3 &&
    /^[a-z0-9_]+$/.test(node.slug) &&
    typeof node.title === "string" &&
    node.title.length > 3
  ) {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(item => extractTalksFromTree(item, depth + 1));
  }

  return Object.values(node).flatMap(val => extractTalksFromTree(val, depth + 1));
}

function mapToResult(talk: any): SearchResult | null {
  if (!talk.slug || !talk.title) return null;
  return {
    title: talk.title,
    presenter: pickPresenter(talk),
    url: `https://www.ted.com/talks/${talk.slug}`,
    thumbnail: pickThumbnail(talk),
    duration: pickDuration(talk),
    description: pickDescription(talk),
  };
}

export async function GET(req: NextRequest) {
  if (!checkRateLimit(getClientIp(req), { windowMs: 60_000, max: 20 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2)  return NextResponse.json({ error: "Query too short" }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  // Cache hit
  const hit = cache.get(q);
  if (hit && Date.now() < hit.expiresAt) {
    return NextResponse.json({ results: hit.results });
  }

  try {
    const tedUrl = `https://www.ted.com/talks?sort=relevance&q=${encodeURIComponent(q)}`;
    const res = await fetch(tedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `TED responded ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const raw = $("#__NEXT_DATA__").html();
    if (!raw) {
      return NextResponse.json({ results: [] });
    }

    const data = JSON.parse(raw);
    const pageProps = data?.props?.pageProps ?? {};

    // ── Try known direct paths first ─────────────────────────────────
    const candidates: any[] = [
      pageProps.talks,                        // classic format
      pageProps.searchResults,               // alternative key
      pageProps.initialData?.talks,
      pageProps.searchTalks?.nodes,
      pageProps.data?.talks?.nodes,
      pageProps.results?.talks,
    ];

    let rawTalks: any[] = [];

    for (const c of candidates) {
      if (Array.isArray(c) && c.length > 0) {
        rawTalks = c;
        break;
      }
    }

    // ── Tree scan fallback ────────────────────────────────────────────
    if (rawTalks.length === 0) {
      rawTalks = extractTalksFromTree(pageProps);
    }

    // Deduplicate by slug
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const talk of rawTalks) {
      if (results.length >= 12) break;
      const mapped = mapToResult(talk);
      if (mapped && !seen.has(mapped.url)) {
        seen.add(mapped.url);
        results.push(mapped);
      }
    }

    cache.set(q, { results, expiresAt: Date.now() + 60_000 });

    // Prune stale cache entries to prevent unbounded growth
    if (cache.size > 200) {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (now > entry.expiresAt) cache.delete(key);
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("[search]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
