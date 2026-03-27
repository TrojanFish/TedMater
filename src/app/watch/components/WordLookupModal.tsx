"use client";

import { X, Volume2, BookMarked, Loader2 } from "lucide-react";
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 print-hidden"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        {wordLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-2)" }}>{t.loading}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-3xl font-black tracking-tight">
                  {activeWord.word?.replace(/[^a-zA-Z'-]/g, "")}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>
                    {activeWord.partOfSpeech}
                  </span>
                  <span className="text-sm font-mono" style={{ color: "var(--text-2)" }}>{activeWord.phonetic}</span>
                  <button
                    onClick={() => {
                      const u = new SpeechSynthesisUtterance(activeWord.word);
                      u.lang = "en-US"; u.rate = 0.85;
                      speechSynthesis.speak(u);
                    }}
                    className="p-1 rounded transition-colors"
                    style={{ color: "var(--text-3)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
                  >
                    <Volume2 size={15} />
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              {/* Meaning */}
              <div className="p-4 rounded-xl" style={{ background: "var(--bg-3)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>{t.meaning}</p>
                <p className="text-xl font-bold leading-snug">{activeWord.definitionZh}</p>
                {activeWord.tense && (
                  <p className="text-xs mt-2 px-2 py-1 rounded inline-block" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>
                    {activeWord.tense}
                  </p>
                )}
              </div>

              {/* Synonyms / Antonyms */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t.synonyms, items: activeWord.synonyms },
                  { label: t.antonyms, items: activeWord.antonyms },
                ].map(({ label, items }) =>
                  items?.length ? (
                    <div key={label} className="p-3 rounded-xl" style={{ background: "var(--bg-3)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((s: string, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full border" style={{ color: "var(--text-2)", borderColor: "var(--border)" }}>
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
                <div className="p-3 rounded-xl" style={{ background: "var(--bg-3)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>{t.collocations}</p>
                  <div className="space-y-1">
                    {activeWord.phrases.map((p: string, i: number) => (
                      <p key={i} className="text-sm border-l-2 pl-3 py-0.5" style={{ color: "var(--text)", borderColor: "var(--accent)" }}>
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Example */}
              {activeWord.exampleEn && (
                <div className="p-3 rounded-xl" style={{ background: "var(--bg-3)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>{t.example}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>"{activeWord.exampleEn}"</p>
                  {activeWord.exampleZh && (
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>"{activeWord.exampleZh}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => onSave(activeWord as VocabItem)}
                className="w-full py-3 rounded-xl font-bold text-white transition-all"
                style={{ background: "var(--accent)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-h)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
              >
                <BookMarked size={16} className="inline mr-2" />{t.saveWord}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
