import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  url: z.string().url().regex(/ted\.com\/talks\//),
  lang: z.string().min(2).max(10),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = ParamsSchema.safeParse({
    url: searchParams.get("url"),
    lang: searchParams.get("lang"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { url, lang } = parsed.data;

  // "en" means no translation — caller clears translated fields itself
  if (lang === "en") {
    return NextResponse.json({ translatedCues: [], isTranslationMissing: false });
  }

  try {
    const res = await fetch(`${url}?language=${lang}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ translatedCues: [], isTranslationMissing: true });
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const nextDataJson = $("#__NEXT_DATA__").html();

    if (!nextDataJson) {
      return NextResponse.json({ translatedCues: [], isTranslationMissing: true });
    }

    const data = JSON.parse(nextDataJson);
    const paragraphs: any[] =
      data.props?.pageProps?.transcriptData?.translation?.paragraphs ?? [];

    const translatedCues = paragraphs.flatMap((p: any) =>
      (p.cues ?? []).map((c: any) => ({ time: c.time, text: c.text }))
    );

    return NextResponse.json({
      translatedCues,
      isTranslationMissing: translatedCues.length === 0,
    });
  } catch (err: any) {
    console.error("[subtitles]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
