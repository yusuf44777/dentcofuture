import type { Metadata } from "next";
import { NetworkingIntakeForm } from "@/components/networking/networking-intake-form";

export const metadata: Metadata = {
  title: "Kahve Molası Networking",
  description:
    "COMMUNITIVE DENTISTRY kapsamında katılımcılara benzer mesleki profilleri gerçek zamanlı gösteren networking ekranı."
};

export default function NetworkingPage() {
  return <NetworkingIntakeForm />;
}
