-- Apple App Review Guideline 1.2 moderation support for the mobile UGC surfaces.

alter table public.event_gallery_items
  add column if not exists uploader_attendee_id uuid references public.attendees(id) on delete set null;

create index if not exists event_gallery_items_uploader_attendee_idx
  on public.event_gallery_items (uploader_attendee_id, created_at desc)
  where uploader_attendee_id is not null;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_attendee_id uuid not null references public.attendees(id) on delete cascade,
  target_attendee_id uuid references public.attendees(id) on delete set null,
  target_type text not null check (target_type in ('gallery_post', 'gallery_comment', 'networking_profile', 'live_question')),
  target_id uuid,
  action text not null default 'report' check (action in ('report', 'block', 'auto_filter')),
  reason text not null default 'objectionable_content' check (char_length(reason) between 1 and 240),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at asc);

create index if not exists content_reports_target_attendee_idx
  on public.content_reports (target_attendee_id, created_at desc)
  where target_attendee_id is not null;

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_attendee_id uuid not null references public.attendees(id) on delete cascade,
  blocked_attendee_id uuid not null references public.attendees(id) on delete cascade,
  reason text not null default 'abusive_user' check (char_length(reason) between 1 and 240),
  source_report_id uuid references public.content_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (blocker_attendee_id, blocked_attendee_id),
  check (blocker_attendee_id <> blocked_attendee_id)
);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_attendee_id, created_at desc);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_attendee_id, created_at desc);

alter table public.content_reports replica identity full;
alter table public.user_blocks replica identity full;
alter table public.content_reports enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists content_reports_insert on public.content_reports;
drop policy if exists user_blocks_read_all on public.user_blocks;
drop policy if exists user_blocks_insert on public.user_blocks;
drop policy if exists user_blocks_update on public.user_blocks;

create policy content_reports_insert on public.content_reports for insert to anon, authenticated with check (true);
create policy user_blocks_read_all on public.user_blocks for select to anon, authenticated using (true);
create policy user_blocks_insert on public.user_blocks for insert to anon, authenticated with check (true);
create policy user_blocks_update on public.user_blocks for update to anon, authenticated using (true);

grant insert on public.content_reports to anon, authenticated;
grant select, insert, update on public.user_blocks to anon, authenticated;
