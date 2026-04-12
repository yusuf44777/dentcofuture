import { NextRequest, NextResponse } from "next/server";
import type { MobileMatchThread } from "@/lib/mobile/contracts";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { isValidUuid, normalizeText, readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  receiverAttendeeId?: string;
  text?: string;
};

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendeeId = resolved.session.attendee?.id;
  if (!attendeeId) {
    return NextResponse.json({ error: "Mesajlaşma için onboarding tamamlanmalı." }, { status: 400 });
  }

  const counterpartId = request.nextUrl.searchParams.get("attendeeId")?.trim() ?? "";

  if (!counterpartId) {
    const [matchesResult, messagesResult] = await Promise.all([
      resolved.session.supabase
        .from("matches")
        .select("attendee_a, attendee_b, created_at")
        .or(`attendee_a.eq.${attendeeId},attendee_b.eq.${attendeeId}`)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(100),
      resolved.session.supabase
        .from("messages")
        .select("id, sender_id, receiver_id, text, created_at")
        .or(`sender_id.eq.${attendeeId},receiver_id.eq.${attendeeId}`)
        .order("created_at", { ascending: false })
        .limit(300)
    ]);

    if (matchesResult.error) {
      return NextResponse.json({ error: `Eşleşmeler alınamadı: ${matchesResult.error.message}` }, { status: 500 });
    }

    if (messagesResult.error) {
      return NextResponse.json({ error: `Mesajlar alınamadı: ${messagesResult.error.message}` }, { status: 500 });
    }

    const counterpartIdsFromMatches = (matchesResult.data ?? []).map((match) =>
      match.attendee_a === attendeeId ? match.attendee_b : match.attendee_a
    );

    const latestByCounterpart = new Map<string, { id: string; text: string; createdAt: string; senderId: string }>();
    for (const message of messagesResult.data ?? []) {
      const counterpart = message.sender_id === attendeeId ? message.receiver_id : message.sender_id;
      if (!counterpart || latestByCounterpart.has(counterpart)) {
        continue;
      }

      latestByCounterpart.set(counterpart, {
        id: message.id,
        text: message.text,
        createdAt: message.created_at,
        senderId: message.sender_id
      });
    }

    const counterpartIds = Array.from(
      new Set([...latestByCounterpart.keys(), ...counterpartIdsFromMatches])
    ).slice(0, 120);

    const attendeesResult =
      counterpartIds.length > 0
        ? await resolved.session.supabase
            .from("attendees")
            .select("id, name, role, instagram, linkedin")
            .in("id", counterpartIds)
        : { data: [], error: null };

    if (attendeesResult.error) {
      return NextResponse.json({ error: `Katılımcılar alınamadı: ${attendeesResult.error.message}` }, { status: 500 });
    }

    const attendeeById = new Map(
      (attendeesResult.data ?? []).map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          role: item.role,
          instagram: item.instagram,
          linkedin: item.linkedin
        }
      ])
    );

    return NextResponse.json({
      ok: true,
      threads: counterpartIds.map((id) => ({
        attendee: attendeeById.get(id) ?? null,
        lastMessage: latestByCounterpart.get(id) ?? null
      }))
    });
  }

  if (!isValidUuid(counterpartId) || counterpartId === attendeeId) {
    return NextResponse.json({ error: "Geçersiz karşı taraf kimliği." }, { status: 400 });
  }

  const [counterpartResult, messagesResult] = await Promise.all([
    resolved.session.supabase
      .from("attendees")
      .select("id, name, role, instagram, linkedin")
      .eq("id", counterpartId)
      .maybeSingle(),
    resolved.session.supabase
      .from("messages")
      .select("id, sender_id, receiver_id, text, created_at")
      .or(`and(sender_id.eq.${attendeeId},receiver_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},receiver_id.eq.${attendeeId})`)
      .order("created_at", { ascending: true })
      .limit(400)
  ]);

  if (counterpartResult.error) {
    return NextResponse.json({ error: `Katılımcı bilgisi alınamadı: ${counterpartResult.error.message}` }, { status: 500 });
  }

  if (messagesResult.error) {
    return NextResponse.json({ error: `Mesaj geçmişi alınamadı: ${messagesResult.error.message}` }, { status: 500 });
  }

  if (!counterpartResult.data) {
    return NextResponse.json({ error: "Karşı taraf bulunamadı." }, { status: 404 });
  }

  const payload: MobileMatchThread = {
    otherAttendee: {
      id: counterpartResult.data.id,
      name: counterpartResult.data.name,
      role: counterpartResult.data.role,
      instagram: counterpartResult.data.instagram,
      linkedin: counterpartResult.data.linkedin
    },
    messages: (messagesResult.data ?? []).map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      receiverId: message.receiver_id,
      text: message.text,
      createdAt: message.created_at
    }))
  };

  return NextResponse.json({ ok: true, thread: payload });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendeeId = resolved.session.attendee?.id;
  if (!attendeeId) {
    return NextResponse.json({ error: "Mesajlaşma için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const receiverAttendeeId = typeof body.receiverAttendeeId === "string" ? body.receiverAttendeeId.trim() : "";
  const text = normalizeText(body.text);

  if (!isValidUuid(receiverAttendeeId) || receiverAttendeeId === attendeeId) {
    return NextResponse.json({ error: "Geçersiz alıcı kimliği." }, { status: 400 });
  }

  if (!text || text.length > 500) {
    return NextResponse.json({ error: "Mesaj 1-500 karakter aralığında olmalı." }, { status: 400 });
  }

  const insertResult = await resolved.session.supabase
    .from("messages")
    .insert({
      sender_id: attendeeId,
      receiver_id: receiverAttendeeId,
      text
    })
    .select("id, sender_id, receiver_id, text, created_at")
    .single();

  if (insertResult.error) {
    return NextResponse.json({ error: `Mesaj gönderilemedi: ${insertResult.error.message}` }, { status: 500 });
  }

  const nextPoints = (resolved.session.attendee?.points ?? 0) + 5;
  await resolved.session.supabase
    .from("attendees")
    .update({ points: nextPoints })
    .eq("id", attendeeId);

  return NextResponse.json({
    ok: true,
    message: {
      id: insertResult.data.id,
      senderId: insertResult.data.sender_id,
      receiverId: insertResult.data.receiver_id,
      text: insertResult.data.text,
      createdAt: insertResult.data.created_at
    }
  });
}
