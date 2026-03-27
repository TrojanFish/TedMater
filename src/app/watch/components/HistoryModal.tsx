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
      className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <HistoryIcon size={16} style={{ color: "var(--accent)" }} />
            <span className="font-bold text-sm">{t.history}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
              {historyItems.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-3)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar divide-y" style={{ borderColor: "var(--border)" }}>
          {historyItems.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--text-3)" }}>No recent history</div>
          ) : (
            historyItems.map(h => (
              <button
                key={h.id}
                onClick={() => onSelect(h.videoUrl, Math.floor(h.progressTime))}
                className="w-full px-6 py-4 flex items-center gap-4 text-left transition-colors group"
                style={{ opacity: h.videoUrl === currentUrl ? 0.45 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-3)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                >
                  <span className="text-[11px] font-black leading-none" style={{ color: "var(--accent)" }}>
                    {Math.floor(h.progressTime / 60)}
                  </span>
                  <span className="text-[9px] opacity-40">min</span>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{h.title}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-3)" }}>{h.presenter}</p>
                  {h.duration && (
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min((h.progressTime / h.duration) * 100, 100)}%`, background: "var(--accent)" }}
                      />
                    </div>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>
                  {Math.floor(h.progressTime / 60)}:{(Math.floor(h.progressTime % 60)).toString().padStart(2, "0")}
                  {h.duration ? ` / ${Math.floor(h.duration / 60)}:${(Math.floor(h.duration % 60)).toString().padStart(2, "0")}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
