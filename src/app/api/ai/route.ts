import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { aiCache, defineKey, analyzeKey } from "@/lib/aiCache";

// UPGRADED TO GEMINI 2.0 FLASH: High Speed + Pro-level Reasoning
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/** Call Gemini with up to `retries` attempts and exponential backoff. */
async function generateWithRetry(prompt: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      if (attempt === retries - 1) throw err;
      const delay = 500 * 2 ** attempt; // 500 ms, 1 s, 2 s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("generateContent failed after retries");
}

// Per-action rate limits (requests per minute per IP)
const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  define:    { windowMs: 60_000, max: 30 },  // word lookups
  analyze:   { windowMs: 60_000, max: 15 },  // sentence analysis (heavier)
  translate: { windowMs: 60_000, max: 6  },  // batch translation (most expensive)
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { action, text, context, sentences, targetLang } = body;

    // Validate action is a known value
    if (!action || !["define", "analyze", "translate"].includes(action)) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    // Guard against oversized inputs
    if (typeof text === "string" && text.length > 500) {
      return NextResponse.json({ error: "text too long (max 500 chars)" }, { status: 400 });
    }
    if (typeof context === "string" && context.length > 1000) {
      return NextResponse.json({ error: "context too long (max 1000 chars)" }, { status: 400 });
    }
    if (Array.isArray(sentences)) {
      // 1500 covers a ~2-hour TED talk at ~1 cue per 5s; reject truly absurd payloads
      if (sentences.length > 1500) {
        return NextResponse.json({ error: "Too many sentences (max 1500)" }, { status: 400 });
      }
      // Each individual sentence must be short (subtitle cues are never paragraphs)
      if (sentences.some((s: unknown) => typeof s !== "string" || s.length > 500)) {
        return NextResponse.json({ error: "Each sentence must be a string under 500 chars" }, { status: 400 });
      }
    }

    // Rate limit per action
    const limit = RATE_LIMITS[action];
    if (limit && !checkRateLimit(`ai:${action}:${getClientIp(req)}`, limit)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (action === "define") {
      const cacheKey = defineKey(text, context ?? "");
      const hit = aiCache.get(cacheKey);
      if (hit) return NextResponse.json(hit);

      const prompt = `
        You are an elite English-Chinese bilingual dictionary expert for students.
        Analyze the word "${text}" inside the context: "${context}".

        Provide high-dimensional data in Chinese (Simplified):
        1. definitionZh: Direct Chinese meaning in this context.
        2. phonetic: IPA.
        3. partOfSpeech: e.g. "vt.", "n.", "adj."
        4. tense: If it's a verb, explain its tense/voice in the context (e.g. "过去完成进行时"). If not a verb, return "".
        5. synonyms: Array of 3-4 synonyms relevant to this context.
        6. antonyms: Array of 1-3 antonyms.
        7. phrases: Array of 2-3 common collocations or phrases related to this word.
        8. exampleEn: One high-quality example sentence.
        9. exampleZh: Chinese translation of exampleEn.

        Return ONLY a JSON object in this format:
        {
          "word": "...",
          "phonetic": "...",
          "partOfSpeech": "...",
          "definitionZh": "...",
          "tense": "...",
          "synonyms": ["...", "..."],
          "antonyms": ["...", "..."],
          "phrases": ["...", "..."],
          "exampleEn": "...",
          "exampleZh": "..."
        }
      `;

      const raw = await generateWithRetry(prompt);
      const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
      aiCache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    if (action === "analyze") {
      const cacheKey = analyzeKey(text);
      const hit = aiCache.get(cacheKey);
      if (hit) return NextResponse.json(hit);

      const prompt = `
        You are a linguistic expert helping a Chinese student understand a complex TED talk sentence.
        Deconstruct this sentence: "${text}".

        Provide:
        1. structureZh: A concise analysis of the sentence structure in Chinese (Simplified).
        2. breakdown: List key parts (Subject, Verb, Obj, etc) with their English content and Chinese explanation.
        3. insights: 2-3 specific learning points (grammar/idioms) explained in Chinese.

        Return ONLY a JSON object in this format:
        {
          "structureZh": "...",
          "breakdown": [{"label": "...", "content": "...", "explanation": "..."}],
          "insights": [{"title": "...", "content": "..."}]
        }
      `;

      const raw = await generateWithRetry(prompt);
      const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
      aiCache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    if (action === "translate") {
      if (!Array.isArray(sentences) || sentences.length === 0) {
        return NextResponse.json({ error: "sentences required" }, { status: 400 });
      }

      const LANG_NAMES: Record<string, string> = {
        "zh-cn": "Simplified Chinese", "zh-tw": "Traditional Chinese",
        "ja": "Japanese", "ko": "Korean", "fr": "French",
        "es": "Spanish", "pt": "Portuguese", "de": "German",
      };
      const langName = LANG_NAMES[targetLang] || targetLang || "Chinese";

      const BATCH = 25;
      const translations: string[] = [];

      for (let i = 0; i < sentences.length; i += BATCH) {
        const batch: string[] = sentences.slice(i, i + BATCH);
        const prompt = `Translate the following ${batch.length} English sentences into ${langName}.
Return ONLY a JSON array of translated strings, same order, no extra text.

${JSON.stringify(batch)}`;

        const rawText = await generateWithRetry(prompt);
        const parsed: string[] = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        translations.push(...parsed);
      }

      return NextResponse.json({ translations });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
