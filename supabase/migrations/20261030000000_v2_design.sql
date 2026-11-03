-- 나도으른 — 스키마 v2 (디자인 v2: 통금·오늘의 상황·AI 프로필·사진 사용 동의·초대·편집 버전·SOS 선택/응답/취소)
-- 적용: supabase db query --linked --file 또는 supabase db push. 중복 실행 가능.

-- =========================================================
-- 1. profiles: 통금·알림 설정
-- =========================================================
alter table public.profiles add column if not exists curfew_time time not null default '23:00';
alter table public.profiles add column if not exists curfew_notify_minutes int not null default 30
  check (curfew_notify_minutes between 0 and 180);
alter table public.profiles add column if not exists notify_curfew boolean not null default true;
alter table public.profiles add column if not exists notify_sos boolean not null default true;
alter table public.profiles add column if not exists notify_response boolean not null default true;
alter table public.profiles add column if not exists theme text not null default 'system'
  check (theme in ('light', 'dark', 'system'));
alter table public.profiles add column if not exists phone text check (phone is null or char_length(phone) <= 30);
alter table public.profiles add column if not exists curfew_notified_on date;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- =========================================================
-- 2. image_generations: 모드 확장 + 버전·장소 태그·파라미터
-- =========================================================
alter table public.image_generations drop constraint if exists image_generations_mode_check;
alter table public.image_generations add constraint image_generations_mode_check
  check (mode in ('add_friend', 'new_background', 'merge_background', 'background_swap', 'background_create', 'hairstyle', 'situation', 'edit'));
alter table public.image_generations add column if not exists parent_id uuid references public.image_generations(id) on delete set null;
alter table public.image_generations add column if not exists version int not null default 1;
alter table public.image_generations add column if not exists place_tag text check (place_tag is null or char_length(place_tag) <= 60);
alter table public.image_generations add column if not exists params jsonb;
alter table public.image_generations add column if not exists updated_at timestamptz not null default now();

-- =========================================================
-- 3. SOS: 상황 스냅샷·취소·응답
-- =========================================================
alter table public.sos_requests add column if not exists situation_snapshot jsonb;
alter table public.sos_requests add column if not exists cancelled_at timestamptz;
alter table public.sos_recipients drop constraint if exists sos_recipients_push_status_check;
alter table public.sos_recipients add constraint sos_recipients_push_status_check
  check (push_status in ('pending', 'sent', 'no_subscription', 'failed', 'muted'));
alter table public.sos_recipients add column if not exists response text check (response is null or response in ('available', 'unavailable'));
alter table public.sos_recipients add column if not exists responded_at timestamptz;

-- =========================================================
-- 4. 새 테이블
-- =========================================================
create table if not exists public.situations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_date date not null,
  end_date date,
  weather text check (weather is null or weather in ('sunny', 'cloudy', 'rain', 'snow')),
  place text not null default '' check (char_length(place) <= 80),
  companion text not null default '' check (char_length(companion) <= 80),
  scene text not null default '' check (char_length(scene) <= 200),
  memo text not null default '' check (char_length(memo) <= 500),
  chosen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint situations_range check (end_date is null or end_date >= target_date)
);
create index if not exists situations_user_date_idx on public.situations (user_id, target_date desc);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('front', 'left', 'right', 'full', 'extra')),
  storage_path text not null,
  media_type text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);
create index if not exists profile_photos_user_idx on public.profile_photos (user_id);

create table if not exists public.photo_consents (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  grantee_id uuid not null references public.profiles(id) on delete cascade,
  granted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (owner_id, grantee_id),
  constraint photo_consents_not_self check (owner_id <> grantee_id)
);

create table if not exists public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz
);

-- =========================================================
-- 5. 권한 함수
-- =========================================================
create or replace function public.has_photo_consent(owner uuid, grantee uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select owner is not null and grantee is not null and owner <> grantee
    and public.is_friend(owner, grantee)
    and exists (select 1 from public.photo_consents c where c.owner_id = owner and c.grantee_id = grantee and c.granted);
$$;
revoke all on function public.has_photo_consent(uuid, uuid) from public, anon;
grant execute on function public.has_photo_consent(uuid, uuid) to authenticated, service_role;

-- =========================================================
-- 6. 테이블 권한 + RLS
-- =========================================================
grant select, insert, update, delete on table public.situations, public.profile_photos, public.photo_consents, public.friend_invites to authenticated;
grant all on table public.situations, public.profile_photos, public.photo_consents, public.friend_invites to service_role;
revoke all on table public.situations, public.profile_photos, public.photo_consents, public.friend_invites from anon;
revoke truncate, references, trigger on table public.situations, public.profile_photos, public.photo_consents, public.friend_invites from authenticated;

alter table public.situations enable row level security;
alter table public.profile_photos enable row level security;
alter table public.photo_consents enable row level security;
alter table public.friend_invites enable row level security;

drop policy if exists situations_own on public.situations;
create policy situations_own on public.situations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists profile_photos_select on public.profile_photos;
create policy profile_photos_select on public.profile_photos
  for select to authenticated using (user_id = auth.uid() or public.has_photo_consent(user_id, auth.uid()));
drop policy if exists profile_photos_insert on public.profile_photos;
create policy profile_photos_insert on public.profile_photos
  for insert to authenticated with check (user_id = auth.uid() and storage_path like auth.uid()::text || '/profile/%');
drop policy if exists profile_photos_delete on public.profile_photos;
create policy profile_photos_delete on public.profile_photos
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists photo_consents_owner on public.photo_consents;
create policy photo_consents_owner on public.photo_consents
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_friend(owner_id, grantee_id));
drop policy if exists photo_consents_grantee_select on public.photo_consents;
create policy photo_consents_grantee_select on public.photo_consents
  for select to authenticated using (grantee_id = auth.uid());

drop policy if exists friend_invites_inviter on public.friend_invites;
create policy friend_invites_inviter on public.friend_invites
  for all to authenticated using (inviter_id = auth.uid()) with check (inviter_id = auth.uid());

-- =========================================================
-- 7. RPC
-- =========================================================
-- SOS 생성 v2: 수신자 선택(null = 친구 전원) + 상황 스냅샷. 동일 idempotency_key 는 기존 요청 반환.
drop function if exists public.create_sos_request(text, text);
create or replace function public.create_sos_request(p_idempotency_key text, p_message text, p_recipient_ids uuid[] default null, p_snapshot jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_targets uuid[];
  v_friends uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 or char_length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  if p_message is null or char_length(p_message) = 0 or char_length(p_message) > 200 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  select r.id into v_id from public.sos_requests r
   where r.sender_id = v_uid and r.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('request_id', v_id, 'created', false);
  end if;

  select coalesce(array_agg(case when f.user_low = v_uid then f.user_high else f.user_low end), '{}') into v_friends
    from public.friendships f where v_uid in (f.user_low, f.user_high);
  if coalesce(array_length(v_friends, 1), 0) = 0 then
    raise exception 'no_friends' using errcode = 'P0001';
  end if;

  if p_recipient_ids is null then
    v_targets := v_friends;
  else
    select coalesce(array_agg(distinct x), '{}') into v_targets from unnest(p_recipient_ids) as x where x = any(v_friends);
    if coalesce(array_length(v_targets, 1), 0) = 0 then
      raise exception 'no_friends' using errcode = 'P0001';
    end if;
    if array_length(v_targets, 1) <> (select count(distinct x) from unnest(p_recipient_ids) as x) then
      raise exception 'invalid_recipient' using errcode = '22023';
    end if;
  end if;

  begin
    insert into public.sos_requests (sender_id, message, idempotency_key, situation_snapshot)
    values (v_uid, p_message, p_idempotency_key, p_snapshot)
    returning id into v_id;
  exception when unique_violation then
    select r.id into v_id from public.sos_requests r
     where r.sender_id = v_uid and r.idempotency_key = p_idempotency_key;
    return jsonb_build_object('request_id', v_id, 'created', false);
  end;

  insert into public.sos_recipients (request_id, recipient_id)
  select v_id, t from unnest(v_targets) as t
  on conflict do nothing;

  return jsonb_build_object('request_id', v_id, 'created', true);
end;
$$;

-- 수신자 응답: 확인·통화 가능 / 응답 불가. 최초 열람도 함께 기록한다.
create or replace function public.respond_sos(p_request_id uuid, p_response text)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ts timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_response not in ('available', 'unavailable') then
    raise exception 'invalid_response' using errcode = '22023';
  end if;
  if exists (select 1 from public.sos_requests r where r.id = p_request_id and r.cancelled_at is not null) then
    raise exception 'cancelled' using errcode = 'P0001';
  end if;
  update public.sos_recipients
     set response = p_response, responded_at = now(), first_read_at = coalesce(first_read_at, now())
   where request_id = p_request_id and recipient_id = v_uid
  returning responded_at into v_ts;
  if not found then
    raise exception 'not_a_recipient' using errcode = '42501';
  end if;
  return v_ts;
end;
$$;

-- 발신자의 요청 취소
create or replace function public.cancel_sos(p_request_id uuid)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ts timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.sos_requests set cancelled_at = coalesce(cancelled_at, now())
   where id = p_request_id and sender_id = v_uid
  returning cancelled_at into v_ts;
  if not found then
    raise exception 'not_sender' using errcode = '42501';
  end if;
  return v_ts;
end;
$$;

-- 발신자·수신자 모두 볼 수 있는 전원 상태 (이름 포함)
create or replace function public.sos_status(p_request_id uuid)
returns table (recipient_id uuid, display_name text, first_read_at timestamptz, push_status text, response text, responded_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.sos_requests r where r.id = p_request_id
      and (r.sender_id = v_uid or exists (select 1 from public.sos_recipients rc where rc.request_id = r.id and rc.recipient_id = v_uid))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select rc.recipient_id, p.display_name, rc.first_read_at, rc.push_status, rc.response, rc.responded_at
      from public.sos_recipients rc join public.profiles p on p.id = rc.recipient_id
     where rc.request_id = p_request_id
     order by p.display_name, p.id;
end;
$$;

-- 초대 링크 정보 (로그인 사용자 누구나 토큰으로 조회)
create or replace function public.invite_info(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_row public.friend_invites%rowtype;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_row from public.friend_invites where token = p_token;
  if not found then
    return null;
  end if;
  select display_name into v_name from public.profiles where id = v_row.inviter_id;
  return jsonb_build_object('id', v_row.id, 'token', v_row.token, 'inviter_id', v_row.inviter_id, 'inviter_name', v_name,
    'created_at', v_row.created_at, 'expires_at', v_row.expires_at, 'accepted_by', v_row.accepted_by, 'accepted_at', v_row.accepted_at);
end;
$$;

-- 초대 수락: 친구 관계 생성 (정렬된 쌍)
create or replace function public.accept_friend_invite(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friend_invites%rowtype;
  v_name text;
  v_already boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_row from public.friend_invites where token = p_token for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.inviter_id = v_uid then
    raise exception 'self' using errcode = 'P0001';
  end if;
  if v_row.expires_at < now() then
    raise exception 'expired' using errcode = 'P0001';
  end if;
  if v_row.accepted_at is not null and v_row.accepted_by is distinct from v_uid then
    raise exception 'used' using errcode = 'P0001';
  end if;
  v_already := public.is_friend(v_uid, v_row.inviter_id);
  insert into public.friendships (user_low, user_high)
  values (least(v_uid, v_row.inviter_id), greatest(v_uid, v_row.inviter_id))
  on conflict do nothing;
  update public.friend_invites set accepted_by = v_uid, accepted_at = coalesce(accepted_at, now()) where id = v_row.id;
  select display_name into v_name from public.profiles where id = v_row.inviter_id;
  return jsonb_build_object('friend_id', v_row.inviter_id, 'friend_name', v_name, 'already_friends', v_already);
end;
$$;

revoke all on function public.create_sos_request(text, text, uuid[], jsonb) from public, anon;
revoke all on function public.respond_sos(uuid, text) from public, anon;
revoke all on function public.cancel_sos(uuid) from public, anon;
revoke all on function public.sos_status(uuid) from public, anon;
revoke all on function public.invite_info(text) from public, anon;
revoke all on function public.accept_friend_invite(text) from public, anon;
grant execute on function public.create_sos_request(text, text, uuid[], jsonb) to authenticated, service_role;
grant execute on function public.respond_sos(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_sos(uuid) to authenticated, service_role;
grant execute on function public.sos_status(uuid) to authenticated, service_role;
grant execute on function public.invite_info(text) to authenticated, service_role;
grant execute on function public.accept_friend_invite(text) to authenticated, service_role;
