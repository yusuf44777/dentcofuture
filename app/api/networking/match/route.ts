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

async function getDirectoryProfiles(currentProfile: PublicProfile) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("networking_profiles")
    .select("id, full_name, interest_area, goal, contact_info, created_at")
    .neq("id", currentProfile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Katılımcı profilleri okunamadı: ${error.message}`);
  }

  const profiles = (data ?? []) as PublicProfile[];
  const recommendedProfiles = profiles
    .filter((profile) => profile.interest_area === currentProfile.interest_area)
    .sort((a, b) => {
      const goalScoreA = a.goal === currentProfile.goal ? 1 : 0;
      const goalScoreB = b.goal === currentProfile.goal ? 1 : 0;
      if (goalScoreA !== goalScoreB) {
        return goalScoreB - goalScoreA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 8);

  const recommendedIds = new Set(recommendedProfiles.map((profile) => profile.id));
  const otherProfiles = profiles
    .filter((profile) => !recommendedIds.has(profile.id))
    .sort((a, b) => {
      const goalScoreA = a.goal === currentProfile.goal ? 1 : 0;
      const goalScoreB = b.goal === currentProfile.goal ? 1 : 0;
      if (goalScoreA !== goalScoreB) {
        return goalScoreB - goalScoreA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return {
    recommendedProfiles,
    otherProfiles
  };
}

function buildDirectoryMessage(recommendedCount: number, otherCount: number) {
  if (recommendedCount === 0 && otherCount === 0) {
    return "Henüz başka katılımcı bulunamadı. Yeni katılımcılar geldikçe liste güncellenecek.";
  }

  if (recommendedCount > 0 && otherCount > 0) {
    return `${recommendedCount} önerilen profil ve ${otherCount} diğer katılımcı listelendi.`;
  }

  if (recommendedCount > 0) {
    return `${recommendedCount} önerilen profil listelendi.`;
  }

  return `Şu an eşleşme önerisi yok, ${otherCount} farklı katılımcı listelendi.`;
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

    const { recommendedProfiles, otherProfiles } = await getDirectoryProfiles(currentProfile);
    const totalCount = recommendedProfiles.length + otherProfiles.length;

    return NextResponse.json({
      status: totalCount > 0 ? "found" : "waiting",
      currentProfile,
      recommendedProfiles,
      otherProfiles,
      message: buildDirectoryMessage(recommendedProfiles.length, otherProfiles.length)
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
