"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Zap, Mic, BookOpen, Sun, Moon, ChevronDown, User, LogIn, X } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { useEffect } from "react";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);
import { useApp, LANGS } from "@/lib/i18n";

export default function Home() {
  const { t, theme, toggleTheme, lang, setLang } = useApp();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; presenter: string; description: string } | null>(null);
  const [user, setUser] = useState<{ email: string; credits: number } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const router = useRouter();

  type UserHistory = {
    id: string;
    videoUrl: string;
    title: string;
    presenter: string;
    progressTime: number;
    duration: number | null;
  };

  const [history, setHistory] = useState<UserHistory[]>([]);
  useEffect(() => {
    fetch("/api/auth/me").then(res => res.json()).then(data => {
      if (data.user) {
        setUser(data.user);
        fetch("/api/user/history")
          .then(res => res.json())
          .then(hData => {
            if (Array.isArray(hData)) setHistory(hData);
          }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze URL");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <Zap size={22} />, title: t.f1Title, desc: t.f1Desc },
    { icon: <Mic size={22} />, title: t.f2Title, desc: t.f2Desc },
    { icon: <BookOpen size={22} />, title: t.f3Title, desc: t.f3Desc },
  ];

  const currentLang = LANGS.find(l => l.value === lang);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-6 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-tight">
            TED<span style={{ color: "var(--accent)" }}>Master</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* 移除首页的登录入口 */}
          <div className="w-px h-6 mx-1 bg-border hidden md:block" />
          {/* GitHub */}
          <a
            href="https://github.com/TrojanFish/TedMater"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
            title={t.github}
          >
            <GithubIcon />
          </a>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "var(--text-2)", border: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
            >
              {currentLang?.short}
              <ChevronDown size={13} />
            </button>
            {showLangMenu && (
              <div
                className="absolute right-0 mt-1 rounded-xl overflow-hidden shadow-lg z-50 py-1 min-w-[140px]"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
              >
                {LANGS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => { setLang(l.value); setShowLangMenu(false); }}
                    className="w-full px-4 py-2 text-sm text-left transition-colors"
                    style={{
                      color: lang === l.value ? "var(--accent)" : "var(--text)",
                      background: lang === l.value ? "var(--accent-s)" : "transparent",
                      fontWeight: lang === l.value ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (lang !== l.value) e.currentTarget.style.background = "var(--bg-3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = lang === l.value ? "var(--accent-s)" : "transparent"; }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-12">
        <div className="w-full max-w-2xl flex flex-col items-center gap-6 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>
            <Zap size={11} />
            {t.tagline}
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
            {t.hero.replace("TED", "TED").split("TED").map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>{part}<span style={{ color: "var(--accent)" }}>TED</span></span>
              ) : part
            )}
          </h1>

          <p className="text-base max-w-xl leading-relaxed" style={{ color: "var(--text-2)" }}>
            {t.heroSub}
          </p>

          {/* URL input */}
          <div className="w-full flex gap-2">
            <div className="flex-1 flex items-center gap-3 px-4 rounded-xl border transition-colors"
              style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
              <Search size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                placeholder={t.placeholder}
                disabled={loading}
                className="flex-1 bg-transparent border-none outline-none py-3 text-sm"
                style={{ color: "var(--text)" }}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: "var(--accent)" }}
              onMouseEnter={e => !loading && url.trim() && (e.currentTarget.style.background = "var(--accent-h)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : t.analyze}
            </button>
          </div>

          {error && (
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{error}</p>
          )}

          {/* Result card */}
          {result && (
            <div className="w-full rounded-xl p-5 text-left border-l-4 card"
              style={{ borderLeftColor: "var(--accent)" }}>
              <p className="text-base font-bold leading-snug" style={{ color: "var(--text)" }}>{result.title}</p>
              <p className="text-sm mt-0.5 mb-3" style={{ color: "var(--accent)" }}>{t.by} {result.presenter}</p>
              <p className="text-sm leading-relaxed line-clamp-2 mb-4" style={{ color: "var(--text)" }}>{result.description}</p>
              <button
                onClick={() => router.push(`/watch?url=${encodeURIComponent(url.trim())}`)}
                className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                style={{ background: "var(--accent)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-h)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
              >
                {t.startLearning}
              </button>
            </div>
          )}
        </div>

        {/* ── Continue Learning Dashboard ────────────────────────── */}
        {user && history.length > 0 && !result && (
          <div className="w-full max-w-4xl flex flex-col gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap size={18} className="text-accent" />
              Continue Learning
            </h3>
            <div className="w-full flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
              {history.map((hItem) => (
                <div 
                  key={hItem.id} 
                  onClick={() => router.push(`/watch?url=${encodeURIComponent(hItem.videoUrl)}&t=${Math.floor(hItem.progressTime)}`)}
                  className="card flex-none w-[280px] p-4 cursor-pointer hover:-translate-y-1 transition-all snap-start group relative overflow-hidden"
                >
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-border">
                     <div 
                        className="h-full bg-accent transition-all duration-1000 group-hover:bg-accent-h"
                        style={{ width: `${hItem.duration ? Math.min(100, (hItem.progressTime / hItem.duration) * 100) : 0}%` }}
                     />
                  </div>
                  <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-2 group-hover:text-accent transition-colors">{hItem.title}</h4>
                  <p className="text-xs text-text-2">{hItem.presenter}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Features ─────────────────────────────────────────── */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="card p-6 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>
                {f.icon}
              </div>
              <h3 className="font-bold text-base">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-4 text-center text-xs border-t" style={{ color: "var(--text-3)", borderColor: "var(--border)" }}>
        {t.footer}
      </footer>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={(u) => setUser(u)} />}
    </div>
  );
}
