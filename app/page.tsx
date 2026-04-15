"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Zap, Users, Gamepad2, Images } from "lucide-react";
import Image from "next/image";
import Script from "next/script";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Config ────────────────────────────────────────────────────────────────
const EVENT_DATE = new Date("2026-05-16T09:00:00+03:00");
const EVENT_ORGANIZER = "Communitive Dentistry Üsküdar";
const EVENT_ADDRESS = "Ümraniye Birikim Okulları: Yamanevler, Site Yolu Cd No:22, 34768 Ümraniye/İstanbul";
const ANDROID_APP_URL = "https://play.google.com/store/apps";
const IOS_APP_URL = "https://apps.apple.com";
const LUMA_EVENT_ID = "evt-suwIs4rhpB5Yd1Q";
const LUMA_EVENT_URL = `https://luma.com/event/${LUMA_EVENT_ID}`;

type SpeakerBadge = "Innovator" | "Artist" | "Entrepreneur" | "AI Pioneer";

type SpeakerItem = {
  name: string;
  title: string;
  badge: SpeakerBadge;
  bio: string;
  imageSrc?: string;
  posterHref?: string;
  posterButtonLabel?: string;
};

const SPEAKERS: SpeakerItem[] = [
  {
    name: "Dt. Kerem İnan",
    title: "Dt. Kerem İnan",
    badge: "Innovator",
    bio: "Alışılmış kariyer yollarını bir kenara bırakıp Kenya'nın en ücra köşelerinde şifa dağıtan, gönüllülük bilinciyle \"Sınır Ötesi Hekimlik\" yapan bir diş hekimi.",
    imageSrc: "/kerem_inan.jpeg",
    posterHref: "/kerem_inan_afis.png",
    posterButtonLabel: "Afişi Aç"
  },
  {
    name: "Doç. Dr. Gaye Keser",
    title: "Doç. Dr. Gaye Keser",
    badge: "AI Pioneer",
    bio: "Marmara Üniversitesi Diş Hekimliği Fakültesi Ağız, Diş ve Çene Radyolojisi Anabilim Dalı'nda değerli çalışmalar yürüten hocamız; özellikle yapay zekâ, derin öğrenme uygulamaları ve oral kanserler üzerine yaptığı çığır açan araştırmalarla tanınıyor.",
    imageSrc: "/gaye_keser.png",
    posterHref: "/gaye_keser_afis.png",
    posterButtonLabel: "Afişi Aç"
  },
  {
    name: "Dr. Sina Saygılı",
    title: "Dr. Sina Saygılı",
    badge: "Innovator",
    bio: "Dijital diş hekimliği ve 3D teknolojilerindeki uzmanlığını global liderlik tecrübesiyle birleştiren Dr. Sina Saygılı, akademik birikimiyle geleceğin diş hekimliği vizyonunu bizlere sunuyor.",
    imageSrc: "/sina_saygin.jpeg",
    posterHref: "/sina_saygin_afis.png",
    posterButtonLabel: "Afişi Aç"
  },
  {
    name: "Slot #3",
    title: "Sürpriz İsim",
    badge: "Artist",
    bio: "Üçüncü sürpriz konuşmacı için geri sayım başladı."
  },
  {
    name: "Slot #4",
    title: "Sürpriz İsim",
    badge: "Entrepreneur",
    bio: "Dördüncü konuşmacı slotu sürpriz isim için ayrıldı."
  }
];

type ScheduleItem = {
  time: string;
  title: string;
  type: "talk" | "break" | "panel" | "interactive";
  speaker?: string;
};

const SCHEDULE: ScheduleItem[] = [
  { time: "10:30-11:00", title: "Kapı Açılışı", type: "break" },
  { time: "11:00-11:20", title: "Açılış Konuşması", type: "talk" },
  { time: "11:30-12:00", title: "1. Konuşmacı: Dr. Sina Saygılı", type: "talk", speaker: "Dr. Sina Saygılı" },
  { time: "12:00-12:20", title: "Kahve + Networking", type: "break" },
  { time: "12:30-13:00", title: "2. Konuşmacı: Doç. Dr. Gaye Keser", type: "talk", speaker: "Doç. Dr. Gaye Keser" },
  { time: "13:00-13:30", title: "Sürpriz Konuşmacı #3 (Yakında Açıklanacak)", type: "talk" },
  { time: "13:30-14:10", title: "Yemek Arası + Networking", type: "break" },
  { time: "14:20-14:50", title: "Sürpriz Konuşmacı #4 (Yakında Açıklanacak)", type: "talk" },
  { time: "14:50-15:20", title: "5. Konuşmacı: Dt. Kerem İnan", type: "talk", speaker: "Dt. Kerem İnan" },
  { time: "15:20-15:40", title: "Kapanış ve Ödül Takdimi", type: "break" }
];

const BADGE_MAP: Record<SpeakerBadge, {
  label: string;
  iconClass: string;
  variant: "innovator" | "artist" | "entrepreneur" | "ai-pioneer";
}> = {
  "Innovator":    { label: "Yenilikçi",         iconClass: "fa-solid fa-rocket", variant: "innovator" },
  "Artist":       { label: "Sanatçı",           iconClass: "fa-solid fa-palette", variant: "artist" },
  "Entrepreneur": { label: "Girişimci",         iconClass: "fa-solid fa-briefcase", variant: "entrepreneur" },
  "AI Pioneer":   { label: "Yapay Zeka Öncüsü", iconClass: "fa-solid fa-robot", variant: "ai-pioneer" }
};

// ─── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const [diff, setDiff] = useState(target.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const total = Math.max(0, diff);
  return {
    d: Math.floor(total / 86400000),
    h: Math.floor((total % 86400000) / 3600000),
    m: Math.floor((total % 3600000) / 60000),
    s: Math.floor((total % 60000) / 1000),
    past: diff < 0
  };
}

// ─── Particle canvas ─────────────────────────────────────────────────────────
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 8 + 4,
      op: Math.random() * 0.2 + 0.04,
      ph: Math.random() * Math.PI * 2,
      green: Math.random() > 0.5
    }));
    let fr = 0;
    let id: number;
    function drawTooth(x: number, y: number, s: number) {
      ctx!.beginPath();
      ctx!.moveTo(x - s, y - s * 0.3);
      ctx!.bezierCurveTo(x - s, y - s * 1.2, x - s * 0.2, y - s * 1.4, x, y - s * 1.2);
      ctx!.bezierCurveTo(x + s * 0.2, y - s * 1.4, x + s, y - s * 1.2, x + s, y - s * 0.3);
      ctx!.bezierCurveTo(x + s * 1.1, y + s * 0.4, x + s * 0.7, y + s, x + s * 0.3, y + s);
      ctx!.bezierCurveTo(x + s * 0.1, y + s, x, y + s * 0.5, x, y + s * 0.5);
      ctx!.bezierCurveTo(x, y + s * 0.5, x - s * 0.1, y + s, x - s * 0.3, y + s);
      ctx!.bezierCurveTo(x - s * 0.7, y + s, x - s * 1.1, y + s * 0.4, x - s, y - s * 0.3);
      ctx!.closePath();
    }
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      fr++;
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = canvas!.width + 20;
        if (p.x > canvas!.width + 20) p.x = -20;
        if (p.y < -20) p.y = canvas!.height + 20;
        if (p.y > canvas!.height + 20) p.y = -20;
        ctx!.globalAlpha = p.op + Math.sin(fr * 0.02 + p.ph) * 0.04;
        ctx!.fillStyle = p.green ? "#00E5A0" : "#7B6EFF";
        ctx!.strokeStyle = p.green ? "rgba(0,229,160,0.15)" : "rgba(123,110,255,0.15)";
        ctx!.lineWidth = 0.5;
        drawTooth(p.x, p.y, p.size / 2);
        ctx!.fill(); ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      id = requestAnimationFrame(draw);
    }
    draw();
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 opacity-50" />;
}

function ApplicationCheckoutButton() {
  return (
    <a
      href={LUMA_EVENT_URL}
      className={cn(
        "luma-checkout--button",
        buttonVariants({ size: "xl", variant: "surface" }),
        "h-14 w-full px-10 text-base sm:w-auto sm:text-lg"
      )}
      data-luma-action="checkout"
      data-luma-event-id={LUMA_EVENT_ID}
      aria-label="Luma üzerinden etkinliğe kaydol"
    >
      Etkinliğe Kaydol
    </a>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { d, h, m, s, past } = useCountdown(EVENT_DATE);
  const [activeSpeaker, setActiveSpeaker] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, 80]);
  const totalSpeakers = SPEAKERS.length;

  const handlePrevSpeaker = () => {
    setActiveSpeaker((prev) => (prev - 1 + totalSpeakers) % totalSpeakers);
  };

  const handleNextSpeaker = () => {
    setActiveSpeaker((prev) => (prev + 1) % totalSpeakers);
  };

  return (
    <main className="min-h-screen bg-[#060918] text-white overflow-x-hidden">
      <Script
        id="luma-checkout"
        src="https://embed.lu.ma/checkout-button.js"
        strategy="afterInteractive"
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/* Background gradients — poster colours */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Centre navy-indigo glow */}
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(30,20,120,0.35)] blur-[120px]" />
          {/* Top-right violet */}
          <div className="absolute -top-20 right-0 h-[500px] w-[500px] rounded-full bg-[rgba(100,50,200,0.18)] blur-[100px]" />
          {/* Bottom-left blue */}
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-[rgba(10,40,160,0.2)] blur-[90px]" />
          {/* Mint accent */}
          <div className="absolute left-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-[rgba(0,229,160,0.04)] blur-[80px]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-30" />
        <ParticleField />

          <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 px-6 text-center max-w-4xl mx-auto">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 text-[10px] font-semibold uppercase tracking-[0.4em] text-[rgba(180,170,255,0.55)]"
            >
              Communitive Dentistry &nbsp;·&nbsp; Üsküdar &nbsp;·&nbsp; 2026
            </motion.p>

            {/* Display serif hero title */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-display italic text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-[5.5rem]"
            >
              <span className="text-gradient-poster">DentCo</span>
              <br />
              <span className="not-italic font-heading font-extrabold text-white">Outliers</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-5 text-base text-[rgba(210,205,255,0.55)] sm:text-lg tracking-wide"
            >
              Diş hekimliğinde sınırları zorluyoruz
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="mt-1 text-xs text-[rgba(180,170,255,0.4)] tracking-widest uppercase"
            >
              16 Mayıs 2026 &nbsp;·&nbsp; İstanbul
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-3 text-xs leading-relaxed text-[rgba(180,170,255,0.35)]"
            >
              {EVENT_ORGANIZER} &nbsp;·&nbsp; {EVENT_ADDRESS}
            </motion.p>

            {/* Countdown */}
            {!past && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mt-12 flex justify-center gap-3 sm:gap-5"
              >
                {[{ l: "Gün", v: d }, { l: "Saat", v: h }, { l: "Dk", v: m }, { l: "Sn", v: s }].map(({ l, v }) => (
                  <div key={l} className="flex flex-col items-center gap-1.5">
                    <div className="card-glass flex h-16 w-14 items-center justify-center sm:h-[72px] sm:w-[68px]">
                      <span className="font-heading text-2xl font-extrabold tabular-nums sm:text-3xl">{String(v).padStart(2, "0")}</span>
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[rgba(180,170,255,0.4)]">{l}</span>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-10 flex justify-center"
            >
              <ApplicationCheckoutButton />
            </motion.div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[rgba(180,170,255,0.25)]"
          >
            <ChevronDown className="h-6 w-6" />
          </motion.div>
        </section>
      {/* ── Feature bar ──────────────────────────────────────────── */}
      <section className="border-y border-[rgba(123,110,255,0.1)] bg-[rgba(12,16,48,0.6)] backdrop-blur-sm py-5">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-6 sm:gap-10 px-6">
          {[
            { icon: <Zap className="h-4 w-4" />, text: "Canlı Soru-Cevap + Anketler" },
            { icon: <Users className="h-4 w-4" />, text: "Akıllı Networking" },
            { icon: <Gamepad2 className="h-4 w-4" />, text: "Molar Muhafızı Oyunu" },
            { icon: <Images className="h-4 w-4" />, text: "Etkinlik Galerisi" }
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-sm text-[rgba(200,195,255,0.45)]">
              <span className="text-[#7B6EFF]">{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Speakers ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#7B6EFF]">Konuşmacılar</p>
          <h2 className="font-display italic text-3xl font-bold sm:text-4xl">
            Outlier&apos;larla <span className="not-italic font-heading font-extrabold text-gradient-purple">Tanışın</span>
          </h2>
        </motion.div>

        <div className="relative mx-auto mt-12 max-w-3xl">
          <div className="overflow-hidden">
            <motion.div
              animate={{ x: `-${activeSpeaker * 100}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="flex"
            >
              {SPEAKERS.map((speaker) => (
                <div key={speaker.name} className="w-full shrink-0 px-1">
                  <div className="card-glass min-h-[280px] p-6 text-center sm:p-8 transition-all duration-300">
                    {speaker.imageSrc ? (
                      <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border-2 border-[rgba(123,110,255,0.5)] shadow-purple">
                        <Image
                          src={speaker.imageSrc}
                          alt={speaker.title}
                          width={96}
                          height={96}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(196,154,42,0.3)] bg-[rgba(196,154,42,0.08)] text-[#C49A2A] text-2xl">
                        <i className={BADGE_MAP[speaker.badge].iconClass} aria-hidden="true" />
                      </div>
                    )}
                    <h3 className="font-heading text-xl font-bold tracking-tight">{speaker.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[rgba(200,195,255,0.45)]">{speaker.bio}</p>
                    {speaker.posterHref ? (
                      <a
                        href={speaker.posterHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center justify-center rounded-full border border-[rgba(123,110,255,0.4)] bg-[rgba(123,110,255,0.12)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-all hover:border-[#7B6EFF] hover:bg-[rgba(123,110,255,0.25)]"
                      >
                        {speaker.posterButtonLabel ?? "Afişi Gör"}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handlePrevSpeaker}
              aria-label="Önceki konuşmacı"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(123,110,255,0.18)] bg-[rgba(12,16,48,0.6)] text-[rgba(200,195,255,0.6)] transition-all hover:border-[#7B6EFF] hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              {SPEAKERS.map((speaker, i) => (
                <button
                  key={speaker.name}
                  type="button"
                  onClick={() => setActiveSpeaker(i)}
                  aria-label={`${i + 1}. konuşmacı slaytı`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeSpeaker === i ? "w-8 bg-[#7B6EFF]" : "w-2 bg-[rgba(180,170,255,0.2)] hover:bg-[rgba(180,170,255,0.4)]"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNextSpeaker}
              aria-label="Sonraki konuşmacı"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(123,110,255,0.18)] bg-[rgba(12,16,48,0.6)] text-[rgba(200,195,255,0.6)] transition-all hover:border-[#7B6EFF] hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Schedule ─────────────────────────────────────────────── */}
      <section className="relative py-20">
        <div className="absolute inset-0 grid-bg opacity-15" />
        <div className="relative mx-auto max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#00E5A0]">Program</p>
            <h2 className="font-display italic text-3xl font-bold sm:text-4xl">
              Günün <span className="not-italic font-heading font-extrabold text-gradient-mint">Akışı</span>
            </h2>
          </motion.div>

          <div className="mt-12 space-y-2.5">
            {SCHEDULE.map((item, i) => (
              <motion.div
                key={`${item.time}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-4 rounded-[14px] border p-4 transition-all duration-200 ${
                  item.type === "break"
                    ? "border-[rgba(123,110,255,0.06)] bg-[rgba(12,16,48,0.3)]"
                    : item.type === "panel"
                    ? "border-[rgba(123,110,255,0.2)] bg-[rgba(123,110,255,0.07)]"
                    : item.type === "interactive"
                    ? "border-[rgba(0,229,160,0.2)] bg-[rgba(0,229,160,0.06)]"
                    : "border-[rgba(123,110,255,0.1)] bg-[rgba(12,16,48,0.5)] hover:border-[rgba(123,110,255,0.28)]"
                }`}
              >
                <span className="w-24 shrink-0 text-[11px] font-bold tabular-nums text-[rgba(180,170,255,0.35)]">{item.time}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${item.type === "break" ? "text-[rgba(200,195,255,0.4)]" : "text-white"}`}>
                    {item.title}
                  </p>
                  {item.speaker && <p className="mt-0.5 text-xs text-[rgba(180,170,255,0.35)]">{item.speaker}</p>}
                </div>
                {item.type === "interactive" && <span className="shrink-0 text-[11px] font-semibold text-[#00E5A0]">Etkileşimli</span>}
                {item.type === "panel" && <span className="shrink-0 text-[11px] font-semibold text-[#B8ACFF]">Panel</span>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-32 text-center">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(30,20,120,0.3)] blur-[130px]" />
        <div className="absolute left-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-[rgba(100,50,200,0.12)] blur-[80px]" />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 px-6"
        >
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.4em] text-[rgba(180,170,255,0.45)]">
            Katılım
          </p>
          <h2 className="font-display italic text-4xl font-bold leading-tight sm:text-6xl">
            Sen de bir{" "}
            <span className="not-italic font-heading font-extrabold text-gradient-poster">Outlier</span>{" "}
            mısın?
          </h2>
          <p className="mt-4 text-base text-[rgba(200,195,255,0.4)]">Kayıtlar Luma üzerinden açık.</p>
          <div className="mt-8 flex justify-center">
            <ApplicationCheckoutButton />
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(123,110,255,0.1)] py-8 text-center">
        <p className="text-xs text-[rgba(180,170,255,0.25)]">© 2026 Communitive Dentistry — DentCo Outliers</p>
        <div className="mt-3 flex flex-wrap justify-center gap-6 text-xs text-[rgba(180,170,255,0.25)]">
          <a href={ANDROID_APP_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            Android Uygulamasını İndir
          </a>
          <a href={IOS_APP_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            iOS Uygulamasını İndir
          </a>
          <span>Luma ile hızlı kayıt</span>
        </div>
      </footer>
    </main>
  );
}
