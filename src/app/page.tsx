"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, Mic, BookOpen, Sun, Moon, ChevronDown, LogIn, User, LogOut, Clock, Play, Sparkles } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { useApp, LANGS } from "@/lib/i18n";
import type { FeaturedTalk } from "@/app/api/featured/route";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);


function fmtDuration(sec: number): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

export default function Home() {
  const { t, theme, toggleTheme, lang, setLang } = useApp();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<{ email: string; credits: number } | null>(null);

  // Featured talks
  const [featured, setFeatured] = useState<FeaturedTalk[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

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

  useEffect(() => {
    fetch("/api/featured")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data.talks)) setFeatured(data.talks); })
      .catch(() => {})
      .finally(() => setFeaturedLoading(false));
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
    <div className="min-h-screen flex flex-col bg-background font-body selection:bg-tertiary selection:text-foreground overflow-x-hidden">
      
      {/* ── Background Decorations ────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary rounded-full mix-blend-multiply opacity-20 animate-pulse" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-secondary rounded-full mix-blend-multiply opacity-10" />
        <div className="absolute top-[20%] left-[10%] w-12 h-12 bg-accent opacity-20 rounded-lg rotate-12" />
        <div className="absolute bottom-[20%] right-[15%] w-16 h-16 bg-quaternary opacity-20 rounded-full border-2 border-border border-dashed" />
        <div className="absolute inset-0 dot-grid opacity-[0.15]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-4 mx-4 sm:mx-8 z-50 flex items-center justify-between px-6 py-3 bg-white border-2 border-border rounded-2xl shadow-pop">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="w-10 h-10 bg-accent border-2 border-border rounded-xl shadow-pop flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform">
            <Zap className="text-white fill-white" size={20} strokeWidth={2.5} />
          </div>
          <span className="font-black text-2xl tracking-tight text-foreground">
            TED<span className="text-accent underline decoration-tertiary decoration-4 underline-offset-4">Master</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Language selector */}
          <div className="relative group">
            <button
              onClick={() => setShowLangMenu(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-border rounded-full font-black text-xs uppercase tracking-widest text-foreground hover:bg-muted transition-all shadow-pop active:shadow-none active:translate-x-1 active:translate-y-1"
            >
              {currentLang?.short}
              <ChevronDown size={14} strokeWidth={3} className={showLangMenu ? "rotate-180" : ""} />
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 mt-3 bg-white border-2 border-border rounded-2xl shadow-pop-lg z-50 py-2 min-w-[160px] animate-in slide-in-from-top-2 duration-200">
                  {LANGS.map(l => (
                    <button key={l.value}
                      onClick={() => { setLang(l.value); setShowLangMenu(false); }}
                      className={`w-full px-4 py-2 text-sm text-left font-black uppercase tracking-wider transition-colors
                        ${lang === l.value ? "bg-accent text-white" : "text-foreground hover:bg-tertiary/20"}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Account */}
          {user ? (
            <div className="relative">
              <button onClick={() => setShowUserMenu(v => !v)}
                className="btn-candy py-2 px-4 text-xs h-10">
                <User size={14} strokeWidth={2.5} className="mr-2" />
                <span className="font-black mr-2 text-foreground">{user?.credits || 0}</span>
                <ChevronDown size={12} strokeWidth={3} />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-3 bg-white border-2 border-border rounded-2xl shadow-pop-lg z-50 py-3 min-w-[200px] overflow-hidden">
                    <div className="px-4 pb-3 border-b-2 border-muted mb-2">
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Account</p>
                      <p className="text-sm font-black text-foreground truncate">{user?.email}</p>
                    </div>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-secondary hover:bg-secondary/10 transition-colors uppercase tracking-widest">
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
              <span className="uppercase tracking-widest text-xs">{t.login}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col items-center px-6 pt-24 pb-32 gap-32 z-10 overflow-visible">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Hero Content */}
          <div className="flex flex-col items-start gap-8 text-left relative">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-tertiary rounded-full opacity-40 blur-3xl -z-10" />
            
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary border-2 border-border rounded-full text-xs font-black uppercase tracking-widest text-white shadow-pop">
              <Sparkles size={14} strokeWidth={2.5} />
              {t.tagline}
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-foreground">
              {t.hero.split("TED").map((part, i, arr) =>
                i < arr.length - 1 ? (
                  <span key={i}>{part}<span className="text-accent underline decoration-tertiary decoration-8 underline-offset-8">TED</span></span>
                ) : part
              )}
            </h1>

            <p className="text-xl font-bold max-w-lg leading-relaxed text-muted-foreground border-l-4 border-accent pl-6">
              {t.heroSub}
            </p>

            <div className="w-full max-w-md flex flex-col gap-4">
              <div className={`relative group p-2 bg-white border-[3px] rounded-2xl shadow-pop-lg transition-all focus-within:shadow-none focus-within:translate-x-1 focus-within:translate-y-1 ${error ? "border-secondary" : "border-border"}`}>
                <div className="flex items-center gap-3 px-3">
                  <Search size={22} strokeWidth={3} className="text-muted-foreground group-focus-within:text-accent transition-colors shrink-0" />
                  <input
                    type="text" value={url} onChange={e => { setUrl(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                    placeholder={t.placeholder}
                    className="flex-1 bg-transparent border-none outline-none py-4 text-lg font-black placeholder:text-muted-foreground/50 tracking-tight"
                    spellCheck={false}
                  />
                  <button onClick={handleAnalyze} disabled={!url.trim()}
                    className="btn-candy h-12 px-6 shadow-pop text-sm font-black whitespace-nowrap active:translate-x-0 active:translate-y-0 disabled:opacity-50 disabled:shadow-none transition-all">
                    {t.analyze}
                  </button>
                </div>
              </div>
              {error && (
                <div className="ml-2 font-black text-secondary text-sm uppercase tracking-widest animate-bounce-short flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-sm aspect-square">
              {/* Geometric Decoration */}
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent rounded-3xl -rotate-12 border-4 border-border shadow-pop-lg -z-10" />
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-quaternary rounded-full border-4 border-border shadow-pop-lg -z-10 flex items-center justify-center">
                <div className="w-24 h-24 dot-grid opacity-50" />
              </div>
              
              {/* "Blob" Masked Image Placeholder / Visual */}
              <div className="w-full h-full bg-white border-4 border-border rounded-tl-[100px] rounded-tr-[40px] rounded-br-[100px] rounded-bl-[40px] shadow-pop-lg overflow-hidden relative group">
                <div className="absolute inset-0 bg-accent/5 dot-grid" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative text-center group-hover:scale-110 transition-transform duration-500">
                    <Play size={80} strokeWidth={2.5} className="text-accent fill-accent" />
                    <div className="mt-4 font-black uppercase tracking-widest text-accent">Master English</div>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md border-2 border-border p-4 rounded-2xl shadow-pop">
                  <p className="text-xs font-black text-foreground uppercase tracking-widest">{t.aiAnalysis}</p>
                  <div className="mt-2 space-y-1">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent w-2/3 animate-pulse" />
                    </div>
                    <div className="h-2 w-4/5 bg-muted rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Continue Learning ────────────────────────────────────────── */}
        {user && history.length > 0 && (
          <div className="w-full max-w-6xl flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-accent border-2 border-border rounded-xl shadow-pop rotate-3">
                <h3 className="font-black text-xl text-white uppercase tracking-tighter">{t.continueLearning}</h3>
              </div>
              <div className="flex-1 h-1 bg-border/10 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((hItem, idx) => {
                const pct = hItem.duration ? Math.min(100, (hItem.progressTime / hItem.duration) * 100) : 0;
                return (
                  <button key={hItem.id}
                    onClick={() => router.push(`/watch?url=${encodeURIComponent(hItem.videoUrl)}&t=${Math.floor(hItem.progressTime)}`)}
                    className={`group relative perspective-1000 ${idx % 2 === 0 ? '-rotate-1 hover:rotate-0' : 'rotate-1 hover:rotate-0'} transition-transform`}>
                    <div className="p-6 bg-white border-2 border-border rounded-2xl shadow-pop-lg group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none transition-all flex flex-col h-full text-left">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg border-2 border-border bg-tertiary flex items-center justify-center font-black shadow-pop">
                          <Play size={12} fill="currentColor" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic truncate max-w-[120px]">
                          {hItem.presenter}
                        </span>
                      </div>
                      <h4 className="font-black text-lg text-foreground line-clamp-2 leading-tight flex-1 mb-4">{hItem.title}</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-accent">
                          <span>{Math.floor(hItem.progressTime / 60)} min</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-3 w-full bg-muted border-2 border-border rounded-full overflow-hidden">
                          <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Featured Talks ───────────────────────────────────────── */}
        <div className="w-full max-w-6xl flex flex-col gap-10">
          <div className="flex flex-col items-center gap-2">
            <h3 className="font-black text-4xl uppercase tracking-tighter border-b-8 border-tertiary pb-2">{t.featuredTitle}</h3>
            <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">{t.featuredSub}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border-2 border-border rounded-2xl shadow-pop p-2 animate-pulse">
                  <div className="aspect-video bg-muted rounded-xl mb-4" />
                  <div className="h-4 bg-muted rounded-full w-3/4 mb-2 mx-2" />
                  <div className="h-3 bg-muted rounded-full w-1/2 mx-2 mb-2" />
                </div>
              ))
            ) : (
              featured.map((talk, idx) => (
                <button key={talk.url} onClick={() => navigate(talk.url)}
                  className={`group bg-white border-2 border-border rounded-2xl shadow-pop-lg transition-all hover:bg-accent/5 relative ${idx % 3 === 0 ? '-rotate-1' : idx % 3 === 1 ? 'rotate-1' : ''}`}>
                  <div className="relative aspect-video m-2 overflow-hidden rounded-xl border-2 border-border group-hover:rotate-1 transition-transform">
                    {talk.thumbnail ? (
                      <img src={talk.thumbnail} alt={talk.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Play size={40} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-background/20 group-hover:bg-accent/20 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 bg-white border-2 border-border rounded-full flex items-center justify-center shadow-pop rotate-12">
                        <Play size={24} className="text-accent fill-accent translate-x-1" />
                      </div>
                    </div>
                    {talk.duration > 0 && (
                      <div className="absolute bottom-2 right-2 px-3 py-1 bg-foreground text-background text-[10px] font-black rounded-lg border-2 border-border shadow-pop">
                        {fmtDuration(talk.duration)}
                      </div>
                    )}
                  </div>
                  <div className="p-4 pt-2 text-left">
                    <p className="text-xs font-black text-accent uppercase tracking-widest mb-1 group-hover:text-secondary transition-colors underline decoration-2 underline-offset-4 decoration-border/10">
                      {talk.presenter}
                    </p>
                    <h4 className="text-lg font-black text-foreground line-clamp-2 leading-tight tracking-tight">{talk.title}</h4>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Features ─────────────────────────────────────────── */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div key={i} className={`group p-8 bg-white border-2 border-border rounded-3xl shadow-pop transition-all hover:-translate-y-2
              ${i === 0 ? 'bg-accent/5' : i === 1 ? 'bg-secondary/5' : 'bg-tertiary/5'}`}>
              <div className={`w-16 h-16 rounded-2xl border-2 border-border shadow-pop flex items-center justify-center mb-6 transition-transform group-hover:rotate-12
                ${i === 0 ? 'bg-accent text-white' : i === 1 ? 'bg-secondary text-white' : 'bg-tertiary text-foreground'}`}>
                {f.icon}
              </div>
              <h3 className="text-2xl font-black text-foreground mb-3">{f.title}</h3>
              <p className="text-muted-foreground font-bold leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative py-12 px-6 bg-white border-t-4 border-border overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-accent opacity-20" />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div className="space-y-2">
            <span className="font-black text-xl tracking-tighter">TED<span className="text-accent">Master</span></span>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t.footer}</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center font-black bg-tertiary shadow-pop">T</div>
              <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center font-black bg-secondary shadow-pop">E</div>
              <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center font-black bg-accent text-white shadow-pop">D</div>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              &copy; {new Date().getFullYear()} TEDMaster
            </p>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={(u) => setUser(u)} />}
    </div>
  );
}
