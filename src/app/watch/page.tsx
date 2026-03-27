"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play, Pause, Settings, Loader2, Sparkles, X, Home, Download, LogIn,
  Mic, FastForward, BookMarked, Sliders,
  FileText, Video, FileCode, Sun, Moon, Zap,
  Maximize, PictureInPicture, Volume, Volume1, Volume2, Lock, LogOut, History as HistoryIcon,
  MoreHorizontal, Globe, ChevronDown
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

  const handleLogout = async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) { window.location.reload(); }
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
  const [showSubtitleBg, setShowSubtitleBg] = useState(true);
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
  const [showUserMenu, setShowUserMenu] = useState(false);
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
      // Wait a frame to ensure virtualizer handles current sizes
      requestAnimationFrame(() => {
        rowVirtualizer.scrollToIndex(activeIndex, { 
          align: "center", 
          behavior: activeIndex === 0 ? "auto" : "smooth" 
        });
      });
    }
  }, [activeIndex, lastActiveIndex, rowVirtualizer]);

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
    <div className="min-h-screen flex flex-col bg-background font-body selection:bg-tertiary selection:text-foreground overflow-x-hidden">
      
      {/* ── Background Decorations ────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary rounded-full mix-blend-multiply opacity-20 animate-pulse" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-secondary rounded-full mix-blend-multiply opacity-10" />
        <div className="absolute top-[20%] left-[10%] w-12 h-12 bg-accent opacity-20 rounded-lg rotate-12" />
        <div className="absolute inset-0 dot-grid opacity-[0.15]" />
      </div>

      {/* PrintView moved to bottom */}

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
      <header className="sticky top-4 mx-4 sm:mx-8 z-[100] flex items-center justify-between px-6 py-3 bg-white border-2 border-border rounded-2xl shadow-pop print-hidden">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-accent border-2 border-border rounded-xl shadow-pop flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform">
            <Zap className="text-white fill-white" size={20} strokeWidth={2.5} />
          </div>
          <span className="font-black text-2xl tracking-tight text-foreground hidden sm:inline">
            TED<span className="text-accent underline decoration-tertiary decoration-4 underline-offset-4">Master</span>
          </span>
        </Link>

        <div className="hidden lg:flex flex-1 mx-8 items-center justify-center min-w-0">
          <div className="px-5 py-2.5 bg-background border-2 border-border rounded-xl shadow-pop-active max-w-[600px] w-full flex items-center gap-4 overflow-hidden">
             <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0" />
             <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] font-black text-foreground truncate uppercase tracking-tight italic leading-tight">
                  {data?.title || t.tagline}
                </span>
                {data?.presenter && (
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-tight mt-0.5 truncate">
                    {data.presenter}
                  </span>
                )}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={() => setShowVocab(true)}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-border rounded-xl shadow-pop hover:scale-105 active:scale-95 transition-all text-foreground"
              title={t.wordsTab}>
              <BookMarked size={18} strokeWidth={2.5} />
            </button>
            <button onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-border rounded-xl shadow-pop hover:scale-105 active:scale-95 transition-all">
              <Settings size={18} strokeWidth={2.5} className="text-foreground" />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-16 bg-white border-2 border-border rounded-2xl shadow-pop-lg z-50 py-3 min-w-[240px] animate-in slide-in-from-top-4 duration-300">
                  <div className="px-4 pb-3 border-b-2 border-muted mb-2 font-black uppercase text-[10px] text-muted-foreground tracking-widest">{t.exportLabel}</div>
                  {[
                    { icon: <FileText size={14} />, label: t.exportPdf, action: () => { setShowMoreMenu(false); setShowPrintModal(true); } },
                    { icon: <FileCode size={14} />, label: t.exportSrt, action: () => { exportSRT(); setShowMoreMenu(false); } },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-foreground hover:bg-tertiary/20 transition-colors uppercase tracking-widest">
                      <span className="text-accent">{item.icon}</span>{item.label}
                    </button>
                  ))}
                  <div className="my-2 border-b-2 border-muted" />
                  <button onClick={() => { setShowMoreMenu(false); setShowHistory(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-foreground hover:bg-secondary/10 transition-colors uppercase tracking-widest">
                    <HistoryIcon size={16} className="text-secondary" />{t.history}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-6 bg-border/20 mx-1 hidden sm:block" />

          {/* Account */}
          {user ? (
            <div className="relative">
              <button onClick={() => setShowUserMenu(v => !v)}
                className="btn-candy py-2 px-4 text-xs h-10 flex items-center gap-2">
                <Sparkles size={14} strokeWidth={2.5} className="mr-1 text-tertiary" />
                <span className="font-black text-foreground">{user?.credits || 0}</span>
                <ChevronDown size={12} strokeWidth={3} className={showUserMenu ? "rotate-180" : ""} />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-3 bg-white border-2 border-border rounded-2xl shadow-pop-lg z-[150] py-3 min-w-[200px] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="px-4 pb-3 border-b-2 border-muted mb-2">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Account</p>
                      <p className="text-sm font-black text-foreground truncate">{user?.email}</p>
                    </div>

                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-secondary hover:bg-secondary/10 transition-colors uppercase tracking-widest border-t-2 border-muted">
                      <LogOut size={16} strokeWidth={2.5} />
                      {t.logout}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="btn-candy h-10 px-6">
              <LogIn size={16} strokeWidth={2.5} className="mr-2" />
              <span className="uppercase tracking-widest text-xs font-black">{t.login}</span>
            </button>
          )}
        </div>
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
           <div className="max-w-md w-full p-10 rounded-[3rem] bg-white border-4 border-border text-center shadow-pop-lg space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 rounded-[2rem] bg-accent border-4 border-border flex items-center justify-center mx-auto mb-4 shadow-pop -rotate-6">
                 <Lock size={40} className="text-white" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black tracking-tight text-foreground uppercase">{t.login || 'Unlocked Growth'}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed font-bold">Create a free account to unlock AI analysis, vocabulary building, and shadowing practice.</p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={() => setShowAuth(true)}
                  className="btn-candy bg-accent text-white py-4.5 text-sm uppercase">
                  Register & Get 100 Free Credits
                </button>
                <button 
                  onClick={() => setShowAuth(true)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                  Already have an account? Sign In
                </button>
              </div>
           </div>
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-8 relative z-10 
        lg:h-[calc(100vh-140px)] lg:overflow-hidden print-hidden">

        {/* ── Video player ─────────────────────────────────────── */}
        <section className="flex-[3] flex flex-col gap-4 min-w-0 h-full sticky top-24 lg:static z-30 bg-background/50 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none">
          <div className="card-sticker bg-black p-0 overflow-hidden shadow-pop-lg h-full active:shadow-pop hover:transform-none animate-in fade-in slide-in-from-left-8 duration-500">
            {/* Video */}
            <div className="aspect-video relative flex items-center justify-center bg-black">
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
                <div className="absolute bottom-12 left-0 right-0 px-8 text-center pointer-events-none transition-all duration-300 flex flex-col items-center">
                  <p className={`font-black leading-snug drop-shadow-[0_4px_12px_rgba(0,0,0,1)] px-4 py-2 inline-block rounded-lg transition-all
                    ${showSubtitleBg ? "bg-black/40 backdrop-blur-md" : ""}`}
                    style={{ fontSize: mainFontSize, color: mainColor }}>{activeItem.english}</p>
                  {activeItem.translated && (
                    <p className={`mt-2 font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,1)] inline-block rounded-lg px-4 py-1.5 transition-all
                      ${showSubtitleBg ? "bg-black/40 backdrop-blur-sm" : ""}`}
                      style={{ fontSize: subFontSize, color: subColor }}>{activeItem.translated}</p>
                  )}
                </div>
              )}
              {/* Start overlay */}
              {!hasInteracted && (
                <div onClick={togglePlay} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 cursor-pointer bg-black/60 backdrop-blur-md">
                  <button className="btn-candy w-24 h-24 rounded-full flex items-center justify-center bg-accent shadow-pop hover:scale-110 active:scale-90 transition-all">
                    <Play size={40} fill="white" color="white" className="ml-2" />
                  </button>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-black text-white px-8">{data?.title}</p>
                    <p className="text-sm font-bold text-white/50 uppercase tracking-widest">{t.loadingTalk}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="px-6 py-4 bg-white border-t-2 border-border flex flex-col gap-4">
              {/* Progress bar */}
              <div className="relative h-4 flex items-center group/seek cursor-pointer">
                <div className="w-full h-2 bg-muted border-2 border-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-150 relative" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-border rounded-full shadow-pop hidden group-hover/seek:block" />
                  </div>
                </div>
                <input type="range" min={0} max={duration || 100} value={currentTime}
                  onChange={e => { const v = Number(e.target.value); if (videoRef.current) videoRef.current.currentTime = (v - subtitleOffset) / 1000; setCurrentTime(v); }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10" />
              </div>

              {/* Buttons row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="btn-candy p-2.5 rounded-xl text-foreground">
                    {isPlaying ? <Pause size={20} strokeWidth={3} /> : <Play size={20} strokeWidth={3} fill="currentColor" />}
                  </button>
                  
                  {/* Volume */}
                  <div className="hidden sm:flex items-center gap-2 group/vol px-3 py-1 bg-muted/30 border-2 border-border rounded-xl">
                     <button onClick={() => { const nv = volume > 0 ? 0 : 1; setVolume(nv); if (videoRef.current) videoRef.current.volume = nv; }} 
                       className="text-foreground/70 hover:text-accent transition-colors">
                       {volume === 0 ? <Volume size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                     </button>
                     <input type="range" min="0" max="1" step="0.01" value={volume} 
                       onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) videoRef.current.volume = v; }}
                       className="w-16 h-1 cursor-pointer accent-accent" />
                  </div>

                  <div className="px-3 py-1.5 bg-background border-2 border-border rounded-xl font-mono text-xs font-black text-muted-foreground">
                    {formatTime(currentTime)} <span className="mx-1 text-border">/</span> {formatTime(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => videoRef.current?.requestPictureInPicture()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-border shadow-pop hover:scale-105 active:scale-95 transition-all text-foreground" title={t.pip}>
                    <PictureInPicture size={18} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => videoRef.current?.requestFullscreen()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-border shadow-pop hover:scale-105 active:scale-95 transition-all text-foreground" title={t.fullscreen}>
                    <Maximize size={18} strokeWidth={2.5} />
                  </button>
                  
                  <div className="w-px h-6 bg-border/20 mx-1" />
                  
                  <button onClick={() => setShowSettings(!showSettings)} className="btn-candy px-4 h-10">
                    <Settings size={18} strokeWidth={2.5} className="mr-2" />
                    <span className="text-xs font-black uppercase tracking-widest">{t.settings}</span>
                  </button>
                </div>
              </div>

              {/* Settings Modal - Centered with backdrop */}
              {showSettings && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="fixed inset-0 cursor-pointer" onClick={() => setShowSettings(false)} />
                  <div className="relative w-full max-w-sm card-sticker bg-white p-6 shadow-pop-lg animate-in zoom-in-95 duration-200 overflow-hidden border-4 border-border">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-muted">
                      <h3 className="font-black uppercase tracking-widest text-sm text-foreground flex items-center gap-2">
                         <Sliders size={16} className="text-secondary" /> {t.settings}
                      </h3>
                      <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                  <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.typographyLabel || 'Typography'}</p>
                      <div className="grid grid-cols-1 gap-4">
                        {[
                          { label: t.mainSize, value: mainFontSize, set: setMainFontSize, min: 14, max: 36, color: mainColor, setColor: setMainColor },
                          { label: t.subSize, value: subFontSize, set: setSubFontSize, min: 10, max: 26, color: subColor, setColor: setSubColor }
                        ].map(s => (
                          <div key={s.label} className="space-y-3">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              <span>{s.label}</span><span>{s.value}px</span>
                            </div>
                            <input type="range" min={s.min} max={s.max} value={s.value} onChange={e => s.set(Number(e.target.value))} 
                              className="w-full h-1.5 bg-muted rounded-full accent-accent cursor-pointer" />
                            
                            <div className="flex items-center gap-2 pt-1 pb-1">
                              {['#ffffff', '#fde047', '#22d3ee', '#4ade80', '#f472b6'].map(c => (
                                <button
                                  key={c}
                                  onClick={() => s.setColor(c)}
                                  className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-125
                                    ${s.color === c ? "border-border shadow-pop-active scale-110" : "border-muted"}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <span>{t.syncOffset}</span>
                        <span className="text-accent">{(subtitleOffset / 1000).toFixed(1)}s</span>
                      </div>
                      <input type="range" min={-5000} max={5000} step={100} value={subtitleOffset} onChange={e => setSubtitleOffset(Number(e.target.value))} 
                        className="w-full h-1.5 bg-muted rounded-full accent-secondary cursor-pointer" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">
                        <span>Background Overlay</span>
                        <button onClick={() => setShowSubtitleBg(!showSubtitleBg)}
                          className={`w-10 h-5 rounded-full transition-all relative border-2 border-border
                            ${showSubtitleBg ? "bg-accent" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all
                            ${showSubtitleBg ? "left-5.5" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.subtitleLangLabel}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {SUBTITLE_LANGS.map(l => (
                          <button key={l.value}
                            onClick={() => handleSubtitleLangChange(l.value)}
                            className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border-2
                              ${subtitleLang === l.value ? "bg-tertiary border-border shadow-pop text-foreground" : "bg-white border-muted text-muted-foreground hover:border-border"}`}>
                            {l.short}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.playbackRate || 'Speed'}</p>
                      <div className="flex flex-wrap gap-2">
                        {SPEEDS.map(r => (
                          <button key={r} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = r; setPlaybackRate(r); }}
                            className={`w-10 h-8 flex items-center justify-center rounded-lg font-black text-[10px] border-2 transition-all
                              ${playbackRate === r ? "bg-quaternary border-border shadow-pop translate-y-[-1px]" : "bg-white border-muted text-muted-foreground hover:border-border"}`}>
                            {r}×
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </section>

        {/* ── Transcript panel ──────────────────────────────────── */}
        <section className="flex-[2] flex flex-col min-w-0 h-[60vh] lg:h-full overflow-hidden border-l-2 border-border bg-white">
          {/* Transcript Header */}
          <div className="px-6 py-4 border-b-2 border-border flex items-center justify-between bg-white shrink-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary border-2 border-border rounded-xl shadow-pop flex items-center justify-center">
                 <FileText size={20} className="text-foreground" strokeWidth={3} />
              </div>
              <div>
                 <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{t.transcript}</h2>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                   {data?.transcript?.length ?? 0} {t.sentences || 'Sentences'}
                 </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data?.needsTranscription && (
                <button onClick={handleTranscribe} disabled={isTranscribing}
                  className="btn-candy text-[10px] px-3 py-2 bg-secondary text-white border-border shadow-pop-sm hover:scale-105 active:scale-95 transition-all">
                  {isTranscribing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span className="ml-1.5 uppercase font-black">{isTranscribing ? (transcribeStatus || t.aiTranscribing) : t.aiTranscribe}</span>
                </button>
              )}
              {data?.isTranslationMissing && subtitleLang !== "en" && (
                <button onClick={handleAiTranslate} disabled={isAiTranslating}
                  className="btn-candy text-[10px] px-3 py-2 bg-accent text-white border-border shadow-pop-sm hover:scale-105 active:scale-95 transition-all">
                  {isAiTranslating ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                  <span className="ml-1.5 uppercase font-black">{isAiTranslating ? (t.aiTranslating || 'Translating...') : (t.aiTranslate || 'AI Translate')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Transcript List Scroll Area */}
          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-background/50 scroll-smooth">
            {data && data.transcript && data.transcript.length > 0 ? (
              <div style={{ height: rowVirtualizer.getTotalSize() || 500, position: "relative", width: "100%" }}>
                {rowVirtualizer.getVirtualItems().map(vRow => {
                const idx = vRow.index;
                const item = data!.transcript[idx];
                const isActive = activeIndex === idx;
                return (
                  <div key={item.id}
                    data-index={idx}
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 w-full pb-4"
                    style={{ transform: `translateY(${vRow.start}px)` }}>
                    <div
                      onClick={() => { if (!hasInteracted) setHasInteracted(true); if (videoRef.current) { videoRef.current.currentTime = (item.startTime - subtitleOffset) / 1000; videoRef.current.play(); } }}
                      className={`group/item p-4 rounded-2xl border-2 transition-all cursor-pointer relative
                        ${isActive 
                          ? "bg-white border-border shadow-pop-lg z-10 scale-[1.02]" 
                          : "bg-white/60 border-muted hover:bg-white hover:border-border hover:scale-[1.01]"}`}>
                        
                        {/* Status Dots */}
                        <div className="absolute left-0 top-1/2 -translate-x-3 -translate-y-1/2 flex flex-col gap-1">
                          {isActive && <div className="w-2 h-6 bg-accent rounded-full border border-border animate-bounce" />}
                          {notes[item.id] && <div className="w-2 h-2 bg-secondary rounded-full border border-border" />}
                        </div>

                        <div className="flex gap-4 items-start">
                          <span className="text-[10px] font-black font-mono w-6 shrink-0 text-center opacity-30 mt-1">{idx + 1}</span>
                          <div className="flex-1 space-y-2">
                            <p className="font-bold leading-relaxed selection:bg-accent selection:text-white" style={{ fontSize: mainFontSize - 2 }}>
                              {item.english.split(" ").map((w, i) => (
                                <span key={i} onClick={async e => {
                                  e.stopPropagation();
                                  const clean = w.replace(/[^a-zA-Z'-]/g, "");
                                  if (!clean) return;
                                  videoRef.current?.pause(); setIsPlaying(false);
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
                                }}
                                  className="inline-block cursor-pointer px-1 rounded hover:bg-tertiary hover:scale-110 active:scale-95 transition-all">
                                  {w}
                                </span>
                              ))}
                            </p>
                            {item.translated && (
                              <p className="font-bold text-muted-foreground leading-relaxed" style={{ fontSize: subFontSize - 1 }}>{item.translated}</p>
                            )}

                            {/* Actions bar (Visible on hover or if active) */}
                            <div className="flex items-center gap-2 pt-2 transition-all group-hover/item:opacity-100 opacity-0 group-focus:opacity-100">
                               <button onClick={e => { e.stopPropagation(); if (analysisPanelId === item.id) setAnalysisPanelId(null); else handleDeepAnalyze(item); }}
                                 className={`btn-candy text-[10px] px-3 py-1.5 shadow-none hover:shadow-pop hover:scale-105 active:scale-95
                                   ${analysisData[item.id] ? "bg-tertiary border-border text-foreground" : "bg-white border-muted text-muted-foreground"}`}>
                                 {analysisLoading === item.id ? <Loader2 size={12} className="animate-spin text-accent" /> : <Sparkles size={12} className="text-accent" />}
                                 <span className="ml-1 uppercase font-black">{t.analyzeBtn}</span>
                               </button>
                               <button onClick={e => { e.stopPropagation(); if (recordingId === item.id) stopRecording(); else startRecording(item.id); }}
                                 className="btn-candy text-[10px] px-3 py-1.5 bg-white border-muted text-muted-foreground shadow-none hover:bg-secondary hover:text-white hover:border-secondary hover:shadow-pop hover:scale-105 active:scale-95">
                                 <Mic size={12} />
                                 <span className="ml-1 uppercase font-black">{recordingId === item.id ? t.recording : t.recordBtn}</span>
                               </button>
                               <button onClick={e => { e.stopPropagation(); setEditingNoteId(editingNoteId === item.id ? null : item.id); setNoteInput(notes[item.id] || ""); }}
                                 className={`btn-candy text-[10px] px-3 py-1.5 shadow-none hover:shadow-pop hover:scale-105 active:scale-95
                                   ${notes[item.id] ? "bg-quaternary border-border text-foreground" : "bg-white border-muted text-muted-foreground"}`}>
                                 <FileText size={12} className="text-secondary" />
                                 <span className="ml-1 uppercase font-black">{notes[item.id] ? t.note : t.addNote}</span>
                               </button>
                            </div>

                            {/* Note Editor */}
                            {editingNoteId === item.id && (
                              <div className="mt-4 p-4 rounded-2xl bg-muted border-2 border-border shadow-pop animate-in slide-in-from-top-2 duration-300" onClick={e => e.stopPropagation()}>
                                <textarea autoFocus value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder={t.notePlaceholder}
                                  className="w-full bg-white border-2 border-border rounded-xl p-3 text-sm font-bold focus:ring-4 focus:ring-accent/10 transition-all outline-none resize-none min-h-[80px]" />
                                <div className="flex justify-end gap-2 mt-3">
                                   <button onClick={() => setEditingNoteId(null)} className="px-3 py-2 text-xs font-black uppercase text-muted-foreground hover:text-foreground">{t.close}</button>
                                   <button onClick={() => handleSaveNote(item.id)} className="btn-candy bg-accent text-white px-4 py-2 text-xs font-black uppercase">{t.saveNote}</button>
                                </div>
                              </div>
                            )}

                            {/* Note Display */}
                            {notes[item.id] && editingNoteId !== item.id && (
                              <div className="mt-2 p-3 rounded-xl bg-quaternary/30 border-2 border-border/20 border-dashed">
                                 <p className="text-[11px] font-bold italic text-foreground/70">{notes[item.id]}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        {/* ── AI Analysis panel (Drawer-like overlay) ───────────────────── */}
        {analysisPanelId !== null && analysisData[analysisPanelId] && (
          <div className="fixed inset-y-0 right-0 w-[480px] max-w-full z-[210] animate-in slide-in-from-right duration-500 shadow-pop-lg">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setAnalysisPanelId(null)} />
            <div className="relative h-full bg-white border-l-4 border-border flex flex-col shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.15)]">
              <AIAnalysisPanel
                analysis={analysisData[analysisPanelId]}
                sentence={data?.transcript.find(i => i.id === analysisPanelId)}
                savedSentences={savedSentences}
                onClose={() => setAnalysisPanelId(null)}
                onSave={saveSentence}
              />
            </div>
          </div>
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

      {/* ── Notebook overlay (Right drawer) ──────────────────────── */}
      {showVocab && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVocab(false)} />
          <div className="relative w-[480px] max-w-[90vw] h-full flex flex-col bg-background border-l-4 border-border shadow-pop-lg animate-in slide-in-from-right duration-500">
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
                  const targetId = typeof sent.id === "string" ? parseInt(sent.id) : sent.id;
                  const item = data?.transcript.find(t => t.id === targetId);
                  if (item) { videoRef.current.currentTime = (item.startTime - subtitleOffset) / 1000; videoRef.current.play(); setIsPlaying(true); }
                  handleDeepAnalyze({ id: targetId, english: sent.english, translated: sent.translated, startTime: 0 }, sent.analysis);
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
      {/* ── Print view ── */}
      <PrintView
        data={data}
        printConfig={printConfig}
        vocabWords={vocabWords}
        analysisData={analysisData}
        savedSentences={savedSentences}
        notes={notes}
      />
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin shadow-pop" />
      </div>
    }>
      <WatchContent />
    </Suspense>
  );
}
