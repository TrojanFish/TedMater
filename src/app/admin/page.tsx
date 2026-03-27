"use client";

import { useState, useEffect, useCallback } from "react";
import { KeyRound, Users, Plus, Trash2, Copy, Check, LogOut, Loader2, RefreshCw } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-3xl p-8 shadow-2xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <div className="flex flex-col items-center mb-8 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-s)" }}>
              <KeyRound size={24} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-xl font-black">Admin Panel</h1>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>TEDMaster management console</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none border"
              style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            {loginErr && <p className="text-xs text-center font-semibold" style={{ color: "var(--accent)" }}>{loginErr}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
              style={{ background: "var(--accent)" }}
            >
              {loginLoading ? <Loader2 size={16} className="animate-spin" /> : "Enter"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const unusedCount = codes.filter(c => !c.usedBy).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-2">
          <span className="font-black text-base">TED<span style={{ color: "var(--accent)" }}>Master</span></span>
          <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "var(--accent-s)", color: "var(--accent)" }}>Admin</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-2)", border: "1px solid var(--border)" }}>
          <LogOut size={13} /> Logout
        </button>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Tabs */}
        <div className="flex gap-2">
          {(["codes", "users"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={tab === t
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
            >
              {t === "codes" ? <KeyRound size={14} /> : <Users size={14} />}
              {t === "codes" ? "Activation Codes" : "Users"}
            </button>
          ))}
          <button onClick={tab === "codes" ? fetchCodes : fetchUsers} className="ml-auto p-2 rounded-xl" style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Codes Tab */}
        {tab === "codes" && (
          <div className="flex flex-col gap-4">
            {/* Generate panel */}
            <div className="rounded-2xl p-5 flex flex-wrap gap-3 items-end" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--accent)" }}>Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={e => setGenCount(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--accent)" }}>Note (optional)</label>
                <input
                  type="text"
                  value={genNote}
                  onChange={e => setGenNote(e.target.value)}
                  placeholder="e.g. batch-jan"
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={genLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Generate
              </button>
              {unusedCount > 0 && (
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}
                >
                  <Copy size={14} /> Copy Unused ({unusedCount})
                </button>
              )}
            </div>

            {/* Codes table */}
            {loading ? (
              <div className="text-center py-12 text-sm" style={{ color: "var(--text-3)" }}>Loading...</div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Code</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Note</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Used by</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Created</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c, i) => (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold tracking-wider text-xs" style={{ color: c.usedBy ? "var(--text-3)" : "var(--text)" }}>{c.code}</span>
                            {!c.usedBy && (
                              <button onClick={() => handleCopy(c.code)} className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity">
                                {copied === c.code ? <Check size={12} style={{ color: "var(--accent)" }} /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-3)" }}>{c.note || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={
                            c.usedBy
                              ? { background: "var(--bg-3)", color: "var(--text-3)" }
                              : { background: "var(--accent-s)", color: "var(--accent)" }
                          }>
                            {c.usedBy ? "Used" : "Available"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-2)" }}>{c.usedBy?.email || "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-3)" }}>
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {!c.usedBy && (
                            <button onClick={() => handleDelete(c.id)} className="p-1 rounded opacity-40 hover:opacity-100 transition-opacity" style={{ color: "var(--accent)" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {codes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-3)" }}>No codes yet. Generate some above.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {loading ? (
              <div className="text-center py-12 text-sm" style={{ color: "var(--text-3)" }}>Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Credits</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Activation Code</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--text-3)" }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{u.email}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: "var(--accent)" }}>{u.credits}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={
                          u.role === "admin"
                            ? { background: "var(--accent-s)", color: "var(--accent)" }
                            : { background: "var(--bg-3)", color: "var(--text-3)" }
                        }>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-3)" }}>
                        {u.activationCodeUsed?.code || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-3)" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-3)" }}>No users yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
