import Image from "next/image";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackForm } from "@/components/submit/feedback-form";

export default function SubmitPage() {
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
          <Badge className="bg-cyan-50 text-cyan-800">Dent Co Future • Canlı Geri Bildirim</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Dent Co Future
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Görüşlerinizi bizimle paylaşın. Yorumlarınız anonim şekilde analiz edilerek canlı ekranda
              kongre akışına katkı sağlar.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              COMMUNITIVE DENTISTRY
            </p>
          </div>
        </div>

        <AppPageSwitcher />

        <Card>
          <CardHeader>
            <CardTitle>Canlı Geri Bildirim</CardTitle>
            <CardDescription>
              Dilerseniz serbest yorum bırakın, dilerseniz çoktan seçmeli anket sorusunu yanıtlayın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
