import { NextRequest, NextResponse } from "next/server";
import {
  createNetworkingProfile,
  getNetworkingProfileById,
  isValidUuid,
  normalizeNetworkingProfileInput,
  updateNetworkingProfile
} from "@/lib/networking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";

  if (/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/i.test(message)) {
    return "Sunucu Supabase ortam degiskenleri eksik.";
  }

  if (
    /column .* does not exist|Could not find the .* column|schema cache|networking_profiles/i.test(
      message
    )
  ) {
    return "Supabase networking semasi guncel degil. supabase/schema.sql dosyasini calistirin.";
  }

  if (process.env.NODE_ENV === "production") {
    return fallback;
  }

  return message || fallback;
}

async function parseRequestBody(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!isValidUuid(profileId)) {
      return NextResponse.json({ error: "Gecersiz profil kimligi." }, { status: 400 });
    }

    const profile = await getNetworkingProfileById(profileId);
    if (!profile) {
      return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: profile.id,
      profile
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getSafeErrorMessage(error, "Profil okunamadi.")
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await parseRequestBody(request);
  const { input, errors } = normalizeNetworkingProfileInput(body);

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  try {
    const profile = await createNetworkingProfile(input);

    return NextResponse.json({
      ok: true,
      id: profile.id,
      profile
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getSafeErrorMessage(error, "Profil olusturulamadi.")
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const body = await parseRequestBody(request);
  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";

  if (!isValidUuid(profileId)) {
    return NextResponse.json({ error: "Gecersiz profil kimligi." }, { status: 400 });
  }

  const { input, errors } = normalizeNetworkingProfileInput(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  try {
    const profile = await updateNetworkingProfile(profileId, input);
    if (!profile) {
      return NextResponse.json({ error: "Guncellenecek profil bulunamadi." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: profile.id,
      profile
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getSafeErrorMessage(error, "Profil guncellenemedi.")
      },
      { status: 500 }
    );
  }
}
