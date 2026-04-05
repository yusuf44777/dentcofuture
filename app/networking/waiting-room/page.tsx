import type { Metadata } from "next";
import { NetworkingWaitingRoom } from "@/components/networking/networking-waiting-room";

export const metadata: Metadata = {
  title: "Benzer Profiller",
  description:
    "Kahve molasında ilgi alanına göre benzer katılımcı profillerini gerçek zamanlı listeleyen networking ekranı."
};

interface WaitingRoomPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WaitingRoomPage({ searchParams }: WaitingRoomPageProps) {
  const params = await searchParams;
  const profileId = typeof params.id === "string" ? params.id : "";

  return <NetworkingWaitingRoom profileId={profileId} />;
}
