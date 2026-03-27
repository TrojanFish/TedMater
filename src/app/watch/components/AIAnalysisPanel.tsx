"use client";

import { X, Sparkles, BookMarked } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { TranscriptItem, AnalysisResult, SavedSentence } from "../types";

interface Props {
  analysis: AnalysisResult;
  sentence: TranscriptItem | undefined;
  savedSentences: SavedSentence[];
  onClose: () => void;
  onSave: (sentence: TranscriptItem, analysis: AnalysisResult) => void;
}

export default function AIAnalysisPanel({ analysis, sentence, savedSentences, onClose, onSave }: Props) {
  const { t } = useApp();
  const isSaved = savedSentences.some(s => s.id === sentence?.id);

  return (
    <section
      className="hidden md:flex w-[300px] shrink-0 flex-col overflow-hidden border-l"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-2">
          <Sparkles size={13} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-bold">{t.aiAnalysis}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: "var(--text-3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
        >
          <X size={15} />
        </button>
      </div>

      {/* Sentence context */}
      {sentence && (
        <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--accent-s)" }}>
          <p className="text-xs leading-relaxed font-medium" style={{ color: "var(--text)" }}>{sentence.english}</p>
          {sentence.translated && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>{sentence.translated}</p>
          )}
        </div>
      )}

      {/* Analysis content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>{t.structure}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{analysis.structureZh}</p>
        </div>
        <div className="space-y-2.5">
          {analysis.breakdown?.map((p, i) => (
            <div key={i} className="text-[11px] leading-relaxed">
              <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>{p.label}</span>
              <span className="ml-2 font-semibold" style={{ color: "var(--text)" }}>{p.content}</span>
              {p.explanation && <p className="mt-0.5 pl-0" style={{ color: "var(--text-2)" }}>{p.explanation}</p>}
            </div>
          ))}
        </div>
        <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{t.insights}</p>
          {analysis.insights.map((ins, i) => (
            <div key={i} className="text-xs space-y-0.5">
              <p className="font-semibold" style={{ color: "var(--text)" }}>{ins.title}</p>
              <p style={{ color: "var(--text-2)" }}>{ins.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        {sentence && (
          <button
            onClick={() => onSave(sentence, analysis)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-all"
            style={{ background: isSaved ? "var(--text-3)" : "var(--accent)" }}
          >
            <BookMarked size={12} />
            {isSaved ? "SAVED" : t.saveSentence}
          </button>
        )}
      </div>
    </section>
  );
}
