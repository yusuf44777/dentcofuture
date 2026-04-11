-- Creates one fake participant and auto-links it to the latest real logged-in attendee
-- so you can test matches + thread UI quickly.
--
-- Run this in Supabase SQL Editor.

do $$
declare
  v_real_attendee_id uuid;
  v_real_profile_id uuid;
  v_fake_attendee_id uuid;
  v_fake_profile_id uuid;
  v_attendee_a uuid;
  v_attendee_b uuid;
begin
  -- Pick the most recently created real attendee (auth-linked).
  select id
  into v_real_attendee_id
  from public.attendees
  where auth_user_id is not null
  order by created_at desc
  limit 1;

  if v_real_attendee_id is null then
    raise exception 'Önce en az bir gerçek kullanıcıyla mobil giriş yap.';
  end if;

  -- Upsert fake attendee.
  select id
  into v_fake_attendee_id
  from public.attendees
  where instagram = 'seed_fake_chat'
  limit 1;

  if v_fake_attendee_id is null then
    insert into public.attendees (
      auth_user_id,
      name,
      role,
      class_level,
      instagram,
      linkedin,
      outlier_score,
      points
    )
    values (
      null,
      'Demo Fake User',
      'Academic',
      null,
      'seed_fake_chat',
      'https://linkedin.com/in/seed-fake-chat',
      77,
      150
    )
    returning id into v_fake_attendee_id;
  else
    update public.attendees
    set
      name = 'Demo Fake User',
      role = 'Academic',
      class_level = null,
      linkedin = 'https://linkedin.com/in/seed-fake-chat',
      outlier_score = 77
    where id = v_fake_attendee_id;
  end if;

  -- Ensure real profile exists.
  select id
  into v_real_profile_id
  from public.networking_profiles
  where attendee_id = v_real_attendee_id
  limit 1;

  if v_real_profile_id is null then
    insert into public.networking_profiles (
      attendee_id,
      full_name,
      headline,
      interest_area,
      goal,
      topics,
      collaboration_goals,
      languages,
      contact_info,
      is_visible,
      profile_completion_score,
      last_active_at
    )
    select
      a.id,
      a.name,
      a.role,
      'Ortodonti',
      'Klinik',
      '["Digital workflow"]'::jsonb,
      '["Mentorluk"]'::jsonb,
      '["Türkçe"]'::jsonb,
      format('{"instagram":"%s","linkedin":"%s"}', coalesce(a.instagram, ''), coalesce(a.linkedin, '')),
      true,
      72,
      now()
    from public.attendees a
    where a.id = v_real_attendee_id
    returning id into v_real_profile_id;
  else
    update public.networking_profiles
    set
      is_visible = true,
      last_active_at = now()
    where id = v_real_profile_id;
  end if;

  -- Ensure fake profile exists.
  select id
  into v_fake_profile_id
  from public.networking_profiles
  where attendee_id = v_fake_attendee_id
  limit 1;

  if v_fake_profile_id is null then
    insert into public.networking_profiles (
      attendee_id,
      full_name,
      headline,
      interest_area,
      goal,
      topics,
      collaboration_goals,
      languages,
      contact_info,
      is_visible,
      profile_completion_score,
      last_active_at
    )
    values (
      v_fake_attendee_id,
      'Demo Fake User',
      'Academic',
      'Ortodonti',
      'Klinik',
      '["Digital workflow","Ekip yönetimi"]'::jsonb,
      '["Vaka tartışması"]'::jsonb,
      '["Türkçe"]'::jsonb,
      '{"instagram":"seed_fake_chat","linkedin":"https://linkedin.com/in/seed-fake-chat"}',
      true,
      78,
      now()
    )
    returning id into v_fake_profile_id;
  else
    update public.networking_profiles
    set
      full_name = 'Demo Fake User',
      headline = 'Academic',
      is_visible = true,
      last_active_at = now()
    where id = v_fake_profile_id;
  end if;

  -- Mutual likes.
  insert into public.networking_profile_actions (actor_profile_id, target_profile_id, action)
  values (v_real_profile_id, v_fake_profile_id, 'like')
  on conflict (actor_profile_id, target_profile_id)
  do update set action = excluded.action, updated_at = now();

  insert into public.networking_profile_actions (actor_profile_id, target_profile_id, action)
  values (v_fake_profile_id, v_real_profile_id, 'like')
  on conflict (actor_profile_id, target_profile_id)
  do update set action = excluded.action, updated_at = now();

  -- Accepted match (attendee_a must be lexicographically smaller).
  if v_real_attendee_id::text < v_fake_attendee_id::text then
    v_attendee_a := v_real_attendee_id;
    v_attendee_b := v_fake_attendee_id;
  else
    v_attendee_a := v_fake_attendee_id;
    v_attendee_b := v_real_attendee_id;
  end if;

  insert into public.matches (attendee_a, attendee_b, status)
  values (v_attendee_a, v_attendee_b, 'accepted')
  on conflict (attendee_a, attendee_b)
  do update set status = 'accepted';

  -- Seed chat messages.
  delete from public.messages
  where text like '[SEED CHAT AUTO]%'
    and (
      (sender_id = v_real_attendee_id and receiver_id = v_fake_attendee_id)
      or
      (sender_id = v_fake_attendee_id and receiver_id = v_real_attendee_id)
    );

  insert into public.messages (sender_id, receiver_id, text, created_at) values
    (v_real_attendee_id, v_fake_attendee_id, '[SEED CHAT AUTO] Merhaba, test için yazıyorum.', now() - interval '8 minutes'),
    (v_fake_attendee_id, v_real_attendee_id, '[SEED CHAT AUTO] Selam, mesajın geldi.', now() - interval '6 minutes'),
    (v_real_attendee_id, v_fake_attendee_id, '[SEED CHAT AUTO] Sohbet ekranını kontrol ediyorum.', now() - interval '3 minutes'),
    (v_fake_attendee_id, v_real_attendee_id, '[SEED CHAT AUTO] Her şey çalışıyor görünüyor.', now() - interval '1 minute');
end $$;

-- Quick check
select
  a.id,
  a.auth_user_id,
  a.name,
  a.role,
  a.instagram,
  p.id as profile_id
from public.attendees a
left join public.networking_profiles p on p.attendee_id = a.id
where a.instagram = 'seed_fake_chat'
order by a.created_at desc;
