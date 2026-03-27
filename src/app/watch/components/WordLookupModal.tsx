"use client";

import { X, Volume2, BookMarked, Loader2, Sparkles } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { VocabItem } from "../types";

interface Props {
  activeWord: VocabItem & { loading?: boolean };
  wordLoading: boolean;
  onClose: () => void;
  onSave: (word: VocabItem) => void;
}

export default function WordLookupModal({ activeWord, wordLoading, onClose, onSave }: Props) {
  const { t } = useApp();

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-md print-hidden"
      onClick={onClose}
    >
      <div
        className="card-sticker w-full max-w-xl max-h-[88vh] flex flex-col shadow-pop-lg bg-white border-2"
        onClick={e => e.stopPropagation()}
      >
        {wordLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-16 h-16 rounded-2xl bg-tertiary border-2 border-border shadow-pop animate-bounce flex items-center justify-center">
               <Loader2 size={32} className="animate-spin text-foreground" strokeWidth={3} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t.loading}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-8 pb-6 border-b-2 border-muted bg-white">
              <div className="space-y-3">
                <h2 className="text-4xl font-black tracking-tighter text-foreground uppercase italic px-1">
                  {activeWord.word?.replace(/[^a-zA-Z'-]/g, "")}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase font-black px-2 py-1 rounded-lg bg-accent text-white border-2 border-border shadow-sm">
                    {activeWord.partOfSpeech}
                  </span>
                  <span className="text-sm font-black font-mono text-muted-foreground tracking-widest">{activeWord.phonetic}</span>
                  <button
                    onClick={() => {
                      const u = new SpeechSynthesisUtterance(activeWord.word);
                      u.lang = "en-US"; u.rate = 0.85;
                      speechSynthesis.speak(u);
                    }}
                    className="w-8 h-8 rounded-lg bg-white border-2 border-border shadow-pop hover:scale-110 active:scale-95 transition-all flex items-center justify-center ml-2"
                  >
                    <Volume2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 border-2 border-border bg-white rounded-xl shadow-pop hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6 bg-background/30">
              {/* Meaning */}
              <div className="p-6 rounded-2xl bg-white border-2 border-border shadow-pop relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-tertiary border-l-2 border-b-2 border-border rounded-bl-2xl flex items-center justify-center">
                   <Sparkles size={18} className="text-foreground" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">{t.meaning}</p>
                <p className="text-2xl font-black leading-tight text-foreground">{activeWord.definitionZh}</p>
                {activeWord.tense && (
                  <p className="text-[10px] font-black mt-3 px-2 py-1 rounded bg-muted border border-border inline-block uppercase italic">
                    {activeWord.tense}
                  </p>
                )}
              </div>

              {/* Synonyms / Antonyms */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t.synonyms, items: activeWord.synonyms, color: "bg-secondary/10" },
                  { label: t.antonyms, items: activeWord.antonyms, color: "bg-quaternary/10" },
                ].map(({ label, items, color }) =>
                  items?.length ? (
                    <div key={label} className={`p-4 rounded-2xl bg-white border-2 border-border`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((s: string, i: number) => (
                          <span key={i} className={`text-[11px] font-black px-2 py-1 rounded-lg bg-muted border border-border/20`}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>

              {/* Collocations */}
              {activeWord.phrases?.length ? (
                <div className="p-4 rounded-2xl bg-white border-2 border-border relative">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t.collocations}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {activeWord.phrases.map((p: string, i: number) => (
                      <div key={i} className="text-[11px] font-bold p-2 px-3 rounded-xl bg-background border border-border/10 flex items-center gap-3">
                         <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                         {p}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Example */}
              {activeWord.exampleEn && (
                <div className="p-5 rounded-3xl bg-tertiary/10 border-2 border-tertiary/30 relative -rotate-1 hover:rotate-0 transition-transform">
                  <p className="text-[10px] font-black uppercase tracking-widest text-tertiary mb-2">{t.example}</p>
                  <p className="text-sm font-black italic leading-relaxed text-foreground">"{activeWord.exampleEn}"</p>
                  {activeWord.exampleZh && (
                    <p className="text-xs font-bold mt-2 leading-relaxed opacity-60">"{activeWord.exampleZh}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="p-8 border-t-2 border-muted bg-white">
              <button
                onClick={() => onSave(activeWord as VocabItem)}
                className="w-full btn-candy py-5 text-lg group"
              >
                <BookMarked size={20} className="mr-3 group-hover:rotate-12 transition-transform" strokeWidth={2.5} />
                <span className="uppercase tracking-widest">{t.saveWord}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
