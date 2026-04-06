import { redirect } from "next/navigation";
import { resolveSafeDashboardRedirectPath } from "@/lib/auth/dashboard";

type SpeakerDashboardLoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function SpeakerDashboardLoginPage({
  searchParams
}: SpeakerDashboardLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedNextPath = Array.isArray(resolvedSearchParams.next)
    ? resolvedSearchParams.next[0]
    : resolvedSearchParams.next;
  const safeNextPath = resolveSafeDashboardRedirectPath(requestedNextPath);
  const normalizedNextPath = safeNextPath.startsWith("/konusmacipanel")
    ? "/admin"
    : safeNextPath.startsWith("/admin/login")
      ? "/admin"
      : safeNextPath;

  redirect(`/admin/login?next=${encodeURIComponent(normalizedNextPath)}`);
}
