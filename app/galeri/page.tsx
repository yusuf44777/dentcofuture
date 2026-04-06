import Image from "next/image";
import { EventGalleryAlbum } from "@/components/gallery/event-gallery-album";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";
import { Badge } from "@/components/ui/badge";

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 px-4 py-6 sm:py-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Image
            src="https://i.imgur.com/Q3ASL2i.png"
            alt="Dent Co Future logosu"
            width={220}
            height={92}
            priority
            className="h-auto w-[154px] object-contain sm:w-[184px]"
          />
          <Badge className="bg-amber-50 text-amber-800">Dent Co Future • Etkinlik Albümü</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Galeri
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Etkinlik boyunca çektiğiniz fotoğraf ve videoları yükleyin. Tüm içerikler tek albümde
              toplanır ve otomatik Google Drive yedeğiyle korunur.
            </p>
          </div>
        </div>

        <AppPageSwitcher />

        <EventGalleryAlbum />
      </section>
    </main>
  );
}
