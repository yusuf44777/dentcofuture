import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardPrivateTokenValid,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";

interface PrivateRafflePageProps {
  params: Promise<{ token: string }>;
}

export default async function PrivateRafflePage({ params }: PrivateRafflePageProps) {
  const { token } = await params;

  if (!isDashboardPrivateTokenValid(token)) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (!isDashboardSessionValid(sessionToken)) {
    redirect("/konusmacipanel/login");
  }

  redirect("/cekilispanel");
}
