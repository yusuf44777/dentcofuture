import { NextRequest, NextResponse } from "next/server";
import {
  createNetworkingInteraction,
  isValidNetworkingInteractionAction,
  isValidUuid
} from "@/lib/networking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/i.test(message)) {
    return "Sunucu Supabase ortam degiskenleri eksik.";
  }

  if (
    /column .* does not exist|Could not find the .* column|schema cache|networking_profiles|networking_profile_actions/i.test(
      message
    )
  ) {
    return "Supabase networking semasi guncel degil. supabase/schema.sql dosyasini calistirin.";
  }

  if (process.env.NODE_ENV === "production") {
    return "Profil aksiyonu kaydedilemedi.";
  }

  return message || "Profil aksiyonu kaydedilemedi.";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const actorProfileId =
      typeof body.actorProfileId === "string" ? body.actorProfileId.trim() : "";
    const targetProfileId =
      typeof body.targetProfileId === "string" ? body.targetProfileId.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!isValidUuid(actorProfileId) || !isValidUuid(targetProfileId)) {
      return NextResponse.json({ error: "Gecersiz profil kimligi." }, { status: 400 });
    }

    if (!isValidNetworkingInteractionAction(action)) {
      return NextResponse.json({ error: "Gecersiz aksiyon." }, { status: 400 });
    }

    const result = await createNetworkingInteraction({
      actorProfileId,
      targetProfileId,
      action
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 });
  }
}
