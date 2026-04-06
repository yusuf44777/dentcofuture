-- DentCo Outlier - Full Supabase Schema (Reset)
-- WARNING: This script drops and recreates application tables.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Drop existing app objects (safe for clean reset)
-- -----------------------------------------------------------------------------
drop table if exists public.staff_operation_audits cascade;
drop table if exists public.staff_roles cascade;
drop table if exists public.mobile_allowed_participants cascade;

drop table if exists public.poll_votes cascade;
drop table if exists public.question_upvotes cascade;
drop table if exists public.messages cascade;
drop table if exists public.matches cascade;
drop table if exists public.reactions cascade;
drop table if exists public.questions cascade;
drop table if exists public.polls cascade;
drop table if exists public.sessions cascade;
drop table if exists public.stamps cascade;
drop table if exists public.game_scores cascade;

drop table if exists public.networking_profile_actions cascade;
drop table if exists public.networking_profiles cascade;

drop table if exists public.raffle_draws cascade;
drop table if exists public.raffle_prizes cascade;
drop table if exists public.raffle_participants cascade;

drop table if exists public.live_poll_presets cascade;
drop table if exists public.live_polls cascade;

drop table if exists public.attendee_feedbacks cascade;
drop table if exists public.congress_analytics cascade;
drop table if exists public.attendees cascade;

drop function if exists public.run_raffle_draw(uuid) cascade;
drop function if exists public.set_raffle_participant_code() cascade;
drop function if exists public.generate_raffle_code() cascade;
drop function if exists public.normalize_raffle_code(text) cascade;
drop function if exists public.increment_points(uuid, integer) cascade;
drop function if exists public.set_updated_at() cascade;

-- -----------------------------------------------------------------------------
-- Core attendee/auth tables
-- -----------------------------------------------------------------------------
create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  role text not null check (role in ('Student', 'Clinician', 'Academic', 'Entrepreneur', 'Industry')),
  instagram text,
  linkedin text,
  avatar_url text,
  outlier_score integer not null default 0 check (outlier_score between 0 and 100),
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index attendees_auth_user_id_uidx
  on public.attendees (auth_user_id)
  where auth_user_id is not null;

create table public.mobile_allowed_participants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mobile_allowed_participants_email_phone_uidx
  on public.mobile_allowed_participants (
    lower(email),
    regexp_replace(phone, '\\D+', '', 'g')
  );

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'moderator',
  capabilities jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id)
);

create index staff_roles_active_idx
  on public.staff_roles (is_active, role);

create table public.staff_operation_audits (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  attendee_id uuid references public.attendees(id) on delete set null,
  operation text not null,
  target_type text,
  target_id text,
  success boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index staff_operation_audits_created_idx
  on public.staff_operation_audits (created_at desc);

-- -----------------------------------------------------------------------------
-- Event interaction tables
-- -----------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 180),
  speaker text,
  start_time timestamptz not null default now(),
  end_time timestamptz not null default now(),
  active boolean not null default false
);

create unique index sessions_single_active_idx
  on public.sessions (active)
  where active = true;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  votes integer not null default 0 check (votes >= 0),
  answered boolean not null default false,
  pinned boolean not null default false,
  session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index questions_session_votes_idx
  on public.questions (session_id, pinned desc, votes desc, created_at asc);

create table public.question_upvotes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (question_id, attendee_id)
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 1 and 200),
  options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  results jsonb not null default '{}'::jsonb check (jsonb_typeof(results) = 'object'),
  active boolean not null default false,
  session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index polls_single_active_idx
  on public.polls (active)
  where active = true;

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 9),
  created_at timestamptz not null default now(),
  unique (poll_id, attendee_id)
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  emoji text not null check (emoji in ('🔥', '💡', '🤯', '👏', '❓')),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index reactions_session_created_idx
  on public.reactions (session_id, created_at desc);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  attendee_a uuid not null references public.attendees(id) on delete cascade,
  attendee_b uuid not null references public.attendees(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  check (attendee_a <> attendee_b),
  check ((attendee_a::text) < (attendee_b::text)),
  unique (attendee_a, attendee_b)
);

create index matches_attendee_a_idx on public.matches (attendee_a, status);
create index matches_attendee_b_idx on public.matches (attendee_b, status);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.attendees(id) on delete cascade,
  receiver_id uuid not null references public.attendees(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index messages_conversation_idx
  on public.messages (
    least(sender_id::text, receiver_id::text),
    greatest(sender_id::text, receiver_id::text),
    created_at
  );

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  type text not null check (type in ('joined', 'quiz_complete', 'question_asked', 'poll_voted', 'match_made', 'game_played', 'all_sessions')),
  earned_at timestamptz not null default now(),
  unique (attendee_id, type)
);

create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  wave integer not null default 1 check (wave >= 1),
  created_at timestamptz not null default now()
);

create index game_scores_score_idx on public.game_scores (score desc, created_at asc);

-- -----------------------------------------------------------------------------
-- Legacy analytics/live-poll tables used by web dashboard
-- -----------------------------------------------------------------------------
create table public.attendee_feedbacks (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now(),
  is_analyzed boolean not null default false
);

create table public.congress_analytics (
  id uuid primary key default gen_random_uuid(),
  total_feedbacks integer not null default 0 check (total_feedbacks >= 0),
  sentiment_score jsonb not null,
  top_keywords jsonb not null,
  created_at timestamptz not null default now()
);

create table public.live_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 6 and 180),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index live_polls_single_active_idx
  on public.live_polls (is_active)
  where is_active = true;

create table public.live_poll_presets (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 6 and 180),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Legacy profile-card networking tables
-- -----------------------------------------------------------------------------
create table public.networking_profiles (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid references public.attendees(id) on delete set null,
  full_name text not null check (char_length(full_name) <= 120),
  headline text,
  interest_area text not null check (char_length(interest_area) <= 120),
  goal text not null check (char_length(goal) <= 120),
  profession text,
  city text,
  institution_name text,
  years_experience integer check (years_experience is null or (years_experience >= 0 and years_experience <= 60)),
  bio text,
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics) = 'array'),
  collaboration_goals jsonb not null default '[]'::jsonb check (jsonb_typeof(collaboration_goals) = 'array'),
  languages jsonb not null default '[]'::jsonb check (jsonb_typeof(languages) = 'array'),
  availability text,
  contact_info text,
  is_visible boolean not null default true,
  profile_completion_score integer not null default 0 check (profile_completion_score between 0 and 100),
  last_active_at timestamptz not null default now(),
  is_matched boolean not null default false,
  matched_with_id uuid references public.networking_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index networking_profiles_attendee_id_uidx
  on public.networking_profiles (attendee_id)
  where attendee_id is not null;

create index networking_profiles_match_lookup_idx
  on public.networking_profiles (interest_area, is_matched, created_at);

create index networking_profiles_visibility_activity_idx
  on public.networking_profiles (is_visible, last_active_at desc);

create index networking_profiles_city_idx
  on public.networking_profiles (city);

create index networking_profiles_topics_gin_idx
  on public.networking_profiles using gin (topics);

create index networking_profiles_collaboration_goals_gin_idx
  on public.networking_profiles using gin (collaboration_goals);

create index networking_profiles_languages_gin_idx
  on public.networking_profiles using gin (languages);

create table public.networking_profile_actions (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.networking_profiles(id) on delete cascade,
  target_profile_id uuid not null references public.networking_profiles(id) on delete cascade,
  action text not null check (action in ('like', 'pass')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_profile_id, target_profile_id),
  check (actor_profile_id <> target_profile_id)
);

create index networking_profile_actions_actor_action_idx
  on public.networking_profile_actions (actor_profile_id, action, updated_at desc);

create index networking_profile_actions_target_action_idx
  on public.networking_profile_actions (target_profile_id, action, updated_at desc);

-- -----------------------------------------------------------------------------
-- Raffle tables
-- -----------------------------------------------------------------------------
create table public.raffle_participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) <= 120),
  participant_code text not null unique check (char_length(participant_code) between 4 and 32),
  external_ref text check (char_length(external_ref) <= 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.raffle_prizes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 140),
  description text check (char_length(description) <= 300),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 100),
  allow_previous_winner boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.raffle_draws (
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

create index raffle_participants_active_idx
  on public.raffle_participants (is_active, created_at desc);

create index raffle_prizes_active_idx
  on public.raffle_prizes (is_active, created_at desc);

create index raffle_draws_prize_drawn_at_idx
  on public.raffle_draws (prize_id, drawn_at desc);

create index raffle_draws_winner_idx
  on public.raffle_draws (winner_participant_id);

-- -----------------------------------------------------------------------------
-- Helper functions and triggers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

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
  returning raffle_draws.id, raffle_draws.drawn_at
  into draw_id, drawn_at;

  prize_id := v_prize.id;
  prize_title := v_prize.title;
  draw_number := v_next_draw_number;
  winner_participant_id := v_winner.id;
  winner_code := v_winner.participant_code;
  winner_name := v_winner.full_name;

  return next;
end;
$$;

create or replace function public.increment_points(p_id uuid, p_pts integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.attendees
  set points = coalesce(points, 0) + coalesce(p_pts, 0)
  where id = p_id;
end;
$$;

-- updated_at triggers
create trigger set_mobile_allowed_participants_updated_at
before update on public.mobile_allowed_participants
for each row
execute function public.set_updated_at();

create trigger set_staff_roles_updated_at
before update on public.staff_roles
for each row
execute function public.set_updated_at();

create trigger set_raffle_participants_updated_at
before update on public.raffle_participants
for each row
execute function public.set_updated_at();

create trigger set_raffle_prizes_updated_at
before update on public.raffle_prizes
for each row
execute function public.set_updated_at();

create trigger set_live_polls_updated_at
before update on public.live_polls
for each row
execute function public.set_updated_at();

create trigger set_live_poll_presets_updated_at
before update on public.live_poll_presets
for each row
execute function public.set_updated_at();

create trigger set_networking_profile_actions_updated_at
before update on public.networking_profile_actions
for each row
execute function public.set_updated_at();

create trigger set_raffle_participant_code_trigger
before insert or update on public.raffle_participants
for each row
execute function public.set_raffle_participant_code();

revoke all on function public.run_raffle_draw(uuid) from anon, authenticated;
grant execute on function public.run_raffle_draw(uuid) to service_role;

revoke all on function public.increment_points(uuid, integer) from anon, authenticated;
grant execute on function public.increment_points(uuid, integer) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Realtime and RLS
-- -----------------------------------------------------------------------------
alter table public.attendees replica identity full;
alter table public.mobile_allowed_participants replica identity full;
alter table public.staff_roles replica identity full;
alter table public.staff_operation_audits replica identity full;
alter table public.sessions replica identity full;
alter table public.questions replica identity full;
alter table public.question_upvotes replica identity full;
alter table public.polls replica identity full;
alter table public.poll_votes replica identity full;
alter table public.reactions replica identity full;
alter table public.matches replica identity full;
alter table public.messages replica identity full;
alter table public.stamps replica identity full;
alter table public.game_scores replica identity full;
alter table public.attendee_feedbacks replica identity full;
alter table public.congress_analytics replica identity full;
alter table public.live_polls replica identity full;
alter table public.live_poll_presets replica identity full;
alter table public.networking_profiles replica identity full;
alter table public.networking_profile_actions replica identity full;
alter table public.raffle_participants replica identity full;
alter table public.raffle_prizes replica identity full;
alter table public.raffle_draws replica identity full;

alter table public.attendees enable row level security;
alter table public.mobile_allowed_participants enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_operation_audits enable row level security;
alter table public.sessions enable row level security;
alter table public.questions enable row level security;
alter table public.question_upvotes enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.reactions enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.stamps enable row level security;
alter table public.game_scores enable row level security;
alter table public.attendee_feedbacks enable row level security;
alter table public.congress_analytics enable row level security;
alter table public.live_polls enable row level security;
alter table public.live_poll_presets enable row level security;
alter table public.networking_profiles enable row level security;
alter table public.networking_profile_actions enable row level security;
alter table public.raffle_participants enable row level security;
alter table public.raffle_prizes enable row level security;
alter table public.raffle_draws enable row level security;

-- Attendees
drop policy if exists attendees_read_all on public.attendees;
drop policy if exists attendees_insert_own on public.attendees;
drop policy if exists attendees_update_own on public.attendees;
create policy attendees_read_all on public.attendees for select to anon, authenticated using (true);
create policy attendees_insert_own on public.attendees for insert to anon, authenticated with check (true);
create policy attendees_update_own on public.attendees for update to anon, authenticated using (true);

-- Live interaction
drop policy if exists questions_read_all on public.questions;
drop policy if exists questions_insert on public.questions;
create policy questions_read_all on public.questions for select to anon, authenticated using (true);
create policy questions_insert on public.questions for insert to anon, authenticated with check (true);

drop policy if exists q_upvotes_read_all on public.question_upvotes;
drop policy if exists q_upvotes_insert on public.question_upvotes;
create policy q_upvotes_read_all on public.question_upvotes for select to anon, authenticated using (true);
create policy q_upvotes_insert on public.question_upvotes for insert to anon, authenticated with check (true);

drop policy if exists polls_read_all on public.polls;
create policy polls_read_all on public.polls for select to anon, authenticated using (true);

drop policy if exists poll_votes_read_all on public.poll_votes;
drop policy if exists poll_votes_insert on public.poll_votes;
create policy poll_votes_read_all on public.poll_votes for select to anon, authenticated using (true);
create policy poll_votes_insert on public.poll_votes for insert to anon, authenticated with check (true);

drop policy if exists reactions_read_all on public.reactions;
drop policy if exists reactions_insert on public.reactions;
create policy reactions_read_all on public.reactions for select to anon, authenticated using (true);
create policy reactions_insert on public.reactions for insert to anon, authenticated with check (true);

-- Networking (attendee matches/messages)
drop policy if exists matches_read_all on public.matches;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_update on public.matches;
create policy matches_read_all on public.matches for select to anon, authenticated using (true);
create policy matches_insert on public.matches for insert to anon, authenticated with check (true);
create policy matches_update on public.matches for update to anon, authenticated using (true);

drop policy if exists messages_read_all on public.messages;
drop policy if exists messages_insert on public.messages;
create policy messages_read_all on public.messages for select to anon, authenticated using (true);
create policy messages_insert on public.messages for insert to anon, authenticated with check (true);

drop policy if exists sessions_read_all on public.sessions;
create policy sessions_read_all on public.sessions for select to anon, authenticated using (true);

drop policy if exists stamps_read_all on public.stamps;
drop policy if exists stamps_insert on public.stamps;
create policy stamps_read_all on public.stamps for select to anon, authenticated using (true);
create policy stamps_insert on public.stamps for insert to anon, authenticated with check (true);

drop policy if exists game_scores_read_all on public.game_scores;
drop policy if exists game_scores_insert on public.game_scores;
create policy game_scores_read_all on public.game_scores for select to anon, authenticated using (true);
create policy game_scores_insert on public.game_scores for insert to anon, authenticated with check (true);

-- Feedback/analytics
drop policy if exists public_can_insert_feedback on public.attendee_feedbacks;
drop policy if exists public_can_read_feedback on public.attendee_feedbacks;
create policy public_can_insert_feedback on public.attendee_feedbacks for insert to anon, authenticated with check (true);
create policy public_can_read_feedback on public.attendee_feedbacks for select to anon, authenticated using (true);

drop policy if exists public_can_read_analytics on public.congress_analytics;
create policy public_can_read_analytics on public.congress_analytics for select to anon, authenticated using (true);

-- Legacy live poll tables
drop policy if exists live_polls_read_all on public.live_polls;
drop policy if exists live_poll_presets_read_all on public.live_poll_presets;
create policy live_polls_read_all on public.live_polls for select to anon, authenticated using (true);
create policy live_poll_presets_read_all on public.live_poll_presets for select to anon, authenticated using (true);

-- Legacy profile-card networking
drop policy if exists public_can_insert_networking_profiles on public.networking_profiles;
drop policy if exists public_can_read_networking_profiles on public.networking_profiles;
drop policy if exists public_can_update_networking_profiles on public.networking_profiles;
create policy public_can_insert_networking_profiles on public.networking_profiles for insert to anon, authenticated with check (true);
create policy public_can_read_networking_profiles on public.networking_profiles for select to anon, authenticated using (true);
create policy public_can_update_networking_profiles on public.networking_profiles for update to anon, authenticated using (true);

drop policy if exists public_can_read_networking_profile_actions on public.networking_profile_actions;
drop policy if exists public_can_insert_networking_profile_actions on public.networking_profile_actions;
drop policy if exists public_can_update_networking_profile_actions on public.networking_profile_actions;
create policy public_can_read_networking_profile_actions on public.networking_profile_actions for select to anon, authenticated using (true);
create policy public_can_insert_networking_profile_actions on public.networking_profile_actions for insert to anon, authenticated with check (true);
create policy public_can_update_networking_profile_actions on public.networking_profile_actions for update to anon, authenticated using (true);

-- Raffle read-only for public clients
drop policy if exists raffle_participants_read_all on public.raffle_participants;
drop policy if exists raffle_prizes_read_all on public.raffle_prizes;
drop policy if exists raffle_draws_read_all on public.raffle_draws;
create policy raffle_participants_read_all on public.raffle_participants for select to anon, authenticated using (true);
create policy raffle_prizes_read_all on public.raffle_prizes for select to anon, authenticated using (true);
create policy raffle_draws_read_all on public.raffle_draws for select to anon, authenticated using (true);

-- Staff tables (self-read)
drop policy if exists staff_roles_read_self on public.staff_roles;
drop policy if exists staff_operation_audits_read_self on public.staff_operation_audits;
create policy staff_roles_read_self
  on public.staff_roles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

create policy staff_operation_audits_read_self
  on public.staff_operation_audits
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

-- mobile_allowed_participants intentionally has no anon/auth policy.

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update on public.attendees to anon, authenticated;
grant select, insert on public.questions to anon, authenticated;
grant select, insert on public.question_upvotes to anon, authenticated;
grant select on public.polls to anon, authenticated;
grant select, insert on public.poll_votes to anon, authenticated;
grant select, insert on public.reactions to anon, authenticated;
grant select, insert, update on public.matches to anon, authenticated;
grant select, insert on public.messages to anon, authenticated;
grant select on public.sessions to anon, authenticated;
grant select, insert on public.stamps to anon, authenticated;
grant select, insert on public.game_scores to anon, authenticated;

grant select, insert on public.attendee_feedbacks to anon, authenticated;
grant select on public.congress_analytics to anon, authenticated;
grant select on public.live_polls to anon, authenticated;
grant select on public.live_poll_presets to anon, authenticated;

grant select, insert, update on public.networking_profiles to anon, authenticated;
grant select, insert, update on public.networking_profile_actions to anon, authenticated;
grant select on public.raffle_participants to anon, authenticated;
grant select on public.raffle_prizes to anon, authenticated;
grant select on public.raffle_draws to anon, authenticated;

revoke all on public.mobile_allowed_participants from anon, authenticated;
revoke all on public.staff_roles from anon, authenticated;
revoke all on public.staff_operation_audits from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime publication
-- -----------------------------------------------------------------------------
do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'attendees',
    'sessions',
    'questions',
    'question_upvotes',
    'polls',
    'poll_votes',
    'reactions',
    'matches',
    'messages',
    'stamps',
    'game_scores',
    'attendee_feedbacks',
    'congress_analytics',
    'live_polls',
    'live_poll_presets',
    'networking_profiles',
    'networking_profile_actions',
    'raffle_participants',
    'raffle_prizes',
    'raffle_draws',
    'staff_roles',
    'staff_operation_audits'
  ];
begin
  foreach table_name in array realtime_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
exception
  when undefined_object then
    null;
end
$$;
