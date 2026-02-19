import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-2xl rounded-3xl border border-cyan-100 bg-white/80 p-8 shadow-xl shadow-cyan-950/10 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
          Communitive Dentistry İstanbul
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          Dent Co Future Canlı Etkileşim Platformu
        </h1>
        <p className="mt-3 text-slate-600">
          Katılımcılar mobil cihazdan yorum gönderebilir; büyük ekrandaki panel ise canlı analizleri,
          eğilimleri ve duygu dağılımını gösterir.
        </p>
        <p className="mt-1 text-sm font-medium text-cyan-800">
          28 Şubat 2026 • Nâzım Hikmet Kültür Merkezi, Kadıköy
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/submit"
            className="rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white transition hover:bg-cyan-500"
          >
            Mobil Gönderim Ekranını Aç
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-800 transition hover:bg-slate-50"
          >
            Panoyu Aç
          </Link>
        </div>
      </section>
    </main>
  );
}
