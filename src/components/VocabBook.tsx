"use client";

import { Download, Trash2, Volume2, BookMarked } from "lucide-react";
import { useApp } from "@/lib/i18n";

export interface VocabItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definitionZh: string;
  tense?: string;
  synonyms?: string[];
  antonyms?: string[];
  phrases?: string[];
  exampleEn: string;
  exampleZh: string;
  addedAt: number;
}

interface Props {
  words: VocabItem[];
  onRemove: (word: string) => void;
  onSelect: (word: VocabItem) => void;
}

export default function VocabBook({ words, onRemove, onSelect }: Props) {
  const { t } = useApp();

  const exportTxt = () => {
    const content = [...words]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map(w => `${w.word}  [${w.phonetic}]  (${w.partOfSpeech})\n${w.definitionZh}\nEx: ${w.exampleEn}\n`)
      .join("\n---\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "TEDMaster_Vocab.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const sorted = [...words].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div className="flex flex-col h-full rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-3)" }}>
        <div className="flex items-center gap-2">
          <BookMarked size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-bold">{t.vocab}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "var(--accent-s)", color: "var(--accent)" }}>{words.length}</span>
        </div>
        <button onClick={exportTxt} disabled={words.length === 0}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: "var(--text-2)" }}
          onMouseEnter={e => !words.length || (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
          title={t.exportLabel}>
          <Download size={15} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {sorted.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
            <BookMarked size={32} style={{ color: "var(--text-3)" }} />
            <p className="text-xs text-center leading-relaxed whitespace-pre-line" style={{ color: "var(--text-3)" }}>
              {t.vocabEmpty}
            </p>
          </div>
        ) : (
          sorted.map(item => (
            <div key={item.word} onClick={() => onSelect(item)}
              className="p-3 rounded-xl cursor-pointer transition-all group/word"
              style={{ border: "1px solid transparent" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base leading-tight">{item.word}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: "var(--accent-s)", color: "var(--accent)" }}>{item.partOfSpeech}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{item.phonetic}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover/word:opacity-100 transition-opacity shrink-0">
                  <button onClick={e => { e.stopPropagation(); const u = new SpeechSynthesisUtterance(item.word); u.lang = "en-US"; u.rate = 0.85; speechSynthesis.speak(u); }}
                    className="p-1 rounded transition-colors" style={{ color: "var(--text-3)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                    <Volume2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); onRemove(item.word); }}
                    className="p-1 rounded transition-colors" style={{ color: "var(--text-3)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-xs mt-1.5 leading-snug line-clamp-2" style={{ color: "var(--text-2)" }}>{item.definitionZh}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
