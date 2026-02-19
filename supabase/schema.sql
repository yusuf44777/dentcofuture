-- Communitive Dentistry: core schema for feedback and analytics
create extension if not exists pgcrypto;

create table if not exists public.attendee_feedbacks (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  is_analyzed boolean not null default false
);

create table if not exists public.congress_analytics (
  id uuid primary key default gen_random_uuid(),
  total_feedbacks integer not null default 0 check (total_feedbacks >= 0),
  sentiment_score jsonb not null,
  top_keywords jsonb not null,
  created_at timestamptz not null default now()
);

-- Improve realtime payload quality for inserts/updates
alter table public.attendee_feedbacks replica identity full;
alter table public.congress_analytics replica identity full;

-- Enable Row Level Security
alter table public.attendee_feedbacks enable row level security;
alter table public.congress_analytics enable row level security;

-- Recreate policies for idempotent migrations

drop policy if exists "public_can_insert_feedback" on public.attendee_feedbacks;
create policy "public_can_insert_feedback"
  on public.attendee_feedbacks
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "public_can_read_feedback" on public.attendee_feedbacks;
create policy "public_can_read_feedback"
  on public.attendee_feedbacks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_can_read_analytics" on public.congress_analytics;
create policy "public_can_read_analytics"
  on public.congress_analytics
  for select
  to anon, authenticated
  using (true);

-- Service role bypasses RLS, no public insert/update policies for analytics.

grant usage on schema public to anon, authenticated;
grant select, insert on public.attendee_feedbacks to anon, authenticated;
grant select on public.congress_analytics to anon, authenticated;

-- Ensure realtime publication contains both tables

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendee_feedbacks'
  ) then
    alter publication supabase_realtime add table public.attendee_feedbacks;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'congress_analytics'
  ) then
    alter publication supabase_realtime add table public.congress_analytics;
  end if;
end
$$;
