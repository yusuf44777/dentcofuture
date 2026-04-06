"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, ArrowLeft, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getStoredAttendeeId } from "@/hooks/useAttendee";
import { addPoints, POINTS } from "@/lib/points";
import type { GameScore } from "@/lib/types";

export default function GamePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [leaderboard, setLeaderboard] = useState<(GameScore & { attendee?: { name: string } })[]>([]);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const attendeeId = typeof window !== "undefined" ? getStoredAttendeeId() : null;

  useEffect(() => {
    loadLeaderboard();

    // Award play points once
    if (attendeeId && !pointsAwarded) {
      addPoints(attendeeId, POINTS.GAME_PLAY).then(() => setPointsAwarded(true));
    }

    // Listen for score messages from the game iframe
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "TOOTH_DEFENDER_SCORE" && attendeeId) {
        const { score, wave } = e.data as { score: number; wave: number };
        submitScore(score, wave);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLeaderboard() {
    const sb = createSupabaseBrowserClient();
    const { data } = await sb
      .from("game_scores")
      .select("*, attendee:attendees(name)")
      .order("score", { ascending: false })
      .limit(10);
    if (data) setLeaderboard(data as (GameScore & { attendee?: { name: string } })[]);
  }

  async function submitScore(score: number, wave: number) {
    if (!attendeeId) return;
    const sb = createSupabaseBrowserClient();
    await sb.from("game_scores").insert({ attendee_id: attendeeId, score, wave });
    const bonus = Math.floor(score / 100);
    if (bonus > 0) await addPoints(attendeeId, bonus);
    loadLeaderboard();
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-[rgba(255,255,255,0.08)] px-4 py-4">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-[#C75B12]" />
          <h1 className="font-heading text-lg font-extrabold">Molar Muhafızı</h1>
        </div>
        {attendeeId && !pointsAwarded && (
          <div className="ml-auto rounded-full bg-[rgba(47,158,68,0.15)] px-3 py-1 text-xs font-semibold text-[#2F9E44]">
            +{POINTS.GAME_PLAY} puan oyun bonusu!
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Game iframe */}
        <div className="relative flex-1">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full min-h-[500px]"
          >
            <iframe
              ref={iframeRef}
              src="/game-embed/index.html"
              className="h-full w-full border-0"
              style={{ minHeight: "calc(100vh - 64px)" }}
              allow="autoplay"
              title="Molar Muhafızı Oyunu"
            />
          </motion.div>
        </div>

        {/* Leaderboard sidebar */}
        <div className="w-full border-t border-[rgba(255,255,255,0.08)] bg-[#13131A] p-4 lg:w-72 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#FFD700]" />
            <h2 className="font-heading text-sm font-bold">En İyi Skorlar</h2>
          </div>

          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 rounded-[8px] p-2.5 ${
                  entry.attendee_id === attendeeId
                    ? "bg-[rgba(199,91,18,0.15)] border border-[rgba(199,91,18,0.3)]"
                    : "bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <span className="w-6 text-center text-xs font-extrabold text-[rgba(240,240,255,0.4)]">
                  {i === 0 ? <i className="fa-solid fa-trophy text-[#FFD700]" aria-hidden="true" />
                    : i === 1 ? <i className="fa-solid fa-medal text-[#C0C0C0]" aria-hidden="true" />
                    : i === 2 ? <i className="fa-solid fa-award text-[#CD7F32]" aria-hidden="true" />
                    : `${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {(entry.attendee as { name?: string } | undefined)?.name ?? "Anonim"}
                    {entry.attendee_id === attendeeId && " (sen)"}
                  </p>
                  <p className="text-[10px] text-[rgba(240,240,255,0.3)]">Dalga {entry.wave}</p>
                </div>
                <span className="text-sm font-extrabold text-[#C75B12]">
                  {entry.score.toLocaleString()}
                </span>
              </motion.div>
            ))}

            {leaderboard.length === 0 && (
              <p className="py-8 text-center text-xs text-[rgba(240,240,255,0.3)]">
                Henüz skor yok, ilk skoru sen yap!
              </p>
            )}
          </div>

          <div className="mt-6 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 text-xs text-[rgba(240,240,255,0.4)]">
            <p className="font-semibold text-white">Puanlar</p>
            <p className="mt-1">+10 oynama bonusu</p>
            <p>+skor÷100 ek puan</p>
          </div>
        </div>
      </div>
    </main>
  );
}
