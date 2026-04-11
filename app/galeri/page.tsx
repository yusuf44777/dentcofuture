import { EventGalleryAlbum } from "@/components/gallery/event-gallery-album";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#060918] text-white px-4 py-8 sm:py-10">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-[rgba(30,20,120,0.25)] blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-[300px] w-[400px] rounded-full bg-[rgba(100,50,200,0.1)] blur-[80px]" />
      </div>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(123,110,255,0.2)] bg-[rgba(123,110,255,0.08)] px-4 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[rgba(180,170,255,0.7)]">
              DentCo Outliers &nbsp;·&nbsp; Etkinlik Albümü
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="font-display italic text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-gradient-poster">Out</span><span className="not-italic font-heading font-extrabold text-white">liers</span>
            </h1>
            <p className="text-sm leading-relaxed text-[rgba(200,195,255,0.4)] max-w-lg mx-auto">
              Etkinlik boyunca çektiğiniz fotoğraf ve videoları yükleyin.
              Tüm içerikler tek albümde toplanır ve Google Drive&apos;a otomatik yedeklenir.
            </p>
          </div>
        </div>

        <AppPageSwitcher />

        <EventGalleryAlbum />
      </section>
    </main>
  );
}
