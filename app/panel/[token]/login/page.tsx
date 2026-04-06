import Image from "next/image";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DashboardLoginForm } from "@/components/dashboard/dashboard-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardPrivateTokenValid,
  resolveSafeDashboardRedirectPath,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";

interface PrivateDashboardLoginPageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ next?: string | string[] }>;
}

export default async function PrivateDashboardLoginPage({
  params,
  searchParams
}: PrivateDashboardLoginPageProps) {
  const { token } = await params;

  if (!isDashboardPrivateTokenValid(token)) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedNextPath = Array.isArray(resolvedSearchParams.next)
    ? resolvedSearchParams.next[0]
    : resolvedSearchParams.next;
  const nextPath = resolveSafeDashboardRedirectPath(requestedNextPath);

  if (isDashboardSessionValid(sessionToken)) {
    redirect(nextPath);
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-slate-100 via-white to-slate-100 px-4 py-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-center gap-6 sm:gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Image
            src="https://i.imgur.com/Q3ASL2i.png"
            alt="Dent Co Future logosu"
            width={220}
            height={92}
            priority
            className="h-auto w-[154px] object-contain sm:w-[184px]"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Panel Erişimi</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Bu alan sadece yetkili ekip erişimine açıktır.
            </p>
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <CardHeader>
            <CardTitle className="text-slate-900">Yetkili Girişi</CardTitle>
            <CardDescription className="text-slate-600">
              Devam etmek için giriş bilgilerinizi girin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardLoginForm redirectPath={nextPath} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
