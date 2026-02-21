import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NetworkingProfileRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchRequestBody = {
  profileId?: string;
};

type PublicProfile = Pick<
  NetworkingProfileRow,
  "id" | "full_name" | "interest_area" | "goal" | "contact_info" | "created_at"
>;

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getProfileById(profileId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("networking_profiles")
    .select("id, full_name, interest_area, goal, contact_info, created_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profil okunamadı: ${error.message}`);
  }

  return data as PublicProfile | null;
}

async function getSimilarProfiles(currentProfile: PublicProfile) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("networking_profiles")
    .select("id, full_name, interest_area, goal, contact_info, created_at")
    .eq("interest_area", currentProfile.interest_area)
    .neq("id", currentProfile.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(`Benzer profiller okunamadı: ${error.message}`);
  }

  const profiles = (data ?? []) as PublicProfile[];
  const prioritized = profiles.sort((a, b) => {
    const goalScoreA = a.goal === currentProfile.goal ? 1 : 0;
    const goalScoreB = b.goal === currentProfile.goal ? 1 : 0;
    if (goalScoreA !== goalScoreB) {
      return goalScoreB - goalScoreA;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return prioritized.slice(0, 8);
}

export async function POST(request: NextRequest) {
  try {
    let body: MatchRequestBody = {};

    try {
      body = (await request.json()) as MatchRequestBody;
    } catch {
      body = {};
    }

    const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId || !isValidUuid(profileId)) {
      return NextResponse.json({ error: "Geçersiz profil kimliği." }, { status: 400 });
    }

    const currentProfile = await getProfileById(profileId);

    if (!currentProfile) {
      return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
    }

    const similarProfiles = await getSimilarProfiles(currentProfile);

    return NextResponse.json({
      status: similarProfiles.length > 0 ? "found" : "waiting",
      currentProfile,
      similarProfiles,
      message:
        similarProfiles.length > 0
          ? `${similarProfiles.length} benzer profil listelendi.`
          : "Henüz benzer profil bulunamadı. Yeni katılımcılar geldikçe liste güncellenecek."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Profil servisi hatası."
            : error instanceof Error
              ? error.message
              : "Profil servisi hatası."
      },
      { status: 500 }
    );
  }
}
