"use client";

import { useState } from "react";
import { X, Mail, Lock, Loader2, UserPlus, LogIn, KeyRound } from "lucide-react";

interface Props {
  onClose: () => void;
  onSuccess: (user: any) => void;
  initialMode?: "login" | "signup";
}

export default function AuthModal({ onClose, onSuccess, initialMode = "login" }: Props) {
  const [isLogin, setIsLogin] = useState(initialMode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const body: Record<string, string> = { email, password };
      if (!isLogin) body.activationCode = activationCode;

      const res = await fetch(`/api/auth/${isLogin ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server error (Non-JSON response)");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message.includes("is not valid JSON") || err.message.includes("Unexpected token")
        ? "Server configuration issue. Check logs."
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setActivationCode("");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border-2 border-border rounded-3xl p-8 shadow-pop-lg relative animate-in fade-in zoom-in duration-300 ease-out"
        onClick={e => e.stopPropagation()}>

        <button onClick={onClose} 
          className="absolute -top-3 -right-3 w-10 h-10 bg-white border-2 border-border rounded-full flex items-center justify-center shadow-pop hover:scale-110 active:scale-95 transition-all z-10">
          <X size={20} strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-tertiary border-2 border-border shadow-pop flex items-center justify-center mb-4 -rotate-3 hover:rotate-0 transition-transform">
            {isLogin ? 
              <LogIn size={32} strokeWidth={2.5} className="text-foreground" /> : 
              <UserPlus size={32} strokeWidth={2.5} className="text-foreground" />
            }
          </div>
          <h2 className="text-3xl font-black text-foreground">{isLogin ? "Welcome Back!" : "Join the Fun!"}</h2>
          <p className="text-sm font-medium text-muted-foreground mt-1">Unlock AI tools with credits</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-foreground ml-1 tracking-widest">Email Address</label>
            <div className="relative group">
              <Mail size={18} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white border-2 border-border focus:border-accent focus:shadow-pop outline-none transition-all text-sm font-medium"
                placeholder="hello@example.com" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-foreground ml-1 tracking-widest">Secret Password</label>
            <div className="relative group">
              <Lock size={18} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white border-2 border-border focus:border-accent focus:shadow-pop outline-none transition-all text-sm font-medium"
                placeholder="••••••••" />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs uppercase font-black text-foreground ml-1 tracking-widest">Activation Code</label>
              <div className="relative group">
                <KeyRound size={18} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <input type="text" value={activationCode} onChange={e => setActivationCode(e.target.value.trim())} required
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white border-2 border-border focus:border-accent focus:shadow-pop outline-none transition-all text-sm font-mono font-bold tracking-wider"
                  placeholder="CODE-123" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-secondary/10 text-xs font-bold text-secondary border-2 border-secondary/20 text-center animate-bounce-short">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-candy text-lg h-16">
            {loading ? <Loader2 className="animate-spin" size={24} strokeWidth={2.5} /> : (isLogin ? "Login →" : "Sign Up Now!")}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t-2 border-muted text-center">
          <button onClick={switchMode} className="text-xs font-black text-accent hover:text-secondary transition-colors uppercase tracking-wider">
            {isLogin ? "New here? Create an account" : "Been here before? Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
