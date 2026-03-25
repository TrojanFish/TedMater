"use client";

import { PlayCircle, ShieldCheck, Zap, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to analyze URL");
      }

      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-ted-red/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-12 text-center">
        {/* Logo / Badge */}
        <div className="flex items-center gap-2 px-4 py-2 glass-effect rounded-full text-sm font-medium animate-fade-in text-white/80">
          <Sparkles className="w-4 h-4 text-ted-red" />
          <span>AI-Powered Intensive Reading</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
            TED<span className="text-ted-red">Master</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Turn visual mastery into language acquisition. Deep dive into the world's greatest ideas with AI syntax analysis and real-time shadowing.
          </p>
        </div>

        {/* URL Input Area */}
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <div className="glass-effect p-2 rounded-[2rem] flex items-center gap-2 group hover-glow transition-all duration-300">
            <div className="pl-6 text-white/40">
              <PlayCircle className="w-6 h-6" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a TED Talk URL to start learning..."
              className="flex-1 bg-transparent border-none outline-none py-4 px-2 text-lg text-white placeholder:text-white/30"
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !url}
              className="bg-ted-red hover:bg-white hover:text-ted-red text-white disabled:opacity-50 disabled:hover:bg-ted-red disabled:hover:text-white font-bold py-3 px-8 rounded-[1.5rem] transition-all duration-300"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Analyze"}
            </button>
          </div>
          {error && <p className="text-ted-red text-sm font-medium px-6 text-left">{error}</p>}
        </div>

        {/* Analysis Preview Card */}
        {data && (
          <div className="w-full max-w-2xl glass-effect p-6 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left border-l-4 border-l-ted-red">
            <h2 className="text-2xl font-bold text-white mb-2">{data.title}</h2>
            <p className="text-ted-red font-medium text-sm mb-4">by {data.presenter}</p>
            <p className="text-white/60 text-sm line-clamp-3 mb-6">{data.description}</p>
            <button 
              onClick={() => router.push(`/watch?url=${encodeURIComponent(url)}`)}
              className="w-full bg-ted-red hover:bg-white hover:text-ted-red text-white font-bold py-3 rounded-xl transition-all"
            >
              Go to Player →
            </button>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
          <div className="glass-effect p-8 rounded-3xl space-y-4 text-left group hover:bg-white/5 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-ted-red/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-ted-red" />
            </div>
            <h3 className="text-xl font-semibold text-white">Syntax Vision</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              AI-driven grammar breakdown for complex sentences. Understand every clause instantly.
            </p>
          </div>

          <div className="glass-effect p-8 rounded-3xl space-y-4 text-left group hover:bg-white/5 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">Shadow Scoring</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Real-time voice analysis and waveform comparison to perfect your rhythm and intonation.
            </p>
          </div>

          <div className="glass-effect p-8 rounded-3xl space-y-4 text-left group hover:bg-white/5 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">Ethical & Free</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Built for learners. Open source, non-commercial, and respects creators' rights.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 text-white/30 text-sm py-4">
        Made with ❤️ for English Learners • Non-commercial Project
      </footer>
    </main>
  );
}
