import { NextRequest, NextResponse } from "next/server";
import { createPollMessage } from "@/lib/engagement";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { normalizeText, readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  message?: string;
  pollOption?: string;
  pollId?: string;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<Body>(request);
  const textMessage = normalizeText(body.message);
  const pollOption = normalizeText(body.pollOption);
  const pollId = normalizeText(body.pollId);

  const finalMessage = textMessage || (pollOption ? createPollMessage(pollOption, pollId || null) : "");

  if (!finalMessage || finalMessage.length > 500) {
    return NextResponse.json({ error: "Mesaj 1-500 karakter aralığında olmalı." }, { status: 400 });
  }

  const { data, error } = await resolved.session.supabase
    .from("attendee_feedbacks")
    .insert({ message: finalMessage })
    .select("id, message, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: `Geri bildirim kaydedilemedi: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data });
}
