import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const session = resolved.session;
  const supabase = session.supabase;

  const leaderboardResult = await supabase
    .from("attendees")
    .select("id, name, role, points")
    .order("points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);

  if (leaderboardResult.error) {
    return NextResponse.json({ error: `Liderlik alınamadı: ${leaderboardResult.error.message}` }, { status: 500 });
  }

  let me: { attendeeId: string; points: number; rank: number } | null = null;
  if (session.attendee?.id) {
    const myPoints = session.attendee.points ?? 0;
    const rankResult = await supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .gt("points", myPoints);

    if (rankResult.error) {
      return NextResponse.json({ error: `Kullanıcı sıralaması alınamadı: ${rankResult.error.message}` }, { status: 500 });
    }

    me = {
      attendeeId: session.attendee.id,
      points: myPoints,
      rank: (rankResult.count ?? 0) + 1
    };
  }

  return NextResponse.json({
    ok: true,
    leaderboard: leaderboardResult.data ?? [],
    me
  });
}
