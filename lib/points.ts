import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StampType } from "@/lib/types";

export const POINTS = {
  JOIN_PROFILE: 50,
  QUIZ_COMPLETE: 30,
  ASK_QUESTION: 20,
  QUESTION_UPVOTED: 5,
  POLL_VOTE: 10,
  REACTIONS_PER_10: 5,
  ACCEPT_MATCH: 25,
  SEND_MESSAGE: 5,
  GAME_PLAY: 10,
  ALL_SESSIONS: 50
} as const;

export async function awardPoints(attendeeId: string, pts: number) {
  const sb = createSupabaseBrowserClient();
  await sb.rpc("increment_points" as never, { p_id: attendeeId, p_pts: pts } as never);
}

export async function awardStamp(attendeeId: string, type: StampType, pts: number) {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("stamps")
    .insert({ attendee_id: attendeeId, type })
    .select()
    .single();

  if (!error) {
    await sb
      .from("attendees")
      .update({ points: pts } as never)
      .eq("id", attendeeId)
      .select()
      .single();
  }
}

export async function addPoints(attendeeId: string, pts: number) {
  const sb = createSupabaseBrowserClient();
  const { data } = await sb
    .from("attendees")
    .select("points")
    .eq("id", attendeeId)
    .single();

  if (data) {
    await sb
      .from("attendees")
      .update({ points: (data.points ?? 0) + pts } as never)
      .eq("id", attendeeId);
  }
}
