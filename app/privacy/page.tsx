import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Database,
  Eye,
  FileText,
  LockKeyhole,
  Mail,
  Server,
  ShieldCheck,
  UserCheck
} from "lucide-react";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — DentCo Outlier",
  description: "DentCo Outlier web sitesi ve mobil uygulaması için detaylı gizlilik politikası."
};

const lastUpdated = "29 Nisan 2026";

const dataCategories = [
  {
    title: "Kimlik ve iletişim bilgileri",
    text: "Ad soyad, e-posta adresi, telefon numarası, katılımcı rolü ve etkinlik kaydıyla ilişkili doğrulama bilgileri."
  },
  {
    title: "Profil ve networking bilgileri",
    text: "Üniversite, sınıf, tercih etmeyi düşündüğünüz uzmanlık alanı, Instagram ve LinkedIn bağlantıları gibi profilinizde görünmesini seçtiğiniz bilgiler."
  },
  {
    title: "Etkinlik etkileşimleri",
    text: "Program görüntüleme, canlı soru-cevap, anket yanıtları, geri bildirimler, puanlar, çekiliş katılımı, Blockerino skorları ve etkinlik içi aksiyonlar."
  },
  {
    title: "Galeri ve kullanıcı içerikleri",
    text: "Etkinlik galerisine yüklenen görseller, açıklamalar, beğeniler, yorumlar ve içerikle ilişkili moderasyon kayıtları."
  },
  {
    title: "Teknik ve güvenlik verileri",
    text: "Cihaz ve tarayıcı türü, IP adresi, oturum bilgileri, hata kayıtları, güvenlik logları, localStorage/cookie benzeri teknik saklama verileri."
  }
];

const purposes = [
  "Etkinlik katılımcılarını doğrulamak ve uygulama erişimini sağlamak.",
  "Kongre programını, konuşmacı bilgilerini, canlı etkinlik özelliklerini ve duyuruları göstermek.",
  "Katılımcı profillerinin görüntülenmesini ve etkinlik içi networking deneyimini sağlamak.",
  "Galeri, puan sistemi, çekiliş ve oyun skorları gibi etkinlik deneyimi özelliklerini çalıştırmak.",
  "Geri bildirimleri analiz ederek etkinlik kalitesini artırmak ve toplu/istatistiksel raporlar oluşturmak.",
  "Güvenliği sağlamak, kötüye kullanımı önlemek, teknik sorunları gidermek ve yasal yükümlülüklere uyum sağlamak."
];

const processors = [
  {
    name: "Supabase",
    detail: "Veritabanı, kimlik doğrulama ve dosya saklama altyapısı."
  },
  {
    name: "Vercel",
    detail: "Web sitesi ve API servislerinin barındırılması."
  },
  {
    name: "Expo, Apple ve Google",
    detail: "Mobil uygulama derleme, dağıtım ve mağaza süreçleri."
  },
  {
    name: "Google Drive",
    detail: "Etkinlik galerisi dosya yedekleme veya paylaşım altyapısı kullanıldığında."
  },
  {
    name: "OpenAI",
    detail: "Yalnızca etkinlik geri bildirimlerinin analiz edilmesi ve toplu içgörü üretilmesi için."
  },
  {
    name: "Luma",
    detail: "Etkinlik kayıt işlemi Luma üzerinden tamamlandığında Luma'nın kendi gizlilik şartları geçerlidir."
  }
];

const rights = [
  "Hangi kişisel verilerinizin işlendiğini öğrenme.",
  "Eksik veya yanlış verilerin düzeltilmesini isteme.",
  "Uygun durumlarda verilerinizin silinmesini veya anonim hale getirilmesini talep etme.",
  "İşleme faaliyetlerine itiraz etme veya verdiğiniz rızayı geri çekme.",
  "Talebinizin sonucuyla ilgili bilgi alma."
];

function Section({
  icon,
  eyebrow,
  title,
  children
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[rgba(123,110,255,0.14)] py-12">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div>
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[rgba(0,229,160,0.22)] bg-[rgba(0,229,160,0.08)] text-[#00E5A0]">
            {icon}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(0,229,160,0.68)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-white">
            {title}
          </h2>
        </div>
        <div className="text-sm leading-7 text-[rgba(232,232,255,0.68)] sm:text-base">
          {children}
        </div>
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#060918] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[rgba(123,110,255,0.18)] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[rgba(0,229,160,0.08)] blur-[100px]" />
        <div className="absolute inset-0 grid-bg opacity-20" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(123,110,255,0.18)] bg-[rgba(12,16,48,0.55)] px-4 py-2 text-sm font-semibold text-[rgba(232,232,255,0.7)] transition-colors hover:border-[rgba(123,110,255,0.45)] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Ana sayfaya dön
        </Link>

        <header className="py-16 sm:py-20">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.42em] text-[#00E5A0]">
            DentCo Outlier
          </p>
          <h1 className="max-w-4xl font-display text-4xl font-black leading-tight sm:text-6xl">
            Gizlilik <span className="font-heading text-gradient-mint">Politikası</span>
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[rgba(232,232,255,0.62)] sm:text-lg">
            Bu politika, DentCo Outlier web sitesi ve mobil uygulaması üzerinden hangi verileri
            topladığımızı, bunları hangi amaçlarla kullandığımızı, kimlerle paylaşabileceğimizi ve
            katılımcıların gizlilik haklarını açıklar.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-[rgba(232,232,255,0.58)] sm:grid-cols-3">
            <div className="rounded-[8px] border border-[rgba(123,110,255,0.14)] bg-[rgba(12,16,48,0.45)] p-4">
              <p className="font-semibold text-white">Son güncelleme</p>
              <p className="mt-1">{lastUpdated}</p>
            </div>
            <div className="rounded-[8px] border border-[rgba(123,110,255,0.14)] bg-[rgba(12,16,48,0.45)] p-4">
              <p className="font-semibold text-white">Kapsam</p>
              <p className="mt-1">Web sitesi, mobil uygulama ve etkinlik servisleri</p>
            </div>
            <div className="rounded-[8px] border border-[rgba(123,110,255,0.14)] bg-[rgba(12,16,48,0.45)] p-4">
              <p className="font-semibold text-white">İletişim</p>
              <p className="mt-1">mahiryusufacan@hotmail.com</p>
            </div>
          </div>
        </header>

        <Section icon={<ShieldCheck className="h-5 w-5" />} eyebrow="Özet" title="Temel yaklaşımımız">
          <p>
            DentCo Outlier, Communitive Dentistry etkinlik deneyimini dijital olarak desteklemek için
            geliştirilmiştir. Verileri yalnızca etkinlik erişimi, program takibi, katılımcı profilleri,
            galeri, puan sistemi, çekiliş, canlı etkileşimler ve teknik güvenlik gibi açık amaçlar için
            işleriz. Kişisel verileri satmayız ve üçüncü taraflara reklam amacıyla aktarmayız.
          </p>
          <p className="mt-4">
            Uygulama çocuklara özel olarak tasarlanmamıştır. Katılımcıların paylaştığı profil ve galeri
            içerikleri diğer etkinlik katılımcıları veya yetkili ekipler tarafından görüntülenebilir.
          </p>
        </Section>

        <Section icon={<Database className="h-5 w-5" />} eyebrow="Veriler" title="Topladığımız bilgiler">
          <div className="grid gap-3 sm:grid-cols-2">
            {dataCategories.map((item) => (
              <div
                key={item.title}
                className="rounded-[8px] border border-[rgba(123,110,255,0.14)] bg-[rgba(12,16,48,0.44)] p-4"
              >
                <h3 className="font-heading text-base font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[rgba(232,232,255,0.6)]">{item.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<FileText className="h-5 w-5" />} eyebrow="Amaçlar" title="Verileri neden kullanıyoruz?">
          <ul className="space-y-3">
            {purposes.map((purpose) => (
              <li key={purpose} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00E5A0]" />
                <span>{purpose}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<Eye className="h-5 w-5" />} eyebrow="Görünürlük" title="Katılımcı profilleri ve galeri">
          <p>
            Profilinizde yer alan ad, üniversite, sınıf, tercih etmeyi düşündüğünüz uzmanlık alanı,
            Instagram ve LinkedIn bağlantıları gibi bilgiler, uygulamadaki profil keşfi alanında diğer
            katılımcılara gösterilebilir. Sohbet özelliği uygulamadan kaldırılmıştır; kullanıcılar uygulama
            içinden birbirlerine doğrudan mesaj gönderemez.
          </p>
          <p className="mt-4">
            Galeriye yüklenen görseller, etkinlik deneyiminin parçası olarak görüntülenebilir. Uygunsuz,
            yetkisiz veya etkinlik bağlamıyla ilgisiz içerikler kaldırılabilir. Gerekli görüldüğünde
            moderasyon ve güvenlik kayıtları tutulabilir.
          </p>
        </Section>

        <Section icon={<Server className="h-5 w-5" />} eyebrow="Servisler" title="Veri işleyen altyapılar">
          <p>
            Uygulamayı çalıştırmak için güvenilir altyapı sağlayıcıları kullanırız. Bu sağlayıcılar
            verileri yalnızca hizmet sunmak, güvenlik sağlamak, depolama yapmak veya teknik operasyonları
            yürütmek için işler.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {processors.map((processor) => (
              <div key={processor.name} className="rounded-[8px] border border-[rgba(123,110,255,0.12)] p-4">
                <h3 className="font-heading text-base font-bold text-white">{processor.name}</h3>
                <p className="mt-1 text-sm leading-6 text-[rgba(232,232,255,0.58)]">{processor.detail}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<LockKeyhole className="h-5 w-5" />} eyebrow="Güvenlik" title="Saklama, koruma ve aktarım">
          <p>
            Veriler HTTPS üzerinden iletilir ve erişim yetkileri rol bazlı olarak sınırlandırılır. Mobil
            oturum bilgileri güvenli saklama mekanizmalarıyla korunur. Yönetim panelleri ve API uçları,
            yetkisiz erişimi azaltmak için oturum, rol ve gizli anahtar kontrolleriyle korunur.
          </p>
          <p className="mt-4">
            Kişisel veriler, etkinlik operasyonu ve yasal/teknik gereklilikler için gerekli süre boyunca
            saklanır. Etkinlik tamamlandıktan sonra operasyonel ihtiyaç kalmayan veriler silinebilir,
            anonimleştirilebilir veya yalnızca toplu istatistik olarak tutulabilir.
          </p>
        </Section>

        <Section icon={<UserCheck className="h-5 w-5" />} eyebrow="Haklar" title="Katılımcı hakları">
          <p>
            KVKK ve uygulanabilir veri koruma ilkeleri kapsamında aşağıdaki talepler için bizimle iletişime
            geçebilirsiniz:
          </p>
          <ul className="mt-4 space-y-3">
            {rights.map((right) => (
              <li key={right} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7B6EFF]" />
                <span>{right}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<Mail className="h-5 w-5" />} eyebrow="İletişim" title="Sorular ve talepler">
          <p>
            Gizlilik politikası, veri talepleri veya uygulama içeriğiyle ilgili sorularınız için aşağıdaki
            e-posta adresinden iletişime geçebilirsiniz.
          </p>
          <a
            href="mailto:mahiryusufacan@hotmail.com"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[rgba(0,229,160,0.28)] bg-[rgba(0,229,160,0.08)] px-5 py-3 text-sm font-bold text-[#9CFFE0] transition-colors hover:border-[rgba(0,229,160,0.55)] hover:text-white"
          >
            <Mail className="h-4 w-4" />
            mahiryusufacan@hotmail.com
          </a>
          <p className="mt-5 text-sm text-[rgba(232,232,255,0.46)]">
            Bu politika zaman zaman güncellenebilir. Güncel sürüm her zaman bu sayfada yayınlanır.
          </p>
        </Section>
      </div>
    </main>
  );
}
