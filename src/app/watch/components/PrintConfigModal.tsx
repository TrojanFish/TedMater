"use client";

import { Download, Book, FileText, Sparkles, FileEdit } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { ParsedData, VocabItem, SavedSentence, AnalysisResult, PrintConfig } from "../types";

interface Props {
  printConfig: PrintConfig;
  onChange: (config: PrintConfig) => void;
  onClose: () => void;
  onConfirm: () => void;
  vocabWords: VocabItem[];
  data: ParsedData | null;
  analysisData: Record<number, AnalysisResult>;
  savedSentences: SavedSentence[];
  notes: Record<number, string>;
}

export default function PrintConfigModal({
  printConfig, onChange, onClose, onConfirm,
  vocabWords, data, analysisData, savedSentences, notes,
}: Props) {
  const { t } = useApp();

  const options = [
    { id: "vocab" as const,    label: t.includeVocab,    count: vocabWords.length,                                              icon: <Book size={14} /> },
    { id: "script" as const,   label: t.includeScript,   count: data?.transcript.length ?? 0,                                   icon: <FileText size={14} /> },
    { id: "analysis" as const, label: t.includeAnalysis, count: Object.keys(analysisData).length || savedSentences.length,      icon: <Sparkles size={14} /> },
    { id: "notes" as const,    label: t.includeNotes,    count: Object.values(notes).filter(Boolean).length,                   icon: <FileEdit size={14} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl p-7"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-s)" }}>
            <Download size={20} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="text-xl font-bold">{t.exportConfig}</h3>
            <p className="text-[11px] opacity-40">Customize your learning PDF</p>
          </div>
        </div>

        <div className="space-y-3">
          {options.map(opt => (
            <label
              key={opt.id}
              className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-accent/20"
              style={{ background: "var(--bg-3)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 opacity-60">{opt.icon}</div>
                <span className="text-sm font-semibold">{opt.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono opacity-30">{opt.count}</span>
                <input
                  type="checkbox"
                  checked={printConfig[opt.id]}
                  onChange={e => onChange({ ...printConfig, [opt.id]: e.target.checked })}
                  className="w-5 h-5 rounded-lg appearance-none cursor-pointer transition-all border-2"
                  style={{
                    accentColor: "var(--accent)",
                    borderColor: printConfig[opt.id] ? "var(--accent)" : "rgba(255,255,255,0.1)",
                    background: printConfig[opt.id] ? "var(--accent)" : "transparent",
                  }}
                />
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:bg-white/5"
            style={{ color: "var(--text-3)" }}
          >
            {t.close}
          </button>
          <button
            onClick={onConfirm}
            className="flex-[2] py-3 rounded-2xl text-sm font-black text-white shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: "var(--accent)", boxShadow: "0 10px 25px -5px rgba(230,43,30,0.4)" }}
          >
            {t.confirmPrint}
          </button>
        </div>
      </div>
    </div>
  );
}
