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
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white border-4 border-border rounded-[2.5rem] shadow-pop-lg p-8 animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent border-4 border-border shadow-pop flex items-center justify-center rotate-3 transform">
            <Download size={28} className="text-white" strokeWidth={3} />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">{t.exportConfig}</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Personalized Learning PDF</p>
          </div>
        </div>

        <div className="space-y-4">
          {options.map(opt => (
            <label
              key={opt.id}
              className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2
                ${printConfig[opt.id] ? "bg-tertiary/10 border-border shadow-pop-active translate-y-[-2px]" : "bg-muted/30 border-muted hover:border-border"}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2
                   ${printConfig[opt.id] ? "bg-white border-border" : "bg-white/50 border-muted"} transition-all`}>
                   {opt.icon}
                </div>
                <div>
                   <span className="text-sm font-black uppercase tracking-tight block">{opt.label}</span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{opt.count} Items</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={printConfig[opt.id]}
                onChange={e => onChange({ ...printConfig, [opt.id]: e.target.checked })}
                className="w-6 h-6 rounded-lg border-2 border-border cursor-pointer accent-accent"
              />
            </label>
          ))}
        </div>

        <div className="flex gap-4 mt-10">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
          >
            {t.close}
          </button>
          <button
            onClick={onConfirm}
            className="btn-candy flex-[2] bg-accent text-white py-4 text-sm font-black uppercase tracking-widest"
          >
            {t.confirmPrint}
          </button>
        </div>
      </div>
    </div>
  );
}
