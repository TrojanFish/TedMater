"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookMarked, Sparkles, MessageSquare, Search, X,
  Download, Trash2, Volume2, ChevronDown, ChevronUp,
  LogIn, LogOut, Zap, BookOpen, FileText,
  FileSpreadsheet, GraduationCap, StickyNote, Filter, ArrowLeft,
  Star, Play, Clock
} from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { VocabItem, SavedSentence, HistoryItem, TalkMeta } from "@/app/watch/types";

/* ── helpers ──────────────────────────────────────────────────── */
const slugFromUrl = (url: string): string => {
  const m = url.match(/ted\.com\/talks\/([^/?#]+)/);
  return m ? m[1] : url.replace(/[^a-z0-9]/gi, "_").slice(-40);
};

const slugToTitle = (slug: string): string =>
  slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const speak = (word: string) => {
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US"; u.rate = 0.85;
  speechSynthesis.speak(u);
};

const fmtTime = (sec: number): string => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ── types ────────────────────────────────────────────────────── */
interface NoteGroup {
  talkSlug: string;
  talkUrl: string;
  entries: { id: string; text: string }[];
}

interface TalkCard {
  talkSlug: string;
  videoUrl: string;
  title: string;
  presenter: string;
  thumbnail: string;
  progressTime: number;
  duration: number;
  pinned: boolean;
  wordCount: number;
  sentenceCount: number;
  noteCount: number;
  lastActivity: number;
}

interface UserInfo { email: string; credits: number }

/* ── main component ───────────────────────────────────────────── */
export default function NotebookPage() {
  const { t } = useApp();
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [vocabWords, setVocabWords] = useState<VocabItem[]>([]);
  const [sentences, setSentences] = useState<SavedSentence[]>([]);
  const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([]);

  const [activeTab, setActiveTab] = useState<"vocab" | "sentences" | "notes" | "talks">("vocab");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "az">("newest");
  const [groupByTalk, setGroupByTalk] = useState(true);
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const [expandedSents, setExpandedSents] = useState<Set<string | number>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [pinnedSlugs, setPinnedSlugs] = useState<Set<string>>(new Set());
  const [historyMap, setHistoryMap] = useState<Map<string, HistoryItem>>(new Map());

  /* ── load from localStorage ───────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tedmaster_vocab");
      if (raw) setVocabWords(JSON.parse(raw));
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem("tedmaster_sentences");
      if (raw) setSentences(JSON.parse(raw));
    } catch { /* ignore */ }

    // Load pinned slugs
    try {
      const pinned: string[] = JSON.parse(localStorage.getItem("tm_pinned_talks") || "[]");
      setPinnedSlugs(new Set(pinned));
    } catch { /* ignore */ }

    // Scan all note keys
    const groups: NoteGroup[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("tm_notes_")) continue;
      const talkUrl = key.replace("tm_notes_", "");
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const notesObj: Record<string, string> = JSON.parse(raw);
        const entries = Object.entries(notesObj)
          .filter(([, v]) => v?.trim())
          .map(([id, text]) => ({ id, text }));
        if (entries.length > 0) {
          groups.push({ talkSlug: slugFromUrl(talkUrl), talkUrl, entries });
        }
      } catch { /* ignore */ }
    }
    setNoteGroups(groups);
  }, []);

  /* ── auth + DB sync ─────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const { user: u } = await res.json();
        setUser(u);

        const [vRes, sRes, hRes, nRes] = await Promise.all([
          fetch("/api/user/vocab"),
          fetch("/api/user/sentences"),
          fetch("/api/user/history"),
          fetch("/api/user/notes"),
        ]);
        if (vRes.ok) {
          const { words: dbWords }: { words: VocabItem[] } = await vRes.json();
          setVocabWords(prev => {
            const map = new Map(prev.map(w => [w.word, w]));
            dbWords.forEach((w: VocabItem) => map.set(w.word, w));
            const merged = Array.from(map.values());
            localStorage.setItem("tedmaster_vocab", JSON.stringify(merged));
            return merged;
          });
        }
        if (sRes.ok) {
          const { sentences: dbSents }: { sentences: SavedSentence[] } = await sRes.json();
          setSentences(prev => {
            const map = new Map(prev.map(s => [`${s.talkSlug || ""}:${s.id}`, s]));
            dbSents.forEach((s: SavedSentence) => map.set(`${s.talkSlug || ""}:${s.id}`, s));
            const merged = Array.from(map.values());
            localStorage.setItem("tedmaster_sentences", JSON.stringify(merged));
            return merged;
          });
        }
        if (nRes?.ok) {
          const { allNotes }: { allNotes: { talkKey: string; notes: Record<string, string> }[] } = await nRes.json();
          setNoteGroups(prev => {
            const map = new Map(prev.map(g => [g.talkUrl, g]));
            allNotes.forEach(({ talkKey, notes }) => {
              const entries = Object.entries(notes)
                .filter(([, v]) => v?.trim())
                .map(([id, text]) => ({ id, text }));
              if (entries.length > 0) {
                map.set(talkKey, { 
                  talkSlug: slugFromUrl(talkKey), 
                  talkUrl: talkKey, 
                  entries 
                });
                localStorage.setItem(`tm_notes_${talkKey}`, JSON.stringify(notes));
              }
            });
            return Array.from(map.values());
          });
        }
        if (hRes.ok) {
          const histArr: HistoryItem[] = await hRes.json();
          const map = new Map<string, HistoryItem>();
          histArr.forEach(h => {
            const slug = h.talkSlug || slugFromUrl(h.videoUrl);
            map.set(slug, h);
          });
          setHistoryMap(map);
          // Merge DB pinned state into localStorage
          const dbPinned = histArr.filter(h => h.pinned).map(h => h.talkSlug || slugFromUrl(h.videoUrl));
          if (dbPinned.length > 0) {
            setPinnedSlugs(prev => {
              const next = new Set([...prev, ...dbPinned]);
              localStorage.setItem("tm_pinned_talks", JSON.stringify([...next]));
              return next;
            });
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── delete handlers ────────────────────────────────────────── */
  const removeWord = useCallback((word: string) => {
    setVocabWords(prev => {
      const next = prev.filter(w => w.word !== word);
      localStorage.setItem("tedmaster_vocab", JSON.stringify(next));
      return next;
    });
    if (user) fetch("/api/user/vocab", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    }).catch(() => {});
  }, [user]);

  const removeSentence = useCallback((sentence: SavedSentence) => {
    setSentences(prev => {
      const next = prev.filter(s => !(s.id === sentence.id && (s.talkSlug || "") === (sentence.talkSlug || "")));
      localStorage.setItem("tedmaster_sentences", JSON.stringify(next));
      return next;
    });
    if (user) {
      const sentenceKey = `${sentence.talkSlug || ""}:${sentence.id}`;
      fetch("/api/user/sentences", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceKey }),
      }).catch(() => {});
    }
  }, [user]);

  const togglePin = useCallback((slug: string, videoUrl: string) => {
    setPinnedSlugs(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      localStorage.setItem("tm_pinned_talks", JSON.stringify([...next]));
      return next;
    });
    if (user) {
      fetch("/api/user/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, pinned: !pinnedSlugs.has(slug) }),
      }).catch(() => {});
    }
  }, [user, pinnedSlugs]);

  const removeNote = useCallback((talkUrl: string, noteId: string) => {
    const key = `tm_notes_${talkUrl}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const obj: Record<string, string> = JSON.parse(raw);
      delete obj[noteId];
      localStorage.setItem(key, JSON.stringify(obj));
      setNoteGroups(prev =>
        prev.map(g => g.talkUrl === talkUrl
          ? { ...g, entries: g.entries.filter(e => e.id !== noteId) }
          : g
        ).filter(g => g.entries.length > 0)
      );
      if (user) fetch("/api/user/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talkKey: talkUrl, notes: obj }),
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [user]);

  /* ── export ─────────────────────────────────────────────────── */
  const exportTXT = () => {
    let out = "--- TEDMaster Learning Export ---\n\n";
    out += `[VOCABULARY] (${vocabWords.length})\n\n`;
    vocabWords.forEach(w => {
      out += `${w.word} [${w.phonetic}] (${w.partOfSpeech})\nDef: ${w.definitionZh}\nEx: ${w.exampleEn}\n\n`;
    });
    out += `\n[SENTENCES] (${sentences.length})\n\n`;
    sentences.forEach(s => { out += `${s.english}\n${s.translated}\n\n`; });
    out += `\n[NOTES]\n\n`;
    noteGroups.forEach(g => {
      out += `== ${slugToTitle(g.talkSlug)} ==\n`;
      g.entries.forEach(e => { out += `  #${e.id}: ${e.text}\n`; });
      out += "\n";
    });
    download("TEDMaster_Notebook.txt", out, "text/plain");
  };

  const exportCSV = () => {
    const rows = [["Word", "Phonetic", "Part of Speech", "Definition", "Tense", "Example EN", "Talk"]];
    vocabWords.forEach(w => rows.push([
      w.word, w.phonetic, w.partOfSpeech, w.definitionZh,
      w.tense || "", w.exampleEn, w.talkSlug || "",
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download("TEDMaster_Vocab.csv", csv, "text/csv");
  };

  const exportAnki = () => {
    const lines = vocabWords.map(w =>
      `${w.word} [${w.phonetic}]\t${w.definitionZh}\t${w.exampleEn}`
    );
    download("TEDMaster_Anki.tsv", lines.join("\n"), "text/tab-separated-values");
  };

  const download = (name: string, content: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── filtered & grouped data ─────────────────────────────────── */
  const q = searchQuery.toLowerCase().trim();

  const filteredWords = useMemo(() => {
    let list = [...vocabWords];
    if (q) list = list.filter(w =>
      w.word.toLowerCase().includes(q) ||
      w.definitionZh?.toLowerCase().includes(q) ||
      w.exampleEn?.toLowerCase().includes(q) ||
      w.talkSlug?.toLowerCase().includes(q)
    );
    if (sortOrder === "newest") list.sort((a, b) => b.addedAt - a.addedAt);
    else if (sortOrder === "oldest") list.sort((a, b) => a.addedAt - b.addedAt);
    else list.sort((a, b) => a.word.localeCompare(b.word));
    return list;
  }, [vocabWords, q, sortOrder]);

  const filteredSents = useMemo(() => {
    let list = [...sentences];
    if (q) list = list.filter(s =>
      s.english?.toLowerCase().includes(q) ||
      s.translated?.toLowerCase().includes(q) ||
      s.talkSlug?.toLowerCase().includes(q)
    );
    if (sortOrder === "newest") list.sort((a, b) => b.addedAt - a.addedAt);
    else if (sortOrder === "oldest") list.sort((a, b) => a.addedAt - b.addedAt);
    else list.sort((a, b) => a.english.localeCompare(b.english));
    return list;
  }, [sentences, q, sortOrder]);

  const filteredNoteGroups = useMemo(() => {
    if (!q) return noteGroups;
    return noteGroups
      .map(g => ({ ...g, entries: g.entries.filter(e => e.text.toLowerCase().includes(q)) }))
      .filter(g => g.entries.length > 0);
  }, [noteGroups, q]);

  /* ── talk cards ─────────────────────────────────────────────── */
  const talkCards = useMemo((): TalkCard[] => {
    const slugSet = new Set<string>();
    vocabWords.forEach(w => w.talkSlug && slugSet.add(w.talkSlug));
    sentences.forEach(s => s.talkSlug && slugSet.add(s.talkSlug));
    noteGroups.forEach(g => g.talkSlug && slugSet.add(g.talkSlug));
    pinnedSlugs.forEach(s => slugSet.add(s));

    const cards: TalkCard[] = [];
    slugSet.forEach(slug => {
      // Load metadata from localStorage (written by watch page on every visit)
      let meta: Partial<TalkMeta> = {};
      try {
        const raw = localStorage.getItem(`tm_talk_meta_${slug}`);
        if (raw) meta = JSON.parse(raw);
      } catch { /* ignore */ }

      const hist = historyMap.get(slug);
      if (!meta.videoUrl && !hist?.videoUrl) return; // no URL = can't navigate

      const wordList = vocabWords.filter(w => w.talkSlug === slug);
      const sentList = sentences.filter(s => s.talkSlug === slug);
      const noteGroup = noteGroups.find(g => g.talkSlug === slug);
      const lastActivity = Math.max(
        0,
        ...wordList.map(w => w.addedAt),
        ...sentList.map(s => s.addedAt),
      );

      cards.push({
        talkSlug: slug,
        videoUrl: meta.videoUrl || hist?.videoUrl || "",
        title: meta.title || hist?.title || slugToTitle(slug),
        presenter: meta.presenter || hist?.presenter || "",
        thumbnail: meta.thumbnail || hist?.thumbnail || "",
        progressTime: hist?.progressTime || 0,
        duration: hist?.duration || 0,
        pinned: pinnedSlugs.has(slug),
        wordCount: wordList.length,
        sentenceCount: sentList.length,
        noteCount: noteGroup?.entries.length || 0,
        lastActivity,
      });
    });

    return cards.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastActivity - a.lastActivity;
    });
  }, [vocabWords, sentences, noteGroups, historyMap, pinnedSlugs]);

  /* ── grouping ────────────────────────────────────────────────── */
  function groupBySlug<T extends { talkSlug?: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    items.forEach(item => {
      const key = item.talkSlug || "_unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }

  const wordGroups = useMemo(() => groupBySlug(filteredWords), [filteredWords]);
  const sentGroups = useMemo(() => groupBySlug(filteredSents), [filteredSents]);

  /* ── stats ───────────────────────────────────────────────────── */
  const allTalks = useMemo(() => {
    const slugs = new Set<string>();
    vocabWords.forEach(w => w.talkSlug && slugs.add(w.talkSlug));
    sentences.forEach(s => s.talkSlug && slugs.add(s.talkSlug));
    noteGroups.forEach(g => slugs.add(g.talkSlug));
    return slugs.size;
  }, [vocabWords, sentences, noteGroups]);

  const totalNotes = useMemo(() =>
    noteGroups.reduce((acc, g) => acc + g.entries.length, 0), [noteGroups]);

  /* ── logout ──────────────────────────────────────────────────── */
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.reload();
  };

  /* ── render helpers ──────────────────────────────────────────── */
  const TalkHeader = ({ slug }: { slug: string }) => (
    <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
      <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
        <BookOpen size={12} className="text-accent" />
      </div>
      <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest truncate">
        {slug === "_unknown" ? "General" : slugToTitle(slug)}
      </span>
      <div className="flex-1 h-px bg-border/20" />
    </div>
  );

  const renderWords = (words: VocabItem[]) =>
    words.map(item => {
      const expanded = expandedWords.has(item.word);
      return (
        <div key={item.word}
          className="bg-white border-2 border-border rounded-xl shadow-pop mb-3 overflow-hidden">
          <div className="flex items-start gap-3 p-4 cursor-pointer"
            onClick={() => setExpandedWords(prev => {
              const next = new Set(prev);
              expanded ? next.delete(item.word) : next.add(item.word);
              return next;
            })}>
            <button
              onClick={e => { e.stopPropagation(); speak(item.word); }}
              className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center hover:bg-accent/20 transition-colors mt-0.5">
              <Volume2 size={13} className="text-accent" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-base text-foreground">{item.word}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-accent text-white">{item.partOfSpeech}</span>
                {item.tense && <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-tertiary/30 text-foreground border border-tertiary/40">{item.tense}</span>}
              </div>
              <span className="text-xs font-mono text-muted-foreground">{item.phonetic}</span>
              {!expanded && <p className="text-sm text-foreground mt-1 line-clamp-1">{item.definitionZh}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={e => { e.stopPropagation(); removeWord(item.word); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary/50 hover:text-secondary hover:bg-secondary/10 transition-colors">
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
              {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </div>
          </div>

          {expanded && (
            <div className="px-4 pb-4 border-t border-dashed border-border/20 pt-3 space-y-3">
              <p className="text-sm font-medium text-foreground">{item.definitionZh}</p>
              {item.synonyms?.length ? (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t.synonyms}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.synonyms.map(s => <span key={s} className="text-xs px-2 py-0.5 bg-quaternary/20 border border-quaternary/30 rounded-full font-bold text-foreground">{s}</span>)}
                  </div>
                </div>
              ) : null}
              {item.antonyms?.length ? (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t.antonyms}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.antonyms.map(s => <span key={s} className="text-xs px-2 py-0.5 bg-secondary/20 border border-secondary/30 rounded-full font-bold text-foreground">{s}</span>)}
                  </div>
                </div>
              ) : null}
              {item.phrases?.length ? (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t.collocations}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.phrases.map(s => <span key={s} className="text-xs px-2 py-0.5 bg-tertiary/20 border border-tertiary/30 rounded-full font-bold text-foreground">{s}</span>)}
                  </div>
                </div>
              ) : null}
              <div className="p-3 bg-background rounded-lg border border-dashed border-border/30">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t.example}</p>
                <p className="text-sm font-bold text-foreground italic">{item.exampleEn}</p>
                {item.exampleZh && <p className="text-xs text-muted-foreground mt-1">{item.exampleZh}</p>}
              </div>
              <p className="text-[9px] text-muted-foreground text-right">{new Date(item.addedAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      );
    });

  const renderSentences = (sents: SavedSentence[]) =>
    sents.map(item => {
      const expanded = expandedSents.has(item.id);
      return (
        <div key={item.id}
          className="bg-white border-2 border-border rounded-xl shadow-pop mb-3 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedSents(prev => {
                const next = new Set(prev);
                expanded ? next.delete(item.id) : next.add(item.id);
                return next;
              })}>
                <p className="text-sm font-bold text-foreground leading-relaxed">{item.english}</p>
                <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-accent pl-2">{item.translated}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => removeSentence(item)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary/50 hover:text-secondary hover:bg-secondary/10 transition-colors">
                  <Trash2 size={13} strokeWidth={2.5} />
                </button>
                {item.analysis && (
                  <button onClick={() => setExpandedSents(prev => {
                    const next = new Set(prev);
                    expanded ? next.delete(item.id) : next.add(item.id);
                    return next;
                  })} className="w-7 h-7 flex items-center justify-center rounded-lg text-accent/50 hover:text-accent hover:bg-accent/10 transition-colors">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {expanded && item.analysis && (
            <div className="px-4 pb-4 border-t border-dashed border-border/20 pt-3 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-accent" strokeWidth={2.5} />
                <span className="text-[10px] font-black text-accent uppercase tracking-widest">{t.aiAnalysis}</span>
              </div>
              <div className="p-3 bg-background rounded-lg border border-dashed border-border/30">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t.structure}</p>
                <p className="text-xs font-bold text-foreground">{item.analysis.structureZh}</p>
              </div>
              {item.analysis.breakdown?.map((b: any, i: number) => (
                <div key={i} className="flex gap-2 text-xs bg-accent/5 border border-accent/10 p-2 rounded-lg">
                  <span className="font-black text-accent shrink-0">{b.label}:</span>
                  <span className="font-medium text-foreground">{b.content}</span>
                </div>
              ))}
              {item.analysis.insights?.map((ins: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-white border-2 border-border shadow-pop-active relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
                  <p className="font-black text-secondary text-[11px] mb-1">{ins.title}</p>
                  <p className="text-[10px] font-medium text-foreground leading-normal">{ins.content}</p>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground text-right">{new Date(item.addedAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      );
    });

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="sticky top-4 mx-4 sm:mx-8 z-[100] flex items-center justify-between px-6 py-3 bg-white border-2 border-border rounded-2xl shadow-pop">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-accent border-2 border-border rounded-xl shadow-pop flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform">
            <Zap className="text-white fill-white" size={20} strokeWidth={2.5} />
          </div>
          <span className="font-black text-2xl tracking-tight text-foreground hidden sm:inline">
            TED<span className="text-accent underline decoration-tertiary decoration-4 underline-offset-4">Master</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center">
            <BookMarked size={15} className="text-accent" strokeWidth={2.5} />
          </div>
          <span className="font-black text-lg tracking-tight text-foreground">Notebook</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Export */}
          <div className="relative">
            <button onClick={() => setShowExport(v => !v)}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-border rounded-xl shadow-pop hover:scale-105 active:scale-95 transition-all"
              title="Export">
              <Download size={17} strokeWidth={2.5} className="text-foreground" />
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 mt-3 bg-white border-2 border-border rounded-2xl shadow-pop-lg z-50 py-3 min-w-[200px] animate-in slide-in-from-top-2 duration-200">
                  {[
                    { icon: <FileText size={14} />, label: "Export TXT", action: exportTXT },
                    { icon: <FileSpreadsheet size={14} />, label: "Export CSV (Vocab)", action: exportCSV },
                    { icon: <GraduationCap size={14} />, label: "Export Anki TSV", action: exportAnki },
                  ].map((item, i) => (
                    <button key={i} onClick={() => { item.action(); setShowExport(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-foreground hover:bg-accent/5 transition-colors uppercase tracking-widest">
                      <span className="text-accent">{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Back to player */}
          <button onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-border rounded-xl shadow-pop hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest text-foreground">
            <ArrowLeft size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Auth */}
          {user ? (
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-border rounded-xl shadow-pop hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest text-muted-foreground">
              <LogOut size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          ) : (
            <Link href="/"
              className="flex items-center gap-2 px-4 py-2 bg-accent border-2 border-border rounded-xl shadow-pop hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest text-white">
              <LogIn size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">{t.login}</span>
            </Link>
          )}
        </div>
      </header>

      {/* ── Stats Bar ─────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 pt-6 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t.wordsTab, value: vocabWords.length, color: "bg-accent", icon: <BookMarked size={16} className="text-white" />, tab: "vocab" as const },
            { label: t.sentencesTab, value: sentences.length, color: "bg-secondary", icon: <Sparkles size={16} className="text-white" />, tab: "sentences" as const },
            { label: t.notesTab, value: totalNotes, color: "bg-tertiary", icon: <StickyNote size={16} className="text-white" />, tab: "notes" as const },
            { label: "Studied", value: allTalks, color: "bg-quaternary", icon: <BookOpen size={16} className="text-white" />, tab: "talks" as const },
          ].map((stat, i) => (
            <div key={i} onClick={() => stat.tab && setActiveTab(stat.tab)}
              className={`bg-white border-2 border-border rounded-2xl shadow-pop p-4 flex items-center gap-3 ${stat.tab ? "cursor-pointer hover:shadow-pop-hover hover:-translate-y-0.5 transition-all" : ""}`}>
              <div className={`w-10 h-10 ${stat.color} rounded-xl border-2 border-border shadow-pop-active flex items-center justify-center shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-black text-foreground leading-none">{stat.value}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + Sort ─────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-4 flex gap-3 items-center flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search words, sentences, notes..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border-2 border-border rounded-xl shadow-pop-active text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}
          className="px-3 py-2.5 bg-white border-2 border-border rounded-xl shadow-pop-active text-xs font-black text-foreground uppercase tracking-widest focus:outline-none focus:border-accent cursor-pointer">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">A → Z</option>
        </select>

        <button onClick={() => setGroupByTalk(v => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 border-2 border-border rounded-xl shadow-pop-active text-xs font-black uppercase tracking-widest transition-all
            ${groupByTalk ? "bg-accent text-white" : "bg-white text-foreground"}`}>
          <Filter size={13} strokeWidth={2.5} />
          By Talk
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 pb-2">
        <div className="flex gap-2 p-1.5 bg-white border-2 border-border rounded-2xl shadow-pop w-fit">
          {([
            { id: "vocab", label: t.wordsTab, count: filteredWords.length, color: "bg-accent" },
            { id: "sentences", label: t.sentencesTab, count: filteredSents.length, color: "bg-secondary" },
            { id: "notes", label: t.notesTab, count: filteredNoteGroups.reduce((a, g) => a + g.entries.length, 0), color: "bg-tertiary" },
            { id: "talks", label: "Talks", count: talkCards.length, color: "bg-quaternary" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                ${activeTab === tab.id
                  ? `${tab.color} text-white border-2 border-border shadow-pop-active translate-y-[-1px]`
                  : "text-muted-foreground hover:text-foreground border-2 border-transparent"
                }`}>
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] border
                ${activeTab === tab.id ? "bg-white/20 text-white border-white/20" : "bg-muted text-muted-foreground border-border/20"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <main className="flex-1 px-4 sm:px-8 pb-12 pt-2">

        {/* Vocabulary */}
        {activeTab === "vocab" && (
          filteredWords.length === 0 ? (
            <EmptyState icon={<BookMarked size={32} />} text={q ? "No words match your search." : t.vocabEmpty} />
          ) : groupByTalk ? (
            Array.from(wordGroups.entries()).map(([slug, words]) => (
              <div key={slug}>
                <TalkHeader slug={slug} />
                {renderWords(words)}
              </div>
            ))
          ) : (
            renderWords(filteredWords)
          )
        )}

        {/* Sentences */}
        {activeTab === "sentences" && (
          filteredSents.length === 0 ? (
            <EmptyState icon={<Sparkles size={32} />} text={q ? "No sentences match your search." : t.sentEmpty} />
          ) : groupByTalk ? (
            Array.from(sentGroups.entries()).map(([slug, sents]) => (
              <div key={slug}>
                <TalkHeader slug={slug} />
                {renderSentences(sents)}
              </div>
            ))
          ) : (
            renderSentences(filteredSents)
          )
        )}

        {/* Notes */}
        {activeTab === "notes" && (
          filteredNoteGroups.length === 0 ? (
            <EmptyState icon={<MessageSquare size={32} />} text={q ? "No notes match your search." : "No notes written yet."} />
          ) : (
            filteredNoteGroups.map(group => (
              <div key={group.talkUrl}>
                <TalkHeader slug={group.talkSlug} />
                {group.entries.map(entry => (
                  <div key={entry.id}
                    className="bg-white border-2 border-border border-dashed rounded-xl shadow-pop mb-3 p-4 relative group">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-quaternary/20 text-quaternary border border-quaternary/30 shrink-0 mt-0.5">
                        <MessageSquare size={13} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                          Sentence #{entry.id}
                        </p>
                        <p className="text-sm font-medium text-foreground leading-relaxed italic">"{entry.text}"</p>
                      </div>
                      <button onClick={() => removeNote(group.talkUrl, entry.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-secondary/50 hover:text-secondary hover:bg-secondary/10 transition-all shrink-0">
                        <Trash2 size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end mb-2">
                  <Link href={`/watch?url=${encodeURIComponent(group.talkUrl)}`}
                    className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline">
                    ↗ Go to talk
                  </Link>
                </div>
              </div>
            ))
          )
        )}

        {/* Talks */}
        {activeTab === "talks" && (
          talkCards.length === 0 ? (
            <EmptyState icon={<BookOpen size={32} />} text={"No talks yet.\nSave a word or sentence while watching to collect a talk."} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {talkCards.map(card => {
                const progress = card.duration > 0 ? Math.min(100, (card.progressTime / card.duration) * 100) : 0;
                const remaining = card.duration > 0 ? Math.max(0, card.duration - card.progressTime) : 0;
                return (
                  <div key={card.talkSlug}
                    className={`bg-white border-2 border-border rounded-2xl shadow-pop overflow-hidden flex flex-col transition-all hover:shadow-pop-hover hover:-translate-y-0.5
                      ${card.pinned ? "ring-2 ring-tertiary ring-offset-2" : ""}`}>
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      {card.thumbnail ? (
                        <img src={card.thumbnail} alt={card.title}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-accent/5 p-4 text-center">
                          <Zap size={32} className="text-accent/20 mb-2" />
                          <p className="text-[10px] font-black text-accent/40 uppercase tracking-tighter px-4 line-clamp-2">
                             {card.title}
                          </p>
                        </div>
                      )}
                      {/* Progress bar overlay */}
                      {progress > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                      {/* Pin badge */}
                      {card.pinned && (
                        <div className="absolute top-2 right-2 w-7 h-7 bg-tertiary border-2 border-border rounded-lg flex items-center justify-center shadow-pop-active">
                          <Star size={12} className="text-white fill-white" />
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-4 flex flex-col gap-3">
                      <div>
                        <h3 className="font-black text-sm text-foreground leading-snug line-clamp-2">{card.title}</h3>
                        {card.presenter && (
                          <p className="text-[11px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide">{card.presenter}</p>
                        )}
                      </div>

                      {/* Progress info */}
                      {card.duration > 0 && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          <Clock size={11} strokeWidth={2.5} />
                          <span>{Math.round(progress)}%</span>
                          {remaining > 0 && <span className="text-muted-foreground/60">· {fmtTime(remaining)} left</span>}
                        </div>
                      )}

                      {/* Content counts */}
                      <div className="flex items-center gap-3">
                        {card.wordCount > 0 && (
                          <button onClick={() => { setActiveTab("vocab"); setSearchQuery(card.talkSlug); }}
                            className="flex items-center gap-1.5 text-[10px] font-black text-accent hover:underline">
                            <BookMarked size={11} />{card.wordCount} {card.wordCount === 1 ? "word" : "words"}
                          </button>
                        )}
                        {card.sentenceCount > 0 && (
                          <button onClick={() => { setActiveTab("sentences"); setSearchQuery(card.talkSlug); }}
                            className="flex items-center gap-1.5 text-[10px] font-black text-secondary hover:underline">
                            <Sparkles size={11} />{card.sentenceCount} {card.sentenceCount === 1 ? "sentence" : "sentences"}
                          </button>
                        )}
                        {card.noteCount > 0 && (
                          <button onClick={() => { setActiveTab("notes"); setSearchQuery(card.talkSlug); }}
                            className="flex items-center gap-1.5 text-[10px] font-black text-quaternary hover:underline">
                            <MessageSquare size={11} />{card.noteCount} {card.noteCount === 1 ? "note" : "notes"}
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-dashed border-border/20">
                        <Link href={`/watch?url=${encodeURIComponent(card.videoUrl)}${card.progressTime > 5 ? `&t=${Math.floor(card.progressTime)}` : ""}`}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent border-2 border-border rounded-xl shadow-pop-active text-xs font-black text-white uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all">
                          <Play size={12} fill="currentColor" />
                          {card.progressTime > 5 ? "Continue" : "Watch"}
                        </Link>
                        <button onClick={() => togglePin(card.talkSlug, card.videoUrl)}
                          className={`w-10 h-10 flex items-center justify-center border-2 border-border rounded-xl shadow-pop-active transition-all hover:scale-105 active:scale-95
                            ${card.pinned ? "bg-tertiary" : "bg-white"}`}
                          title={card.pinned ? "Unpin" : "Pin to top"}>
                          <Star size={14} strokeWidth={2.5}
                            className={card.pinned ? "text-white fill-white" : "text-foreground"} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 opacity-30">
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm font-bold text-center max-w-[220px] whitespace-pre-line">{text}</p>
    </div>
  );
}
