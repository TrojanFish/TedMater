"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Play, Pause, Settings, Loader2, Sparkles, X,
  PlayCircle, Mic, FastForward, BookMarked, Sliders, Download,
  FileText, Video, FileCode, Check, Sun, Moon, ChevronDown, 
  Book, FileEdit, Maximize, PictureInPicture, Volume, Volume1, Volume2,
} from "lucide-react";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);
import Hls from "hls.js";
import LearningNotebook, { SavedSentence, VocabItem } from "@/components/LearningNotebook";
import { useApp, LANGS } from "@/lib/i18n";

interface TranscriptItem {
  id: number;
  startTime: number;
  english: string;
  translated: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ── Shared header controls (GitHub / Theme / Lang) ───────────── */
function HeaderControls() {
  const { t, theme, toggleTheme, lang, setLang } = useApp();
  const [showLang, setShowLang] = useState(false);
  const currentLang = LANGS.find(l => l.value === lang);
  return (
    <div className="flex items-center gap-1">
      <a href="https://github.com/TrojanFish/TedMater" target="_blank" rel="noopener noreferrer"
        className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-2)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")} title={t.github}>
        <GithubIcon />
      </a>
      <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors"
        style={{ color: "var(--text-2)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}>
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <div className="relative">
        <button onClick={() => setShowLang(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={{ color: "var(--text-2)", border: "1px solid var(--border)" }}>
          {currentLang?.short}<ChevronDown size={11} />
        </button>
        {showLang && (
          <div className="absolute right-0 mt-1 rounded-xl overflow-hidden shadow-xl z-[200] py-1 min-w-[140px]"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            {LANGS.map(l => (
              <button key={l.value} onClick={() => { setLang(l.value); setShowLang(false); }}
                className="w-full px-4 py-2 text-sm text-left transition-colors"
                style={{ color: lang === l.value ? "var(--accent)" : "var(--text)", background: lang === l.value ? "var(--accent-s)" : "transparent", fontWeight: lang === l.value ? 600 : 400 }}
                onMouseEnter={e => { if (lang !== l.value) e.currentTarget.style.background = "var(--bg-3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = lang === l.value ? "var(--accent-s)" : "transparent"; }}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main watch component ─────────────────────────────────────── */
function WatchContent() {
  const { lang, t } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoUrlParam = searchParams.get("url");

  const [data, setData] = useState<{ title: string; presenter: string; videoUrl: string; downloadUrl: string; isHls: boolean; transcript: TranscriptItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Display settings
  const [mainFontSize, setMainFontSize] = useState(18);
  const [subFontSize, setSubFontSize] = useState(13);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [mainColor, setMainColor] = useState("#ffffff");
  const [subColor, setSubColor] = useState("rgba(255,255,255,0.75)");
  const [volume, setVolume] = useState(1);

  // AI
  const [activeWord, setActiveWord] = useState<VocabItem & { loading?: boolean } | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<Record<number, { structureZh: string; breakdown: { label: string; content: string; explanation: string }[]; insights: { title: string; content: string }[] }>>({});
  const [analysisLoading, setAnalysisLoading] = useState<number | null>(null);
  const [vocabWords, setVocabWords] = useState<VocabItem[]>([]);
  const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);
  const [showVocab, setShowVocab] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printConfig, setPrintConfig] = useState({ vocab: true, script: true, analysis: true, notes: true });

  // Recording
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeParagraphRef = useRef<HTMLDivElement>(null);
  const [lastActiveIndex, setLastActiveIndex] = useState(-1);

  /* ── RAF sync ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const update = () => {
      if (videoRef.current) setCurrentTime(videoRef.current.currentTime * 1000 + subtitleOffset);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, subtitleOffset]);

  /* ── Hotkeys ───────────────────────────────────────────────── */
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setActiveWord(null); setShowExportMenu(false); setShowSettings(false); return; }
      if (activeWord || analysisLoading !== null) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); if (videoRef.current) videoRef.current.currentTime -= 5; }
      if (e.code === "ArrowRight") { e.preventDefault(); if (videoRef.current) videoRef.current.currentTime += 5; }
      if (e.key === "v" || e.key === "V") setShowVocab(v => !v);
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [activeWord, analysisLoading]);

  /* ── Initial fetch ─────────────────────────────────────────── */

  useEffect(() => {
    if (!videoUrlParam) { router.push("/"); return; }
    try {
      const saved = localStorage.getItem("tedmaster_vocab");
      if (saved) setVocabWords(JSON.parse(saved));
      const savedSents = localStorage.getItem("tedmaster_sentences");
      if (savedSents) setSavedSentences(JSON.parse(savedSents));
      const savedNotes = localStorage.getItem(`tm_notes_${videoUrlParam}`);
      if (savedNotes) setNotes(JSON.parse(savedNotes));
    } catch { 
      localStorage.removeItem("tedmaster_vocab"); 
      localStorage.removeItem("tedmaster_sentences");
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const tedLangMap: Record<string, string> = {
          "zh": "zh-cn",
          "zh-tw": "zh-tw",
          "ja": "ja",
          "en": "en"
        };
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            url: videoUrlParam, 
            targetLang: tedLangMap[lang] || "zh-cn" 
          }),
        });
        const result = await res.json();
        if (!res.ok) { router.push("/"); return; }
        setData(result);
      } catch { router.push("/"); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [videoUrlParam, router, lang]);

  /* ── HLS setup ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!data?.videoUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | null = null;
    if (data.isHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: false });
      hls.on(Hls.Events.ERROR, (_e, err) => {
        if (err.fatal) { hls!.destroy(); hls = null; if (data.downloadUrl) video.src = data.downloadUrl; }
      });
      hls.loadSource(data.videoUrl);
      hls.attachMedia(video);
    } else if (data.isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = data.videoUrl;
    } else {
      video.src = data.videoUrl;
    }
    return () => { if (hls) hls.destroy(); };
  }, [data]);

  /* ── Active index ──────────────────────────────────────────── */
  const findActiveIndex = useCallback(() => {
    if (!data?.transcript) return -1;
    let lo = 0, hi = data.transcript.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const item = data.transcript[mid], next = data.transcript[mid + 1];
      if (currentTime >= item.startTime && (!next || currentTime < next.startTime)) return mid;
      else if (currentTime < item.startTime) hi = mid - 1;
      else lo = mid + 1;
    }
    return -1;
  }, [data, currentTime]);

  const activeIndex = useMemo(() => findActiveIndex(), [findActiveIndex]);
  const activeItem = activeIndex !== -1 ? data?.transcript[activeIndex] : null;

  useEffect(() => {
    if (activeIndex !== -1 && activeIndex !== lastActiveIndex) {
      setLastActiveIndex(activeIndex);
      setTimeout(() => activeParagraphRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }, [activeIndex, lastActiveIndex]);

  /* ── Helpers ───────────────────────────────────────────────── */
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (!hasInteracted) setHasInteracted(true);
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };

  const saveToVocab = (wordData: VocabItem) => {
    setVocabWords(prev => {
      const newList = [...prev.filter(i => i.word !== wordData.word), { ...wordData, addedAt: Date.now() }];
      localStorage.setItem("tedmaster_vocab", JSON.stringify(newList));
      return newList;
    });
    setActiveWord(null);
  };

  const saveSentence = (item: TranscriptItem, analysis: any) => {
    setSavedSentences(prev => {
      const newList = [...prev.filter(i => i.id !== item.id), { 
        id: item.id, 
        english: item.english, 
        translated: item.translated, 
        analysis, 
        addedAt: Date.now() 
      }];
      localStorage.setItem("tedmaster_sentences", JSON.stringify(newList));
      return newList;
    });
  };

  const handleSaveNote = (id: number) => {
    setNotes(prev => {
      const newNotes = { ...prev, [id]: noteInput };
      localStorage.setItem(`tm_notes_${videoUrlParam}`, JSON.stringify(newNotes));
      return newNotes;
    });
    setEditingNoteId(null);
  };

  const startRecording = async (id: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder; audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const newUrl = URL.createObjectURL(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        setAudioUrls(prev => { if (prev[id]) URL.revokeObjectURL(prev[id]); return { ...prev, [id]: newUrl }; });
        setRecordingId(null); stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(); setRecordingId(id);
    } catch (e) { console.error(e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const handleDeepAnalyze = async (item: TranscriptItem, preloaded?: any) => {
    if (preloaded) { setAnalysisData(prev => ({ ...prev, [item.id]: preloaded })); return; }
    if (analysisData[item.id]) { const { [item.id]: _, ...rest } = analysisData; setAnalysisData(rest); return; }
    videoRef.current?.pause(); setIsPlaying(false);
    setAnalysisLoading(item.id);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", text: item.english }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setAnalysisData(prev => ({ ...prev, [item.id]: result }));
    } catch (e) { console.error(e); }
    finally { setAnalysisLoading(null); }
  };

  const exportSRT = () => {
    if (!data) return;
    const fmt = (ms: number) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), ms2 = ms % 1000; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms2).padStart(3,"0")}`; };
    const content = data.transcript.map((item, i) => `${i + 1}\n${fmt(item.startTime)} --> ${fmt(data.transcript[i + 1]?.startTime ?? item.startTime + 3000)}\n${item.english}\n${item.translated}\n`).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = `${data.title}.srt`; a.click();
    URL.revokeObjectURL(url); setShowExportMenu(false);
  };

  /* ── Loading screen ────────────────────────────────────────── */
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--text-2)" }}>{t.loadingTalk}</p>
    </div>
  );

  /* ── Print styles ──────────────────────────────────────────── */
  const printStyle = `@media print { html,body{height:auto!important;overflow:visible!important;background:white!important;color:black!important} body>div,#__next>div{height:auto!important;overflow:visible!important} .print-hidden{display:none!important} #print-view{display:block!important} @page{margin:15mm 20mm;size:A4} }`;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Print view ── */}
      <div id="print-view" className="hidden-on-screen bg-white text-black w-full font-sans">
        <div style={{ borderBottom: "4px solid #E62B1E", paddingBottom: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#E62B1E", marginBottom: "3px" }}>TEDMaster · Learning Script</div>
              <div style={{ fontSize: "16px", fontWeight: 900 }}>{data?.title}</div>
              <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{data?.presenter}</div>
            </div>
            <div style={{ fontSize: "9px", color: "#aaa", textAlign: "right" }}>
              <div>{new Date().toLocaleDateString()}</div>
              <div>{data?.transcript?.length} sentences</div>
            </div>
          </div>
        </div>
        <div>
          {printConfig.vocab && vocabWords.length > 0 && (
            <div style={{ marginBottom: "20px", borderBottom: "1px dashed #eee", paddingBottom: "15px" }}>
               <h4 style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase", color: "#E62B1E", marginBottom: "8px" }}>Vocabulary List</h4>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {vocabWords.map((v, i) => (
                    <div key={i} style={{ fontSize: "9px", border: "1px solid #f5f5f5", padding: "6px", borderRadius: "4px" }}>
                       <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                         <span style={{ fontWeight: 700 }}>{v.word}</span>
                         <span style={{ color: "#aaa" }}>{v.partOfSpeech}</span>
                       </div>
                       <div style={{ color: "#666" }}>{v.definitionZh}</div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {printConfig.script && data?.transcript?.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0", borderBottom: "1px solid #f0f0f0", pageBreakInside: "avoid", breakInside: "avoid" }}>
              <span style={{ fontSize: "8px", color: "#ccc", fontFamily: "monospace", width: "20px", flexShrink: 0, paddingTop: "2px", textAlign: "right" }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", lineHeight: 1.5, color: "#111", fontWeight: 500 }}>{item.english}</div>
                {item.translated && <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#888", marginTop: "1px" }}>{item.translated}</div>}
                
                {printConfig.analysis && (analysisData[item.id] || savedSentences.find(s => s.id === item.id)?.analysis) && (
                   (() => {
                     const analysis = analysisData[item.id] || savedSentences.find(s => s.id === item.id)?.analysis;
                     return (
                       <div style={{ marginTop: "6px", padding: "8px", background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "6px" }}>
                          <div style={{ fontSize: "9px", fontWeight: 700, color: "#E62B1E", textTransform: "uppercase", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Sparkles size={8} /> AI Structure Analysis
                          </div>
                          <div style={{ fontSize: "10px", color: "#333", fontStyle: "italic", marginBottom: "6px" }}>{analysis.structureZh}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2px" }}>
                             {analysis.breakdown?.map((b: any, bi: number) => (
                               <div key={bi} style={{ display: "flex", gap: "6px", fontSize: "9px", borderLeft: "2px solid #E62B1E", paddingLeft: "6px" }}>
                                  <span style={{ fontWeight: 800, color: "#E62B1E", flexShrink: 0 }}>{b.label}</span>
                                  <span style={{ color: "#555" }}>{b.content}</span>
                               </div>
                             ))}
                          </div>
                          {analysis.insights?.length > 0 && (
                            <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px dashed #ddd" }}>
                               <div style={{ fontSize: "8px", fontWeight: 700, color: "#666", textTransform: "uppercase", marginBottom: "4px" }}>Insights</div>
                               <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px" }}>
                                  {analysis.insights.map((ins: any, ii: number) => (
                                    <div key={ii} style={{ fontSize: "9px" }}>
                                       <span style={{ fontWeight: 700, color: "#333" }}>{ins.title}: </span>
                                       <span style={{ color: "#666" }}>{ins.content}</span>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )}
                       </div>
                     );
                   })()
                )}

                {printConfig.notes && notes[item.id] && (
                  <div style={{ fontSize: "10px", color: "#E62B1E", fontStyle: "italic", marginTop: "4px", padding: "4px 8px", background: "#fdf2f2", borderRadius: "4px", borderLeft: "2px solid #E62B1E" }}>
                    Note: {notes[item.id]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#bbb" }}>
          <span>{data?.title}</span><span>TEDMaster · AI-Powered English Learning</span>
        </div>
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setShowPrintModal(false)}>
           <div className="w-full max-w-sm rounded-3xl shadow-2xl p-7" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-s)" }}>
                   <Download size={20} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                   <h3 className="text-xl font-bold">{t.exportConfig}</h3>
                   <p className="text-[11px] opacity-40">Customize your learning PDF</p>
                </div>
              </div>
              
              <div className="space-y-3">
                 {[
                   { id: "vocab", label: t.includeVocab, count: vocabWords.length, icon: <Book size={14} /> },
                   { id: "script", label: t.includeScript, count: data?.transcript.length, icon: <FileText size={14} /> },
                   { id: "analysis", label: t.includeAnalysis, count: Object.keys(analysisData).length || savedSentences.length, icon: <Sparkles size={14} /> },
                   { id: "notes", label: t.includeNotes, count: Object.values(notes).filter(Boolean).length, icon: <FileEdit size={14} /> }
                 ].map(opt => (
                   <label key={opt.id} className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-accent/20"
                     style={{ background: "var(--bg-3)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 opacity-60">{opt.icon}</div>
                        <span className="text-sm font-semibold">{opt.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] font-mono opacity-30">{opt.count}</span>
                         <input type="checkbox" checked={(printConfig as any)[opt.id]} onChange={e => setPrintConfig(prev => ({ ...prev, [opt.id]: e.target.checked }))} 
                           className="w-5 h-5 rounded-lg appearance-none cursor-pointer transition-all border-2" 
                           style={{ 
                             accentColor: "var(--accent)", 
                             borderColor: (printConfig as any)[opt.id] ? "var(--accent)" : "rgba(255,255,255,0.1)",
                             background: (printConfig as any)[opt.id] ? "var(--accent)" : "transparent"
                           }} />
                      </div>
                   </label>
                 ))}
              </div>

              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowPrintModal(false)} className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:bg-white/5" style={{ color: "var(--text-3)" }}>{t.close}</button>
                <button onClick={() => { setShowPrintModal(false); setTimeout(() => window.print(), 100); }} 
                   className="flex-[2] py-3 rounded-2xl text-sm font-black text-white shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
                   style={{ background: "var(--accent)", boxShadow: "0 10px 25px -5px rgba(230,43,30,0.4)" }}>
                   {t.confirmPrint}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="h-14 flex items-center gap-3 px-4 border-b shrink-0 print-hidden"
        style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
        <button onClick={() => router.push("/")} className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--text-2)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{data?.title}</h1>
        <HeaderControls />
        <div className="w-px h-6 mx-1" style={{ background: "var(--border)" }} />
        {/* Vocab */}
        <button onClick={() => setShowVocab(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{ background: showVocab ? "var(--accent)" : "var(--bg-3)", color: showVocab ? "#fff" : "var(--text-2)" }}>
          <BookMarked size={15} />{t.vocab}
          {vocabWords.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: showVocab ? "rgba(255,255,255,0.25)" : "var(--accent-s)", color: showVocab ? "#fff" : "var(--accent)" }}>{vocabWords.length}</span>}
        </button>
        {/* Export */}
        <div className="relative">
          <button onClick={() => setShowExportMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: showExportMenu ? "var(--accent)" : "var(--bg-3)", color: showExportMenu ? "#fff" : "var(--text-2)" }}>
            <Download size={15} />{t.exportLabel}
          </button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 rounded-xl shadow-xl z-[102] py-1"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              {[
                { icon: <Video size={15} />, label: t.downloadVideo, action: () => { if (data?.downloadUrl) { const a = document.createElement("a"); a.href = data.downloadUrl; a.download = `${data.title}.mp4`; a.target = "_blank"; a.click(); } setShowExportMenu(false); }, disabled: !data?.downloadUrl },
                { icon: <FileText size={15} />, label: t.exportPdf, action: () => { setShowExportMenu(false); setShowPrintModal(true); }, disabled: false },
                { icon: <FileCode size={15} />, label: t.exportSrt, action: exportSRT, disabled: false },
              ].map((item, i) => (
                <button key={i} onClick={item.disabled ? undefined : item.action} disabled={item.disabled}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-30"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => !item.disabled && (e.currentTarget.style.background = "var(--bg-3)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ color: "var(--accent)" }}>{item.icon}</span>{item.label}
                  {!item.disabled && <Check size={13} className="ml-auto" style={{ color: "var(--text-3)" }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Main layout ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden print-hidden">

        {/* Notebook overlay */}
        {showVocab && (
          <div className="absolute top-14 right-0 w-80 bottom-0 z-50 p-3">
            <LearningNotebook 
              words={vocabWords}
              sentences={savedSentences}
              notes={notes}
              onRemoveWord={w => setVocabWords(prev => { 
                const next = prev.filter(i => i.word !== w); 
                localStorage.setItem("tedmaster_vocab", JSON.stringify(next)); 
                return next; 
              })}
              onRemoveSentence={id => setSavedSentences(prev => {
                const next = prev.filter(i => i.id !== id);
                localStorage.setItem("tedmaster_sentences", JSON.stringify(next));
                return next;
              })}
              onSelectWord={word => { videoRef.current?.pause(); setIsPlaying(false); setActiveWord(word); }}
              onSelectSentence={sent => {
                if (videoRef.current) {
                  if (typeof sent.id === "number") {
                    const item = data?.transcript.find(t => t.id === sent.id);
                    if (item) { videoRef.current.currentTime = (item.startTime - subtitleOffset) / 1000; videoRef.current.play(); setIsPlaying(true); }
                  }
                  handleDeepAnalyze({ id: sent.id as number, english: sent.english, translated: sent.translated, startTime: 0 }, sent.analysis);
                }
              }}
              onSelectNote={id => {
                const item = data?.transcript.find(t => t.id === id);
                if (item && videoRef.current) { videoRef.current.currentTime = (item.startTime - subtitleOffset) / 1000; videoRef.current.play(); setIsPlaying(true); }
              }}
            />
          </div>
        )}

        {/* ── Video player ─────────────────────────────────────── */}
        <section className="flex-[3] flex flex-col bg-black overflow-hidden">
          {/* Video */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onLoadedMetadata={() => setDuration((videoRef.current?.duration ?? 0) * 1000)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
            />
            {/* Subtitle overlay */}
            {hasInteracted && activeItem && (
              <div className="absolute bottom-6 left-0 right-0 px-8 text-center pointer-events-none">
                <p className="font-bold leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,1)]"
                  style={{ fontSize: mainFontSize, color: mainColor }}>{activeItem.english}</p>
                {activeItem.translated && (
                  <p className="mt-1 font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,1)]"
                    style={{ fontSize: subFontSize, color: subColor }}>{activeItem.translated}</p>
                )}
              </div>
            )}
            {/* Start overlay */}
            {!hasInteracted && (
              <div onClick={togglePlay} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 cursor-pointer" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--accent)", boxShadow: "0 0 40px rgba(230,43,30,0.5)" }}>
                  <Play size={32} fill="white" color="white" className="ml-1" />
                </div>
                <p className="text-sm font-medium text-white/60">{data?.title}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="shrink-0 px-4 pb-4 pt-3 relative z-30" style={{ background: "rgba(0,0,0,0.85)" }}>
            {/* Progress bar */}
            <div className="relative h-5 flex items-center mb-3 group/seek">
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div className="h-full rounded-full" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, background: "var(--accent)" }} />
                </div>
              </div>
              <input type="range" min={0} max={duration || 100} value={currentTime}
                onChange={e => { const v = Number(e.target.value); if (videoRef.current) videoRef.current.currentTime = (v - subtitleOffset) / 1000; setCurrentTime(v); }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            </div>
            {/* Buttons row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white">
                  {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" />}
                </button>
                {/* Volume Control */}
                <div className="flex items-center group/vol gap-2">
                   <button onClick={() => { const nv = volume > 0 ? 0 : 1; setVolume(nv); if (videoRef.current) videoRef.current.volume = nv; }} 
                     className="p-1 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                     {volume === 0 ? <Volume size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                   </button>
                   <input type="range" min="0" max="1" step="0.01" value={volume} 
                     onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) videoRef.current.volume = v; }}
                     className="w-0 group-hover/vol:w-20 transition-all overflow-hidden h-1 cursor-pointer accent-white" />
                </div>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Speed */}
                <div className="relative">
                  <button onClick={() => { if (!hasInteracted) setHasInteracted(true); setShowSpeedMenu(v => !v); setShowSettings(false); }}
                    className="px-3 py-1 rounded text-xs font-bold border transition-all"
                    style={{ color: showSpeedMenu ? "var(--accent)" : "rgba(255,255,255,0.6)", borderColor: showSpeedMenu ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
                    {playbackRate}×
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 right-0 rounded-xl overflow-hidden shadow-2xl z-50 w-24"
                      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                      {SPEEDS.map(r => (
                        <button key={r} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = r; setPlaybackRate(r); setShowSpeedMenu(false); }}
                          className="block w-full px-5 py-2 text-sm text-left transition-colors"
                          style={{ color: r === playbackRate ? "var(--accent)" : "var(--text)", background: r === playbackRate ? "var(--accent-s)" : "transparent" }}
                          onMouseEnter={e => { if (r !== playbackRate) e.currentTarget.style.background = "var(--bg-3)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = r === playbackRate ? "var(--accent-s)" : "transparent"; }}>
                          {r}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Fullscreen & PiP */}
                <button onClick={() => videoRef.current?.requestPictureInPicture()} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white" title={t.pip}>
                  <PictureInPicture size={18} />
                </button>
                <button onClick={() => videoRef.current?.requestFullscreen()} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white" title={t.fullscreen}>
                  <Maximize size={18} />
                </button>
                {/* Settings */}
                <div className="relative">
                  <button onClick={() => { if (!hasInteracted) setHasInteracted(true); setShowSettings(v => !v); setShowSpeedMenu(false); }}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: showSettings ? "var(--accent)" : "rgba(255,255,255,0.6)" }}>
                    <Settings size={18} />
                  </button>
                  {showSettings && (
                    <div className="absolute bottom-full mb-3 right-0 rounded-xl p-5 shadow-2xl w-72 space-y-5 z-50"
                      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
                      onClick={e => e.stopPropagation()}>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}><Sliders size={12} className="inline mr-1" />{t.settings}</p>
                      <div className="grid grid-cols-2 gap-4">
                        {[{ label: t.mainSize, value: mainFontSize, set: setMainFontSize, min: 14, max: 36 },
                          { label: t.subSize, value: subFontSize, set: setSubFontSize, min: 10, max: 26 }].map(s => (
                          <div key={s.label} className="space-y-1.5">
                            <div className="flex justify-between text-xs" style={{ color: "var(--text-2)" }}>
                              <span>{s.label}</span><span>{s.value}px</span>
                            </div>
                            <input type="range" min={s.min} max={s.max} value={s.value} onChange={e => s.set(Number(e.target.value))} className="w-full" />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs" style={{ color: "var(--text-2)" }}>
                          <span><FastForward size={11} className="inline mr-1" />{t.syncOffset}</span>
                          <span>{subtitleOffset > 0 ? "+" : ""}{(subtitleOffset / 1000).toFixed(1)}s</span>
                        </div>
                        <input type="range" min={-5000} max={5000} step={100} value={subtitleOffset} onChange={e => setSubtitleOffset(Number(e.target.value))} className="w-full" />
                      </div>

                      {/* Color Settings */}
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[10px] uppercase font-bold text-white/40 mb-2">{t.mainColor}</p>
                            <div className="flex gap-2">
                               {["#ffffff", "#ffd700", "#00ff00", "#00d4ff"].map(c => (
                                 <button key={c} onClick={() => setMainColor(c)} className="w-5 h-5 rounded-full border border-white/10 transition-transform active:scale-95" 
                                   style={{ background: c, outline: mainColor === c ? "2px solid var(--accent)" : "none", outlineOffset: "1px" }} />
                               ))}
                            </div>
                         </div>
                         <div>
                            <p className="text-[10px] uppercase font-bold text-white/40 mb-2">{t.subColor}</p>
                            <div className="flex gap-2">
                               {["rgba(255,255,255,0.75)", "rgba(255,215,0,0.7)", "rgba(0,255,0,0.7)", "#cccccc"].map(c => (
                                 <button key={c} onClick={() => setSubColor(c)} className="w-5 h-5 rounded-full border border-white/10 transition-transform active:scale-95" 
                                   style={{ background: c, outline: subColor === c ? "2px solid var(--accent)" : "none", outlineOffset: "1px" }} />
                               ))}
                            </div>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Transcript panel ──────────────────────────────────── */}
        <section className="flex-[2] flex flex-col overflow-hidden border-l" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
          <div className="px-4 py-3 border-b shrink-0 flex items-center gap-2" style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
            <div className="w-1 h-4 rounded-full" style={{ background: "var(--accent)" }} />
            <span className="text-sm font-bold">{t.transcript}</span>
            <span className="ml-auto text-xs" style={{ color: "var(--text-3)" }}>{data?.transcript?.length ?? 0}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
            {data?.transcript?.map((item, idx) => {
              const isActive = activeIndex === idx;
              return (
                <div key={item.id} ref={isActive ? activeParagraphRef : null}
                  onClick={() => { if (!hasInteracted) setHasInteracted(true); if (videoRef.current) { videoRef.current.currentTime = (item.startTime - subtitleOffset) / 1000; videoRef.current.play(); } }}
                  className="rounded-xl p-3 cursor-pointer transition-all group/item"
                  style={{
                    background: isActive ? "var(--bg-2)" : "transparent",
                    border: `1px solid ${isActive ? "var(--border)" : "transparent"}`,
                    opacity: isActive ? 1 : 0.55,
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "var(--bg-3)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.opacity = "0.55"; e.currentTarget.style.background = "transparent"; } }}>
                  {/* Sentence number + English */}
                  <div className="flex gap-2 items-start">
                    <span className="text-[10px] font-mono mt-0.5 w-6 shrink-0 text-right" style={{ color: "var(--text-3)" }}>{idx + 1}</span>
                    <div className="flex-1">
                      <p className="leading-relaxed font-medium" style={{ fontSize: mainFontSize - 2, color: isActive ? "var(--text)" : "inherit" }}>
                        {item.english.split(" ").map((w, i) => (
                          <span key={i} onClick={e => {
                            e.stopPropagation();
                            const clean = w.replace(/[^a-zA-Z'-]/g, "");
                            if (!clean) return;
                            (async () => {
                              videoRef.current?.pause(); setIsPlaying(false);
                              setWordLoading(true);
                              setActiveWord({ word: clean, loading: true } as VocabItem & { loading: boolean });
                              try {
                                const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "define", text: clean, context: item.english }) });
                                const result = await r.json();
                                if (!r.ok) throw new Error(result.error);
                                setActiveWord(result);
                              } catch { setActiveWord(null); }
                              finally { setWordLoading(false); }
                            })();
                          }}
                            className="inline cursor-pointer rounded px-0.5 transition-colors"
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-s)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            {w}{" "}
                          </span>
                        ))}
                      </p>
                      {item.translated && (
                        <p className="mt-0.5 leading-relaxed" style={{ fontSize: subFontSize - 1, color: "var(--text-2)" }}>{item.translated}</p>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 mt-2 pl-8 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); handleDeepAnalyze(item); }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: analysisData[item.id] ? "var(--accent)" : "var(--bg-3)", color: analysisData[item.id] ? "#fff" : "var(--text-2)" }}>
                      {analysisLoading === item.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      {t.analyzeBtn}
                    </button>
                    <button onClick={e => { e.stopPropagation(); recordingId === item.id ? stopRecording() : startRecording(item.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: recordingId === item.id ? "var(--accent)" : "var(--bg-3)", color: recordingId === item.id ? "#fff" : "var(--text-2)" }}>
                      <Mic size={13} />
                      {recordingId === item.id ? t.recording : t.recordBtn}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditingNoteId(editingNoteId === item.id ? null : item.id); setNoteInput(notes[item.id] || ""); }}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: notes[item.id] ? "var(--accent-s)" : "var(--bg-3)", color: notes[item.id] ? "var(--accent)" : "var(--text-2)" }}>
                      <FileText size={13} />
                      {notes[item.id] ? t.note : t.addNote}
                    </button>
                    {audioUrls[item.id] && (
                      <audio src={audioUrls[item.id]} controls className="h-6" style={{ maxWidth: "140px" }} />
                    )}
                  </div>

                  {/* Note Editor */}
                  {editingNoteId === item.id && (
                    <div className="mt-2 ml-8 space-y-2 p-3 rounded-xl card" onClick={e => e.stopPropagation()}>
                      <textarea
                        autoFocus
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        placeholder={t.notePlaceholder}
                        className="w-full bg-transparent border-none outline-none text-xs resize-none min-h-[60px]"
                        style={{ color: "var(--text)" }}
                      />
                      <div className="flex justify-end gap-2">
                         <button onClick={() => setEditingNoteId(null)} className="px-3 py-1 text-[10px] font-bold opacity-40">{t.close}</button>
                         <button onClick={() => handleSaveNote(item.id)} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>{t.saveNote}</button>
                      </div>
                    </div>
                  )}

                  {/* Note Display (not editing) */}
                  {notes[item.id] && editingNoteId !== item.id && (
                    <div className="mt-2 ml-8 p-3 rounded-xl card opacity-80 border-l-2 bg-accent-s" style={{ borderLeftColor: "var(--accent)" }}>
                       <p className="text-[11px] italic" style={{ color: "var(--text-2)" }}>{notes[item.id]}</p>
                    </div>
                  )}

                  {/* Analysis panel */}
                  {analysisData[item.id] && (
                    <div className="mt-3 ml-8 p-4 rounded-xl space-y-4" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>{t.structure}</p>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{analysisData[item.id].structureZh}</p>
                      </div>
                      <div className="space-y-2">
                        {analysisData[item.id].breakdown?.map((p, i) => (
                          <div key={i} className="grid grid-cols-[120px_1fr] gap-3 text-[11px] leading-relaxed items-start">
                            <span className="font-mono text-right font-bold pt-0.5" style={{ color: "var(--accent)" }}>{p.label}</span>
                            <div className="flex-1">
                              <span className="font-semibold" style={{ color: "var(--text)" }}>{p.content}</span>
                              {p.explanation && <span className="ml-2" style={{ color: "var(--text-2)" }}>{p.explanation}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                        <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{t.insights}</p>
                          <button onClick={e => { e.stopPropagation(); saveSentence(item, analysisData[item.id]); }}
                             className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold text-white transition-all"
                             style={{ background: savedSentences.some(s => s.id === item.id) ? "var(--text-3)" : "var(--accent)" }}>
                             <BookMarked size={11} />
                             {savedSentences.some(s => s.id === item.id) ? "SAVED" : t.saveSentence}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {analysisData[item.id].insights.map((ins, i) => (
                            <div key={i} className="text-xs space-y-0.5">
                              <p className="font-semibold" style={{ color: "var(--text)" }}>{ins.title}</p>
                              <p style={{ color: "var(--text-2)" }}>{ins.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      </main>

      {/* ── Word modal ─────────────────────────────────────────── */}
      {activeWord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print-hidden"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setActiveWord(null)}>
          <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}>

            {wordLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
                <p className="text-sm" style={{ color: "var(--text-2)" }}>{t.loading}</p>
              </div>
            ) : (
              <>
                {/* Modal header */}
                <div className="flex items-start justify-between p-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">{activeWord.word?.replace(/[^a-zA-Z'-]/g, "")}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>{activeWord.partOfSpeech}</span>
                      <span className="text-sm font-mono" style={{ color: "var(--text-2)" }}>{activeWord.phonetic}</span>
                      <button onClick={() => { const u = new SpeechSynthesisUtterance(activeWord.word); u.lang = "en-US"; u.rate = 0.85; speechSynthesis.speak(u); }}
                        className="p-1 rounded transition-colors" style={{ color: "var(--text-3)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                        <Volume2 size={15} />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setActiveWord(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-3)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                    <X size={18} />
                  </button>
                </div>

                {/* Modal body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                  {/* Meaning */}
                  <div className="p-4 rounded-xl" style={{ background: "var(--bg-3)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>{t.meaning}</p>
                    <p className="text-xl font-bold leading-snug">{activeWord.definitionZh}</p>
                    {activeWord.tense && <p className="text-xs mt-2 px-2 py-1 rounded inline-block" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>{activeWord.tense}</p>}
                  </div>

                  {/* Synonyms / Antonyms */}
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: t.synonyms, items: activeWord.synonyms }, { label: t.antonyms, items: activeWord.antonyms }].map(({ label, items }) => items?.length ? (
                      <div key={label} className="p-3 rounded-xl" style={{ background: "var(--bg-3)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>{label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((s: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full border" style={{ color: "var(--text-2)", borderColor: "var(--border)" }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    ) : null)}
                  </div>

                  {/* Collocations */}
                  {activeWord.phrases?.length ? (
                    <div className="p-3 rounded-xl" style={{ background: "var(--bg-3)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>{t.collocations}</p>
                      <div className="space-y-1">
                        {activeWord.phrases.map((p: string, i: number) => (
                          <p key={i} className="text-sm border-l-2 pl-3 py-0.5" style={{ color: "var(--text)", borderColor: "var(--accent)" }}>{p}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Example */}
                  {activeWord.exampleEn && (
                    <div className="p-3 rounded-xl" style={{ background: "var(--bg-3)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>{t.example}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>"{activeWord.exampleEn}"</p>
                      {activeWord.exampleZh && <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>"{activeWord.exampleZh}"</p>}
                    </div>
                  )}
                </div>

                {/* Save button */}
                <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <button onClick={() => saveToVocab(activeWord as VocabItem)}
                    className="w-full py-3 rounded-xl font-bold text-white transition-all"
                    style={{ background: "var(--accent)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-h)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}>
                    <BookMarked size={16} className="inline mr-2" />{t.saveWord}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    }>
      <WatchContent />
    </Suspense>
  );
}
