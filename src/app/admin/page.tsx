"use client";

import { useState, useEffect, useCallback } from "react";
import { KeyRound, Users, Plus, Trash2, Copy, Check, LogOut, Loader2, RefreshCw, Sparkles, Sliders, X } from "lucide-react";

type Code = {
  id: string;
  code: string;
  usedAt: string | null;
  createdAt: string;
  note: string | null;
  usedBy: { email: string } | null;
};

type User = {
  id: string;
  email: string;
  username: string | null;
  credits: number;
  role: string;
  createdAt: string;
  activationCodeUsed: { code: string } | null;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<"codes" | "users">("codes");
  const [codes, setCodes] = useState<Code[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genNote, setGenNote] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/codes");
    if (res.ok) { const d = await res.json(); setCodes(d.codes); }
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (tab === "codes") fetchCodes();
    else fetchUsers();
  }, [authed, tab, fetchCodes, fetchUsers]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginErr("");
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setLoginErr(d.error || "Login failed");
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setPassword("");
  };

  const handleGenerate = async () => {
    setGenLoading(true);
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: genCount, note: genNote || undefined }),
    });
    if (res.ok) { await fetchCodes(); setGenNote(""); }
    setGenLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this code?")) return;
    await fetch("/api/admin/codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCodes(prev => prev.filter(c => c.id !== id));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleCopyAll = () => {
    const unused = codes.filter(c => !c.usedBy).map(c => c.code).join("\n");
    if (unused) handleCopy(unused);
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-body selection:bg-tertiary">
        {/* Background Decorations */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary rounded-full mix-blend-multiply opacity-20" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-secondary rounded-full mix-blend-multiply opacity-10" />
          <div className="absolute inset-0 dot-grid opacity-[0.1]" />
        </div>

        <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm card-sticker bg-white p-10 animate-in zoom-in-95 duration-500 shadow-pop-lg">
          <div className="flex flex-col items-center mb-10 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent border-4 border-border flex items-center justify-center shadow-pop -rotate-6">
              <KeyRound size={32} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black uppercase tracking-tight">Admin<span className="text-accent underline decoration-tertiary decoration-4 underline-offset-4 ml-1">Panel</span></h1>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2 px-3 py-1 bg-muted rounded-full">Secure Management Console</p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-5 py-4 bg-muted/30 border-2 border-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
              />
            </div>
            {loginErr && (
              <p className="text-[10px] font-black text-center text-secondary uppercase tracking-widest animate-bounce px-4">
                ⚠ {loginErr}
              </p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="btn-candy w-full py-4 text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:translate-y-1 active:shadow-pop-active"
            >
              {loginLoading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} strokeWidth={3} />}
              Authorize Access
            </button>
          </div>
        </form>
      </div>
    );
  }

  const unusedCount = codes.filter(c => !c.usedBy).length;

  return (
    <div className="min-h-screen flex flex-col bg-background font-body selection:bg-tertiary">
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 bg-accent opacity-10 rounded-lg rotate-12" />
        <div className="absolute bottom-[20%] right-[10%] w-16 h-16 bg-quaternary opacity-10 rounded-full border-2 border-border border-dashed" />
        <div className="absolute inset-0 dot-grid opacity-[0.05]" />
      </div>

      {/* Header */}
      <header className="sticky top-4 mx-4 sm:mx-8 z-[100] flex items-center justify-between px-6 py-3 bg-white border-2 border-border rounded-2xl shadow-pop mt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent border-2 border-border rounded-xl shadow-pop flex items-center justify-center -rotate-6">
             <KeyRound size={20} className="text-white" />
          </div>
          <div className="flex flex-col -space-y-1">
             <span className="font-black text-xl tracking-tight">TED<span className="text-accent">Master</span></span>
             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Admin Console</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-candy bg-white hover:bg-secondary/10 text-secondary border-muted px-4 py-2 text-xs hover:border-secondary transition-all">
          <LogOut size={16} strokeWidth={2.5} className="mr-2" /> 
          <span className="uppercase tracking-widest">Logout</span>
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-10 relative z-10 flex flex-col gap-8">
        {/* Tabs & Tools */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="card-sticker p-1.5 flex gap-1 bg-white shadow-pop">
            {(["codes", "users"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                  ${tab === t ? "bg-accent text-white shadow-pop" : "text-muted-foreground hover:bg-muted"}`}
              >
                {t === "codes" ? <KeyRound size={14} strokeWidth={3} /> : <Users size={14} strokeWidth={3} />}
                {t === "codes" ? "Access Codes" : "User Roster"}
              </button>
            ))}
          </div>
          
          <button onClick={tab === "codes" ? fetchCodes : fetchUsers} 
            className="w-11 h-11 flex items-center justify-center card-sticker bg-white hover:bg-muted transition-all text-muted-foreground hover:text-foreground shadow-pop">
            <RefreshCw size={18} strokeWidth={3} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {tab === "codes" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Generate panel */}
              <div className="card-sticker bg-white p-8 shadow-pop-lg grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quantity</label>
                  <input
                    type="number"
                    min={1} max={100}
                    value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-muted/40 border-2 border-border rounded-xl font-black text-sm outline-none focus:ring-4 focus:ring-accent/10 transition-all shadow-pop-active"
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Audit Note</label>
                  <input
                    type="text"
                    value={genNote}
                    onChange={e => setGenNote(e.target.value)}
                    placeholder="Batch name, campaign id, or user target"
                    className="w-full px-4 py-3 bg-muted/40 border-2 border-border rounded-xl font-black text-sm outline-none focus:ring-4 focus:ring-accent/10 transition-all shadow-pop-active placeholder:opacity-30"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleGenerate} disabled={genLoading}
                    className="btn-candy flex-1 bg-accent text-white py-3 active:translate-y-1">
                    {genLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />}
                    <span className="ml-2 uppercase tracking-widest text-xs font-black">Create</span>
                  </button>
                  {unusedCount > 0 && (
                    <button onClick={handleCopyAll}
                      className="btn-candy bg-white text-foreground border-border py-3 shadow-pop-active hover:shadow-pop transition-all">
                      <Copy size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="card-sticker bg-white overflow-hidden shadow-pop-lg border-4 border-border">
                <div className="px-6 py-4 border-b-4 border-border bg-muted/20 flex items-center justify-between">
                   <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground flex items-center gap-2">
                      <KeyRound size={14} /> Registered Activation Keys
                   </h3>
                   <span className="text-[9px] font-black px-3 py-1 bg-accent/10 text-accent rounded-full uppercase tracking-tighter">
                      Showing {codes.length} results
                   </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-muted/10 border-b-2 border-border/10">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Key String</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin Note</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Redeemed By</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-6">Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-muted/10">
                      {codes.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`font-mono font-black text-xs tracking-wider px-3 py-1 rounded-lg border-2 border-dashed
                                ${c.usedBy ? "bg-muted border-border/10 text-muted-foreground line-through" : "bg-tertiary/20 border-tertiary/40 text-foreground"}`}>
                                {c.code}
                              </span>
                              {!c.usedBy && (
                                <button onClick={() => handleCopy(c.code)} className="p-1.5 bg-white border-2 border-border/10 rounded-lg hover:border-border transition-all shadow-pop-active scale-90">
                                  {copied === c.code ? <Check size={12} className="text-quaternary" strokeWidth={3} /> : <Copy size={12} className="text-muted-foreground" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-xs font-bold text-foreground/70">{c.note || <span className="opacity-20 italic">No notes</span>}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span className={`text-[9px] font-black uppercase tracking-tighter px-3 py-1 rounded-full border-2
                                ${c.usedBy ? "bg-muted border-border text-muted-foreground" : "bg-accent border-border text-white shadow-pop-active"}`}>
                                {c.usedBy ? "Redeemed" : "Valid"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-xs font-black text-foreground truncate max-w-[150px]">{c.usedBy?.email || "—"}</span>
                               {c.usedAt && <span className="text-[9px] font-bold text-muted-foreground">{new Date(c.usedAt).toLocaleDateString()}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right pr-6">
                             {!c.usedBy && (
                               <button onClick={() => handleDelete(c.id)} 
                                 className="w-10 h-10 flex items-center justify-center card-sticker bg-white hover:bg-secondary hover:text-white transition-all shadow-pop-active hover:shadow-pop text-secondary border-muted hover:border-border">
                                 <Trash2 size={16} strokeWidth={3} />
                               </button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {codes.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                       <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground/30 border-2 border-dashed border-border/20">
                          <Plus size={32} />
                       </div>
                       <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Vault is currently empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="card-sticker bg-white overflow-hidden shadow-pop-lg animate-in fade-in slide-in-from-bottom-4 duration-500 border-4 border-border">
              <div className="px-6 py-4 border-b-4 border-border bg-muted/20 flex items-center justify-between">
                 <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground flex items-center gap-2">
                    <Users size={14} /> Registered Members
                 </h3>
                 <span className="text-[9px] font-black px-3 py-1 bg-secondary/10 text-secondary rounded-full uppercase tracking-tighter italic">
                    {users.length} Users Total
                 </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/10 border-b-2 border-border/10">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">User Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Balance</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Origin Key</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-6">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-muted/10">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-9 h-9 bg-tertiary rounded-xl border-2 border-border shadow-pop-active flex items-center justify-center font-black text-xs uppercase italic">
                                {u.email[0]}
                             </div>
                             <div className="flex flex-col">
                                <span className="text-sm font-black text-foreground">{u.email}</span>
                                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">ID: {u.id.slice(0,8)}</span>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black">
                          <div className="flex items-center gap-2">
                             <div className="w-5 h-5 bg-tertiary rounded border border-border flex items-center justify-center">
                                <Sparkles size={10} className="text-accent" />
                             </div>
                             <span className="text-accent text-sm drop-shadow-sm">{u.credits} <span className="text-[9px] text-muted-foreground/60">PTS</span></span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full border-2 uppercase tracking-tighter
                            ${u.role === "admin" ? "bg-accent text-white border-border shadow-pop-active" : "bg-muted text-muted-foreground border-border/20"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                           {u.activationCodeUsed?.code ? (
                             <span className="font-mono text-[10px] font-bold bg-muted/60 px-2 py-1 rounded border border-border/5">{u.activationCodeUsed.code}</span>
                           ) : (
                             <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">Natural</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-right pr-6 text-xs font-bold text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
