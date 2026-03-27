"use client";

import { Sparkles } from "lucide-react";
import type { ParsedData, VocabItem, SavedSentence, AnalysisResult, PrintConfig } from "../types";

interface Props {
  data: ParsedData | null;
  printConfig: PrintConfig;
  vocabWords: VocabItem[];
  analysisData: Record<number, AnalysisResult>;
  savedSentences: SavedSentence[];
  notes: Record<number, string>;
}

export default function PrintView({ data, printConfig, vocabWords, analysisData, savedSentences, notes }: Props) {
  return (
    <div id="print-view" className="hidden print:block bg-white text-black w-full font-sans p-8">
      {/* ── PDF Header ─────────────────────────────────────────── */}
      <div style={{ borderBottom: "4px solid #E62B1E", paddingBottom: "15px", marginBottom: "25px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#E62B1E", marginBottom: "5px" }}>
              TEDMaster · Study Script
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{data?.title}</h1>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px", fontWeight: 700 }}>{data?.presenter}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "10px", color: "#999" }}>
            <div style={{ fontWeight: 800 }}>{new Date().toLocaleDateString()}</div>
            <div>{data?.transcript?.length} Sentences</div>
          </div>
        </div>
      </div>

      {/* ── 1. The Article (Interleaved) ───────────────────────── */}
      {printConfig.script && (
        <div style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", borderLeft: "4px solid #E62B1E", paddingLeft: "10px", marginBottom: "20px" }}>
            Main Script & Translation
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {data?.transcript.map((item, i) => {
              const isSaved = savedSentences.some(s => s.id === item.id);
              return (
                <div key={i} style={{ pageBreakInside: "avoid" }}>
                  {/* English Line */}
                  <div style={{ 
                    fontSize: "13px", 
                    lineHeight: 1.6, 
                    color: "#111", 
                    fontWeight: 600,
                    textDecoration: isSaved ? "underline" : "none",
                    textDecorationStyle: "dotted",
                    textDecorationColor: "#E62B1E"
                  }}>
                    <span style={{ fontSize: "9px", color: "#ccc", marginRight: "8px", fontWeight: 400 }}>{i + 1}</span>
                    {item.english.split(" ").map((word, wi) => {
                       const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
                       const isWordSaved = vocabWords.some(v => v.word.toLowerCase() === clean);
                       return (
                         <span key={wi} style={{ 
                           textDecoration: isWordSaved ? "underline" : "none",
                           textDecorationColor: "#E62B1E",
                           textDecorationThickness: "2px",
                           marginRight: "4px"
                         }}>{word}</span>
                       );
                    })}
                  </div>
                  {/* Chinese Line */}
                  {item.translated && (
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "4px", paddingLeft: "24px", fontWeight: 500 }}>
                      {item.translated}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Vocabulary List ─────────────────────────────────── */}
      {printConfig.vocab && vocabWords.length > 0 && (
        <div style={{ marginBottom: "40px", pageBreakBefore: "always" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", borderLeft: "4px solid #E62B1E", paddingLeft: "10px", marginBottom: "20px" }}>
            Vocabulary Bank
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            {vocabWords.map((v, i) => (
              <div key={i} style={{ border: "2px solid #f0f0f0", padding: "12px", borderRadius: "12px", pageBreakInside: "avoid" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 900, color: "#E62B1E" }}>{v.word}</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, paddingLeft: "6px", paddingRight: "6px", background: "#f5f5f5", borderRadius: "4px", color: "#999" }}>{v.partOfSpeech}</span>
                </div>
                <div style={{ fontSize: "10px", color: "#333", fontWeight: 600, lineHeight: 1.4 }}>{v.definitionZh}</div>
                {v.phonetic && <div style={{ fontSize: "8px", color: "#999", marginTop: "2px" }}>/{v.phonetic}/</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. AI Structure & Sentence Analysis ────────────────── */}
      {printConfig.analysis && (Object.keys(analysisData).length > 0 || savedSentences.length > 0) && (
        <div style={{ marginBottom: "40px", pageBreakBefore: "always" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", borderLeft: "4px solid #E62B1E", paddingLeft: "10px", marginBottom: "20px" }}>
            Language Structure & Analysis
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {data?.transcript.map(item => {
              const analysis = analysisData[item.id] || savedSentences.find(s => s.id === item.id)?.analysis;
              if (!analysis) return null;
              return (
                <div key={item.id} style={{ border: "2px solid #E62B1E20", borderRadius: "15px", padding: "15px", pageBreakInside: "avoid" }}>
                  <div style={{ fontSize: "9px", color: "#999", marginBottom: "5px" }}>SENTENCE #{data.transcript.indexOf(item) + 1}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>{item.english}</div>
                  <div style={{ background: "#fdf2f2", padding: "10px", borderRadius: "8px", marginBottom: "10px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 900, color: "#E62B1E", textTransform: "uppercase", marginBottom: "4px" }}>Core Insight</div>
                    <div style={{ fontSize: "10px", color: "#444", fontWeight: 500 }}>{analysis.structureZh}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px" }}>
                    {analysis.breakdown?.map((b: any, bi: number) => (
                      <div key={bi} style={{ display: "flex", gap: "10px", fontSize: "10px" }}>
                        <span style={{ fontWeight: 900, color: "#E62B1E", minWidth: "60px" }}>{b.label}</span>
                        <span style={{ color: "#333" }}>{b.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Personal Learning Notes ─────────────────────────── */}
      {printConfig.notes && Object.values(notes).some(Boolean) && (
        <div style={{ marginBottom: "40px", pageBreakBefore: "always" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", borderLeft: "4px solid #E62B1E", paddingLeft: "10px", marginBottom: "20px" }}>
            Personal Study Notes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data?.transcript.map(item => {
              if (!notes[item.id]) return null;
              return (
                <div key={item.id} style={{ padding: "12px", background: "#f9f9f9", borderRadius: "10px", borderLeft: "4px solid #666" }}>
                  <div style={{ fontSize: "9px", color: "#999", marginBottom: "4px" }}>REF: {item.english.slice(0, 50)}...</div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#111" }}>{notes[item.id]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div style={{ marginTop: "40px", paddingTop: "15px", borderTop: "2px solid #f0f0f0", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#bbb", fontWeight: 700 }}>
        <span>Generated by TEDMaster AI on {new Date().toLocaleDateString()}</span>
        <span style={{ color: "#E62B1E" }}>tedmaster.io</span>
      </div>
    </div>
  );
}
