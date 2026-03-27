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
    <section className="flex w-full h-full flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b-4 border-border shrink-0 flex items-center justify-between bg-white sticky top-0 z-20 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent border-2 border-border flex items-center justify-center -rotate-3 shadow-pop">
             <Sparkles size={24} className="text-white" strokeWidth={3} />
          </div>
          <div>
            <span className="text-lg font-black uppercase tracking-tight text-foreground block leading-tight">{t.aiAnalysis}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Smart Sentence Guide</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 border-2 border-border bg-white rounded-xl shadow-pop hover:scale-110 active:scale-95 active:shadow-none transition-all flex items-center justify-center group"
        >
          <X size={18} strokeWidth={3} className="text-muted-foreground group-hover:text-foreground" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* Sentence context */}
        {sentence && (
          <div className="px-8 py-8 border-b-2 border-muted shrink-0 bg-muted/20">
            <div className="flex items-start gap-4">
               <div className="mt-1 w-7 h-7 rounded-lg bg-border flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 shadow-sm">
                 EN
               </div>
               <div>
                  <p className="text-[15px] leading-relaxed font-black text-foreground">{sentence.english}</p>
                  {sentence.translated && (
                    <p className="text-xs mt-3 leading-relaxed font-bold text-muted-foreground italic border-l-2 border-border/30 pl-4">{sentence.translated}</p>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* Analysis Details */}
        <div className="p-8 space-y-10">
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-accent" />
               {t.structure}
            </p>
            <div className="p-5 rounded-2xl bg-accent/5 border-2 border-accent/10 shadow-inner">
               <p className="text-sm leading-relaxed font-bold text-foreground italic">{analysis.structureZh}</p>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-xs font-black uppercase tracking-widest text-secondary flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-secondary" />
               Sentence Breakdown
            </p>
            <div className="space-y-5">
              {analysis.breakdown?.map((p, i) => (
                <div key={i} className="space-y-2 group bg-muted/10 p-4 rounded-2xl border-2 border-transparent hover:border-border/10 transition-all">
                   <div className="flex items-center gap-3">
                      <span className="text-[11px] font-black uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-0.5 rounded-md">{p.label}</span>
                   </div>
                   <p className="text-[13px] font-black text-foreground pl-1 leading-tight">{p.content}</p>
                   {p.explanation && <p className="text-[11px] font-semibold text-muted-foreground pl-1 leading-relaxed">{p.explanation}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t-2 border-muted space-y-6">
            <p className="text-xs font-black uppercase tracking-widest text-quaternary flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-quaternary" />
               {t.insights}
            </p>
            <div className="grid grid-cols-1 gap-4">
              {analysis.insights.map((ins, i) => (
                <div key={i} className="p-4 rounded-2xl bg-quaternary/5 border-2 border-quaternary/10 space-y-2 hover:bg-quaternary/10 transition-colors">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                    <Sparkles size={12} className="text-quaternary" />
                    {ins.title}
                  </p>
                  <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed">{ins.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save button (Always at bottom) */}
      <div className="px-8 py-8 border-t-4 border-border shrink-0 bg-white sticky bottom-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        {sentence && (
          <button
            onClick={() => onSave(sentence, analysis)}
            className={`w-full btn-candy py-5 text-sm group ${isSaved ? "bg-muted text-muted-foreground border-border shadow-none pointer-events-none opacity-50" : "bg-secondary text-white"}`}
          >
            <BookMarked size={20} className={`mr-3 ${isSaved ? "" : "group-hover:rotate-12 transition-transform"}`} strokeWidth={3} />
            <span className="uppercase font-black tracking-widest">
              {isSaved ? "Already in Notebook" : "Add to Notebook"}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
