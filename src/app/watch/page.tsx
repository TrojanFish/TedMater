"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play, Pause, Settings, Loader2, Sparkles, X, Home,
  Mic, FastForward, BookMarked, Sliders,
  FileText, Video, FileCode, Sun, Moon,
  Maximize, PictureInPicture, Volume, Volume1, Volume2, Lock, LogOut, History as HistoryIcon,
  MoreHorizontal, Globe
} from "lucide-react";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);
import Hls from "hls.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import LearningNotebook from "@/components/LearningNotebook";
import { useApp, LANGS, SUBTITLE_LANGS } from "@/lib/i18n";
import AuthModal from "@/components/AuthModal";
import HistoryModal from "./components/HistoryModal";
import WordLookupModal from "./components/WordLookupModal";
import AIAnalysisPanel from "./components/AIAnalysisPanel";
import PrintView from "./components/PrintView";
import PrintConfigModal from "./components/PrintConfigModal";
import type { TranscriptItem, AnalysisResult, ParsedData, HistoryItem, VocabItem, SavedSentence } from "./types";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ── Main watch component ─────────────────────────────────────── */
function WatchContent() {
  const { lang, t, theme, toggleTheme, setLang, subtitleLang, setSubtitleLang } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoUrlParam = searchParams.get("url");

  // ── Transcript / translation localStorage cache ────────────────
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;        // 30 days — transcript text (stable)
  const TRANSLATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — translations may be updated

  const slugFromUrl = (url: string): string => {
    const m = url.match(/ted\.com\/talks\/([^/?#]+)/);
    return m ? m[1] : url.replace(/[^a-z0-9]/gi, "_").slice(-40);
  };

  const readTranscriptCache = (slug: string): TranscriptItem[] | null => {
    try {
      const raw = localStorage.getItem(`tm_transcript_${slug}`);
      if (!raw) return null;
      const { transcript, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL) { localStorage.removeItem(`tm_transcript_${slug}`); return null; }
      return transcript;
    } catch { return null; }
  };

  const writeTranscriptCache = (slug: string, transcript: TranscriptItem[]) => {
    try {
      localStorage.setItem(`tm_transcript_${slug}`, JSON.stringify({
        transcript: transcript.map(({ id, startTime, english }) => ({ id, startTime, english, translated: "" })),
        timestamp: Date.now(),
      }));
    } catch { /* quota exceeded — silently skip */ }
  };

  const readTranslationCache = (slug: string, lang: string): string[] | null => {
    try {
      const raw = localStorage.getItem(`tm_translation_${slug}_${lang}`);
      if (!raw) return null;
      const { translations, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > TRANSLATION_CACHE_TTL) { localStorage.removeItem(`tm_translation_${slug}_${lang}`); return null; }
      return translations;
    } catch { return null; }
  };

  const writeTranslationCache = (slug: string, lang: string, translations: string[]) => {
    try {
      localStorage.setItem(`tm_translation_${slug}_${lang}`, JSON.stringify({ translations, timestamp: Date.now() }));
    } catch { /* quota exceeded — silently skip */ }
  };
  // ──────────────────────────────────────────────────────────────

  const [data, setData] = useState<ParsedData | null>(null);
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
  const [analysisData, setAnalysisData] = useState<Record<number, AnalysisResult>>({});
  const [analysisLoading, setAnalysisLoading] = useState<number | null>(null);
  const [analysisPanelId, setAnalysisPanelId] = useState<number | null>(null);
  const [vocabWords, setVocabWords] = useState<VocabItem[]>([]);
  const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);
  const [showVocab, setShowVocab] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printConfig, setPrintConfig] = useState({ vocab: true, script: true, analysis: true, notes: true });
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  const [isAiTranslating, setIsAiTranslating] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Capture audio into a 16 kHz Float32Array by spinning up a hidden <video>
  // with the same HLS/MP4 source.  We use a *separate* element so the main
  // player is never disrupted and createMediaElementSource() can be called
  // freely (it is a one-shot API per element).
  // playbackRate = 1 is mandatory — at higher rates the audio is
  // time-compressed and ASR models trained on normal-speed speech will fail.
  const captureAudioFromHiddenVideo = (
    onStatus: (s: string) => void
  ): Promise<Float32Array> =>
    new Promise((resolve, reject) => {
      if (!data?.videoUrl) { reject(new Error('视频源不可用')); return; }

      // Hidden video — must be in the DOM for autoplay to work
      const cap = document.createElement('video');
      cap.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
      cap.muted = true;   // muted → autoplay allowed without prior gesture
      document.body.appendChild(cap);

      let hlsInstance: Hls | null = null;

      if (data.isHls && Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: false });
        hlsInstance.loadSource(data.videoUrl);
        hlsInstance.attachMedia(cap);
      } else if (data.isHls && cap.canPlayType('application/vnd.apple.mpegurl')) {
        cap.src = data.videoUrl; // native HLS (Safari)
      } else {
        cap.src = data.videoUrl; // MP4 direct
      }

      const teardown = () => {
        try { document.body.removeChild(cap); } catch { /* already removed */ }
        if (hlsInstance) { hlsInstance!.destroy(); hlsInstance = null; }
      };

      const startCapture = () => {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const buffers: Float32Array[] = [];

        let source: MediaElementAudioSourceNode;
        try {
          // muted=true does NOT silence MediaElementAudioSourceNode —
          // the Web Audio API intercepts decoded PCM before the mute flag applies.
          source = audioCtx.createMediaElementSource(cap);
        } catch {
          audioCtx.close();
          teardown();
          reject(new Error('无法绑定视频音频源，请刷新页面后重试'));
          return;
        }

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          buffers.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(audioCtx.destination); // processor must be connected to stay active

        const durSec = isFinite(cap.duration) ? cap.duration : 0;
        onStatus(`正在提取音频 0%${durSec > 0 ? `（约需 ${Math.ceil(durSec / 60)} 分钟）` : ''}...`);

        const onTimeUpdate = () => {
          const d = cap.duration;
          if (d > 0 && isFinite(d)) {
            const pct = Math.round((cap.currentTime / d) * 100);
            const remMin = Math.ceil((d - cap.currentTime) / 60);
            onStatus(`正在提取音频 ${pct}%${remMin > 0 ? `（还需约 ${remMin} 分钟）` : ''}...`);
          }
        };

        const finish = (err?: Error) => {
          cap.removeEventListener('timeupdate', onTimeUpdate);
          processor.disconnect();
          try { source.disconnect(); } catch { /* ignore */ }
          audioCtx.close();
          teardown();
          if (err) { reject(err); return; }
          const total = buffers.reduce((s, b) => s + b.length, 0);
          const out = new Float32Array(total);
          let off = 0;
          for (const b of buffers) { out.set(b, off); off += b.length; }
          resolve(out);
        };

        cap.addEventListener('timeupdate', onTimeUpdate);
        cap.addEventListener('ended', () => finish(), { once: true });
        cap.addEventListener('error', () => finish(new Error('视频捕获出错')), { once: true });

        // playbackRate MUST stay at 1×.
        // Higher rates time-compress the audio — ASR models expect normal-speed speech.
        cap.playbackRate = 1;
        cap.play().catch(e => finish(e instanceof Error ? e : new Error(String(e))));
      };

      cap.addEventListener('canplay', startCapture, { once: true });
      cap.addEventListener('error', () => {
        teardown();
        reject(new Error('视频加载失败，无法提取音频'));
      }, { once: true });
    });

  const handleTranscribe = async () => {
    if (!data) return;
    setIsTranscribing(true);
    setTranscribeStatus(t.preparingAudio);

    try {
      // 0. Try YouTube subtitle fallback first (instant & reliable)
      if (data.youtubeTranscriptUrl) {
        try {
          console.log("[ASR] Attempting YouTube subtitle fallback...");
          const ytRes = await fetch(data.youtubeTranscriptUrl);
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            if (ytData.transcript && ytData.transcript.length > 0) {
              console.log("[ASR] YouTube subtitles found, skipping Moonshine.");
              setData({ ...data, transcript: ytData.transcript, needsTranscription: false });
              setIsTranscribing(false);
              return;
            }
          }
        } catch (e) {
          console.warn("[ASR] YouTube fallback failed, continuing to Moonshine.", e);
        }
      }

      let float32Data: Float32Array | null = null;
      let lastError = "";

      // 1. Server-side HLS audio extraction — parallel segment fetch + TS demux on server
      //    Returns raw ADTS AAC which the browser decodes instantly via decodeAudioData.
      //    Much faster than real-time capture (seconds vs. full video duration).
      if (!float32Data && data.isHls && data.hlsUrl) {
        try {
          setTranscribeStatus('正在提取音频 (服务端解析中)...');
          const res = await fetch(`/api/extract-audio?url=${encodeURIComponent(data.hlsUrl)}`);
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              const arrayBuffer = await res.arrayBuffer();
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
              try {
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                float32Data = audioBuffer.getChannelData(0);
              } finally {
                audioCtx.close();
              }
            }
          } else {
            lastError = `extract-audio: HTTP ${res.status}`;
            console.warn('[ASR] extract-audio failed:', lastError);
          }
        } catch (e: any) {
          lastError = e.message;
          console.warn('[ASR] extract-audio error:', e);
        }
      }

      // 2. Try downloading audio via proxy / direct CDN sources
      const sources = data.transcribeSources && data.transcribeSources.length > 0
        ? data.transcribeSources
        : [data.transcribeUrl || data.videoUrl];

      for (const url of sources) {
        try {
          console.log("[ASR] Trying source:", url);
          const res = await fetch(url);
          if (res.ok) {
            // Guard: reject HTML responses (e.g. TED login-page redirects)
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('text/html')) {
              lastError = '收到 HTML 而非音频 (可能需要登录)';
              continue;
            }
            const arrayBuffer = await res.arrayBuffer();
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            float32Data = audioBuffer.getChannelData(0);
            audioCtx.close();
            break;
          } else {
            const errData = await res.json().catch(() => ({}));
            lastError = errData.details || `HTTP ${res.status}`;
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }

      // 3. Last resort: real-time hidden-video capture (as long as the video itself)
      if (!float32Data) {
        console.log("[ASR] All fast sources failed, falling back to hidden-video capture. lastError:", lastError);
        setTranscribeStatus('正在加载视频以提取音频...');
        float32Data = await captureAudioFromHiddenVideo(setTranscribeStatus);
      }

      // 4. Initialize worker (once)
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('../../workers/transcribeWorker.ts', import.meta.url));
        workerRef.current.onmessage = (e) => {
          const { status, message, transcript } = e.data;
          if (status === 'loading' || status === 'processing' || status === 'ready') {
            setTranscribeStatus(message);
          } else if (status === 'done') {
            setData((prev: any) => {
              const slug = prev?.slug || slugFromUrl(videoUrlParam || "");
              if (slug) writeTranscriptCache(slug, transcript);
              return { ...prev, transcript, needsTranscription: false };
            });
            setIsTranscribing(false);
            setTranscribeStatus('');
          } else if (status === 'error') {
            alert('转录失败: ' + message);
            setIsTranscribing(false);
          }
        };
      }

      // 5. Send audio to worker
      setTranscribeStatus('初始化 AI 引擎...');
      workerRef.current.postMessage({ type: 'transcribe', audio: float32Data });
    } catch (err: any) {
      console.error('[ASR] Fatal error:', err);
      alert('音频处理失败: ' + err.message);
      setIsTranscribing(false);
    }
  };

  // AbortController for in-flight subtitle fetch — cancelled on rapid language switches
  const subtitleAbortRef = useRef<AbortController | null>(null);

  // Change subtitle language without re-parsing the full video
  const handleSubtitleLangChange = async (newLang: string) => {
    setSubtitleLang(newLang);
    if (!videoUrlParam) return;

    if (newLang === "en") {
      setData(prev => prev
        ? { ...prev, transcript: prev.transcript.map(item => ({ ...item, translated: "" })), isTranslationMissing: false }
        : prev);
      return;
    }

    // Check translation cache before hitting the network
    const slug = data?.slug || slugFromUrl(videoUrlParam || "");
    const cached = slug ? readTranslationCache(slug, newLang) : null;
    if (cached && data && cached.length === data.transcript.length) {
      setData(prev => prev ? {
        ...prev,
        transcript: prev.transcript.map((item, i) => ({ ...item, translated: cached[i] || "" })),
        isTranslationMissing: false,
      } : prev);
      return;
    }

    // Cancel any previous in-flight request
    subtitleAbortRef.current?.abort();
    subtitleAbortRef.current = new AbortController();

    setIsLoadingSubtitles(true);
    try {
      const res = await fetch(
        `/api/subtitles?url=${encodeURIComponent(videoUrlParam)}&lang=${newLang}`,
        { signal: subtitleAbortRef.current.signal }
      );
      const { translatedCues, isTranslationMissing } = await res.json();
      setData(prev => {
        if (!prev) return prev;
        const newTranscript = prev.transcript.map(item => {
          const match = translatedCues.find((c: any) => Math.abs(c.time - item.startTime) < 1000);
          return { ...item, translated: match ? match.text : "" };
        });
        // Cache the result for future visits
        if (slug && !isTranslationMissing) {
          writeTranslationCache(slug, newLang, newTranscript.map((i: TranscriptItem) => i.translated));
        }
        return { ...prev, transcript: newTranscript, isTranslationMissing };
      });
    } catch (e: any) {
      if (e.name !== "AbortError") console.warn("[subtitles] Failed to load", e);
    } finally {
      setIsLoadingSubtitles(false);
    }
  };

  // AI translate the full transcript when TED has no official translation
  const AI_TRANSLATE_COST = 20;
  const handleAiTranslate = async () => {
    if (!data || !user) return;
    if (user.credits < AI_TRANSLATE_COST) {
      alert(lang === "en"
        ? `Insufficient credits. Need ${AI_TRANSLATE_COST} pts.`
        : `积分不足，需要 ${AI_TRANSLATE_COST} 积分`);
      return;
    }

    setIsAiTranslating(true);
    try {
      // 1. Deduct credits first
      const creditRes = await fetch("/api/user/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "AI_TRANSLATE" }),
      });
      if (!creditRes.ok) {
        const err = await creditRes.json();
        throw new Error(err.error || "Credit deduction failed");
      }
      const { credits: newCredits } = await creditRes.json();
      setUser(prev => prev ? { ...prev, credits: newCredits } : prev);

      // 2. Run translation in batches via Gemini
      const englishSentences = data.transcript.map(item => item.english);
      const aiRes = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          sentences: englishSentences,
          targetLang: subtitleLang,
        }),
      });
      if (!aiRes.ok) throw new Error("Translation API failed");

      const { translations } = await aiRes.json();

      // 3. Merge translations into transcript and cache
      const slug = data.slug || slugFromUrl(videoUrlParam || "");
      if (slug) writeTranslationCache(slug, subtitleLang, translations);
      setData(prev => {
        if (!prev) return prev;
        const newTranscript = prev.transcript.map((item, i) => ({
          ...item,
          translated: translations[i] ?? "",
        }));
        return { ...prev, transcript: newTranscript, isTranslationMissing: false };
      });
    } catch (err: any) {
      console.error("[AI Translate]", err);
      alert(err.message);
    } finally {
      setIsAiTranslating(false);
    }
  };

  // Recording
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [user, setUser] = useState<{ email: string; credits: number } | null>(null);
  // Keep a ref in sync with user so HLS cleanup can read it without being a dep
  const userRef = useRef<{ email: string; credits: number } | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeParagraphRef = useRef<HTMLDivElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const [lastActiveIndex, setLastActiveIndex] = useState(-1);

  /* ── RAF sync (throttled: only update when time changes by >50ms) ── */
  const lastSyncedTime = useRef(-1);
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const update = () => {
      if (videoRef.current) {
        const t = videoRef.current.currentTime * 1000 + subtitleOffset;
        if (Math.abs(t - lastSyncedTime.current) >= 50) {
          lastSyncedTime.current = t;
          setCurrentTime(t);
        }
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, subtitleOffset]);

  /* ── Hotkeys ───────────────────────────────────────────────── */
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveWord(null); setShowExportMenu(false); setShowSettings(false);
        setShowMoreMenu(false); setShowHistory(false); setShowVocab(false); setAnalysisPanelId(null);
        return;
      }
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
        const uRes = await fetch("/api/auth/me");
        if (uRes.ok) { const d = await uRes.json(); setUser(d.user); }

        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: videoUrlParam, targetLang: subtitleLang }),
        });
        const result = await res.json();
        if (!res.ok) { router.push("/"); return; }

        const slug = result.slug || slugFromUrl(videoUrlParam!);

        // Overlay cached Whisper transcript (so user doesn't have to re-transcribe)
        if (result.needsTranscription) {
          const cached = readTranscriptCache(slug);
          if (cached) {
            result.transcript = cached;
            result.needsTranscription = false;
          }
        }

        // Overlay cached translation for current subtitle language
        if (subtitleLang !== "en") {
          const cachedTrans = readTranslationCache(slug, subtitleLang);
          if (cachedTrans && cachedTrans.length === result.transcript.length) {
            result.transcript = result.transcript.map((item: TranscriptItem, i: number) => ({
              ...item, translated: cachedTrans[i] || item.translated,
            }));
            result.isTranslationMissing = false;
          }
        }

        setData(result);
      } catch { router.push("/"); }
      finally { setLoading(false); }
    };
    fetchData();

    // Fetch history
    fetch("/api/user/history").then(res => res.json()).then(hData => {
      if (Array.isArray(hData)) setHistoryItems(hData);
    }).catch(() => {});

  }, [videoUrlParam, router]);

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
    
    // 恢复之前的播放断点
    const startProgress = searchParams.get("t");
    if (startProgress && !isNaN(Number(startProgress))) {
       video.currentTime = Number(startProgress);
    }

    return () => {
      if (hls) hls.destroy();
      // 卸载时上报进度 — use ref so this doesn't re-run when user credits update
      if (userRef.current && video.currentTime > 0) {
        fetch("/api/user/history", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             videoUrl: videoUrlParam,
             title: data.title,
             presenter: data.presenter,
             progressTime: video.currentTime,
             duration: video.duration
           }),
           keepalive: true
         }).catch(() => {});
      }
    };
  }, [data, videoUrlParam, searchParams]);

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

  /* ── Virtual transcript list ────────────────────────────────── */
  const rowVirtualizer = useVirtualizer({
    count: data?.transcript?.length ?? 0,
    getScrollElement: () => transcriptScrollRef.current,
    estimateSize: () => 82,
    overscan: 4,
  });

  useEffect(() => {
    if (activeIndex !== -1 && activeIndex !== lastActiveIndex) {
      setLastActiveIndex(activeIndex);
      rowVirtualizer.scrollToIndex(activeIndex, { align: "center", behavior: "smooth" });
    }
  }, [activeIndex, lastActiveIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Helpers ───────────────────────────────────────────────── */
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (!hasInteracted) setHasInteracted(true);
    if (videoRef.current.paused) { 
      videoRef.current.play(); 
      setIsPlaying(true); 
    } else { 
      videoRef.current.pause(); 
      setIsPlaying(false);
      // 上报断点进度
      if (user && data) {
         fetch("/api/user/history", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             videoUrl: videoUrlParam,
             title: data.title,
             presenter: data.presenter,
             progressTime: videoRef.current.currentTime,
             duration: videoRef.current.duration
           })
         }).catch(console.error);
      }
    }
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

  // AbortController for in-flight word lookup — cancelled when user clicks a different word
  const wordAbortRef = useRef<AbortController | null>(null);

  const deductPoints = async (action: "WORD_LOOKUP" | "AI_ANALYZE" | "PDF_EXPORT") => {
    if (!user) { setShowAuth(true); return false; }
    try {
      const res = await fetch("/api/user/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || "Points issue"); return false; }
      setUser(prev => prev ? ({ ...prev, credits: d.credits }) : null);
      return true;
    } catch { return false; }
  };

  const handleDeepAnalyze = async (item: TranscriptItem, preloaded?: any) => {
    if (preloaded) {
      setAnalysisData(prev => ({ ...prev, [item.id]: preloaded }));
      setAnalysisPanelId(item.id);
      return;
    }
    // Already cached — just open the panel
    if (analysisData[item.id]) {
      setAnalysisPanelId(item.id);
      return;
    }

    if (!(await deductPoints("AI_ANALYZE"))) return;

    videoRef.current?.pause(); setIsPlaying(false);
    setAnalysisLoading(item.id);
    const ac = new AbortController();
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", text: item.english }), signal: ac.signal });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setAnalysisData(prev => ({ ...prev, [item.id]: result }));
      setAnalysisPanelId(item.id);
    } catch (e: any) { if (e.name !== "AbortError") console.error(e); }
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
      <PrintView
        data={data}
        printConfig={printConfig}
        vocabWords={vocabWords}
        analysisData={analysisData}
        savedSentences={savedSentences}
        notes={notes}
      />

      {showPrintModal && (
        <PrintConfigModal
          printConfig={printConfig}
          onChange={setPrintConfig}
          onClose={() => setShowPrintModal(false)}
          onConfirm={async () => {
            if (!(await deductPoints("PDF_EXPORT"))) return;
            setShowPrintModal(false);
            setTimeout(() => window.print(), 100);
          }}
          vocabWords={vocabWords}
          data={data}
          analysisData={analysisData}
          savedSentences={savedSentences}
          notes={notes}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="h-14 flex items-center gap-2 px-4 border-b shrink-0 print-hidden"
        style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>

        {/* Home */}
        <Link href="/" className="p-2 rounded-lg transition-colors shrink-0"
          style={{ color: "var(--text-2)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}>
          <Home size={18} />
        </Link>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate leading-tight" style={{ color: "var(--text)" }}>{data?.title}</h1>
          {data?.presenter && <p className="text-[11px] truncate leading-tight" style={{ color: "var(--text-3)" }}>{t.by} {data.presenter}</p>}
        </div>

        {/* Knowledge Hub — primary action, always visible */}
        <button onClick={() => setShowVocab(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0"
          style={{ background: showVocab ? "var(--accent)" : "var(--bg-3)", color: showVocab ? "#fff" : "var(--text-2)" }}>
          <BookMarked size={15} /><span className="hidden sm:inline">{t.vocab}</span>
          {vocabWords.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: showVocab ? "rgba(255,255,255,0.25)" : "var(--accent-s)", color: showVocab ? "#fff" : "var(--accent)" }}>
              {vocabWords.length}
            </span>
          )}
        </button>

        {/* ⋯ More menu */}
        <div className="relative shrink-0">
          <button onClick={() => setShowMoreMenu(v => !v)}
            className="p-2 rounded-lg transition-colors"
            style={{ background: showMoreMenu ? "var(--bg-3)" : "transparent", color: showMoreMenu ? "var(--text)" : "var(--text-2)" }}>
            <MoreHorizontal size={18} />
          </button>

          {showMoreMenu && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-[109]" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-2xl z-[110] py-2 overflow-hidden"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>

                {/* Export group */}
                <div className="px-3 pt-1 pb-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1" style={{ color: "var(--text-3)" }}>{t.exportLabel}</p>
                  {[
                    { icon: <Video size={14} />, label: t.downloadVideo, action: () => { if (data?.downloadUrl) { const a = document.createElement("a"); a.href = data.downloadUrl; a.download = `${data.title}.mp4`; a.target = "_blank"; a.click(); } setShowMoreMenu(false); }, disabled: !data?.downloadUrl },
                    { icon: <FileText size={14} />, label: t.exportPdf, action: () => { setShowMoreMenu(false); setShowPrintModal(true); } },
                    { icon: <FileCode size={14} />, label: t.exportSrt, action: () => { exportSRT(); setShowMoreMenu(false); } },
                  ].map((item, i) => (
                    <button key={i} onClick={item.disabled ? undefined : item.action} disabled={!!item.disabled}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-left transition-colors disabled:opacity-30"
                      style={{ color: "var(--text)" }}
                      onMouseEnter={e => !item.disabled && (e.currentTarget.style.background = "var(--bg-3)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ color: "var(--accent)" }}>{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>

                <div className="my-1.5 mx-3 h-px" style={{ background: "var(--border)" }} />

                {/* History */}
                <div className="px-3">
                  <button onClick={() => { setShowMoreMenu(false); setShowHistory(true); }}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-left transition-colors"
                    style={{ color: "var(--text)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <HistoryIcon size={14} style={{ color: "var(--accent)" }} />{t.history}
                  </button>
                </div>

                <div className="my-1.5 mx-3 h-px" style={{ background: "var(--border)" }} />

                {/* Preferences */}
                <div className="px-3 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1" style={{ color: "var(--text-3)" }}>{t.settings}</p>

                  {/* Theme toggle */}
                  <button onClick={toggleTheme}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: "var(--text)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    {theme === "dark" ? <Sun size={14} style={{ color: "var(--accent)" }} /> : <Moon size={14} style={{ color: "var(--accent)" }} />}
                    {theme === "dark" ? (lang === "en" ? "Light Mode" : "浅色模式") : (lang === "en" ? "Dark Mode" : "深色模式")}
                  </button>

                  {/* App language */}
                  <div className="px-2 py-1.5">
                    <p className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                      <Globe size={13} style={{ color: "var(--accent)" }} />{lang === "en" ? "Language" : "界面语言"}
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                      {LANGS.map(l => (
                        <button key={l.value} onClick={() => setLang(l.value)}
                          className="py-1 rounded text-[11px] font-medium transition-all"
                          style={{
                            background: lang === l.value ? "var(--accent-s)" : "var(--bg)",
                            color: lang === l.value ? "var(--accent)" : "var(--text-2)",
                            border: `1px solid ${lang === l.value ? "var(--accent)" : "var(--border)"}`,
                          }}>
                          {l.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* GitHub */}
                  <a href="https://github.com/TrojanFish/TedMater" target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: "var(--text)", display: "flex" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ color: "var(--accent)" }}><GithubIcon /></span>GitHub
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Account pill */}
        {user ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl shrink-0"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: "var(--accent)" }}>
              {user.email[0].toUpperCase()}
            </div>
            <span className="text-[11px] font-bold" style={{ color: "var(--text)" }}>{user.credits} <span style={{ color: "var(--text-3)" }}>pts</span></span>
            <button onClick={() => { fetch("/api/auth/logout"); setUser(null); }}
              className="transition-opacity opacity-30 hover:opacity-80"
              title={t.logout}>
              <LogOut size={12} style={{ color: "var(--text)" }} />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowAuth(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0 transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--accent)" }}>
            {t.login}
          </button>
        )}
      </header>
      
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={(u) => setUser(u)} />}

      {/* ── History Modal ────────────────────────────────────────── */}
      {showHistory && (
        <HistoryModal
          historyItems={historyItems}
          currentUrl={videoUrlParam ?? ""}
          onClose={() => setShowHistory(false)}
          onSelect={(url, time) => { setShowHistory(false); router.push(`/watch?url=${encodeURIComponent(url)}&t=${time}`); }}
        />
      )}

      {/* Login Barrier for Watch Page - Absolute Cover */}
      {!user && !loading && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/70 backdrop-blur-xl" 
          style={{ backgroundImage: "radial-gradient(circle at center, rgba(230,43,30,0.2) 0%, transparent 80%)" }}>
           <div className="max-w-md w-full p-10 rounded-[3rem] bg-bg-2 border border-accent/20 text-center shadow-2xl space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 rounded-[2rem] bg-accent flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-accent/40">
                 <Lock size={40} className="text-white" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black tracking-tight">{t.login || 'Unlocked Growth'}</h2>
                <p className="text-sm opacity-60 leading-relaxed font-medium">Create a free account to unlock AI analysis, vocabulary building, and shadowing practice.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowAuth(true)}
                  className="w-full py-4.5 rounded-2xl bg-accent text-white font-black hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-accent/30 transition-all text-sm">
                  Register & Get 100 Free Credits
                </button>
                <button 
                  onClick={() => setShowAuth(true)}
                  className="w-full py-4 rounded-2xl bg-white/5 text-[10px] font-bold opacity-30 hover:opacity-100 transition-opacity">
                  Already have an account? Sign In
                </button>
              </div>
           </div>
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden print-hidden">

        {/* Notebook overlay — full-height right drawer with backdrop */}
        {showVocab && (
          <div className="absolute inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowVocab(false)} />
          <div className="relative w-[420px] max-w-[90vw] h-full flex flex-col p-3" style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}>
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
            <div className="relative h-6 flex items-center mb-2 group/seek cursor-pointer"
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const el = e.currentTarget.querySelector<HTMLElement>("[data-tooltip]");
                if (el && duration > 0) {
                  el.style.left = `${pct * 100}%`;
                  el.textContent = formatTime(pct * duration);
                }
              }}
            >
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-1 group-hover/seek:h-2 rounded-full transition-all duration-150" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div className="h-full rounded-full" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, background: "var(--accent)" }} />
                </div>
              </div>
              {/* Hover time tooltip */}
              <div data-tooltip className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded text-xs font-mono pointer-events-none opacity-0 group-hover/seek:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.8)", color: "#fff", whiteSpace: "nowrap" }}>
                {formatTime(currentTime)}
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

                      {/* Subtitle Language */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-2)" }}>
                          <span className="font-medium">{t.subtitleLangLabel}</span>
                          {isLoadingSubtitles && <Loader2 size={10} className="animate-spin" style={{ color: "var(--accent)" }} />}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {SUBTITLE_LANGS.map(l => (
                            <button key={l.value}
                              onClick={() => handleSubtitleLangChange(l.value)}
                              disabled={isLoadingSubtitles}
                              className="px-2 py-1 rounded text-[11px] font-medium transition-all"
                              style={{
                                background: subtitleLang === l.value ? "var(--accent-s)" : "var(--bg-3)",
                                color: subtitleLang === l.value ? "var(--accent)" : "var(--text-2)",
                                border: `1px solid ${subtitleLang === l.value ? "var(--accent)" : "var(--border)"}`,
                                opacity: isLoadingSubtitles ? 0.5 : 1,
                              }}>
                              {l.short}
                            </button>
                          ))}
                        </div>
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
            {data?.needsTranscription && !isTranscribing && (
              <button 
                onClick={handleTranscribe}
                className="ml-3 text-[10px] px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all font-bold flex items-center gap-1 border border-indigo-500/20"
              >
                <Sparkles size={10} /> {t.aiTranscribe}
              </button>
            )}
            {isTranscribing && (
              <div className="ml-3 flex items-center gap-2 px-2 py-0.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <Loader2 size={10} className="animate-spin text-indigo-500" />
                <span className="text-[10px] font-bold text-indigo-500 animate-pulse">{transcribeStatus || t.aiTranscribing}</span>
              </div>
            )}

            {/* AI Translate (if official sub is missing) */}
            {data?.isTranslationMissing && subtitleLang !== "en" && (
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden xl:inline text-[10px] whitespace-nowrap" style={{ color: "var(--text-3)" }}>
                  {lang === "en" ? "No official sub" : "暂无官方字幕"}
                </span>
                {user ? (
                  <button onClick={handleAiTranslate} disabled={isAiTranslating}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border shrink-0"
                    style={{
                      background: isAiTranslating ? "var(--bg-3)" : "var(--accent-s)",
                      color: isAiTranslating ? "var(--text-3)" : "var(--accent)",
                      borderColor: "var(--accent)",
                      opacity: isAiTranslating ? 0.7 : 1,
                    }}>
                    {isAiTranslating
                      ? <><Loader2 size={10} className="animate-spin" /> {t.aiTranslating}</>
                      : <><Sparkles size={10} /> {t.aiTranslate} · {AI_TRANSLATE_COST}</>}
                  </button>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--text-3)" }}>{t.login}</span>
                )}
              </div>
            )}
            
            {!data?.isTranslationMissing && <span className="ml-auto text-xs" style={{ color: "var(--text-3)" }}>{data?.transcript?.length ?? 0}</span>}
          </div>
          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const idx = vRow.index;
              const item = data!.transcript[idx];
              const isActive = activeIndex === idx;
              return (
                <div key={item.id}
                  data-index={idx}
                  ref={rowVirtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)`, paddingBottom: "4px" }}>
                <div
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
                          <span key={i} onClick={async e => {
                            e.stopPropagation();
                            const clean = w.replace(/[^a-zA-Z'-]/g, "");
                            if (!clean) return;
                            (async () => {
                              videoRef.current?.pause(); setIsPlaying(false);
                              // Cancel previous in-flight lookup
                              wordAbortRef.current?.abort();
                              wordAbortRef.current = new AbortController();
                              setWordLoading(true);
                              setActiveWord({ word: clean, loading: true } as VocabItem & { loading: boolean });
                              try {
                                const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "define", text: clean, context: item.english }), signal: wordAbortRef.current.signal });
                                const result = await r.json();
                                if (!r.ok) throw new Error(result.error);
                                setActiveWord(result);
                              } catch (err: any) { if (err.name !== "AbortError") setActiveWord(null); }
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
                    <button onClick={e => { e.stopPropagation(); analysisPanelId === item.id ? setAnalysisPanelId(null) : handleDeepAnalyze(item); }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: analysisPanelId === item.id ? "var(--accent)" : analysisData[item.id] ? "var(--accent-s)" : "var(--bg-3)", color: analysisPanelId === item.id ? "#fff" : analysisData[item.id] ? "var(--accent)" : "var(--text-2)" }}>
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

                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── AI Analysis panel (3rd column) ───────────────────── */}
        {analysisPanelId !== null && analysisData[analysisPanelId] && (
          <AIAnalysisPanel
            analysis={analysisData[analysisPanelId]}
            sentence={data?.transcript.find(i => i.id === analysisPanelId)}
            savedSentences={savedSentences}
            onClose={() => setAnalysisPanelId(null)}
            onSave={saveSentence}
          />
        )}
      </main>

      {/* ── Word modal ─────────────────────────────────────────── */}
      {activeWord && (
        <WordLookupModal
          activeWord={activeWord}
          wordLoading={wordLoading}
          onClose={() => setActiveWord(null)}
          onSave={saveToVocab}
        />
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
