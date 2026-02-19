"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/dashboard-auth", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Giriş sırasında bir hata oluştu.");
      }

      router.replace("/dashboard");
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
        <label htmlFor="dashboard-username" className="text-sm font-medium text-slate-700">
          Kullanıcı Adı
        </label>
        <input
          id="dashboard-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
          placeholder="Kullanıcı adını girin"
          required
        />
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
          className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
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
