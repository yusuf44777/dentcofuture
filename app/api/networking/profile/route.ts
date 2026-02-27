import { NextRequest, NextResponse } from "next/server";
import { buildContactInfo } from "@/lib/networking-contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateProfileRequestBody = {
  profileId?: unknown;
  fullName?: unknown;
  interestArea?: unknown;
  goal?: unknown;
  instagram?: unknown;
  linkedin?: unknown;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getSafeErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Profil güncellenemedi.";
  }
  return error instanceof Error ? error.message : "Profil güncellenemedi.";
}

export async function PUT(request: NextRequest) {
  let body: UpdateProfileRequestBody = {};

  try {
    body = (await request.json()) as UpdateProfileRequestBody;
  } catch {
    body = {};
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const fullName = typeof body.fullName === "string" ? normalizeText(body.fullName) : "";
  const interestArea = typeof body.interestArea === "string" ? normalizeText(body.interestArea) : "";
  const goal = typeof body.goal === "string" ? normalizeText(body.goal) : "";
  const instagram = typeof body.instagram === "string" ? body.instagram : "";
  const linkedin = typeof body.linkedin === "string" ? body.linkedin : "";

  if (!isValidUuid(profileId)) {
    return NextResponse.json({ error: "Geçersiz profil kimliği." }, { status: 400 });
  }

  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Ad soyad alanı geçersiz." }, { status: 400 });
  }

  if (!interestArea || interestArea.length > 120) {
    return NextResponse.json({ error: "İlgi alanı alanı geçersiz." }, { status: 400 });
  }

  if (!goal || goal.length > 120) {
    return NextResponse.json({ error: "Kariyer yönü alanı geçersiz." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("networking_profiles")
      .update({
        full_name: fullName,
        interest_area: interestArea,
        goal,
        contact_info: buildContactInfo(instagram, linkedin)
      })
      .eq("id", profileId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.id) {
      return NextResponse.json({ error: "Güncellenecek profil bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: data.id
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getSafeErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
