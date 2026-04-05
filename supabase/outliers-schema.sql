-- DentCo Outliers — Full Schema
-- Run this in your Supabase SQL editor

create extension if not exists pgcrypto;

-- ─── Attendees ──────────────────────────────────────────────────────────────
create table if not exists public.attendees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  role        text not null check (role in ('Student','Clinician','Academic','Entrepreneur','Industry')),
  instagram   text,
  avatar_url  text,
  outlier_score integer not null default 0 check (outlier_score between 0 and 100),
  points      integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── Sessions ───────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  speaker    text,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  active     boolean not null default false
);

create unique index if not exists sessions_single_active_idx
  on public.sessions (active) where active = true;

-- ─── Questions ──────────────────────────────────────────────────────────────
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 200),
  votes       integer not null default 0,
  answered    boolean not null default false,
  pinned      boolean not null default false,
  session_id  uuid references public.sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists questions_session_votes_idx
  on public.questions (session_id, votes desc, created_at desc);

create table if not exists public.question_upvotes (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (question_id, attendee_id)
);

-- ─── Polls ──────────────────────────────────────────────────────────────────
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (char_length(question) between 1 and 200),
  options    jsonb not null default '[]'::jsonb,
  results    jsonb not null default '{}'::jsonb,
  active     boolean not null default false,
  session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists polls_single_active_idx
  on public.polls (active) where active = true;

create table if not exists public.poll_votes (
  id           uuid primary key default gen_random_uuid(),
  poll_id      uuid not null references public.polls(id) on delete cascade,
  attendee_id  uuid not null references public.attendees(id) on delete cascade,
  option_index integer not null,
  created_at   timestamptz not null default now(),
  unique (poll_id, attendee_id)
);

-- ─── Reactions ──────────────────────────────────────────────────────────────
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  emoji       text not null check (emoji in ('🔥','💡','🤯','👏','❓')),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  session_id  uuid references public.sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists reactions_session_created_idx
  on public.reactions (session_id, created_at desc);

-- ─── Networking Matches ──────────────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  attendee_a  uuid not null references public.attendees(id) on delete cascade,
  attendee_b  uuid not null references public.attendees(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at  timestamptz not null default now(),
  check (attendee_a <> attendee_b),
  unique (attendee_a, attendee_b)
);

create index if not exists matches_attendee_a_idx on public.matches (attendee_a, status);
create index if not exists matches_attendee_b_idx on public.matches (attendee_b, status);

-- ─── Messages ───────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.attendees(id) on delete cascade,
  receiver_id uuid not null references public.attendees(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 500),
  created_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists messages_conversation_idx
  on public.messages (least(sender_id::text, receiver_id::text), greatest(sender_id::text, receiver_id::text), created_at);

-- ─── Stamps ─────────────────────────────────────────────────────────────────
create table if not exists public.stamps (
  id          uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  type        text not null check (type in ('joined','quiz_complete','question_asked','poll_voted','match_made','game_played','all_sessions')),
  earned_at   timestamptz not null default now(),
  unique (attendee_id, type)
);

-- ─── Game Scores ─────────────────────────────────────────────────────────────
create table if not exists public.game_scores (
  id          uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  score       integer not null default 0,
  wave        integer not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists game_scores_score_idx on public.game_scores (score desc);

-- ─── Replica Identity for Realtime ──────────────────────────────────────────
alter table public.attendees        replica identity full;
alter table public.questions        replica identity full;
alter table public.question_upvotes replica identity full;
alter table public.polls            replica identity full;
alter table public.poll_votes       replica identity full;
alter table public.reactions        replica identity full;
alter table public.matches          replica identity full;
alter table public.messages         replica identity full;
alter table public.sessions         replica identity full;
alter table public.stamps           replica identity full;
alter table public.game_scores      replica identity full;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.attendees        enable row level security;
alter table public.questions        enable row level security;
alter table public.question_upvotes enable row level security;
alter table public.polls            enable row level security;
alter table public.poll_votes       enable row level security;
alter table public.reactions        enable row level security;
alter table public.matches          enable row level security;
alter table public.messages         enable row level security;
alter table public.sessions         enable row level security;
alter table public.stamps           enable row level security;
alter table public.game_scores      enable row level security;

-- Attendees: read all, insert own
drop policy if exists "attendees_read_all"   on public.attendees;
drop policy if exists "attendees_insert_own" on public.attendees;
create policy "attendees_read_all"   on public.attendees for select to anon, authenticated using (true);
create policy "attendees_insert_own" on public.attendees for insert to anon, authenticated with check (true);
create policy "attendees_update_own" on public.attendees for update to anon, authenticated using (true);

-- Questions: public read/insert, update via service role
drop policy if exists "questions_read_all"   on public.questions;
drop policy if exists "questions_insert"     on public.questions;
create policy "questions_read_all" on public.questions for select to anon, authenticated using (true);
create policy "questions_insert"   on public.questions for insert to anon, authenticated with check (true);

-- Question upvotes
drop policy if exists "q_upvotes_read_all" on public.question_upvotes;
drop policy if exists "q_upvotes_insert"   on public.question_upvotes;
create policy "q_upvotes_read_all" on public.question_upvotes for select to anon, authenticated using (true);
create policy "q_upvotes_insert"   on public.question_upvotes for insert to anon, authenticated with check (true);

-- Polls: public read
drop policy if exists "polls_read_all" on public.polls;
create policy "polls_read_all" on public.polls for select to anon, authenticated using (true);

-- Poll votes
drop policy if exists "poll_votes_read_all" on public.poll_votes;
drop policy if exists "poll_votes_insert"   on public.poll_votes;
create policy "poll_votes_read_all" on public.poll_votes for select to anon, authenticated using (true);
create policy "poll_votes_insert"   on public.poll_votes for insert to anon, authenticated with check (true);

-- Reactions
drop policy if exists "reactions_read_all" on public.reactions;
drop policy if exists "reactions_insert"   on public.reactions;
create policy "reactions_read_all" on public.reactions for select to anon, authenticated using (true);
create policy "reactions_insert"   on public.reactions for insert to anon, authenticated with check (true);

-- Matches
drop policy if exists "matches_read_all" on public.matches;
drop policy if exists "matches_insert"   on public.matches;
drop policy if exists "matches_update"   on public.matches;
create policy "matches_read_all" on public.matches for select to anon, authenticated using (true);
create policy "matches_insert"   on public.matches for insert to anon, authenticated with check (true);
create policy "matches_update"   on public.matches for update to anon, authenticated using (true);

-- Messages
drop policy if exists "messages_read_all" on public.messages;
drop policy if exists "messages_insert"   on public.messages;
create policy "messages_read_all" on public.messages for select to anon, authenticated using (true);
create policy "messages_insert"   on public.messages for insert to anon, authenticated with check (true);

-- Sessions: public read
drop policy if exists "sessions_read_all" on public.sessions;
create policy "sessions_read_all" on public.sessions for select to anon, authenticated using (true);

-- Stamps
drop policy if exists "stamps_read_all" on public.stamps;
drop policy if exists "stamps_insert"   on public.stamps;
create policy "stamps_read_all" on public.stamps for select to anon, authenticated using (true);
create policy "stamps_insert"   on public.stamps for insert to anon, authenticated with check (true);

-- Game scores
drop policy if exists "game_scores_read_all" on public.game_scores;
drop policy if exists "game_scores_insert"   on public.game_scores;
create policy "game_scores_read_all" on public.game_scores for select to anon, authenticated using (true);
create policy "game_scores_insert"   on public.game_scores for insert to anon, authenticated with check (true);

-- ─── Grants ─────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.attendees        to anon, authenticated;
grant select, insert         on public.questions        to anon, authenticated;
grant select, insert         on public.question_upvotes to anon, authenticated;
grant select                 on public.polls            to anon, authenticated;
grant select, insert         on public.poll_votes       to anon, authenticated;
grant select, insert         on public.reactions        to anon, authenticated;
grant select, insert, update on public.matches          to anon, authenticated;
grant select, insert         on public.messages         to anon, authenticated;
grant select                 on public.sessions         to anon, authenticated;
grant select, insert         on public.stamps           to anon, authenticated;
grant select, insert         on public.game_scores      to anon, authenticated;

-- ─── Realtime Publication ────────────────────────────────────────────────────
do $$ begin
  perform pg_publication_tables.tablename
  from pg_publication_tables
  where pubname = 'supabase_realtime' and tablename = 'attendees';
  if not found then
    alter publication supabase_realtime add table public.attendees;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='questions') then
    alter publication supabase_realtime add table public.questions;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='question_upvotes') then
    alter publication supabase_realtime add table public.question_upvotes;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='polls') then
    alter publication supabase_realtime add table public.polls;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='poll_votes') then
    alter publication supabase_realtime add table public.poll_votes;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='reactions') then
    alter publication supabase_realtime add table public.reactions;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='matches') then
    alter publication supabase_realtime add table public.matches;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='sessions') then
    alter publication supabase_realtime add table public.sessions;
  end if; end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='game_scores') then
    alter publication supabase_realtime add table public.game_scores;
  end if; end $$;
