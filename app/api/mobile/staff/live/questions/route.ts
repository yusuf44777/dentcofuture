import { NextRequest, NextResponse } from "next/server";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";
import { logStaffOperation } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  questionId?: string;
  pinned?: boolean;
  answered?: boolean;
};

export async function GET(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const { data, error } = await resolved.session.supabase
    .from("questions")
    .select("id, text, votes, answered, pinned, created_at, attendee_id, attendee:attendees(name, role)")
    .order("pinned", { ascending: false })
    .order("votes", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(120);

  if (error) {
    return NextResponse.json({ error: `Sorular alınamadı: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, questions: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "live.questions.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<PatchBody>(request);
  const questionId = typeof body.questionId === "string" ? body.questionId.trim() : "";

  if (!isValidUuid(questionId)) {
    return NextResponse.json({ error: "Geçersiz soru kimliği." }, { status: 400 });
  }

  const updates: { pinned?: boolean; answered?: boolean } = {};
  if (typeof body.pinned === "boolean") {
    updates.pinned = body.pinned;
  }

  if (typeof body.answered === "boolean") {
    updates.answered = body.answered;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncelleme alanı bulunamadı." }, { status: 400 });
  }

  try {
    const { data, error } = await resolved.session.supabase
      .from("questions")
      .update(updates)
      .eq("id", questionId)
      .select("id, text, votes, answered, pinned, created_at, attendee_id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.live.questions.update",
      targetType: "question",
      targetId: questionId,
      success: true,
      details: updates
    });

    return NextResponse.json({ ok: true, question: data });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.live.questions.update",
      targetType: "question",
      targetId: questionId,
      success: false,
      details: {
        updates,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Soru güncellenemedi." },
      { status: 500 }
    );
  }
}
