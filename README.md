# Dent Co Future Canlı

COMMUNITIVE DENTISTRY tarafından düzenlenen Dent Co Future etkinliği için Next.js App Router + Supabase + OpenAI tabanlı gerçek zamanlı etkileşim uygulaması.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS + Shadcn-style UI primitives
- Supabase (PostgreSQL + Realtime)
- OpenAI (`gpt-5-mini-2025-08-07`) for batch analytics
- Recharts for sentiment charting
- `react-qr-code` for the dashboard CTA

## Routes

- `/submit` mobil geri bildirim formu
- `/oyla` -> `/submit` yönlendirmesi
- `/dashboard` büyük ekran canlı analiz panosu
- `/dashboard/login` dashboard giriş ekranı
- `/api/analyze` batch AI analiz endpoint'i (GET/POST)
- `/api/dashboard-auth` dashboard oturum endpoint'i

## 1. Veritabanı Kurulumu (Supabase)

`supabase/schema.sql` dosyasını Supabase SQL Editor'da çalıştır.

Oluşan tablolar:

- `attendee_feedbacks`
  - `id` uuid (PK)
  - `message` text
  - `created_at` timestamptz
  - `is_analyzed` boolean default `false`
- `congress_analytics`
  - `id` uuid (PK)
  - `total_feedbacks` int
  - `sentiment_score` jsonb
  - `top_keywords` jsonb
  - `created_at` timestamptz

## 2. Ortam Değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyala:

```bash
cp .env.example .env.local
```

Gerekli:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET` (zorunlu, `/api/analyze` endpoint koruması için)
- `DASHBOARD_USERNAME` (dashboard kullanıcı adı)
- `DASHBOARD_PASSWORD` (dashboard şifresi)
- `DASHBOARD_AUTH_SECRET` (opsiyonel, dashboard cookie imzası için; boşsa `CRON_SECRET` kullanılır)
- `NEXT_PUBLIC_APP_URL` (QR URL üretimi için)

## 3. Local Çalıştırma

```bash
npm install
npm run dev
```

## 4. AI Batch Analiz Akışı

- `/api/analyze`, `attendee_feedbacks` tablosunda `is_analyzed = false` kayıtlarını alır
- Bekleyen kayıt sayısı `>= 10` ise batch mesajı `gpt-5-mini-2025-08-07` modeline gönderir
- Bekleyen kayıt `< 10` ise, yalnızca `force=true` ile çalışır
- Sonucu `congress_analytics` tablosuna yazar
- İşlenen geri bildirimleri `is_analyzed = true` yapar
- Endpoint public değildir; `Authorization: Bearer <CRON_SECRET>`/`x-analyze-secret` veya moderatör dashboard oturumu ister
- Dashboard'a giriş yapan moderatörler, `/dashboard` üzerindeki "AI Analizini Yenile" butonuyla manuel analiz tetikleyebilir
- Model: `gpt-5-mini-2025-08-07`

### Manuel tetikleme örnekleri

```bash
# Eşik (>=10) sağlanmışsa çalıştır
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer $CRON_SECRET"

# Eşiği beklemeden zorla çalıştır
curl -X POST "http://localhost:3000/api/analyze?force=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 5. Realtime Davranış

`/dashboard`, `postgres_changes` eventlerini dinler:

- `attendee_feedbacks` insert -> `Toplam Yanıt` + son 5 yorum güncellenir
- `congress_analytics` insert -> duygu grafiği + top konular + özet güncellenir

## 5.1 Yanıt Tipleri

- `/submit` ekranında iki mod vardır:
  - `Serbest Yanıt` (açık uçlu metin)
  - `Çoktan Seçmeli` (tek seçimli anket)
- Çoktan seçmeli yanıtlar `attendee_feedbacks.message` alanına `ANKET: <seçenek>` formatında yazılır.
- `/dashboard` anket kartı bu yanıtları canlı olarak sayar.
- `/api/analyze` yalnızca serbest metinleri AI analizine dahil eder; anket yanıtları analiz kuyruğunda birikmez.

## 6. Vercel Deploy ve API Güvenliği

- `vercel.json` içinde `/api/analyze` için cron tanımlıdır (Hobby plan uyumlu: günde 1 kez).
- Vercel Project Settings -> Environment Variables alanına tüm değişkenleri ekle.
- `CRON_SECRET` mutlaka tanımlı olmalı; endpoint bu secret olmadan production'da çalışmaz.
- `SUPABASE_SERVICE_ROLE_KEY` ve `OPENAI_API_KEY` sadece server-side değişken olarak tutulmalı, client'a taşınmamalı.
- `.env.local` dosyasını kesinlikle repo'ya commit etme.

## 7. Dashboard Erişim Koruması

- `/dashboard` sayfası artık giriş zorunludur; oturum yoksa otomatik `/dashboard/login` sayfasına yönlenir.
- Giriş doğrulaması `/api/dashboard-auth` üzerinden server-side yapılır.
- Varsayılan kullanıcı adı/şifre:
  - `communitive`
  - `communitiveİstanbul2026`
- Üretim ortamında bu bilgileri Vercel Environment Variables üzerinden yönet.

## Notlar

- Analitik kayıtları server-side `SUPABASE_SERVICE_ROLE_KEY` ile yazılır.
- Client form insert işlemleri `anon` key + RLS policy ile yapılır.
- Mesaj uzunluğu hem UI hem DB katmanında 200 karakter ile sınırlandırılmıştır.
