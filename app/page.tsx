import Image from "next/image";
import { Instagram } from "lucide-react";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-2xl rounded-3xl border border-cyan-100 bg-white/80 p-8 shadow-xl shadow-cyan-950/10 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
          COMMUNITIVE DENTISTRY
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          ✨ Geleceğini Şekillendirmeye Hazır mısın?
        </h1>
        <p className="mt-3 text-slate-600">
          Communitive Dentistry İstanbul olarak Dent Co Future etkinliğiyle sizlerleyiz.
        </p>
        <p className="mt-2 text-slate-600">
          Akademi, klinik ve kamu deneyimini temsil eden 4 hocamızın aynı sahnede yer aldığı,
          interaktif soru-cevap formatında bir panelde buluşuyoruz.
        </p>
        <p className="mt-1 text-sm font-medium text-cyan-800">
          28 Şubat 2026 • Nâzım Hikmet Kültür Merkezi, Kadıköy
        </p>

        <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
          <p className="text-sm font-semibold text-cyan-900">Konuşmacılarımız</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-800">Prof. Hare Gürsoy</p>
              <a
                href="https://www.instagram.com/profdrharegursoy/"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:text-pink-600"
              >
                <Instagram className="h-3.5 w-3.5" />
                @profdrharegursoy
              </a>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-800">Dt. Fatih Güler</p>
              <a
                href="https://www.instagram.com/fatihguler64/"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:text-pink-600"
              >
                <Instagram className="h-3.5 w-3.5" />
                @fatihguler64
              </a>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-800">Dr. Ahmet Kiğılı</p>
              <a
                href="https://www.instagram.com/drahmetkigili/"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:text-pink-600"
              >
                <Instagram className="h-3.5 w-3.5" />
                @drahmetkigili
              </a>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-800">Doç. Dr. Tuğçe Paksoy</p>
              <a
                href="https://www.instagram.com/tugcepaksoy_/"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:text-pink-600"
              >
                <Instagram className="h-3.5 w-3.5" />
                @tugcepaksoy_
              </a>
            </div>
          </div>
        </div>

        <AppPageSwitcher className="mt-8" />

        <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-900">
              Etkinlik Afişi
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Detaylı görseli görmek için afişe dokunun.
            </p>
          </div>
          <a
            href="https://i.imgur.com/B2QKrJw.jpeg"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-xl border border-cyan-100 bg-white p-1.5 transition hover:shadow-md"
          >
            <Image
              src="https://i.imgur.com/B2QKrJw.jpeg"
              alt="Dent Co Future etkinlik afişi"
              width={160}
              height={200}
              className="h-auto w-[88px] rounded-lg object-cover sm:w-[104px]"
            />
          </a>
        </div>
      </section>
    </main>
  );
}
