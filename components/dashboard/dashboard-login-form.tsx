"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLoginFormProps {
  redirectPath?: string;
}

export function DashboardLoginForm({ redirectPath = "/admin" }: DashboardLoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const normalizedIdentifier = identifier.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier);
      const payload = isEmail
        ? { email: normalizedIdentifier.toLowerCase(), password }
        : { username: normalizedIdentifier, password };

      const response = await fetch("/api/dashboard-auth", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Giriş sırasında bir hata oluştu.");
      }

      router.replace(redirectPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Giriş sırasında bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="dashboard-identifier" className="text-sm font-medium text-slate-700">
          E-posta veya Kullanıcı Adı
        </label>
        <input
          id="dashboard-identifier"
          type="text"
          autoComplete="username email"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
          placeholder="ornek@firma.com"
          required
        />
        <p className="text-xs text-slate-500">
          Supabase e-posta hesabınızla giriş yapabilirsiniz. Legacy kullanıcı adı da desteklenir.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="dashboard-password" className="text-sm font-medium text-slate-700">
          Şifre
        </label>
        <input
          id="dashboard-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
          placeholder="Şifreyi girin"
          required
        />
      </div>

      <Button className="w-full" size="lg" type="submit" disabled={!canSubmit}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Doğrulanıyor...
          </>
        ) : (
          <>
            <LockKeyhole className="h-4 w-4" />
            Panoya Giriş Yap
          </>
        )}
      </Button>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}
    </form>
  );
}
