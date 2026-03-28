"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Trash2, Volume2, BookMarked, Sparkles, MessageSquare, ExternalLink } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { VocabItem, SavedSentence } from "@/app/watch/types";

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
    <div className="flex flex-col h-full bg-white border-2 border-border rounded-2xl shadow-pop-lg overflow-hidden">

      {/* Header & Tabs */}
      <div className="shrink-0 bg-background border-b-2 border-border">
        <div className="flex items-center justify-between px-4 py-4 border-b-2 border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent border-2 border-border shadow-pop flex items-center justify-center -rotate-3">
              <BookMarked size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-black uppercase tracking-tight text-foreground">Notebook</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notebook"
              className="w-10 h-10 flex items-center justify-center bg-accent/10 border-2 border-border rounded-full shadow-pop hover:scale-110 active:scale-95 transition-all"
              title="Open Full Notebook">
              <ExternalLink size={16} strokeWidth={2.5} className="text-accent" />
            </Link>
            <button onClick={exportAll}
              disabled={words.length === 0 && sentences.length === 0 && noteEntries.length === 0}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-border rounded-full shadow-pop hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:shadow-none"
              title={t.exportLabel}>
              <Download size={18} strokeWidth={2.5} className="text-foreground" />
            </button>
          </div>
        </div>
        
        <div className="flex p-2 gap-2 bg-background">
          {[
            { id: "words", label: t.wordsTab, count: words.length, color: "bg-accent" },
            { id: "sentences", label: t.sentencesTab, count: sentences.length, color: "bg-secondary" },
            { id: "notes", label: t.notesTab, count: noteEntries.length, color: "bg-tertiary" }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-wider
                ${activeTab === tab.id 
                  ? `${tab.color} text-white border-border shadow-pop translate-y-[-2px]` 
                  : "bg-white text-muted-foreground border-transparent hover:border-border/30"
                }`}>
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] border border-border/20
                ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-white dot-grid-subtle">
        {activeTab === "words" && (
          sortedWords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-20 opacity-30">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <BookMarked size={32} />
              </div>
              <p className="text-sm font-bold text-center max-w-[200px]">{t.vocabEmpty}</p>
            </div>
          ) : (
            sortedWords.map(item => (
              <div key={item.word} onClick={() => onSelectWord(item)}
                className="p-4 bg-white border-2 border-border rounded-xl shadow-pop hover:shadow-pop-hover hover:-translate-y-1 active:translate-y-0.5 transition-all cursor-pointer group/item relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-accent/5 rounded-bl-xl border-l border-b border-border/10 flex items-center justify-center">
                   <Volume2 size={12} className="text-accent" />
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-foreground">{item.word}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-accent text-white border border-border/20">{item.partOfSpeech}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-muted-foreground">{item.phonetic}</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onRemoveWord(item.word); }}
                    className="opacity-0 group-hover/item:opacity-100 p-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all border border-secondary/20">
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                </div>
                <p className="text-sm font-medium leading-normal text-foreground border-t border-dashed border-border/10 pt-2">{item.definitionZh}</p>
              </div>
            ))
          )
        )}

        {activeTab === "sentences" && (
          sortedSents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-20 opacity-30">
              <Sparkles size={32} />
              <p className="text-sm font-bold text-center max-w-[200px]">{t.sentEmpty}</p>
            </div>
          ) : (
            sortedSents.map((sent, index) => (
              <div key={sent.id} 
                className={`p-4 bg-white border-2 border-border rounded-xl shadow-pop transition-all group/item mb-4 
                  ${index % 2 === 0 ? 'hover:rotate-1' : 'hover:-rotate-1'}`}>
                <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => onSelectSentence(sent)}>
                   <p className="text-sm font-bold leading-relaxed text-foreground">{sent.english}</p>
                   <button onClick={e => { e.stopPropagation(); onRemoveSentence(sent.id); }}
                      className="opacity-0 group-hover/item:opacity-100 p-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all border border-secondary/20 shrink-0">
                      <Trash2 size={14} strokeWidth={2.5} />
                   </button>
                </div>
                <p className="text-xs font-medium mt-2 text-muted-foreground italic border-l-2 border-accent pl-2">{sent.translated}</p>
                
                {/* Embedded Analysis */}
                {sent.analysis && (
                  <div className="mt-4 p-4 border-2 border-border rounded-xl bg-tertiary/5 space-y-4">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary border-2 border-border shadow-pop w-fit -mt-7 ml-2">
                       <Sparkles size={12} className="text-foreground" strokeWidth={2.5} />
                       <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{t.aiAnalysis}</span>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-accent">Sentence Structure</p>
                      <p className="text-xs font-bold leading-normal text-foreground bg-white/50 p-2 rounded-lg border border-border/10">{sent.analysis.structureZh}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Grammar Breakdown</p>
                      <div className="grid gap-2">
                        {sent.analysis.breakdown?.map((b: any, i: number) => (
                          <div key={i} className="flex gap-2 text-[10px] bg-white border border-border/10 p-2 rounded-lg">
                             <span className="font-black text-accent shrink-0">{b.label}:</span>
                             <span className="font-medium text-foreground">{b.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {sent.analysis.insights?.length > 0 && (
                      <div className="space-y-2">
                         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Key Insights</p>
                         {sent.analysis.insights.map((ins: any, i: number) => (
                           <div key={i} className="p-3 rounded-lg bg-white border-2 border-border shadow-pop-pink relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
                              <p className="font-black text-secondary text-[11px] mb-1">{ins.title}</p>
                              <p className="text-[10px] font-medium text-foreground leading-normal">{ins.content}</p>
                           </div>
                         ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-4 flex items-center justify-end">
                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded-full">
                    {new Date(sent.addedAt).toLocaleDateString()}
                   </span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === "notes" && (
          noteEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-20 opacity-30">
              <MessageSquare size={32} />
              <p className="text-sm font-bold text-center">No notes written in this talk.</p>
            </div>
          ) : (
            noteEntries.map(([id, note]) => (
              <div key={id} onClick={() => onSelectNote(parseInt(id))}
                className="p-4 bg-background border-2 border-border border-dashed rounded-xl shadow-pop hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer mb-4 relative overflow-hidden group">
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-quaternary border-2 border-border flex items-center justify-center text-[10px] font-black text-foreground shadow-pop">
                  {id}
                </div>
                <div className="flex items-center gap-2 mb-3">
                   <div className="p-1.5 rounded-lg bg-quaternary/20 text-quaternary border border-quaternary/30">
                    <MessageSquare size={14} strokeWidth={2.5} />
                   </div>
                   <span className="text-[11px] font-black text-foreground uppercase tracking-widest">{t.note}</span>
                </div>
                <p className="text-sm font-medium leading-relaxed italic text-foreground bg-white/50 p-3 rounded-lg">"{note}"</p>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
