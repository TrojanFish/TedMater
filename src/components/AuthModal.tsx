"use client";

import { useState } from "react";
import { X, Mail, Lock, Loader2, UserPlus, LogIn } from "lucide-react";

interface Props {
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export default function AuthModal({ onClose, onSuccess }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/auth/${isLogin ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200" 
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors">
          <X size={18} className="opacity-40" />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center mb-4">
             {isLogin ? <LogIn size={28} className="text-accent" /> : <UserPlus size={28} className="text-accent" />}
          </div>
          <h2 className="text-2xl font-black">{isLogin ? "Welcome Back" : "Join TEDMaster"}</h2>
          <p className="text-xs opacity-40 mt-1">Unlock AI learning with credits</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-accent ml-1 tracking-wider">Email</label>
            <div className="relative group">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-bg-3 border border-transparent focus:border-accent/40 outline-none transition-all text-sm"
                placeholder="name@example.com" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-accent ml-1 tracking-wider">Password</label>
            <div className="relative group">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-bg-3 border border-transparent focus:border-accent/40 outline-none transition-all text-sm"
                placeholder="••••••••" />
            </div>
          </div>

          {error && <div className="p-3 rounded-xl bg-accent/5 text-[11px] font-bold text-accent border border-accent/10 text-center">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? "Sign In" : "Free Sign Up")}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
           <button onClick={() => setIsLogin(!isLogin)} className="text-xs font-bold text-accent/60 hover:text-accent transition-colors">
             {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
           </button>
        </div>
      </div>
    </div>
  );
}
