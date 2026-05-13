import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RaffleAdminConsole } from "@/components/raffle/raffle-admin-console";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";

export default async function AdminRafflePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (!isDashboardSessionValid(sessionToken)) {
    redirect("/admin/login?next=/admin/cekilis");
  }

  return <RaffleAdminConsole dashboardPath="/admin" presentationPath="/cekilis" />;
}
