"use client";

import { useState } from "react";
import { Download, Trash2, Volume2, BookMarked, Sparkles, MessageSquare } from "lucide-react";
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

export interface SavedSentence {
  id: string | number;
  english: string;
  translated: string;
  analysis?: any;
  addedAt: number;
}

interface Props {
  words: VocabItem[];
  sentences: SavedSentence[];
  notes: Record<number, string>;
  onRemoveWord: (word: string) => void;
  onRemoveSentence: (id: string | number) => void;
  onSelectWord: (word: VocabItem) => void;
  onSelectSentence: (sent: SavedSentence) => void;
  onSelectNote: (id: number) => void;
}

export default function LearningNotebook({
  words,
  sentences,
  notes,
  onRemoveWord,
  onRemoveSentence,
  onSelectWord,
  onSelectSentence,
  onSelectNote
}: Props) {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<"words" | "sentences" | "notes">("words");
  const noteEntries = Object.entries(notes).filter(([_, content]) => !!content);

  const exportAll = () => {
    let content = `--- TEDMaster Learning Export ---\n\n`;
    
    content += `[WORDS / 单词] (${words.length})\n\n`;
    words.sort((a, b) => b.addedAt - a.addedAt).forEach(w => {
      content += `${w.word} [${w.phonetic}] (${w.partOfSpeech})\nDef: ${w.definitionZh}\nEx: ${w.exampleEn}\n\n`;
    });

    content += `\n[SENTENCES / 重点句] (${sentences.length})\n\n`;
    sentences.sort((a, b) => b.addedAt - a.addedAt).forEach(s => {
      content += `${s.english}\n${s.translated}\n\n`;
    });

    content += `\n[MY NOTES / 我的笔记] (${noteEntries.length})\n\n`;
    noteEntries.forEach(([id, note]) => {
      content += `Sentence ID ${id}: ${note}\n\n`;
    });

    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "TEDMaster_Notebook.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const sortedWords = [...words].sort((a, b) => b.addedAt - a.addedAt);
  const sortedSents = [...sentences].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div className="flex flex-col h-full rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>

      {/* Header & Tabs */}
      <div className="shrink-0" style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <BookMarked size={16} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-bold uppercase tracking-tight">Notebook</span>
          </div>
          <button onClick={exportAll} disabled={words.length === 0 && sentences.length === 0 && noteEntries.length === 0}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "var(--text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
            title={t.exportLabel}>
            <Download size={15} />
          </button>
        </div>
        
        <div className="flex p-1 gap-1">
          {[
            { id: "words", label: t.wordsTab, count: words.length },
            { id: "sentences", label: t.sentencesTab, count: sentences.length },
            { id: "notes", label: t.notesTab, count: noteEntries.length }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{ 
                background: activeTab === tab.id ? "var(--bg-2)" : "transparent",
                color: activeTab === tab.id ? "var(--accent)" : "var(--text-3)",
                boxShadow: activeTab === tab.id ? "0 2px 8px var(--shadow)" : "none"
              }}>
              {tab.label}
              <span className="px-1 py-0.5 rounded-md text-[9px]" 
                style={{ background: activeTab === tab.id ? "var(--accent-s)" : "var(--bg)", opacity: 0.6 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {activeTab === "words" && (
          sortedWords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-16 opacity-40">
              <BookMarked size={32} />
              <p className="text-xs text-center whitespace-pre-line">{t.vocabEmpty}</p>
            </div>
          ) : (
            sortedWords.map(item => (
              <div key={item.word} onClick={() => onSelectWord(item)}
                className="p-3 rounded-xl cursor-pointer transition-all group/item"
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{item.word}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background: "var(--accent-s)", color: "var(--accent)" }}>{item.partOfSpeech}</span>
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>{item.phonetic}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); const u = new SpeechSynthesisUtterance(item.word); u.lang = "en-US"; speechSynthesis.speak(u); }}
                      className="p-1 rounded text-text-3 hover:text-text"><Volume2 size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); onRemoveWord(item.word); }}
                      className="p-1 rounded text-text-3 hover:text-accent"><Trash2 size={13} /></button>
                  </div>
                </div>
                <p className="text-xs mt-1.5 leading-snug line-clamp-1" style={{ color: "var(--text-2)" }}>{item.definitionZh}</p>
              </div>
            ))
          )
        )}

        {activeTab === "sentences" && (
          sortedSents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-16 opacity-40">
              <Sparkles size={32} />
              <p className="text-xs text-center whitespace-pre-line">{t.sentEmpty}</p>
            </div>
          ) : (
            sortedSents.map(sent => (
              <div key={sent.id} 
                className="p-3 rounded-xl transition-all group/item mb-2"
                style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
                <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => onSelectSentence(sent)}>
                   <p className="text-xs font-bold leading-relaxed" style={{ color: "var(--text)" }}>{sent.english}</p>
                   <button onClick={e => { e.stopPropagation(); onRemoveSentence(sent.id); }}
                      className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-text-3 hover:text-accent transition-opacity shrink-0">
                      <Trash2 size={13} />
                   </button>
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--text-3)" }}>{sent.translated}</p>
                
                {/* Embedded Analysis */}
                {sent.analysis && (
                  <div className="mt-3 pt-2 border-t space-y-3 opacity-90" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-s w-fit">
                      <Sparkles size={10} className="text-accent" />
                      <span className="text-[9px] font-bold text-accent uppercase tracking-tighter">{t.aiAnalysis}</span>
                    </div>
                    
                    {/* Structure */}
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>Structure</p>
                      <p className="text-[10px] leading-snug" style={{ color: "var(--text-2)" }}>{sent.analysis.structureZh}</p>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-3)" }}>Breakdown</p>
                      {sent.analysis.breakdown?.map((b: any, i: number) => (
                        <div key={i} className="flex gap-2 text-[9px] border-l border-accent-s pl-2">
                           <span className="font-bold text-accent shrink-0">{b.label}:</span>
                           <span style={{ color: "var(--text-2)" }}>{b.content}</span>
                        </div>
                      ))}
                    </div>

                    {/* Insights */}
                    {sent.analysis.insights?.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                         <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Insights</p>
                         {sent.analysis.insights.map((ins: any, i: number) => (
                           <div key={i} className="p-1.5 rounded bg-bg-3/50 text-[9px] space-y-0.5">
                              <p className="font-bold text-accent-h" style={{ color: "var(--accent)" }}>{ins.title}</p>
                              <p style={{ color: "var(--text-2)" }}>{ins.content}</p>
                           </div>
                         ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-2 flex items-center justify-end">
                   <span className="text-[9px]" style={{ color: "var(--text-3)" }}>{new Date(sent.addedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === "notes" && (
          noteEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-16 opacity-40">
              <MessageSquare size={32} />
              <p className="text-xs text-center border-t border-dashed mt-4 pt-4 border-white/10">No notes written in this talk.</p>
            </div>
          ) : (
            noteEntries.map(([id, note]) => (
              <div key={id} onClick={() => onSelectNote(parseInt(id))}
                className="p-3 rounded-xl cursor-pointer transition-all border border-dashed mb-2"
                style={{ borderColor: "var(--border)", background: "var(--bg-3)" }}>
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-5 h-5 rounded bg-accent text-[9px] flex items-center justify-center text-white font-bold"># {id}</div>
                   <span className="text-[10px] font-bold text-accent">{t.note}</span>
                </div>
                <p className="text-[11px] leading-relaxed italic" style={{ color: "var(--text)" }}>"{note}"</p>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
