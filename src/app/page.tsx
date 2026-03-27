"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, Mic, BookOpen, Sun, Moon, ChevronDown, LogIn, User, LogOut } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { useApp, LANGS } from "@/lib/i18n";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const EXAMPLE_TALKS = [
  { title: "Do schools kill creativity?", presenter: "Ken Robinson", url: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity" },
  { title: "The power of vulnerability", presenter: "Brené Brown", url: "https://www.ted.com/talks/brene_brown_the_power_of_vulnerability" },
  { title: "How great leaders inspire action", presenter: "Simon Sinek", url: "https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action" },
];

export default function Home() {
  const { t, theme, toggleTheme, lang, setLang } = useApp();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<{ email: string; credits: number } | null>(null);
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
          .then(hData => { if (Array.isArray(hData)) setHistory(hData); })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setHistory([]);
    setShowUserMenu(false);
  };

  const navigate = (tedUrl: string) => {
    const trimmed = tedUrl.trim();
    if (!trimmed.includes("ted.com/talks/")) {
      setError(t.errorInvalidUrl);
      return;
    }
    router.push(`/watch?url=${encodeURIComponent(trimmed)}`);
  };

  const handleAnalyze = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError("");
    navigate(trimmed);
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
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
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
              </>
            )}
          </div>

          <div className="w-px h-6 mx-1" style={{ background: "var(--border)" }} />

          {/* Account */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "var(--text-2)", border: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
              >
                <User size={14} />
                <span className="hidden sm:inline max-w-[100px] truncate">{user.email.split("@")[0]}</span>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{user.credits}</span>
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div
                    className="absolute right-0 mt-1 rounded-xl shadow-lg z-50 py-1 min-w-[160px]"
                    style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
                  >
                    <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{user.email}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{t.balance}: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{user.credits}</span></p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--text-2)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.color = "var(--text)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}
                    >
                      <LogOut size={14} />
                      {t.logout}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: "var(--accent)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-h)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
            >
              <LogIn size={14} />
              {t.login}
            </button>
          )}
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
            {t.hero.split("TED").map((part, i, arr) =>
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
                onChange={e => { setUrl(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                placeholder={t.placeholder}
                className="flex-1 bg-transparent border-none outline-none py-3 text-sm"
                style={{ color: "var(--text)" }}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: "var(--accent)" }}
              onMouseEnter={e => url.trim() && (e.currentTarget.style.background = "var(--accent-h)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
            >
              {t.analyze}
            </button>
          </div>

          {error && (
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{error}</p>
          )}

          {/* Example talks */}
          <div className="w-full flex flex-col gap-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{t.tryExample}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_TALKS.map(ex => (
                <button
                  key={ex.url}
                  onClick={() => navigate(ex.url)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border"
                  style={{ background: "var(--bg-2)", borderColor: "var(--border)", color: "var(--text-2)" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.color = "var(--text)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-2)";
                  }}
                >
                  <span className="font-semibold truncate max-w-[180px]">{ex.title}</span>
                  <span style={{ color: "var(--text-3)" }}>· {ex.presenter}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Continue Learning Dashboard ────────────────────────── */}
        {user && history.length > 0 && (
          <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap size={18} style={{ color: "var(--accent)" }} />
              {t.continueLearning}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((hItem) => {
                const pct = hItem.duration ? Math.min(100, (hItem.progressTime / hItem.duration) * 100) : 0;
                const mins = Math.floor(hItem.progressTime / 60);
                const totalMins = hItem.duration ? Math.floor(hItem.duration / 60) : null;
                return (
                  <div
                    key={hItem.id}
                    onClick={() => router.push(`/watch?url=${encodeURIComponent(hItem.videoUrl)}&t=${Math.floor(hItem.progressTime)}`)}
                    className="card p-4 cursor-pointer hover:-translate-y-1 transition-all group relative overflow-hidden"
                  >
                    <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-1 group-hover:text-accent transition-colors" style={{ color: "var(--text)" }}>{hItem.title}</h4>
                    <p className="text-xs mb-3" style={{ color: "var(--text-2)" }}>{hItem.presenter}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                      </div>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>
                        {mins}m{totalMins ? ` / ${totalMins}m` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
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
