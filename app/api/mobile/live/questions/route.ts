import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text?: string;
};

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const { data, error } = await resolved.session.supabase
    .from("questions")
    .select("id, text, votes, answered, pinned, created_at, attendee_id, attendee:attendees(name, role)")
    .order("pinned", { ascending: false })
    .order("votes", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(60);

  if (error) {
    return NextResponse.json({ error: `Sorular alınamadı: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, questions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Soru göndermek için onboarding tamamlanmalı." }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (text.length < 1 || text.length > 200) {
    return NextResponse.json({ error: "Soru metni 1-200 karakter aralığında olmalı." }, { status: 400 });
  }

  const { data, error } = await resolved.session.supabase
    .from("questions")
    .insert({
      attendee_id: resolved.session.attendee.id,
      text,
      session_id: null
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: `Soru gönderilemedi: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, question: data });
}
