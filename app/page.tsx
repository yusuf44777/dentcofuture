"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Instagram, ChevronDown, Zap, Users, Gamepad2, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Session } from "@/lib/types";

// ─── Config ────────────────────────────────────────────────────────────────
const EVENT_DATE = new Date("2026-05-15T09:00:00+03:00");

const SPEAKERS = [
  {
    name: "Dr. Elif Arslan",
    title: "Digital Dentistry Pioneer",
    instagram: "drelarslan",
    badge: "AI Pioneer" as const,
    bio: "Leading research in AI-assisted diagnostics at Istanbul University."
  },
  {
    name: "Prof. Ahmet Yıldız",
    title: "Oral & Maxillofacial Surgeon",
    instagram: "profyildiz",
    badge: "Innovator" as const,
    bio: "20+ years transforming surgical protocols across Europe."
  },
  {
    name: "Dt. Selin Koç",
    title: "Aesthetic Dentistry Artist",
    instagram: "dtselinkon",
    badge: "Artist" as const,
    bio: "International award-winner in smile design and ceramics."
  },
  {
    name: "Barış Demirci",
    title: "DentTech Founder & CEO",
    instagram: "bdemircitech",
    badge: "Entrepreneur" as const,
    bio: "Serial founder building the next generation of dental SaaS."
  }
];

const SCHEDULE = [
  { time: "09:00", title: "Registration & Welcome Coffee", type: "break" },
  { time: "09:30", title: "Opening Keynote: The Outlier Mindset", speaker: "Dr. Elif Arslan", type: "talk" },
  { time: "10:15", title: "AI in the Clinic: Tools That Actually Work", speaker: "Dr. Elif Arslan", type: "talk" },
  { time: "11:00", title: "Coffee Break + Networking", type: "break" },
  { time: "11:30", title: "Surgical Innovation: From Research to Reality", speaker: "Prof. Ahmet Yıldız", type: "talk" },
  { time: "12:15", title: "The Art of the Smile", speaker: "Dt. Selin Koç", type: "talk" },
  { time: "13:00", title: "Lunch", type: "break" },
  { time: "14:00", title: "Building in Dentistry: Lessons from the Trenches", speaker: "Barış Demirci", type: "talk" },
  { time: "14:45", title: "Panel: Outliers Roundtable", speaker: "All Speakers", type: "panel" },
  { time: "15:30", title: "Live Q&A + Polls + Reactions", type: "interactive" },
  { time: "16:00", title: "Networking + Tooth Defender Tournament", type: "break" },
  { time: "17:00", title: "Raffle & Closing", type: "break" }
];

const BADGE_MAP: Record<string, { label: string; variant: "innovator" | "artist" | "entrepreneur" | "ai-pioneer" }> = {
  "Innovator":    { label: "🚀 Innovator",    variant: "innovator" },
  "Artist":       { label: "🎨 Artist",        variant: "artist" },
  "Entrepreneur": { label: "💼 Entrepreneur",  variant: "entrepreneur" },
  "AI Pioneer":   { label: "🤖 AI Pioneer",    variant: "ai-pioneer" }
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
      op: Math.random() * 0.25 + 0.05,
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
        ctx!.globalAlpha = p.op + Math.sin(fr * 0.02 + p.ph) * 0.05;
        ctx!.fillStyle = p.green ? "#00E5A0" : "#6C63FF";
        ctx!.strokeStyle = p.green ? "rgba(0,229,160,0.2)" : "rgba(108,99,255,0.2)";
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
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 opacity-60" />;
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { d, h, m, s, past } = useCountdown(EVENT_DATE);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, 80]);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.from("sessions").select("*").eq("active", true).single()
      .then(({ data }) => setActiveSession(data as Session | null));
  }, []);

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
      {/* Live pill */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
        >
          <Link href="/live">
            <div className="flex items-center gap-2 rounded-full border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.15)] px-4 py-2 backdrop-blur">
              <span className="live-dot" />
              <span className="text-xs font-semibold text-[#FF4D6D]">LIVE — {activeSession.title}</span>
            </div>
          </Link>
        </motion.div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(108,99,255,0.08)] blur-[100px]" />
          <div className="absolute left-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-[rgba(0,229,160,0.05)] blur-[80px]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-40" />
        <ParticleField />

        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 px-6 text-center">
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(240,240,255,0.5)]">
            Communitive Dentistry • Istanbul 2026
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="font-heading text-5xl font-extrabold leading-tight tracking-tight sm:text-7xl lg:text-8xl">
            <span className="text-gradient-hero">DentCo</span>
            <br />
            <span className="text-white">Outliers</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="mt-4 text-lg text-[rgba(240,240,255,0.6)] sm:text-xl">
            Breaking boundaries in dentistry
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="mt-1 text-sm text-[rgba(240,240,255,0.4)]">
            May 15, 2026 • Istanbul
          </motion.p>

          {/* Countdown */}
          {!past && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
              className="mt-10 flex justify-center gap-3 sm:gap-6">
              {[{ l: "Days", v: d }, { l: "Hours", v: h }, { l: "Min", v: m }, { l: "Sec", v: s }].map(({ l, v }) => (
                <div key={l} className="flex flex-col items-center">
                  <div className="flex h-16 w-14 items-center justify-center rounded-[12px] border border-[rgba(108,99,255,0.3)] bg-[rgba(108,99,255,0.1)] sm:h-20 sm:w-20">
                    <span className="font-heading text-2xl font-extrabold tabular-nums sm:text-3xl">{String(v).padStart(2,"0")}</span>
                  </div>
                  <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,240,255,0.4)]">{l}</span>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/join"><Button size="xl" className="w-full sm:w-auto">Join the Experience</Button></Link>
            <Link href="/live"><Button size="xl" variant="outline" className="w-full sm:w-auto">Enter Live Hub</Button></Link>
          </motion.div>
        </motion.div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[rgba(240,240,255,0.3)]">
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </section>

      {/* ── Feature bar ──────────────────────────────────────────── */}
      <section className="border-y border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8 px-6">
          {[
            { icon: <Zap className="h-4 w-4"/>, text: "Live Q&A + Polls" },
            { icon: <Users className="h-4 w-4"/>, text: "Smart Networking" },
            { icon: <Gamepad2 className="h-4 w-4"/>, text: "Tooth Defender Game" },
            { icon: <Trophy className="h-4 w-4"/>, text: "Points & Raffle" }
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-[rgba(240,240,255,0.5)]">
              <span className="text-[#6C63FF]">{icon}</span>{text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Speakers ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#6C63FF]">Speakers</p>
          <h2 className="font-heading text-center text-3xl font-extrabold sm:text-4xl">Meet the Outliers</h2>
        </motion.div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SPEAKERS.map((speaker, i) => (
            <motion.div key={speaker.name}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="card-surface-hover p-6 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(108,99,255,0.15)] border-2 border-[rgba(108,99,255,0.3)] text-3xl">
                {speaker.badge === "AI Pioneer" ? "🤖" : speaker.badge === "Innovator" ? "🚀" : speaker.badge === "Artist" ? "🎨" : "💼"}
              </div>
              <Badge variant={BADGE_MAP[speaker.badge].variant} className="mb-3">{BADGE_MAP[speaker.badge].label}</Badge>
              <h3 className="font-heading text-base font-bold">{speaker.name}</h3>
              <p className="mt-0.5 text-xs text-[rgba(240,240,255,0.5)]">{speaker.title}</p>
              <p className="mt-3 text-xs leading-relaxed text-[rgba(240,240,255,0.4)]">{speaker.bio}</p>
              <a href={`https://instagram.com/${speaker.instagram}`} target="_blank" rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[rgba(240,240,255,0.35)] transition-colors hover:text-[#E1306C]">
                <Instagram className="h-3.5 w-3.5" />@{speaker.instagram}
              </a>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Schedule ─────────────────────────────────────────────── */}
      <section className="relative py-24">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative mx-auto max-w-3xl px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#00E5A0]">Schedule</p>
            <h2 className="font-heading text-center text-3xl font-extrabold sm:text-4xl">Day at a Glance</h2>
          </motion.div>
          <div className="mt-12 space-y-3">
            {SCHEDULE.map((item, i) => (
              <motion.div key={`${item.time}-${i}`}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-4 rounded-[12px] border p-4 ${
                  item.type === "break" ? "border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)]"
                  : item.type === "panel" ? "border-[rgba(108,99,255,0.2)] bg-[rgba(108,99,255,0.07)]"
                  : item.type === "interactive" ? "border-[rgba(0,229,160,0.2)] bg-[rgba(0,229,160,0.07)]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#13131A] hover:border-[rgba(108,99,255,0.3)]"
                }`}>
                <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-[rgba(240,240,255,0.4)]">{item.time}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${item.type === "break" ? "text-[rgba(240,240,255,0.5)]" : "text-white"}`}>{item.title}</p>
                  {item.speaker && <p className="mt-0.5 text-xs text-[rgba(240,240,255,0.4)]">{item.speaker}</p>}
                </div>
                {item.type === "interactive" && <span className="shrink-0 text-xs font-semibold text-[#00E5A0]">Interactive</span>}
                {item.type === "panel" && <span className="shrink-0 text-xs font-semibold text-[#A78BFA]">Panel</span>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-32 text-center">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(108,99,255,0.1)] blur-[120px]" />
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative z-10 px-6">
          <h2 className="font-heading text-4xl font-extrabold sm:text-6xl">
            Are you an <span className="text-gradient-purple">Outlier?</span>
          </h2>
          <p className="mt-4 text-lg text-[rgba(240,240,255,0.5)]">Join, earn points, break boundaries.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/join"><Button size="xl">Join the Experience</Button></Link>
            <Link href="/game"><Button size="xl" variant="surface"><Gamepad2 className="h-5 w-5"/>Play Tooth Defender</Button></Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-8 text-center">
        <p className="text-xs text-[rgba(240,240,255,0.3)]">© 2026 Communitive Dentistry — DentCo Outliers</p>
        <div className="mt-3 flex justify-center gap-6 text-xs text-[rgba(240,240,255,0.3)]">
          {[["Live Hub", "/live"], ["Networking", "/networking"], ["Game", "/game"], ["Admin", "/admin"]].map(([l, h]) => (
            <Link key={l} href={h} className="hover:text-white transition-colors">{l}</Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
