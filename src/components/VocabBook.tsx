"use client";

import { useState, useEffect } from "react";
import { BookMarked, Trash2, ExternalLink, Download, Search } from "lucide-react";

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

interface VocabBookProps {
  words: VocabItem[];
  onRemove: (word: string) => void;
  onSelect: (word: VocabItem) => void;
}

export default function VocabBook({ words, onRemove, onSelect }: VocabBookProps) {
  const exportToTxt = () => {
    const content = words.map(i => `${i.word} [${i.phonetic}] (${i.partOfSpeech})\nDef: ${i.definitionZh}\nEx: ${i.exampleEn}\n---`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "TEDMaster_Vocab.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950/95 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl animate-in slide-in-from-right duration-500">
      <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5 relative shrink-0">
        <div className="absolute inset-0 bg-ted-red/5 blur-3xl rounded-full translate-x-12" />
        <h3 className="font-bold flex items-center gap-3 relative z-10">
          <BookMarked className="w-5 h-5 text-ted-red drop-shadow-[0_0_8px_rgba(230,43,30,0.6)]" />
          MASTER REPOSITORY
        </h3>
        <button 
          onClick={exportToTxt}
          disabled={words.length === 0}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white disabled:opacity-20 transition-all border border-white/10 relative z-10"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {words.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-10 gap-6">
             <BookMarked className="w-20 h-20" />
             <p className="text-sm tracking-widest uppercase font-bold text-center">Repository Empty.<br/>Capture knowledge in Synergy.</p>
          </div>
        ) : (
          [...words].sort((a,b) => b.addedAt - a.addedAt).map((item) => (
            <div 
              key={item.word} 
              onClick={() => onSelect(item)}
              className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl group transition-all hover:bg-white/[0.06] hover:border-ted-red/30 cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-col text-white">
                   <div className="flex items-center gap-2">
                      <span className="font-black text-2xl tracking-tighter group-hover:text-ted-red transition-colors">{item.word}</span>
                      <Search className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                   </div>
                   <span className="text-xs text-white/30 font-mono tracking-widest">{item.phonetic}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onRemove(item.word); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-ted-red transition-all bg-white/5 rounded-xl">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-[12px] font-bold text-white/80 line-clamp-2 leading-relaxed h-10">{item.definitionZh}</p>
                <div className="flex items-center justify-between">
                   <span className="inline-block px-2 py-0.5 bg-ted-red/10 border border-ted-red/20 text-ted-red text-[8px] font-black uppercase rounded shadow-sm">{item.partOfSpeech}</span>
                   <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">{new Date(item.addedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
