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

create table if not exists public.live_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 6 and 180),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.networking_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) <= 120),
  interest_area text not null check (char_length(interest_area) <= 120),
  goal text not null check (char_length(goal) <= 120),
  contact_info text check (char_length(contact_info) <= 120),
  is_matched boolean not null default false,
  matched_with_id uuid references public.networking_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists networking_profiles_match_lookup_idx
  on public.networking_profiles (interest_area, is_matched, created_at);

create table if not exists public.raffle_participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) <= 120),
  participant_code text not null unique check (char_length(participant_code) between 4 and 32),
  external_ref text check (char_length(external_ref) <= 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raffle_prizes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 140),
  description text check (char_length(description) <= 300),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 100),
  allow_previous_winner boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references public.raffle_prizes(id) on delete cascade,
  winner_participant_id uuid not null references public.raffle_participants(id) on delete restrict,
  draw_number integer not null check (draw_number > 0),
  winner_code_snapshot text not null,
  winner_name_snapshot text not null,
  drawn_at timestamptz not null default now(),
  unique (prize_id, draw_number),
  unique (prize_id, winner_participant_id)
);

create index if not exists raffle_participants_active_idx
  on public.raffle_participants (is_active, created_at desc);

create index if not exists raffle_prizes_active_idx
  on public.raffle_prizes (is_active, created_at desc);

create index if not exists raffle_draws_prize_drawn_at_idx
  on public.raffle_draws (prize_id, drawn_at desc);

create index if not exists raffle_draws_winner_idx
  on public.raffle_draws (winner_participant_id);

create unique index if not exists live_polls_single_active_idx
  on public.live_polls (is_active)
  where is_active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_raffle_participants_updated_at on public.raffle_participants;
create trigger set_raffle_participants_updated_at
before update on public.raffle_participants
for each row
execute function public.set_updated_at();

drop trigger if exists set_raffle_prizes_updated_at on public.raffle_prizes;
create trigger set_raffle_prizes_updated_at
before update on public.raffle_prizes
for each row
execute function public.set_updated_at();

drop trigger if exists set_live_polls_updated_at on public.live_polls;
create trigger set_live_polls_updated_at
before update on public.live_polls
for each row
execute function public.set_updated_at();

create or replace function public.normalize_raffle_code(input text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(input, ''), '[^A-Za-z0-9-]', '', 'g'));
$$;

create or replace function public.generate_raffle_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'DCF-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
    exit when not exists (
      select 1
      from public.raffle_participants
      where participant_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.set_raffle_participant_code()
returns trigger
language plpgsql
as $$
begin
  if new.participant_code is null or btrim(new.participant_code) = '' then
    new.participant_code := public.generate_raffle_code();
  else
    new.participant_code := public.normalize_raffle_code(new.participant_code);
  end if;

  if new.participant_code = '' then
    new.participant_code := public.generate_raffle_code();
  end if;

  return new;
end;
$$;

drop trigger if exists set_raffle_participant_code_trigger on public.raffle_participants;
create trigger set_raffle_participant_code_trigger
before insert or update on public.raffle_participants
for each row
execute function public.set_raffle_participant_code();

create or replace function public.run_raffle_draw(p_prize_id uuid)
returns table (
  draw_id uuid,
  prize_id uuid,
  prize_title text,
  draw_number integer,
  winner_participant_id uuid,
  winner_code text,
  winner_name text,
  drawn_at timestamptz
)
language plpgsql
as $$
declare
  v_prize public.raffle_prizes%rowtype;
  v_winner public.raffle_participants%rowtype;
  v_next_draw_number integer;
begin
  select *
  into v_prize
  from public.raffle_prizes
  where id = p_prize_id
  for update;

  if not found then
    raise exception 'Ödül bulunamadı.';
  end if;

  if not v_prize.is_active then
    raise exception 'Ödül pasif durumda.';
  end if;

  select coalesce(max(d.draw_number), 0) + 1
  into v_next_draw_number
  from public.raffle_draws d
  where d.prize_id = p_prize_id;

  if v_next_draw_number > v_prize.quantity then
    raise exception 'Bu ödül için çekiliş kotası doldu.';
  end if;

  select p.*
  into v_winner
  from public.raffle_participants p
  where p.is_active = true
    and not exists (
      select 1
      from public.raffle_draws d
      where d.prize_id = p_prize_id
        and d.winner_participant_id = p.id
    )
    and (
      v_prize.allow_previous_winner
      or not exists (
        select 1
        from public.raffle_draws d2
        where d2.winner_participant_id = p.id
      )
    )
  order by random()
  limit 1
  for update skip locked;

  if not found then
    raise exception 'Uygun katılımcı kalmadı.';
  end if;

  insert into public.raffle_draws (
    prize_id,
    winner_participant_id,
    draw_number,
    winner_code_snapshot,
    winner_name_snapshot
  )
  values (
    p_prize_id,
    v_winner.id,
    v_next_draw_number,
    v_winner.participant_code,
    v_winner.full_name
  )
  returning
    raffle_draws.id,
    raffle_draws.drawn_at
  into
    draw_id,
    drawn_at;

  prize_id := v_prize.id;
  prize_title := v_prize.title;
  draw_number := v_next_draw_number;
  winner_participant_id := v_winner.id;
  winner_code := v_winner.participant_code;
  winner_name := v_winner.full_name;

  return next;
end;
$$;

revoke all on function public.run_raffle_draw(uuid) from anon, authenticated;
grant execute on function public.run_raffle_draw(uuid) to service_role;

-- Improve realtime payload quality for inserts/updates
alter table public.attendee_feedbacks replica identity full;
alter table public.congress_analytics replica identity full;
alter table public.live_polls replica identity full;
alter table public.networking_profiles replica identity full;
alter table public.raffle_participants replica identity full;
alter table public.raffle_prizes replica identity full;
alter table public.raffle_draws replica identity full;

-- Enable Row Level Security
alter table public.attendee_feedbacks enable row level security;
alter table public.congress_analytics enable row level security;
alter table public.live_polls enable row level security;
alter table public.networking_profiles enable row level security;
alter table public.raffle_participants enable row level security;
alter table public.raffle_prizes enable row level security;
alter table public.raffle_draws enable row level security;

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

drop policy if exists "public_can_insert_networking_profiles" on public.networking_profiles;
create policy "public_can_insert_networking_profiles"
  on public.networking_profiles
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "public_can_read_networking_profiles" on public.networking_profiles;
create policy "public_can_read_networking_profiles"
  on public.networking_profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_can_read_raffle_participants" on public.raffle_participants;
drop policy if exists "public_can_insert_raffle_participants" on public.raffle_participants;
drop policy if exists "public_can_read_raffle_prizes" on public.raffle_prizes;
drop policy if exists "public_can_insert_raffle_prizes" on public.raffle_prizes;
drop policy if exists "public_can_read_raffle_draws" on public.raffle_draws;
drop policy if exists "public_can_insert_raffle_draws" on public.raffle_draws;

-- Service role bypasses RLS, no public insert/update policies for analytics.

grant usage on schema public to anon, authenticated;
grant select, insert on public.attendee_feedbacks to anon, authenticated;
grant select on public.congress_analytics to anon, authenticated;
grant select, insert on public.networking_profiles to anon, authenticated;
revoke all on public.live_polls from anon, authenticated;
revoke all on public.raffle_participants from anon, authenticated;
revoke all on public.raffle_prizes from anon, authenticated;
revoke all on public.raffle_draws from anon, authenticated;

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

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'networking_profiles'
  ) then
    alter publication supabase_realtime add table public.networking_profiles;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raffle_participants'
  ) then
    alter publication supabase_realtime add table public.raffle_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raffle_prizes'
  ) then
    alter publication supabase_realtime add table public.raffle_prizes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raffle_draws'
  ) then
    alter publication supabase_realtime add table public.raffle_draws;
  end if;
end
$$;
