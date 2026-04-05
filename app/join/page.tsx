"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Instagram, User } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  QUIZ_QUESTIONS,
  calculateOutlierScore,
  getOutlierTitle,
  getOutlierColor
} from "@/lib/outlier-quiz";
import { POINTS } from "@/lib/points";
import type { AttendeeRole } from "@/lib/types";

const ROLES: { value: AttendeeRole; label: string; icon: string; desc: string }[] = [
  { value: "Student",       label: "Öğrenci",          icon: "🎓", desc: "Geleceği şekillendiren diş hekimliği öğrencisi" },
  { value: "Clinician",     label: "Klinisyen",        icon: "🦷", desc: "Aktif çalışan diş hekimi veya uzman" },
  { value: "Academic",      label: "Akademisyen",      icon: "🔬", desc: "Araştırmacı veya öğretim üyesi" },
  { value: "Entrepreneur",  label: "Girişimci",        icon: "🚀", desc: "Kurucu veya startup geliştirici" },
  { value: "Industry",      label: "Sektör Profesyoneli", icon: "🏭", desc: "Dental sektörde çalışan profesyonel" }
];

const STEPS = ["Profil", "Rol", "Test", "Sonuç"] as const;

export default function JoinPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [role, setRole] = useState<AttendeeRole | null>(null);
  const [answers, setAnswers] = useState<number[]>(Array(5).fill(0));
  const [score, setScore] = useState(0);
  const [attendeeId, setAttendeeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1 → Step 2
  async function handleProfileNext() {
    if (!name.trim()) { setError("Lütfen adınızı girin."); return; }
    setError("");
    setStep(1);
  }

  // Step 2 → Step 3
  function handleRoleNext() {
    if (!role) { setError("Lütfen rolünüzü seçin."); return; }
    setError("");
    setStep(2);
  }

  // Step 3 → Step 4: submit to Supabase
  async function handleQuizSubmit() {
    setSubmitting(true);
    const finalScore = calculateOutlierScore(answers);
    setScore(finalScore);

    const sb = createSupabaseBrowserClient();
    const { data, error: err } = await sb
      .from("attendees")
      .insert({
        name: name.trim(),
        role: role!,
        instagram: instagram.replace("@", "") || null,
        outlier_score: finalScore,
        points: POINTS.JOIN_PROFILE + POINTS.QUIZ_COMPLETE
      })
      .select()
      .single();

    if (err || !data) {
      setError("Profil kaydedilemedi. Lütfen tekrar deneyin.");
      setSubmitting(false);
      return;
    }

    localStorage.setItem("dentco_outliers_attendee_id", data.id);
    setAttendeeId(data.id);
    setStep(3);
    setSubmitting(false);
  }

  const quizQ = QUIZ_QUESTIONS[step - 2] ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4 py-12">
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[rgba(108,99,255,0.08)] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(240,240,255,0.4)]">
            DentCo Outliers
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-heading mt-2 text-3xl font-extrabold text-white">
            {step === 3 ? "Sen bir Outlier'sın!" : "Deneyime Katıl"}
          </motion.h1>
        </div>

        {/* Progress */}
        {step < 3 && (
          <div className="mb-8 flex gap-2">
            {STEPS.slice(0, 3).map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1 rounded-full transition-all duration-500 ${i <= step ? "bg-[#6C63FF]" : "bg-[rgba(255,255,255,0.08)]"}`} />
                <p className={`mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors ${i === step ? "text-[#6C63FF]" : i < step ? "text-[rgba(240,240,255,0.5)]" : "text-[rgba(240,240,255,0.2)]"}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Step 0: Profile ─────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step0"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="space-y-4 rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
              <Input
                label="Ad Soyad"
                placeholder="Dr. Ayşe Yılmaz"
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                inputPrefix={<User className="h-4 w-4" />}
                onKeyDown={e => e.key === "Enter" && handleProfileNext()}
                autoFocus
              />
              <Input
                label="Instagram (opsiyonel)"
                placeholder="@kullaniciadi"
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                inputPrefix={<Instagram className="h-4 w-4" />}
              />
              {error && <p className="text-xs text-[#FF4D6D]">{error}</p>}
              <Button onClick={handleProfileNext} className="w-full mt-2" size="lg">
                Devam Et <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 1: Role ─────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="space-y-3">
              <p className="text-sm text-[rgba(240,240,255,0.5)]">Diş hekimliğinde kendini nasıl tanımlarsın?</p>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => { setRole(r.value); setError(""); }}
                  className={`w-full flex items-center gap-4 rounded-[12px] border p-4 text-left transition-all ${
                    role === r.value
                      ? "border-[#6C63FF] bg-[rgba(108,99,255,0.12)] shadow-[0_0_0_1px_rgba(108,99,255,0.4)]"
                      : "border-[rgba(255,255,255,0.08)] bg-[#13131A] hover:border-[rgba(108,99,255,0.3)]"
                  }`}>
                  <span className="text-2xl">{r.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.label}</p>
                    <p className="text-xs text-[rgba(240,240,255,0.4)]">{r.desc}</p>
                  </div>
                  {role === r.value && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-[#6C63FF]" />
                  )}
                </button>
              ))}
              {error && <p className="text-xs text-[#FF4D6D]">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1" size="lg">
                  <ArrowLeft className="h-4 w-4" /> Geri
                </Button>
                <Button onClick={handleRoleNext} className="flex-1" size="lg">
                  Devam Et <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Steps 2–6: Quiz ──────────────────────────────────── */}
          {step >= 2 && step <= 6 && quizQ && (
            <motion.div key={`quiz-${step}`}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6C63FF]">
                  Soru {quizQ.id} / 5
                </span>
                <span className="text-xs text-[rgba(240,240,255,0.3)]">Outlier Testi</span>
              </div>

              <h3 className="font-heading text-lg font-bold text-white leading-snug mb-6">
                {quizQ.text}
              </h3>

              {quizQ.type === "scale" && (
                <div className="space-y-4">
                  <input
                    type="range" min={1} max={5} step={1}
                    value={answers[quizQ.id - 1] || 3}
                    onChange={e => {
                      const next = [...answers];
                      next[quizQ.id - 1] = parseInt(e.target.value);
                      setAnswers(next);
                    }}
                    className="w-full accent-[#6C63FF]"
                  />
                  <div className="flex justify-between text-xs text-[rgba(240,240,255,0.4)]">
                    <span>{quizQ.scaleMin}</span>
                    <span className="font-bold text-[#6C63FF]">{answers[quizQ.id - 1] || 3}/5</span>
                    <span>{quizQ.scaleMax}</span>
                  </div>
                </div>
              )}

              {quizQ.type === "choice" && quizQ.options && (
                <div className="space-y-2">
                  {quizQ.options.map(opt => (
                    <button key={opt.label}
                      onClick={() => {
                        const next = [...answers];
                        next[quizQ.id - 1] = opt.value;
                        setAnswers(next);
                      }}
                      className={`w-full rounded-[10px] border p-3 text-left text-sm transition-all ${
                        answers[quizQ.id - 1] === opt.value
                          ? "border-[#6C63FF] bg-[rgba(108,99,255,0.15)] text-white"
                          : "border-[rgba(255,255,255,0.08)] bg-[#1A1A24] text-[rgba(240,240,255,0.7)] hover:border-[rgba(108,99,255,0.3)]"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1" size="lg">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {step < 6 ? (
                  <Button
                    onClick={() => {
                      if (!(answers[quizQ.id - 1])) {
                        const next = [...answers];
                        next[quizQ.id - 1] = quizQ.type === "scale" ? 3 : (quizQ.options?.[0]?.value ?? 3);
                        setAnswers(next);
                      }
                      setStep(step + 1);
                    }}
                    className="flex-2 flex-1" size="lg">
                    {step === 6 ? "Puanımı Gör" : "Sonraki"} <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleQuizSubmit} disabled={submitting} className="flex-1" size="lg">
                    {submitting ? "Hesaplanıyor..." : "Puanımı Hesapla"} <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {step === 6 && (
                <Button onClick={handleQuizSubmit} disabled={submitting} className="w-full mt-3" size="lg">
                  {submitting ? "Hesaplanıyor..." : "Outlier Puanımı Göster"}
                </Button>
              )}
            </motion.div>
          )}

          {/* ── Step 3 (=7): Result ──────────────────────────────── */}
          {step === 3 && attendeeId && (
            <motion.div key="result"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="space-y-6 text-center">
              {/* Score ring */}
              <div className="mx-auto relative flex h-40 w-40 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <motion.circle
                    cx="80" cy="80" r="70"
                    fill="none"
                    stroke={getOutlierColor(score)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 70}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - score / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="text-center">
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="font-heading text-4xl font-extrabold"
                    style={{ color: getOutlierColor(score) }}
                  >
                    {score}
                  </motion.span>
                  <p className="text-xs text-[rgba(240,240,255,0.4)]">/ 100</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-[rgba(240,240,255,0.4)]">Outlier Tipin</p>
                <h2 className="font-heading mt-1 text-3xl font-extrabold" style={{ color: getOutlierColor(score) }}>
                  {getOutlierTitle(score)}
                </h2>
                <p className="mt-1 text-sm text-[rgba(240,240,255,0.5)]">{name}</p>
              </div>

              <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#13131A] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[rgba(240,240,255,0.4)]">
                  Profil QR Kodun
                </p>
                <div className="flex justify-center rounded-[8px] bg-white p-3">
                  <QRCode
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/profile/${attendeeId}`}
                    size={120}
                  />
                </div>
                <p className="mt-2 text-xs text-[rgba(240,240,255,0.3)]">
                  Diğer katılımcılar bu kodu okutarak seninle bağlantı kurabilir
                </p>
              </div>

              <div className="rounded-[12px] border border-[rgba(0,229,160,0.2)] bg-[rgba(0,229,160,0.08)] p-4">
                <p className="text-sm font-semibold text-[#00E5A0]">
                  +{POINTS.JOIN_PROFILE + POINTS.QUIZ_COMPLETE} puan kazandın!
                </p>
                <p className="mt-0.5 text-xs text-[rgba(240,240,255,0.4)]">Profil + Test tamamlandı</p>
              </div>

              <div className="flex flex-col gap-3">
                <Button onClick={() => router.push("/live")} size="lg" className="w-full">
                  Canlı Merkeze Gir <ArrowRight className="h-4 w-4" />
                </Button>
                <Button onClick={() => router.push("/networking")} variant="outline" size="lg" className="w-full">
                  Ağ Kurmaya Geç
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && step !== 0 && step !== 1 && (
          <p className="mt-4 text-center text-xs text-[#FF4D6D]">{error}</p>
        )}
      </div>
    </main>
  );
}
