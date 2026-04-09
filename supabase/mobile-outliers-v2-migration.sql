-- Mobile Outliers V2 (non-destructive)
-- Run in Supabase SQL editor for existing projects.

create extension if not exists pgcrypto;

alter table if exists public.attendees
  add column if not exists class_level text;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'attendees'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'attendees_class_level_check'
      and conrelid = 'public.attendees'::regclass
  ) then
    alter table public.attendees
      add constraint attendees_class_level_check
      check (class_level is null or class_level in ('Hazırlık', '1', '2', '3', '4', '5', 'Mezun'));
  end if;
end $$;

create table if not exists public.event_gallery_items (
  id uuid primary key default gen_random_uuid(),
  uploader_name text not null check (char_length(uploader_name) between 2 and 120),
  caption text check (caption is null or char_length(caption) <= 280),
  media_type text not null check (media_type in ('photo', 'video')),
  mime_type text not null check (char_length(mime_type) between 3 and 120),
  file_path text not null unique check (char_length(file_path) between 4 and 260),
  public_url text not null check (char_length(public_url) between 10 and 1024),
  file_size bigint not null check (file_size > 0 and file_size <= 2147483648),
  drive_backup_status text not null default 'pending' check (drive_backup_status in ('pending', 'synced', 'failed', 'disabled')),
  drive_file_id text,
  drive_error text,
  created_at timestamptz not null default now()
);

create index if not exists event_gallery_items_created_idx
  on public.event_gallery_items (created_at desc);

create index if not exists event_gallery_items_media_type_idx
  on public.event_gallery_items (media_type, created_at desc);

create table if not exists public.networking_gallery_likes (
  id uuid primary key default gen_random_uuid(),
  gallery_item_id uuid not null references public.event_gallery_items(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gallery_item_id, attendee_id)
);

create index if not exists networking_gallery_likes_item_idx
  on public.networking_gallery_likes (gallery_item_id, created_at desc);

create index if not exists networking_gallery_likes_attendee_idx
  on public.networking_gallery_likes (attendee_id, created_at desc);

create table if not exists public.networking_gallery_comments (
  id uuid primary key default gen_random_uuid(),
  gallery_item_id uuid not null references public.event_gallery_items(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists networking_gallery_comments_item_idx
  on public.networking_gallery_comments (gallery_item_id, created_at desc);

create index if not exists networking_gallery_comments_attendee_idx
  on public.networking_gallery_comments (attendee_id, created_at desc);
