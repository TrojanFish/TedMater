"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Play, Pause, Volume2, Settings, Loader2, Sparkles, X,
  PlayCircle, Mic, FastForward, BookMarked, Sliders, Download, FileText, Video, FileCode, Check
} from "lucide-react";
import Hls from "hls.js";
import VocabBook, { VocabItem } from "@/components/VocabBook";

interface TranscriptItem {
  id: number;
  startTime: number;
  english: string;
  translated: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const COLORS = [
  { name: "Pure White", value: "#ffffff" },
  { name: "TED Red", value: "#ff2b1e" },
  { name: "Golden", value: "#ffd700" },
  { name: "Neon Cyan", value: "#00f3ff" },
  { name: "Soft Gray", value: "#a1a1aa" }
];
const FONTS = [
  { name: "Modern Sans", value: "var(--font-geist-sans)" },
  { name: "Elegant Serif", value: "serif" },
  { name: "Classic Mono", value: "monospace" }
];

function WatchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoUrlParam = searchParams.get("url");
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0);      
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Customization
  const [mainFontSize, setMainFontSize] = useState(20);
  const [subFontSize, setSubFontSize] = useState(14);
  const [mainColor, setMainColor] = useState("#ffffff");
  const [subColor, setSubColor] = useState("rgba(255,255,255,0.4)");
  const [fontFamily, setFontFamily] = useState("var(--font-geist-sans)");
  const [subtitleOffset, setSubtitleOffset] = useState(0);

  // AI & States
  const [activeWord, setActiveWord] = useState<any>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ [key: number]: any }>({});
  const [analysisLoading, setAnalysisLoading] = useState<number | null>(null);
  const [vocabWords, setVocabWords] = useState<VocabItem[]>([]);
  const [showVocab, setShowVocab] = useState(false);

  // Recording
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<{ [key: number]: string }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeParagraphRef = useRef<HTMLDivElement>(null);

  const [lastActiveIndex, setLastActiveIndex] = useState<number>(-1);

  // High Precision Sync — only loop when playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const update = () => {
      if (videoRef.current) {
        setCurrentTime((videoRef.current.currentTime * 1000) + subtitleOffset);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, subtitleOffset]);

  // Hotkeys
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActiveWord(null); setShowExportMenu(false); setShowSettings(false); return; }
      if (activeWord || analysisLoading !== null) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); if(videoRef.current) videoRef.current.currentTime -= 5; }
      if (e.code === 'ArrowRight') { e.preventDefault(); if(videoRef.current) videoRef.current.currentTime += 5; }
      if (e.key === 'v' || e.key === 'V') setShowVocab(prev => !prev);
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [activeWord, analysisLoading]);

  // Initial Fetch
  useEffect(() => {
    if (!videoUrlParam) { router.push("/"); return; }
    try {
      const savedVocab = localStorage.getItem("tedmaster_vocab");
      if (savedVocab) setVocabWords(JSON.parse(savedVocab));
    } catch { localStorage.removeItem("tedmaster_vocab"); }

    const fetchData = async () => {
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: videoUrlParam }),
        });
        const result = await res.json();
        if (!res.ok) { console.error(result.error); router.push("/"); return; }
        setData(result);
      } catch (e) { console.error(e); router.push("/"); } finally { setLoading(false); }
    };
    fetchData();
  }, [videoUrlParam, router]);

  // HLS
  useEffect(() => {
    if (!data?.videoUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | null = null;

    if (data.isHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: false });
      hls.on(Hls.Events.ERROR, (_e, err) => {
        if (err.fatal) {
          console.warn("[HLS] fatal error, falling back to src:", err);
          hls!.destroy(); hls = null;
          // Fallback: try direct src (works for MP4, may not work for m3u8)
          if (data.downloadUrl) video.src = data.downloadUrl;
        }
      });
      hls.loadSource(data.videoUrl);
      hls.attachMedia(video);
    } else if (data.isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = data.videoUrl;
    } else {
      video.src = data.videoUrl;
    }

    return () => { if (hls) hls.destroy(); };
  }, [data]);

  const findActiveIndex = useCallback(() => {
    if (!data?.transcript) return -1;
    let low = 0, high = data.transcript.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const item = data.transcript[mid], nextItem = data.transcript[mid + 1];
        if (currentTime >= item.startTime && (!nextItem || currentTime < nextItem.startTime)) return mid;
        else if (currentTime < item.startTime) high = mid - 1;
        else low = mid + 1;
    }
    return -1;
  }, [data, currentTime]);

  const activeIndex = useMemo(() => findActiveIndex(), [findActiveIndex]);
  const activeItem = activeIndex !== -1 ? data?.transcript[activeIndex] : null;

  useEffect(() => {
    if (activeIndex !== -1 && activeIndex !== lastActiveIndex) {
      setLastActiveIndex(activeIndex);
      setTimeout(() => {
        if (activeParagraphRef.current) activeParagraphRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [activeIndex, lastActiveIndex]);

  const formatTime = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (!hasInteracted) setHasInteracted(true);
      if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
      else { videoRef.current.pause(); setIsPlaying(false); }
    }
  };

  const saveToVocab = (wordData: any) => {
    setVocabWords(prev => {
      const newList = [...prev.filter(i => i.word !== wordData.word), { ...wordData, addedAt: Date.now() }];
      localStorage.setItem("tedmaster_vocab", JSON.stringify(newList)); return newList;
    });
    setActiveWord(null);
  };

  const startRecording = async (id: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder; audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const newUrl = URL.createObjectURL(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        setAudioUrls(prev => {
          if (prev[id]) URL.revokeObjectURL(prev[id]);
          return { ...prev, [id]: newUrl };
        });
        setRecordingId(null); stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(); setRecordingId(id);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
  };

  const handleDeepAnalyze = async (item: TranscriptItem) => {
    if (analysisData[item.id]) {
      const { [item.id]: _, ...rest } = analysisData; setAnalysisData(rest); return;
    }
    if (videoRef.current) { videoRef.current.pause(); setIsPlaying(false); }
    setAnalysisLoading(item.id);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action: "analyze", text: item.english }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "AI analysis failed");
      setAnalysisData(prev => ({ ...prev, [item.id]: result }));
    } catch (e) { console.error(e); } finally { setAnalysisLoading(null); }
  };

  const handleWordSelect = (word: VocabItem) => {
    if (videoRef.current) { videoRef.current.pause(); setIsPlaying(false); }
    setActiveWord(word);
  };

  const exportPDF = () => {
    setShowExportMenu(false);
    window.print();
  };

  const exportSRT = () => {
    const formatTime = (ms: number) => {
      const hh = Math.floor(ms / 3600000).toString().padStart(2, '0');
      const mm = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
      const ss = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
      const mms = (ms % 1000).toString().padStart(3, '0');
      return `${hh}:${mm}:${ss},${mms}`;
    };
    let content = data.transcript.map((item: TranscriptItem, i: number) => {
      const nextTime = data.transcript[i+1]?.startTime || item.startTime + 2000;
      return `${i + 1}\n${formatTime(item.startTime)} --> ${formatTime(nextTime)}\n${item.english}\n${item.translated}\n\n`;
    }).join("");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.title}_Subtitle.srt`; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const downloadVideoMP4 = () => {
    if(!data.downloadUrl) return;
    const a = document.createElement("a");
    a.href = data.downloadUrl; a.download = `${data.title}.mp4`; a.target = "_blank"; a.click();
    setShowExportMenu(false);
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-bg-deep text-white">
      <div className="flex flex-col items-center gap-6">
         <div className="w-16 h-16 border-4 border-ted-red border-t-transparent rounded-full animate-spin" />
         <p className="text-sm tracking-[0.5em] uppercase opacity-20">Syncing Nucleus...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-bg-deep text-white flex flex-col font-sans select-none overflow-hidden" style={{ fontFamily }}>
      
      {/* GLOBAL PRINT STYLE */}
      <style jsx global>{`
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
          }
          /* Release the h-screen / overflow-hidden root chain */
          body > div, #__next > div {
            height: auto !important;
            overflow: visible !important;
          }
          .print-hidden { display: none !important; }
          #print-view { display: block !important; }
          @page { margin: 15mm 20mm; size: A4; }
        }
      `}</style>

      {/* WEB UI */}
      <header className="h-16 px-6 flex items-center gap-4 glass-effect border-b border-white/10 z-[101] shrink-0 print-hidden">
        <button onClick={() => router.push("/")} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></button>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-bold truncate tracking-tight">{data?.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
             <button onClick={() => setShowExportMenu(!showExportMenu)} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border transition-all ${showExportMenu ? "bg-ted-red text-white border-ted-red shadow-lg" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                <Download className="w-4 h-4" />
                <span className="text-sm font-bold">Synergy Hub</span>
             </button>
             {showExportMenu && (
               <div className="absolute top-full mt-4 right-0 w-80 bg-neutral-900 border border-white/10 p-6 rounded-[2.5rem] shadow-4xl z-[102] animate-in slide-in-from-top-4 duration-300">
                  <div className="text-[10px] uppercase font-black text-ted-red tracking-[0.3em] mb-6">Expert Export Hub</div>
                  <div className="space-y-3">
                     <button onClick={downloadVideoMP4} className={`w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-ted-red/40 hover:bg-ted-red/5 transition-all text-left ${!data.downloadUrl ? 'opacity-30 grayscale cursor-not-allowed text-white/20':''}`}>
                        <div className="flex items-center gap-4">
                           <div className="p-2 bg-ted-red/20 rounded-xl"><Video className="w-5 h-5 text-ted-red" /></div>
                           <div className="space-y-0.5">
                              <div className="text-xs font-bold">Video Discovery</div>
                              <div className="text-[10px] opacity-40">Download as 1080p MP4</div>
                           </div>
                        </div>
                        {data.downloadUrl ? <Check className="w-4 h-4 text-ted-red" /> : <X className="w-4 h-4" />}
                     </button>
                     <button onClick={exportPDF} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-ted-red/40 hover:bg-ted-red/5 transition-all text-left">
                        <div className="flex items-center gap-4">
                           <div className="p-2 bg-ted-red/20 rounded-xl"><FileText className="w-5 h-5 text-ted-red" /></div>
                           <div className="space-y-0.5">
                              <div className="text-xs font-bold">Academic PDF</div>
                              <div className="text-[10px] opacity-40">Bilingual Learning Script</div>
                           </div>
                        </div>
                        <Check className="w-4 h-4 text-ted-red" />
                     </button>
                     <button onClick={exportSRT} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-ted-red/40 hover:bg-ted-red/5 transition-all text-left">
                        <div className="flex items-center gap-4">
                           <div className="p-2 bg-ted-red/20 rounded-xl"><FileCode className="w-5 h-5 text-ted-red" /></div>
                           <div className="space-y-0.5">
                              <div className="text-xs font-bold">SRT Subtitles</div>
                              <div className="text-[10px] opacity-40">Standard Time-Synced Format</div>
                           </div>
                        </div>
                        <Check className="w-4 h-4 text-ted-red" />
                     </button>
                  </div>
               </div>
             )}
          </div>

          <button onClick={() => setShowVocab(!showVocab)} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border transition-all ${showVocab ? "bg-ted-red text-white border-ted-red shadow-lg" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
            <BookMarked className="w-5 h-5" />
            <span className="text-sm font-bold">Vocabulary</span>
          </button>
        </div>
      </header>

      {/* Use md:flex-row to ensure horizontal layout on tablets/PCs */}
      <main className="flex-1 flex flex-col md:flex-row relative print-hidden h-[calc(100vh-64px)] overflow-hidden">
        {showVocab && (
          <div className="absolute top-0 right-0 w-96 h-full z-50 p-6">
             <VocabBook words={vocabWords} onRemove={(w) => setVocabWords(prev => prev.filter(i => i.word !== w))} onSelect={handleWordSelect} />
          </div>
        )}

        {/* Player section */}
        <section className="flex-[2] min-h-0 relative bg-black flex flex-col overflow-hidden group">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-contain" onLoadedMetadata={() => setDuration(videoRef.current!.duration * 1000)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onClick={togglePlay} />
            
            {hasInteracted && activeItem && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-5xl px-12 pointer-events-none text-center z-20">
                <p className="font-bold mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,1)] leading-tight" style={{ fontSize: `${mainFontSize + 8}px`, color: mainColor }}>{activeItem.english}</p>
                <p className="font-medium drop-shadow-lg leading-tight opacity-70" style={{ fontSize: `${subFontSize + 4}px`, color: subColor }}>{activeItem.translated}</p>
              </div>
            )}

            {!hasInteracted && (
              <div onClick={togglePlay} className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl cursor-pointer">
                <PlayCircle className="w-24 h-24 text-ted-red drop-shadow-[0_0_40px_rgba(230,43,30,0.6)] animate-pulse" />
                <p className="mt-8 text-xl font-bold tracking-[0.6em] text-white/50 uppercase">Synch Chronos</p>
              </div>
            )}
          </div>
          
          <div className={`p-6 bg-gradient-to-t from-black via-black/30 to-transparent transition-opacity z-40 ${showSettings || showSpeedMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
             <div className="relative h-6 flex items-center mb-6 px-2">
                <input type="range" min="0" max={duration || 100} value={currentTime} onChange={(e)=> { videoRef.current!.currentTime=(Number(e.target.value)-subtitleOffset)/1000; setCurrentTime(Number(e.target.value)); }} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-ted-red" />
                <div className="absolute left-2 h-1 bg-ted-red rounded-full pointer-events-none shadow-[0_0_10px_rgba(230,43,30,1)]" style={{ width: `calc(${duration > 0 ? (currentTime/duration)*100 : 0}% - 8px)` }} />
             </div>

             <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded-full">{isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white" />}</button>
                   <div className="text-xs font-mono opacity-40">{formatTime(currentTime)} / {formatTime(duration)}</div>
                </div>

                <div className="flex items-center gap-6">
                   <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowSpeedMenu(false); }} className={`p-2 rounded-xl transition-all ${showSettings ? "bg-ted-red text-white" : "text-white/40 hover:text-white"}`}><Settings className="w-6 h-6" /></button>
                      {showSettings && (
                        <div className="absolute bottom-full mb-6 right-0 bg-neutral-900/95 backdrop-blur-3xl border border-white/10 p-8 rounded-[3rem] shadow-4xl z-50 w-80 space-y-8 animate-in slide-in-from-bottom-6 duration-300" onClick={e=>e.stopPropagation()}>
                           <div className="space-y-6">
                              <div className="flex items-center gap-3 text-ted-red opacity-80 font-bold uppercase tracking-widest text-[10px]"><Sliders className="w-4 h-4" /> Lab Params</div>
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3"><span className="text-[9px] opacity-40 uppercase tracking-widest">Main Size</span><input type="range" min="14" max="48" value={mainFontSize} onChange={(e)=>setMainFontSize(Number(e.target.value))} className="w-full h-1 accent-ted-red" /></div>
                                <div className="space-y-3"><span className="text-[9px] opacity-40 uppercase tracking-widest">Sub Size</span><input type="range" min="10" max="32" value={subFontSize} onChange={(e)=>setSubFontSize(Number(e.target.value))} className="w-full h-1 accent-ted-red" /></div>
                              </div>
                              <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-[10px] opacity-40 uppercase flex items-center gap-2"><FastForward className="w-3 h-3" /> Sync Offset: {subtitleOffset}ms</span>
                                <input type="range" min="-3000" max="3000" step="100" value={subtitleOffset} onChange={(e)=>setSubtitleOffset(Number(e.target.value))} className="w-full h-1 accent-white" />
                              </div>
                           </div>
                           <div className="space-y-6 pt-6 border-t border-white/5">
                              <div className="flex flex-wrap gap-3">
                                 {COLORS.map(c => ( <button key={c.value} onClick={()=>setMainColor(c.value)} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${mainColor===c.value?'border-white shadow-[0_0_10px_white]':'border-transparent underline'}`} style={{ backgroundColor: c.value }} /> ))}
                              </div>
                              <div className="flex gap-2">
                                 {FONTS.map(f => ( <button key={f.value} onClick={()=>setFontFamily(f.value)} className={`flex-1 px-3 py-2 rounded-xl text-[10px] border transition-all ${fontFamily===f.value?'bg-ted-red border-ted-red shadow-lg':'bg-white/5 border-white/10'}`} style={{ fontFamily: f.value }}>{f.name}</button> ))}
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                   <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); setShowSettings(false); }} className={`px-5 py-2.5 bg-white/5 rounded-xl text-xs font-bold border border-white/10 transition-all ${showSpeedMenu ? "text-ted-red border-ted-red/40" : ""}`}>{playbackRate}x</button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-full mb-6 right-0 bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
                           {SPEEDS.map(r => ( <button key={r} onClick={() => { videoRef.current!.playbackRate=r; setPlaybackRate(r); setShowSpeedMenu(false); }} className={`block w-full px-8 py-4 text-sm hover:bg-ted-red transition-all ${r===playbackRate?'bg-ted-red text-white':'text-white/60'}`}>{r}x</button> ))}
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* Transcript Section */}
        <section className="flex-1 min-h-0 bg-neutral-950/50 flex flex-col overflow-hidden border-l border-white/5">
          <div className="p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <h2 className="font-bold text-sm tracking-widest flex items-center gap-2"><div className="w-1 h-4 bg-ted-red rounded-full" />SENTENCE MATRIX</h2>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar h-full">
            {data?.transcript?.map((item: TranscriptItem, idx: number) => (
              <div 
                key={item.id}
                ref={activeIndex === idx ? activeParagraphRef : null}
                onClick={() => { if (!hasInteracted) setHasInteracted(true); videoRef.current!.currentTime=(item.startTime-subtitleOffset)/1000; videoRef.current!.play(); }}
                className={`p-6 rounded-[2.5rem] transition-all cursor-pointer relative group/item border ${
                  activeIndex === idx 
                    ? "bg-white/[0.04] border-white/10 shadow-xl" 
                    : "border-transparent opacity-30 hover:opacity-100 hover:bg-white/[0.03]"
                }`}
              >
                {activeIndex === idx && <div className="absolute left-0 top-6 bottom-6 w-1 bg-ted-red rounded-full shadow-[0_0_15px_rgba(230,43,30,1)]" />}
                <p className="font-bold leading-relaxed mb-2" style={{ fontSize: `${mainFontSize}px`, color: activeIndex === idx ? mainColor : "rgba(255,255,255,0.7)" }}>
                  {item.english.split(" ").map((w, i) => (
                    <span key={i} onClick={(e) => { e.stopPropagation(); (async () => {
                      if(videoRef.current){ videoRef.current.pause(); setIsPlaying(false); }
                      const cleanWord = w.replace(/[^a-zA-Z'-]/g, '');
                      if (!cleanWord) return;
                      setWordLoading(true); setActiveWord({ word: cleanWord, loading: true });
                      try {
                        const r = await fetch("/api/ai", { method: "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action: "define", text: cleanWord, context: item.english }) });
                        const result = await r.json();
                        if (!r.ok) throw new Error(result.error || "AI request failed");
                        setActiveWord(result);
                      } catch (e) { console.error(e); setActiveWord(null); }
                      finally { setWordLoading(false); }
                    })(); }} className="inline-block hover:bg-ted-red/20 rounded px-1">{w}</span>
                  ))}
                </p>
                {item.translated && <p className="italic font-medium leading-relaxed" style={{ fontSize: `${subFontSize}px`, color: subColor, opacity: activeIndex === idx ? 1 : 0.4 }}>{item.translated}</p>}
                
                <div className="mt-6 flex gap-3 opacity-0 group-hover/item:opacity-100 transition-opacity">
                   <button onClick={(e) => { e.stopPropagation(); handleDeepAnalyze(item); }} className={`flex items-center gap-2 text-[10px] px-4 py-2 rounded-full border transition-all font-bold ${analysisData[item.id] ? "bg-white text-black" : "bg-white/5 border-white/10"}`}>
                     {analysisLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI X-RAY
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); recordingId === item.id ? stopRecording() : startRecording(item.id); }} className={`p-2.5 rounded-xl border transition-all ${recordingId === item.id ? "bg-ted-red border-ted-red animate-pulse" : "bg-white/5 border-white/10"}`}><Mic className="w-4 h-4" /></button>
                </div>

                {analysisData[item.id] && (
                  <div className="mt-6 p-6 rounded-3xl bg-neutral-900 border border-white/10 animate-in slide-in-from-top-4 space-y-6">
                     <div className="space-y-2 pb-4 border-b border-white/5">
                        <div className="text-[10px] font-bold text-ted-red uppercase tracking-widest">Structure Matrix</div>
                        <p className="text-[12px] text-white/90 leading-relaxed">{analysisData[item.id].structureZh}</p>
                     </div>
                     <div className="space-y-4">
                        {analysisData[item.id].breakdown?.map((p: any, i: number) => (
                          <div key={i} className="flex gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                             <span className="text-[9px] font-mono text-ted-red/60 w-16 uppercase">{p.label}</span>
                             <div className="space-y-1"><p className="text-[11px] font-bold text-white leading-relaxed">{p.content}</p><p className="text-[10px] text-white/30 italic">{p.explanation}</p></div>
                          </div>
                        ))}
                     </div>
                     {analysisData[item.id].insights?.length > 0 && (
                       <div className="space-y-3 pt-4 border-t border-white/5">
                          <div className="text-[10px] font-bold text-ted-red uppercase tracking-widest">Learning Insights</div>
                          {analysisData[item.id].insights.map((ins: any, i: number) => (
                            <div key={i} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                              <p className="text-[11px] font-bold text-white/80">{ins.title}</p>
                              <p className="text-[10px] text-white/40 leading-relaxed">{ins.content}</p>
                            </div>
                          ))}
                       </div>
                     )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* RE-DESIGNED KNOWLEDGE MODAL */}
      {activeWord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 print-hidden" onClick={() => setActiveWord(null)}>
           <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col p-10 rounded-[4rem] bg-neutral-900 border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-300" onClick={e=>e.stopPropagation()}>
             <div className="absolute -top-24 -left-24 w-64 h-64 bg-ted-red/10 blur-[100px] rounded-full" />
             <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full" />

             {wordLoading ? (
               <div className="flex flex-col items-center justify-center gap-6 py-20 flex-1"><Loader2 className="w-16 h-16 animate-spin text-ted-red opacity-30" /><p className="text-[10px] uppercase tracking-[0.4em] opacity-30">Accessing Oracle...</p></div>
             ) : (
               <>
                 <div className="relative z-10 text-center space-y-3 mb-10 shrink-0">
                   <h2 className="text-8xl font-black tracking-tighter text-white drop-shadow-md">{activeWord.word.replace(/[^a-zA-Z]/g, '')}</h2>
                   <div className="flex items-center justify-center gap-8">
                     <span className="px-5 py-2 bg-ted-red/20 text-ted-red font-mono font-black tracking-[0.2em] text-xs uppercase rounded-2xl border border-ted-red/30 shadow-lg">{activeWord.partOfSpeech}</span>
                     <div className="flex items-center gap-4">
                       <span className="text-white/40 text-2xl font-mono tracking-widest">{activeWord.phonetic}</span>
                       <button onClick={(e) => { e.stopPropagation(); const u = new SpeechSynthesisUtterance(activeWord.word); u.lang='en-US'; u.rate=0.8; window.speechSynthesis.speak(u); }} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"><Volume2 className="w-5 h-5" /></button>
                     </div>
                   </div>
                 </div>

                 <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-10 focus:outline-none">
                    <div className="p-10 rounded-[3rem] bg-white/[0.04] border border-white/10 shadow-2xl relative overflow-hidden">
                       <div className="text-[11px] font-bold text-ted-red uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-ted-red" />Core Meaning</div>
                       <p className="text-4xl font-extrabold text-white tracking-tight leading-normal mb-6">{activeWord.definitionZh}</p>
                       {activeWord.tense && <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-xl uppercase tracking-widest"><FastForward className="w-4 h-4" /> {activeWord.tense}</div>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="p-8 rounded-[2.5rem] bg-neutral-800/40 border border-white/5 space-y-6">
                          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">SYNONYMS / 同义词</div>
                          <div className="flex flex-wrap gap-2">{activeWord.synonyms?.map((s: string, i: number) => (<span key={i} className="px-4 py-2 bg-white/5 border border-white/10 text-xs text-white/80 rounded-full">{s}</span>))}</div>
                       </div>
                       <div className="p-8 rounded-[2.5rem] bg-neutral-800/40 border border-white/5 space-y-6">
                          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">ANTONYMS / 反义词</div>
                          <div className="flex flex-wrap gap-2">{activeWord.antonyms?.map((a: string, i: number) => (<span key={i} className="px-4 py-2 bg-white/5 border border-white/10 text-xs text-white/30 rounded-full">{a}</span>))}</div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="p-8 rounded-[2.5rem] bg-neutral-800/40 border border-white/5 space-y-6">
                          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">COLLOCATIONS / 搭配</div>
                          <div className="space-y-3">{activeWord.phrases?.map((p: string, i: number) => (<p key={i} className="text-[13px] font-bold text-white/70 border-l-2 border-ted-red/40 pl-4 py-0.5">{p}</p>))}</div>
                       </div>
                       <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] space-y-6">
                          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">BILINGUAL USAGE / 例句</div>
                          <div className="space-y-3"><p className="text-[15px] font-medium text-white/90 leading-relaxed">“{activeWord.exampleEn}”</p><p className="text-[13px] text-white/40 italic">“{activeWord.exampleZh}”</p></div>
                       </div>
                    </div>
                 </div>

                 <div className="relative z-10 pt-10 shrink-0 flex flex-col items-center">
                    <button onClick={() => saveToVocab(activeWord)} className="group relative w-full h-20 rounded-[2.5rem] bg-ted-red overflow-hidden shadow-[0_20px_60px_rgba(230,43,30,0.5)] transition-all hover:scale-[1.01] active:scale-95">
                        <div className="flex items-center justify-center gap-4 text-white font-black text-2xl tracking-tight"><BookMarked className="w-8 h-8" /> Capture Knowledge</div>
                    </button>
                    <button onClick={()=>setActiveWord(null)} className="mt-6 text-[11px] uppercase font-bold tracking-[0.4em] opacity-20 hover:opacity-100 transition-opacity">Dismiss Inspector</button>
                 </div>
               </>
             )}
           </div>
        </div>
      )}

      {/* PRINT VIEW */}
      <div id="print-view" className="hidden bg-white text-black w-full font-sans">
        {/* Compact header */}
        <div style={{ borderBottom: "4px solid #E62B1E", paddingBottom: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.25em", textTransform: "uppercase", color: "#E62B1E", marginBottom: "4px" }}>TEDMaster · Learning Script</div>
              <div style={{ fontSize: "16px", fontWeight: 900, lineHeight: 1.2 }}>{data?.title}</div>
              <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{data?.presenter}</div>
            </div>
            <div style={{ fontSize: "9px", color: "#aaa", textAlign: "right", flexShrink: 0, marginLeft: "20px" }}>
              <div>{new Date().toLocaleDateString("zh-CN")}</div>
              <div style={{ marginTop: "2px" }}>{data?.transcript?.length ?? 0} sentences</div>
            </div>
          </div>
        </div>

        {/* Interleaved bilingual sentences — compact */}
        <div>
          {data?.transcript?.map((item: TranscriptItem, i: number) => (
            <div key={item.id} style={{ display: "flex", gap: "8px", padding: "4px 0", borderBottom: "1px solid #f0f0f0", pageBreakInside: "avoid", breakInside: "avoid" }}>
              <span style={{ fontSize: "8px", color: "#ccc", fontFamily: "monospace", width: "20px", flexShrink: 0, paddingTop: "2px", textAlign: "right" }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", lineHeight: 1.5, color: "#111", fontWeight: 500 }}>{item.english}</div>
                {item.translated && (
                  <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#888", marginTop: "1px" }}>{item.translated}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#bbb" }}>
          <span>{data?.title}</span>
          <span>TEDMaster · AI-Powered Intensive Reading</span>
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center bg-bg-deep text-white">
        <div className="w-16 h-16 border-4 border-ted-red border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WatchContent />
    </Suspense>
  );
}
