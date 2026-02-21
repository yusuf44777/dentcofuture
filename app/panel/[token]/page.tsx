import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardPrivateTokenValid,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";

interface PrivateDashboardPageProps {
  params: Promise<{ token: string }>;
}

export default async function PrivateDashboardPage({ params }: PrivateDashboardPageProps) {
  const { token } = await params;

  if (!isDashboardPrivateTokenValid(token)) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (!isDashboardSessionValid(sessionToken)) {
    redirect(`/panel/${token}/login`);
  }

  return <LiveDashboard />;
}
