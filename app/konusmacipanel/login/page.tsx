import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardLoginForm } from "@/components/dashboard/dashboard-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";

export default async function SpeakerDashboardLoginPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (isDashboardSessionValid(sessionToken)) {
    redirect("/konusmacipanel");
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:py-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6">
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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Konuşmacı Paneli
            </h1>
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
            <DashboardLoginForm redirectPath="/konusmacipanel" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
