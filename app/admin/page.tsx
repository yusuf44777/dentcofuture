"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, MessageSquare, Zap, Play, Square,
  Plus, Trash2, Pin, Check, Lock, Trophy, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Attendee, Question, Poll, Session, AttendeeRole } from "@/lib/types";

const ROLE_LABELS: Record<AttendeeRole, string> = {
  Student: "Öğrenci",
  Clinician: "Klinisyen",
  Academic: "Akademisyen",
  Entrepreneur: "Girişimci",
  Industry: "Sektör"
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");

  // Data
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reactionTotal, setReactionTotal] = useState(0);
  const [reactionByEmoji, setReactionByEmoji] = useState<Record<string, number>>({});

  // Poll form
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Session form
  const [sessionTitle, setSessionTitle] = useState("");

  const sb = createSupabaseBrowserClient();

  useEffect(() => {
    if (!authed) return;
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  function checkPassword() {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "outliers2026";
    if (password === expected) {
      setAuthed(true);
    } else {
      setPwError("Şifre hatalı");
    }
  }

  async function loadAll() {
    const [att, qst, pol, ses, rxn] = await Promise.all([
      sb.from("attendees").select("*").order("points", { ascending: false }),
      sb.from("questions").select("*, attendee:attendees(name,role)").order("pinned", { ascending: false }).order("votes", { ascending: false }),
      sb.from("polls").select("*").order("created_at", { ascending: false }),
      sb.from("sessions").select("*").order("start_time"),
      sb.from("reactions").select("emoji")
    ]);
    if (att.data) setAttendees(att.data as Attendee[]);
    if (qst.data) setQuestions(qst.data as Question[]);
    if (pol.data) setPolls(pol.data as Poll[]);
    if (ses.data) setSessions(ses.data as Session[]);
    if (rxn.data) {
      const counts: Record<string, number> = {};
      rxn.data.forEach((r: { emoji: string }) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
      setReactionByEmoji(counts);
      setReactionTotal(rxn.data.length);
    }
  }

  const markAnswered = useCallback(async (id: string) => {
    await sb.from("questions").update({ answered: true } as never).eq("id", id);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const togglePin = useCallback(async (id: string, current: boolean) => {
    await sb.from("questions").update({ pinned: !current } as never).eq("id", id);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const activatePoll = useCallback(async (pollId: string) => {
    await sb.from("polls").update({ active: false } as never).neq("id", pollId);
    await sb.from("polls").update({ active: true } as never).eq("id", pollId);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const deactivatePoll = useCallback(async (pollId: string) => {
    await sb.from("polls").update({ active: false } as never).eq("id", pollId);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const createPoll = useCallback(async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    await sb.from("polls").insert({
      question: pollQuestion.trim(),
      options: pollOptions.filter(o => o.trim()),
      results: {},
      active: false
    });
    setPollQuestion("");
    setPollOptions(["", ""]);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollQuestion, pollOptions, sb]);

  const deletePoll = useCallback(async (id: string) => {
    await sb.from("polls").delete().eq("id", id);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const activateSession = useCallback(async (sessionId: string) => {
    await sb.from("sessions").update({ active: false } as never).neq("id", sessionId);
    await sb.from("sessions").update({ active: true } as never).eq("id", sessionId);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const deactivateSession = useCallback(async (sessionId: string) => {
    await sb.from("sessions").update({ active: false } as never).eq("id", sessionId);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const createSession = useCallback(async () => {
    if (!sessionTitle.trim()) return;
    await sb.from("sessions").insert({
      title: sessionTitle.trim(),
      active: false,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString()
    });
    setSessionTitle("");
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionTitle, sb]);

  function exportCSV() {
    const rows = [
      ["Ad Soyad", "Rol", "Instagram", "LinkedIn", "Outlier Puanı", "Puan", "Oluşturulma"],
      ...attendees.map(a => [a.name, a.role, a.instagram ?? "", a.linkedin ?? "", a.outlier_score, a.points, a.created_at])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dentco-outliers-katilimcilar.csv"; a.click();
  }

  const roleCounts = attendees.reduce<Record<string, number>>((acc, a) => {
    acc[a.role] = (acc[a.role] ?? 0) + 1; return acc;
  }, {});

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-4 rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-8 text-center"
        >
          <Lock className="mx-auto h-8 w-8 text-[rgba(240,240,255,0.3)]" />
          <h1 className="font-heading text-xl font-extrabold text-white">Yönetim Erişimi</h1>
          <Input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={e => { setPassword(e.target.value); setPwError(""); }}
            onKeyDown={e => e.key === "Enter" && checkPassword()}
            error={pwError}
            autoFocus
          />
          <Button onClick={checkPassword} className="w-full" size="lg">Panoya Gir</Button>
        </motion.div>
      </main>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[#13131A] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-extrabold">DentCo Outliers — Yönetim</h1>
            <p className="text-xs text-[rgba(240,240,255,0.4)]">Canlı pano</p>
          </div>
          <Button onClick={exportCSV} variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" /> CSV Dışa Aktar
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">

        {/* ── Stats row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Katılımcılar", value: attendees.length, icon: <Users className="h-5 w-5" />, color: "#6C63FF" },
            { label: "Sorular", value: questions.length, icon: <MessageSquare className="h-5 w-5" />, color: "#00E5A0" },
            { label: "Tepkiler", value: reactionTotal, icon: <Zap className="h-5 w-5" />, color: "#FF4D6D" },
            { label: "Aktif Anket", value: polls.filter(p=>p.active).length ? "Evet" : "Hayır", icon: <BarChart3 className="h-5 w-5" />, color: "#F59E0B" }
          ].map(stat => (
            <div key={stat.label} className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-4">
              <div className="flex items-center gap-2" style={{ color: stat.color }}>
                {stat.icon}
                <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(240,240,255,0.5)]">{stat.label}</span>
              </div>
              <p className="mt-2 font-heading text-3xl font-extrabold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Role breakdown ──────────────────────────────────── */}
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
          <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">Rollere Göre Katılımcılar</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(roleCounts).map(([role, count]) => (
              <div key={role} className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-2">
                <span className="text-sm font-semibold text-white">{ROLE_LABELS[role as AttendeeRole] ?? role}</span>
                <span className="rounded-full bg-[#6C63FF] px-2 py-0.5 text-xs font-bold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Reaction energy ──────────────────────────────────── */}
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
          <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">Tepki Enerji Ölçeri</h2>
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-[#00E5A0] transition-all duration-500"
              style={{ width: `${Math.min(100, reactionTotal / 2)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(reactionByEmoji).map(([emoji, count]) => (
              <div key={emoji} className="flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <span className="font-bold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sessions control ─────────────────────────────────── */}
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
          <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">Oturumlar</h2>

          <div className="mb-4 flex gap-3">
            <Input placeholder="Yeni oturum başlığı..." value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createSession()} className="flex-1" />
            <Button onClick={createSession} size="default"><Plus className="h-4 w-4" />Ekle</Button>
          </div>

          <div className="space-y-2">
            {sessions.map(sess => (
              <div key={sess.id} className={`flex items-center gap-3 rounded-[10px] border p-3 ${
                sess.active ? "border-[rgba(0,229,160,0.3)] bg-[rgba(0,229,160,0.06)]" : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
              }`}>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">{sess.title}</p>
                  {sess.speaker && <p className="text-xs text-[rgba(240,240,255,0.4)]">{sess.speaker}</p>}
                </div>
                {sess.active ? (
                  <>
                    <Badge variant="mint">CANLI</Badge>
                    <Button variant="danger" size="sm" onClick={() => deactivateSession(sess.id)}>
                      <Square className="h-3.5 w-3.5" /> Bitir
                    </Button>
                  </>
                ) : (
                  <Button variant="mint" size="sm" onClick={() => activateSession(sess.id)}>
                    <Play className="h-3.5 w-3.5" /> Başlat
                  </Button>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-[rgba(240,240,255,0.3)]">Henüz oturum yok. Yukarıdan ekleyin.</p>
            )}
          </div>
        </div>

        {/* ── Poll creator ─────────────────────────────────────── */}
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
          <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">Anketler</h2>

          <div className="mb-6 space-y-3 rounded-[10px] border border-[rgba(108,99,255,0.2)] bg-[rgba(108,99,255,0.06)] p-4">
            <Textarea placeholder="Anket sorusu..." value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)} rows={2} />
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder={`Seçenek ${i + 1}`} value={opt}
                  onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }} />
                {pollOptions.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setPollOptions([...pollOptions, ""])}>
                <Plus className="h-3.5 w-3.5" /> Seçenek Ekle
              </Button>
              <Button size="sm" onClick={createPoll}>Anket Oluştur</Button>
            </div>
          </div>

          <div className="space-y-3">
            {polls.map(poll => {
              const total = Object.values(poll.results ?? {}).reduce((a, b) => a + b, 0);
              return (
                <div key={poll.id} className={`rounded-[10px] border p-4 ${
                  poll.active ? "border-[rgba(0,229,160,0.3)] bg-[rgba(0,229,160,0.06)]" : "border-[rgba(255,255,255,0.06)]"
                }`}>
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{poll.question}</p>
                      <p className="text-xs text-[rgba(240,240,255,0.4)]">{total} oy</p>
                    </div>
                    <div className="flex gap-2">
                      {poll.active ? (
                        <Button variant="danger" size="sm" onClick={() => deactivatePoll(poll.id)}>Kapat</Button>
                      ) : (
                        <Button variant="mint" size="sm" onClick={() => activatePoll(poll.id)}>
                          <Play className="h-3.5 w-3.5" /> Yayına Al
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deletePoll(poll.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {poll.options.map((opt, i) => {
                      const votes = poll.results?.[i] ?? 0;
                      const pct = total ? Math.round((votes / total) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-32 truncate text-xs text-[rgba(240,240,255,0.6)]">{opt}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                            <div className="h-full rounded-full bg-[#6C63FF] transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs font-bold text-[rgba(240,240,255,0.5)]">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Question queue ───────────────────────────────────── */}
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
          <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">
            Soru Kuyruğu ({questions.filter(q => !q.answered).length} beklemede)
          </h2>
          <div className="space-y-2">
            {questions.map(q => (
              <div key={q.id} className={`flex items-start gap-3 rounded-[10px] border p-3 ${
                q.answered ? "border-[rgba(255,255,255,0.04)] opacity-50"
                : q.pinned ? "border-[rgba(108,99,255,0.4)] bg-[rgba(108,99,255,0.06)]"
                : "border-[rgba(255,255,255,0.06)]"
              }`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-snug">{q.text}</p>
                  <p className="mt-0.5 text-xs text-[rgba(240,240,255,0.4)]">
                    {(q.attendee as { name?: string } | undefined)?.name} · {q.votes} oy
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => togglePin(q.id, q.pinned)}
                    className={q.pinned ? "text-[#6C63FF]" : ""}>
                    <Pin className="h-3.5 w-3.5" />
                  </Button>
                  {!q.answered && (
                    <Button variant="ghost" size="icon" onClick={() => markAnswered(q.id)}>
                      <Check className="h-3.5 w-3.5 text-[#00E5A0]" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <p className="text-xs text-[rgba(240,240,255,0.3)]">Henüz soru yok</p>
            )}
          </div>
        </div>

        {/* ── Top Leaderboard ──────────────────────────────────── */}
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#FFD700]" />
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">Liderlik Tablosu</h2>
          </div>
          <div className="space-y-2">
            {attendees.slice(0, 10).map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 rounded-[8px] p-2">
                <span className="w-6 text-center text-xs font-extrabold text-[rgba(240,240,255,0.4)]">
                  {i === 0 ? <i className="fa-solid fa-trophy text-[#FFD700]" aria-hidden="true" />
                    : i === 1 ? <i className="fa-solid fa-medal text-[#C0C0C0]" aria-hidden="true" />
                    : i === 2 ? <i className="fa-solid fa-award text-[#CD7F32]" aria-hidden="true" />
                    : `${i + 1}`}
                </span>
                <span className="flex-1 text-sm font-semibold truncate">{a.name}</span>
                <span className="text-xs text-[rgba(240,240,255,0.4)]">{ROLE_LABELS[a.role] ?? a.role}</span>
                <span className="text-sm font-extrabold text-[#6C63FF]">{a.points} puan</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
