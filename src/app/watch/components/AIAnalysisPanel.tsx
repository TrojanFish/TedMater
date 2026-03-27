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
      className="hidden md:flex w-[320px] shrink-0 flex-col overflow-hidden border-l-2 border-border bg-white"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-muted shrink-0 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-tertiary border-2 border-border flex items-center justify-center -rotate-6">
             <Sparkles size={16} className="text-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-black uppercase tracking-widest text-foreground">{t.aiAnalysis}</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 border-2 border-border bg-white rounded-lg shadow-pop hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
        >
          <X size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* Sentence context */}
      {sentence && (
        <div className="px-5 py-5 border-b-2 border-muted shrink-0 bg-background/30">
          <p className="text-xs leading-relaxed font-black text-foreground">{sentence.english}</p>
          {sentence.translated && (
            <p className="text-[11px] mt-2 leading-relaxed font-bold text-muted-foreground">{sentence.translated}</p>
          )}
        </div>
      )}

      {/* Analysis content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 bg-white">
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">{t.structure}</p>
          <div className="p-4 rounded-xl bg-accent/5 border-2 border-accent/10">
             <p className="text-xs leading-relaxed font-bold text-foreground">{analysis.structureZh}</p>
          </div>
        </div>

        <div className="space-y-4">
          {analysis.breakdown?.map((p, i) => (
            <div key={i} className="space-y-1 group">
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary group-hover:scale-125 transition-transform" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-secondary">{p.label}</span>
               </div>
               <p className="text-xs font-black text-foreground pl-3.5 leading-tight">{p.content}</p>
               {p.explanation && <p className="text-[10px] font-semibold text-muted-foreground pl-3.5 leading-relaxed">{p.explanation}</p>}
            </div>
          ))}
        </div>

        <div className="pt-6 border-t-2 border-muted space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-quaternary">{t.insights}</p>
          {analysis.insights.map((ins, i) => (
            <div key={i} className="p-3 rounded-xl bg-quaternary/5 border border-quaternary/20 space-y-1">
              <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{ins.title}</p>
              <p className="text-[10px] font-semibold text-muted-foreground leading-relaxed">{ins.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 py-5 border-t-2 border-muted shrink-0 bg-white">
        {sentence && (
          <button
            onClick={() => onSave(sentence, analysis)}
            className={`w-full btn-candy py-4 text-xs group ${isSaved ? "bg-muted text-muted-foreground border-border/20 shadow-none pointer-events-none" : ""}`}
          >
            <BookMarked size={16} className={`mr-2 ${isSaved ? "" : "group-hover:rotate-12 transition-transform"}`} strokeWidth={2.5} />
            <span className="uppercase font-black tracking-widest">{isSaved ? "SAVED" : t.saveSentence}</span>
          </button>
        )}
      </div>
    </section>
  );
}
