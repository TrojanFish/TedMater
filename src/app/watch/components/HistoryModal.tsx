"use client";

import { X, History as HistoryIcon } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { HistoryItem } from "../types";

interface Props {
  historyItems: HistoryItem[];
  currentUrl: string;
  onClose: () => void;
  onSelect: (url: string, time: number) => void;
}

export default function HistoryModal({ historyItems, currentUrl, onClose, onSelect }: Props) {
  const { t } = useApp();

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-foreground/20 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="card-sticker w-full max-w-2xl flex flex-col overflow-hidden max-h-[80vh] shadow-pop-lg bg-white border-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary border-2 border-border flex items-center justify-center -rotate-6">
              <HistoryIcon size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-lg uppercase tracking-widest text-foreground">{t.history}</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-muted border-2 border-border">
              {historyItems.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 border-2 border-border bg-white rounded-xl shadow-pop hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar divide-y-2 divide-muted bg-background/50">
          {historyItems.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="text-4xl">🕰️</div>
              <p className="text-sm font-black uppercase text-muted-foreground tracking-widest">No recent history</p>
            </div>
          ) : (
            historyItems.map(h => {
              const isActive = h.videoUrl === currentUrl;
              return (
                <button
                  key={h.id}
                  onClick={() => onSelect(h.videoUrl, Math.floor(h.progressTime))}
                  className={`w-full px-6 py-5 flex items-center gap-4 text-left transition-all group relative
                    ${isActive ? "bg-accent/5 opacity-60 grayscale-[0.5]" : "hover:bg-white"}`}
                >
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center bg-white border-2 border-border shadow-pop group-hover:scale-110 transition-transform"
                  >
                    <span className="text-xs font-black leading-none text-accent">
                      {Math.floor(h.progressTime / 60)}
                    </span>
                    <span className="text-[9px] font-bold opacity-40 uppercase">min</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-black truncate text-foreground group-hover:text-accent transition-colors uppercase tracking-tight">{h.title}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">{h.presenter}</span>
                       <div className="w-1 h-1 rounded-full bg-border opacity-20" />
                       <span className="text-[10px] font-black text-muted-foreground uppercase">{Math.floor(h.progressTime / 60)}:{(Math.floor(h.progressTime % 60)).toString().padStart(2, "0")}</span>
                    </div>
                    {h.duration && (
                      <div className="w-full h-2 rounded-full overflow-hidden bg-muted border border-border/10">
                        <div
                          className="h-full rounded-full bg-secondary shadow-sm transition-all"
                          style={{ width: `${Math.min((h.progressTime / h.duration) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span className="absolute right-4 top-4 text-[9px] font-black text-accent border border-accent rounded px-1 tracking-tighter uppercase animate-pulse">Viewing</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
