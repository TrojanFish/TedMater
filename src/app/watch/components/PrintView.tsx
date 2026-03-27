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
    <div id="print-view" className="hidden-on-screen bg-white text-black w-full font-sans">
      {/* Header */}
      <div style={{ borderBottom: "4px solid #E62B1E", paddingBottom: "10px", marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#E62B1E", marginBottom: "3px" }}>
              TEDMaster · Learning Script
            </div>
            <div style={{ fontSize: "16px", fontWeight: 900 }}>{data?.title}</div>
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{data?.presenter}</div>
          </div>
          <div style={{ fontSize: "9px", color: "#aaa", textAlign: "right" }}>
            <div>{new Date().toLocaleDateString()}</div>
            <div>{data?.transcript?.length} sentences</div>
          </div>
        </div>
      </div>

      <div>
        {/* Vocabulary */}
        {printConfig.vocab && vocabWords.length > 0 && (
          <div style={{ marginBottom: "20px", borderBottom: "1px dashed #eee", paddingBottom: "15px" }}>
            <h4 style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase", color: "#E62B1E", marginBottom: "8px" }}>
              Vocabulary List
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {vocabWords.map((v, i) => (
                <div key={i} style={{ fontSize: "9px", border: "1px solid #f5f5f5", padding: "6px", borderRadius: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ fontWeight: 700 }}>{v.word}</span>
                    <span style={{ color: "#aaa" }}>{v.partOfSpeech}</span>
                  </div>
                  <div style={{ color: "#666" }}>{v.definitionZh}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Script */}
        {printConfig.script && data?.transcript?.map((item, i) => {
          const analysis = analysisData[item.id] || savedSentences.find(s => s.id === item.id)?.analysis;
          return (
            <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0", borderBottom: "1px solid #f0f0f0", pageBreakInside: "avoid", breakInside: "avoid" }}>
              <span style={{ fontSize: "8px", color: "#ccc", fontFamily: "monospace", width: "20px", flexShrink: 0, paddingTop: "2px", textAlign: "right" }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", lineHeight: 1.5, color: "#111", fontWeight: 500 }}>{item.english}</div>
                {item.translated && (
                  <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#888", marginTop: "1px" }}>{item.translated}</div>
                )}

                {printConfig.analysis && analysis && (
                  <div style={{ marginTop: "6px", padding: "8px", background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "6px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#E62B1E", textTransform: "uppercase", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Sparkles size={8} /> AI Structure Analysis
                    </div>
                    <div style={{ fontSize: "10px", color: "#333", fontStyle: "italic", marginBottom: "6px" }}>{analysis.structureZh}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2px" }}>
                      {analysis.breakdown?.map((b: any, bi: number) => (
                        <div key={bi} style={{ display: "flex", gap: "6px", fontSize: "9px", borderLeft: "2px solid #E62B1E", paddingLeft: "6px" }}>
                          <span style={{ fontWeight: 800, color: "#E62B1E", flexShrink: 0 }}>{b.label}</span>
                          <span style={{ color: "#555" }}>{b.content}</span>
                        </div>
                      ))}
                    </div>
                    {analysis.insights?.length > 0 && (
                      <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px dashed #ddd" }}>
                        <div style={{ fontSize: "8px", fontWeight: 700, color: "#666", textTransform: "uppercase", marginBottom: "4px" }}>Insights</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px" }}>
                          {analysis.insights.map((ins: any, ii: number) => (
                            <div key={ii} style={{ fontSize: "9px" }}>
                              <span style={{ fontWeight: 700, color: "#333" }}>{ins.title}: </span>
                              <span style={{ color: "#666" }}>{ins.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {printConfig.notes && notes[item.id] && (
                  <div style={{ fontSize: "10px", color: "#E62B1E", fontStyle: "italic", marginTop: "4px", padding: "4px 8px", background: "#fdf2f2", borderRadius: "4px", borderLeft: "2px solid #E62B1E" }}>
                    Note: {notes[item.id]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#bbb" }}>
        <span>{data?.title}</span>
        <span>TEDMaster · AI-Powered English Learning</span>
      </div>
    </div>
  );
}
