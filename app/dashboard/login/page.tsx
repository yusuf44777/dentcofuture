import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardLoginForm } from "@/components/dashboard/dashboard-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DASHBOARD_AUTH_COOKIE_NAME, isDashboardSessionValid } from "@/lib/auth/dashboard";

export default async function DashboardLoginPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (isDashboardSessionValid(sessionToken)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-10">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="https://i.imgur.com/Q3ASL2i.png"
            alt="Dent Co Future logosu"
            width={220}
            height={92}
            priority
            className="h-auto w-[180px] sm:w-[220px]"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Erişimi</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Bu alan sadece yetkili ekip erişimine açıktır.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Yetkili Girişi</CardTitle>
            <CardDescription>Devam etmek için kullanıcı adı ve şifrenizi girin.</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardLoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
