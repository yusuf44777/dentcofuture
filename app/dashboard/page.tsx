import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { DASHBOARD_AUTH_COOKIE_NAME, isDashboardSessionValid } from "@/lib/auth/dashboard";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (!isDashboardSessionValid(sessionToken)) {
    redirect("/dashboard/login");
  }

  return <LiveDashboard />;
}
