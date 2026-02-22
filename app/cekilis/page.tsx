import type { Metadata } from "next";
import { RafflePublicBoard } from "@/components/raffle/raffle-public-board";

export const metadata: Metadata = {
  title: "Dent Co Future Çekiliş",
  description: "Dent Co Future canlı çekiliş sonuç ekranı."
};

export default function RafflePublicPage() {
  return <RafflePublicBoard />;
}
