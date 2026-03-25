import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// UPGRADED TO GEMINI 2.0 FLASH: High Speed + Pro-level Reasoning
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const { action, text, context } = await req.json();

    if (action === "define") {
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

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let jsonStr = response.text().replace(/```json|```/g, "").trim();
      return NextResponse.json(JSON.parse(jsonStr));
    }

    if (action === "analyze") {
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

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let jsonStr = response.text().replace(/```json|```/g, "").trim();
      return NextResponse.json(JSON.parse(jsonStr));
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
