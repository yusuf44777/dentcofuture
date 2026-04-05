"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, BarChart3, Zap, Trophy, ChevronUp, Check, Pin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getStoredAttendeeId } from "@/hooks/useAttendee";
import { addPoints, POINTS } from "@/lib/points";
import type { Question, Poll, Reaction, Attendee, AttendeeRole } from "@/lib/types";

type Tab = "questions" | "polls" | "reactions" | "leaderboard";

const EMOJI_LIST = ["🔥", "💡", "🤯", "👏", "❓"] as const;
const ROLE_LABELS: Record<AttendeeRole, string> = {
  Student: "Öğrenci",
  Clinician: "Klinisyen",
  Academic: "Akademisyen",
  Entrepreneur: "Girişimci",
  Industry: "Sektör"
};

// ─── Floating emoji component ────────────────────────────────────────────────
function FloatingEmoji({ emoji, id, x }: { emoji: string; id: number; x: number }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -160, scale: 1.5 }}
      transition={{ duration: 1.4, ease: "easeOut" }}
      className="pointer-events-none fixed bottom-24 z-[9999] text-3xl"
      style={{ left: x }}
    >
      {emoji}
    </motion.div>
  );
}

export default function LivePage() {
  const [tab, setTab] = useState<Tab>("questions");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [leaderboard, setLeaderboard] = useState<Attendee[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [votedPoll, setVotedPoll] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [floaters, setFloaters] = useState<{ emoji: string; id: number; x: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [myUpvotes, setMyUpvotes] = useState(3); // 3 upvotes per session
  const floaterId = useRef(0);
  const attendeeId = typeof window !== "undefined" ? getStoredAttendeeId() : null;

  const sb = createSupabaseBrowserClient();

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadQuestions();
    loadActivePoll();
    loadLeaderboard();
    loadReactionCounts();

    // Load upvotes I've already made
    if (attendeeId) {
      sb.from("question_upvotes")
        .select("question_id")
        .eq("attendee_id", attendeeId)
        .then(({ data }) => {
          if (data) setUpvoted(new Set(data.map(r => r.question_id)));
        });

      sb.from("poll_votes")
        .select("poll_id")
        .eq("attendee_id", attendeeId)
        .then(({ data }) => {
          if (data?.[0]) setVotedPoll(data[0].poll_id);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    const ch = sb.channel("live-hub")
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "questions" } as never,
        () => loadQuestions())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "question_upvotes" } as never,
        () => loadQuestions())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "polls" } as never,
        () => loadActivePoll())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "poll_votes" } as never,
        () => loadActivePoll())
      .on("postgres_changes" as never, { event: "INSERT", schema: "public", table: "reactions" } as never,
        (payload: { new: Reaction }) => {
          setReactionCounts(prev => ({
            ...prev,
            [payload.new.emoji]: (prev[payload.new.emoji] ?? 0) + 1
          }));
        })
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "attendees" } as never,
        () => loadLeaderboard())
      .subscribe();

    return () => { sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions() {
    const { data } = await sb
      .from("questions")
      .select("*, attendee:attendees(name,role)")
      .order("pinned", { ascending: false })
      .order("votes", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setQuestions(data as Question[]);
  }

  async function loadActivePoll() {
    const { data } = await sb.from("polls").select("*").eq("active", true).single();
    setActivePoll(data as Poll | null);
  }

  async function loadLeaderboard() {
    const { data } = await sb
      .from("attendees")
      .select("*")
      .order("points", { ascending: false })
      .limit(10);
    if (data) setLeaderboard(data as Attendee[]);
  }

  async function loadReactionCounts() {
    const { data } = await sb.from("reactions").select("emoji");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
      setReactionCounts(counts);
    }
  }

  // ── Submit question ──────────────────────────────────────────────────────────
  async function submitQuestion() {
    if (!questionText.trim() || !attendeeId) return;
    setSubmitting(true);
    const { error } = await sb.from("questions").insert({
      attendee_id: attendeeId,
      text: questionText.trim(),
      session_id: null
    });
    if (!error) {
      setQuestionText("");
      await addPoints(attendeeId, POINTS.ASK_QUESTION);
    }
    setSubmitting(false);
  }

  // ── Upvote question ──────────────────────────────────────────────────────────
  async function upvoteQuestion(qId: string, currentVotes: number) {
    if (!attendeeId || upvoted.has(qId) || myUpvotes <= 0) return;
    setUpvoted(prev => new Set([...prev, qId]));
    setMyUpvotes(v => v - 1);

    await sb.from("question_upvotes").insert({ question_id: qId, attendee_id: attendeeId });
    await sb.from("questions").update({ votes: currentVotes + 1 } as never).eq("id", qId);

    // Award points to question asker
    const q = questions.find(q => q.id === qId);
    if (q) await addPoints(q.attendee_id, POINTS.QUESTION_UPVOTED);
  }

  // ── Vote on poll ─────────────────────────────────────────────────────────────
  async function votePoll(optionIndex: number) {
    if (!attendeeId || !activePoll || votedPoll === activePoll.id) return;
    setVotedPoll(activePoll.id);

    await sb.from("poll_votes").insert({
      poll_id: activePoll.id,
      attendee_id: attendeeId,
      option_index: optionIndex
    });

    const results = { ...(activePoll.results ?? {}) };
    results[optionIndex] = (results[optionIndex] ?? 0) + 1;
    await sb.from("polls").update({ results } as never).eq("id", activePoll.id);
    await addPoints(attendeeId, POINTS.POLL_VOTE);
    loadActivePoll();
  }

  // ── Send reaction ─────────────────────────────────────────────────────────────
  const sendReaction = useCallback(async (emoji: string) => {
    if (!attendeeId) return;
    await sb.from("reactions").insert({ emoji, attendee_id: attendeeId, session_id: null });

    floaterId.current++;
    const x = Math.random() * (window.innerWidth * 0.6) + window.innerWidth * 0.2;
    const id = floaterId.current;
    setFloaters(prev => [...prev, { emoji, id, x }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 1500);
  }, [attendeeId, sb]);

  // ── Poll helpers ─────────────────────────────────────────────────────────────
  function getPollTotal(poll: Poll) {
    return Object.values(poll.results ?? {}).reduce((a, b) => a + b, 0);
  }

  function getPollPct(poll: Poll, idx: number) {
    const total = getPollTotal(poll);
    if (!total) return 0;
    return Math.round(((poll.results?.[idx] ?? 0) / total) * 100);
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "questions",   label: "Soru-Cevap", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "polls",       label: "Anketler",   icon: <BarChart3 className="h-4 w-4" /> },
    { id: "reactions",   label: "Tepkiler",   icon: <Zap className="h-4 w-4" /> },
    { id: "leaderboard", label: "Liderlik",   icon: <Trophy className="h-4 w-4" /> }
  ];

  return (
    <main className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      {/* Floating emojis */}
      <AnimatePresence>
        {floaters.map(f => <FloatingEmoji key={f.id} {...f} />)}
      </AnimatePresence>

      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[#0A0A0F] px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="live-dot" />
          <h1 className="font-heading text-lg font-extrabold text-white">Canlı Oturum Merkezi</h1>
        </div>
        {!attendeeId && (
          <p className="mt-1 text-xs text-[rgba(240,240,255,0.4)]">
            Katılmak için önce <a href="/join" className="text-[#6C63FF] underline">kayıt ol</a>
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)] bg-[#0A0A0F]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-all ${
              tab === t.id
                ? "border-b-2 border-[#6C63FF] text-[#6C63FF]"
                : "text-[rgba(240,240,255,0.4)] hover:text-white"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ── Questions ──────────────────────────────────────── */}
          {tab === "questions" && (
            <motion.div key="questions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Submit */}
              {attendeeId && (
                <div className="mb-6 space-y-3 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-4">
                  <Textarea
                    placeholder="Konuşmacıya bir soru sor..."
                    value={questionText}
                    onChange={e => setQuestionText(e.target.value)}
                    rows={3}
                    maxLength={200}
                    showCount
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[rgba(240,240,255,0.3)]">{myUpvotes} oy hakkın kaldı</p>
                    <Button onClick={submitQuestion} disabled={submitting || !questionText.trim()} size="sm">
                      <Send className="h-3.5 w-3.5" /> Gönder
                    </Button>
                  </div>
                </div>
              )}

              {/* Feed */}
              <div className="space-y-3">
                {questions.length === 0 && (
                  <p className="py-12 text-center text-sm text-[rgba(240,240,255,0.3)]">
                    Henüz soru yok. İlk soruyu sen sor!
                  </p>
                )}
                <AnimatePresence>
                  {questions.map((q, i) => (
                    <motion.div key={q.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      className={`rounded-[12px] border p-4 transition-all ${
                        q.answered ? "border-[rgba(0,229,160,0.2)] bg-[rgba(0,229,160,0.05)] opacity-60"
                        : q.pinned ? "border-[rgba(108,99,255,0.4)] bg-[rgba(108,99,255,0.08)] shadow-[0_0_20px_rgba(108,99,255,0.15)]"
                        : "border-[rgba(255,255,255,0.08)] bg-[#13131A]"
                      }`}>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => upvoteQuestion(q.id, q.votes)}
                          disabled={upvoted.has(q.id) || myUpvotes <= 0 || !attendeeId}
                          className={`flex flex-col items-center gap-0.5 rounded-[8px] border px-2 py-1.5 transition-all ${
                            upvoted.has(q.id)
                              ? "border-[#6C63FF] bg-[rgba(108,99,255,0.2)] text-[#6C63FF]"
                              : "border-[rgba(255,255,255,0.1)] text-[rgba(240,240,255,0.4)] hover:border-[#6C63FF] hover:text-[#6C63FF]"
                          } disabled:cursor-not-allowed disabled:opacity-30`}>
                          <ChevronUp className="h-4 w-4" />
                          <span className="text-xs font-bold tabular-nums">{q.votes}</span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white leading-snug">{q.text}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[rgba(240,240,255,0.4)]">
                              {(q.attendee as { name?: string } | undefined)?.name ?? "Anonim"}
                            </span>
                            {q.pinned && <span className="flex items-center gap-1 text-xs text-[#A78BFA]"><Pin className="h-3 w-3"/> Sabitlendi</span>}
                            {q.answered && <span className="flex items-center gap-1 text-xs text-[#00E5A0]"><Check className="h-3 w-3"/> Yanıtlandı</span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── Polls ──────────────────────────────────────────── */}
          {tab === "polls" && (
            <motion.div key="polls" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!activePoll ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <BarChart3 className="mb-4 h-10 w-10 text-[rgba(240,240,255,0.2)]" />
                  <p className="text-sm text-[rgba(240,240,255,0.4)]">Şu anda aktif anket yok</p>
                  <p className="mt-1 text-xs text-[rgba(240,240,255,0.25)]">Oturum başlayınca tekrar kontrol et</p>
                </div>
              ) : (
                <div className="mx-auto max-w-lg space-y-4">
                  <h2 className="font-heading text-xl font-bold leading-snug text-white">
                    {activePoll.question}
                  </h2>
                  <p className="text-xs text-[rgba(240,240,255,0.4)]">
                    {getPollTotal(activePoll)} oy
                    {votedPoll === activePoll.id && " · Oy verdin"}
                  </p>

                  <div className="space-y-3">
                    {activePoll.options.map((opt, idx) => {
                      const pct = getPollPct(activePoll, idx);
                      const voted = votedPoll === activePoll.id;
                      void (voted && (activePoll.results?.[idx] ?? 0) > 0); // isChosen — reserved for future highlight logic

                      return (
                        <button key={idx}
                          onClick={() => !voted && votePoll(idx)}
                          disabled={voted}
                          className={`relative w-full overflow-hidden rounded-[12px] border p-4 text-left transition-all ${
                            voted
                              ? "border-[rgba(255,255,255,0.1)] cursor-default"
                              : "border-[rgba(255,255,255,0.1)] hover:border-[#6C63FF] hover:bg-[rgba(108,99,255,0.08)] cursor-pointer"
                          }`}>
                          {/* Bar */}
                          {voted && (
                            <div
                              className="absolute inset-y-0 left-0 rounded-[12px] bg-[rgba(108,99,255,0.15)] transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{opt}</span>
                            {voted && (
                              <span className="text-xs font-bold text-[#6C63FF]">{pct}%</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Reactions ───────────────────────────────────────── */}
          {tab === "reactions" && (
            <motion.div key="reactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Energy bar */}
              <div className="mb-8 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[rgba(240,240,255,0.4)]">
                  Oturum Enerjisi
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-[#00E5A0]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (Object.values(reactionCounts).reduce((a,b)=>a+b,0) / 2))}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[rgba(240,240,255,0.3)]">
                  <span>{Object.values(reactionCounts).reduce((a,b)=>a+b,0)} toplam tepki</span>
                </div>
              </div>

              {/* Emoji buttons */}
              {attendeeId ? (
                <div className="grid grid-cols-5 gap-3">
                  {EMOJI_LIST.map(emoji => (
                    <button key={emoji} onClick={() => sendReaction(emoji)}
                      className="flex flex-col items-center gap-2 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] py-5 transition-all hover:border-[rgba(108,99,255,0.4)] hover:bg-[rgba(108,99,255,0.1)] active:scale-90">
                      <span className="text-3xl">{emoji}</span>
                      <span className="text-xs font-bold tabular-nums text-[rgba(240,240,255,0.4)]">
                        {reactionCounts[emoji] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-3">
                    {EMOJI_LIST.map(emoji => (
                      <div key={emoji} className="flex flex-col items-center gap-2 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] py-5 opacity-40">
                        <span className="text-3xl">{emoji}</span>
                        <span className="text-xs tabular-nums text-[rgba(240,240,255,0.3)]">
                          {reactionCounts[emoji] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-xs text-[rgba(240,240,255,0.4)]">
                    Tepki göndermek için <a href="/join" className="text-[#6C63FF]">katıl</a>
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Leaderboard ─────────────────────────────────────── */}
          {tab === "leaderboard" && (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold">En İyi Outlier&apos;lar</h2>
                <Badge variant="mint">Canlı</Badge>
              </div>
              <div className="space-y-2">
                {leaderboard.map((a, i) => (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 rounded-[12px] border p-3 ${
                      a.id === attendeeId
                        ? "border-[rgba(108,99,255,0.4)] bg-[rgba(108,99,255,0.1)]"
                        : "border-[rgba(255,255,255,0.06)] bg-[#13131A]"
                    }`}>
                    <span className={`w-7 text-center text-sm font-extrabold ${
                      i === 0 ? "text-[#FFD700]" : i === 1 ? "text-[#C0C0C0]" : i === 2 ? "text-[#CD7F32]" : "text-[rgba(240,240,255,0.4)]"
                    }`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(108,99,255,0.2)] text-sm font-bold">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {a.name}{a.id === attendeeId && " (sen)"}
                      </p>
                      <p className="text-xs text-[rgba(240,240,255,0.4)]">{ROLE_LABELS[a.role] ?? a.role}</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#6C63FF]">{a.points}</span>
                  </motion.div>
                ))}
                {leaderboard.length === 0 && (
                  <p className="py-12 text-center text-sm text-[rgba(240,240,255,0.3)]">
                    Henüz katılımcı yok
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
