"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, MessageSquare, QrCode, UserPlus, Check, Instagram, Send } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getStoredAttendeeId } from "@/hooks/useAttendee";
import { addPoints, POINTS } from "@/lib/points";
import type { Attendee, Match, Message, AttendeeRole } from "@/lib/types";

type NetTab = "discover" | "matches" | "qr";

const ROLE_COLORS: Record<AttendeeRole, string> = {
  Student: "default",
  Clinician: "mint",
  Academic: "default",
  Entrepreneur: "entrepreneur" as never,
  Industry: "surface"
} as Record<AttendeeRole, string>;

export default function NetworkingPage() {
  const [tab, setTab] = useState<NetTab>("discover");
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [others, setOthers] = useState<Attendee[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchedAttendees, setMatchedAttendees] = useState<Record<string, Attendee>>({});
  const [pendingFrom, setPendingFrom] = useState<Set<string>>(new Set()); // who I sent to
  const [filterRole, setFilterRole] = useState<AttendeeRole | "">("");
  const [chatOpen, setChatOpen] = useState<string | null>(null); // attendee id of chat partner
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(false);

  const attendeeId = typeof window !== "undefined" ? getStoredAttendeeId() : null;
  const sb = createSupabaseBrowserClient();

  useEffect(() => {
    if (attendeeId) {
      loadMyProfile();
      loadOthers();
      loadMatches();
    } else {
      loadOthers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendeeId]);

  // Realtime for messages
  useEffect(() => {
    if (!chatOpen || !attendeeId) return;
    const ch = sb.channel(`chat-${chatOpen}`)
      .on("postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "messages" } as never,
        (payload: { new: Message }) => {
          const m = payload.new;
          if ((m.sender_id === attendeeId && m.receiver_id === chatOpen) ||
              (m.sender_id === chatOpen && m.receiver_id === attendeeId)) {
            setMessages(prev => [...prev, m]);
          }
        })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, attendeeId]);

  async function loadMyProfile() {
    const { data } = await sb.from("attendees").select("*").eq("id", attendeeId!).single();
    if (data) setAttendee(data as Attendee);
  }

  async function loadOthers() {
    const { data } = await sb.from("attendees")
      .select("*")
      .order("points", { ascending: false })
      .limit(50);
    if (data) setOthers((data as Attendee[]).filter(a => a.id !== attendeeId));
  }

  async function loadMatches() {
    if (!attendeeId) return;
    const { data } = await sb.from("matches")
      .select("*")
      .or(`attendee_a.eq.${attendeeId},attendee_b.eq.${attendeeId}`);

    if (data) {
      setMatches(data as Match[]);
      // Track pending sent
      const sent = new Set((data as Match[])
        .filter(m => m.attendee_a === attendeeId)
        .map(m => m.attendee_b));
      setPendingFrom(sent);

      // Load matched attendee profiles
      const acceptedIds = (data as Match[])
        .filter(m => m.status === "accepted")
        .map(m => m.attendee_a === attendeeId ? m.attendee_b : m.attendee_a);

      if (acceptedIds.length > 0) {
        const { data: profiles } = await sb.from("attendees")
          .select("*").in("id", acceptedIds);
        if (profiles) {
          const map: Record<string, Attendee> = {};
          (profiles as Attendee[]).forEach(p => { map[p.id] = p; });
          setMatchedAttendees(map);
        }
      }
    }
  }

  const sendConnect = useCallback(async (targetId: string) => {
    if (!attendeeId || pendingFrom.has(targetId)) return;
    setPendingFrom(prev => new Set([...prev, targetId]));
    await sb.from("matches").insert({ attendee_a: attendeeId, attendee_b: targetId });
  }, [attendeeId, pendingFrom, sb]);

  const acceptMatch = useCallback(async (matchId: string, fromId: string) => {
    await sb.from("matches").update({ status: "accepted" } as never).eq("id", matchId);
    await addPoints(attendeeId!, POINTS.ACCEPT_MATCH);
    await addPoints(fromId, POINTS.ACCEPT_MATCH);
    loadMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendeeId, sb]);

  const openChat = useCallback(async (partnerId: string) => {
    if (!attendeeId) return;
    setChatOpen(partnerId);
    setMessages([]);
    const { data } = await sb.from("messages")
      .select("*")
      .or(`and(sender_id.eq.${attendeeId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${attendeeId})`)
      .order("created_at");
    if (data) setMessages(data as Message[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendeeId, sb]);

  const sendMsg = useCallback(async () => {
    if (!msgText.trim() || !attendeeId || !chatOpen) return;
    setLoading(true);
    await sb.from("messages").insert({
      sender_id: attendeeId, receiver_id: chatOpen, text: msgText.trim()
    });
    await addPoints(attendeeId, POINTS.SEND_MESSAGE);
    setMsgText("");
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgText, attendeeId, chatOpen, sb]);

  const filteredOthers = filterRole
    ? others.filter(a => a.role === filterRole)
    : others;

  const incomingRequests = matches.filter(
    m => m.status === "pending" && m.attendee_b === attendeeId
  );
  const acceptedMatches = matches.filter(m => m.status === "accepted");

  const TABS: { id: NetTab; label: string; icon: React.ReactNode }[] = [
    { id: "discover", label: "Discover", icon: <Users className="h-4 w-4" /> },
    { id: "matches",  label: `Matches ${acceptedMatches.length > 0 ? `(${acceptedMatches.length})` : ""}`,
      icon: <UserPlus className="h-4 w-4" /> },
    { id: "qr",       label: "QR",       icon: <QrCode className="h-4 w-4" /> }
  ];

  return (
    <main className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.08)] px-4 py-4 text-center">
        <h1 className="font-heading text-lg font-extrabold">Networking</h1>
        {!attendeeId && (
          <p className="mt-1 text-xs text-[rgba(240,240,255,0.4)]">
            <a href="/join" className="text-[#6C63FF] underline">Join first</a> to connect
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-all ${
              tab === t.id ? "border-b-2 border-[#6C63FF] text-[#6C63FF]" : "text-[rgba(240,240,255,0.4)] hover:text-white"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ── Discover ─────────────────────────────────────────── */}
          {tab === "discover" && (
            <motion.div key="discover" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Incoming requests */}
              {incomingRequests.length > 0 && (
                <div className="mb-6 rounded-[12px] border border-[rgba(0,229,160,0.2)] bg-[rgba(0,229,160,0.06)] p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#00E5A0]">
                    {incomingRequests.length} Connection Request{incomingRequests.length > 1 ? "s" : ""}
                  </p>
                  {incomingRequests.map(req => {
                    const requester = others.find(a => a.id === req.attendee_a);
                    return (
                      <div key={req.id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(108,99,255,0.2)] text-sm font-bold">
                          {requester?.name?.charAt(0) ?? "?"}
                        </div>
                        <span className="flex-1 text-sm font-semibold">{requester?.name ?? "Someone"}</span>
                        <button onClick={() => acceptMatch(req.id, req.attendee_a)}
                          className="rounded-full bg-[#00E5A0] px-3 py-1 text-xs font-bold text-[#0A0A0F]">
                          Accept
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Filter */}
              <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                {(["", "Student", "Clinician", "Academic", "Entrepreneur", "Industry"] as const).map(r => (
                  <button key={r} onClick={() => setFilterRole(r)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      filterRole === r
                        ? "bg-[#6C63FF] text-white"
                        : "border border-[rgba(255,255,255,0.1)] text-[rgba(240,240,255,0.5)] hover:border-[#6C63FF]"
                    }`}>
                    {r || "All"}
                  </button>
                ))}
              </div>

              {/* Attendee grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredOthers.map((a, i) => {
                  const isConnected = pendingFrom.has(a.id) || acceptedMatches.some(m =>
                    (m.attendee_a === a.id || m.attendee_b === a.id)
                  );
                  return (
                    <motion.div key={a.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="card-surface-hover p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar with score ring */}
                        <div className="relative shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(108,99,255,0.2)] text-lg font-bold">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#13131A] text-[8px] font-extrabold text-[#6C63FF]">
                            {a.outlier_score}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold">{a.name}</p>
                          <Badge variant={(ROLE_COLORS[a.role] as never) || "default"} className="mt-1">
                            {a.role}
                          </Badge>
                          {a.instagram && (
                            <a href={`https://instagram.com/${a.instagram}`} target="_blank" rel="noreferrer"
                              className="mt-2 flex items-center gap-1 text-xs text-[rgba(240,240,255,0.35)] hover:text-[#E1306C]">
                              <Instagram className="h-3 w-3" />@{a.instagram}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-[rgba(240,240,255,0.35)]">{a.points} pts</span>
                        {attendeeId && (
                          <Button
                            onClick={() => sendConnect(a.id)}
                            disabled={isConnected}
                            variant={isConnected ? "ghost" : "outline"}
                            size="sm"
                          >
                            {isConnected ? <><Check className="h-3 w-3" /> Sent</> : <><UserPlus className="h-3 w-3" /> Connect</>}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {filteredOthers.length === 0 && (
                <p className="py-16 text-center text-sm text-[rgba(240,240,255,0.3)]">
                  No attendees found
                </p>
              )}
            </motion.div>
          )}

          {/* ── Matches ──────────────────────────────────────────── */}
          {tab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {acceptedMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Users className="mb-4 h-10 w-10 text-[rgba(240,240,255,0.2)]" />
                  <p className="text-sm text-[rgba(240,240,255,0.4)]">No connections yet</p>
                  <p className="mt-1 text-xs text-[rgba(240,240,255,0.25)]">Go to Discover and connect!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {acceptedMatches.map(m => {
                    const otherId = m.attendee_a === attendeeId ? m.attendee_b : m.attendee_a;
                    const other = matchedAttendees[otherId];
                    return (
                      <motion.div key={m.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(108,99,255,0.2)] text-base font-bold">
                          {other?.name?.charAt(0) ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold">{other?.name ?? "..."}</p>
                          <p className="text-xs text-[rgba(240,240,255,0.4)]">{other?.role ?? ""}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openChat(otherId)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Chat
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── QR ───────────────────────────────────────────────── */}
          {tab === "qr" && (
            <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 text-center">
              {!attendeeId ? (
                <p className="text-sm text-[rgba(240,240,255,0.4)]">
                  <a href="/join" className="text-[#6C63FF] underline">Join first</a> to get your QR code
                </p>
              ) : (
                <>
                  <div className="rounded-[16px] bg-white p-6 shadow-[0_0_60px_rgba(108,99,255,0.3)]">
                    <QRCode
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/profile/${attendeeId}`}
                      size={220}
                    />
                  </div>
                  <div className="mt-6 space-y-1">
                    <p className="font-heading text-xl font-bold">{attendee?.name}</p>
                    <p className="text-sm text-[rgba(240,240,255,0.4)]">{attendee?.role}</p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="text-sm font-bold text-[#6C63FF]">{attendee?.outlier_score}</span>
                      <span className="text-xs text-[rgba(240,240,255,0.4)]">Outlier Score</span>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-[rgba(240,240,255,0.3)]">
                    Others scan this to connect with you instantly
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat modal */}
      <Modal
        open={!!chatOpen}
        onClose={() => setChatOpen(null)}
        title={`Chat — ${matchedAttendees[chatOpen ?? ""]?.name ?? ""}`}
        size="md"
      >
        <div className="flex flex-col gap-3" style={{ height: "360px" }}>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === attendeeId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-[10px] px-3 py-2 text-sm ${
                  msg.sender_id === attendeeId
                    ? "bg-[#6C63FF] text-white"
                    : "bg-[#1A1A24] border border-[rgba(255,255,255,0.08)] text-white"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="py-8 text-center text-xs text-[rgba(240,240,255,0.3)]">
                Say hello!
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMsg()}
              className="flex-1"
            />
            <Button onClick={sendMsg} disabled={loading || !msgText.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
