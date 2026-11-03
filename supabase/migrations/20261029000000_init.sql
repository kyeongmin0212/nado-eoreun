-- 나도으른 — 초기 스키마 v1
-- 적용: supabase db push (linked) 또는 Supabase SQL Editor 에서 전체 실행.
-- 중복 실행 가능하도록 if not exists / or replace / drop policy if exists 를 사용한다.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. 테이블
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- 친구 관계는 정렬된 쌍(user_low < user_high) 한 행으로 저장해 중복·자기 자신 관계를 막는다.
create table if not exists public.friendships (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint friendships_ordered check (user_low < user_high)
);

create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('add_friend', 'new_background', 'merge_background')),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  storage_path text not null,
  media_type text not null default 'image/png',
  prompt_text text check (prompt_text is null or char_length(prompt_text) <= 500),
  model_id text,
  created_at timestamptz not null default now()
);
create index if not exists image_generations_owner_created_idx
  on public.image_generations (owner_id, created_at desc);

create table if not exists public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (sender_id, idempotency_key)
);
create index if not exists sos_requests_sender_created_idx
  on public.sos_requests (sender_id, created_at desc);

create table if not exists public.sos_recipients (
  request_id uuid not null references public.sos_requests(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  first_read_at timestamptz,
  push_status text not null default 'pending'
    check (push_status in ('pending', 'sent', 'no_subscription', 'failed')),
  push_error text,
  push_attempted_at timestamptz,
  primary key (request_id, recipient_id)
);
create index if not exists sos_recipients_recipient_idx on public.sos_recipients (recipient_id);
-- Realtime UPDATE 이벤트에 전체 행이 포함되도록 한다.
alter table public.sos_recipients replica identity full;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- =========================================================
-- 2. 권한 판정 함수 (security definer: RLS 재귀 방지)
-- =========================================================
create or replace function public.is_friend(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.friendships f
    where f.user_low = least(a, b) and f.user_high = greatest(a, b)
  );
$$;

create or replace function public.is_sos_sender(req uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.sos_requests r where r.id = req and r.sender_id = auth.uid());
$$;

create or replace function public.is_sos_recipient(req uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.sos_recipients rc where rc.request_id = req and rc.recipient_id = auth.uid());
$$;

-- 프로필은 본인, 친구, 그리고 SOS 로 연결된 상대(발신자↔수신자)만 볼 수 있다.
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    auth.uid() = target
    or public.is_friend(auth.uid(), target)
    or exists (
      select 1
      from public.sos_requests r
      join public.sos_recipients rc on rc.request_id = r.id
      where (r.sender_id = target and rc.recipient_id = auth.uid())
         or (r.sender_id = auth.uid() and rc.recipient_id = target)
    )
  );
$$;

revoke all on function public.is_friend(uuid, uuid) from public, anon;
revoke all on function public.is_sos_sender(uuid) from public, anon;
revoke all on function public.is_sos_recipient(uuid) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.is_friend(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_sos_sender(uuid) to authenticated, service_role;
grant execute on function public.is_sos_recipient(uuid) to authenticated, service_role;
grant execute on function public.can_view_profile(uuid) to authenticated, service_role;


-- =========================================================
-- 2-1. 테이블 권한 (새 Supabase 프로젝트는 public 테이블을 자동 노출하지 않으므로 명시적으로 부여)
--      실제 행 접근 범위는 아래 RLS 가 제한한다.
-- =========================================================
grant usage on schema public to authenticated, service_role;
grant select, update on table public.profiles to authenticated;
grant select on table public.friendships to authenticated;
grant select, insert, update, delete on table public.image_generations to authenticated;
grant select on table public.sos_requests to authenticated;
grant select on table public.sos_recipients to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant all on table
  public.profiles, public.friendships, public.image_generations,
  public.sos_requests, public.sos_recipients, public.push_subscriptions
  to service_role;
revoke all on table
  public.profiles, public.friendships, public.image_generations,
  public.sos_requests, public.sos_recipients, public.push_subscriptions
  from anon;

-- =========================================================
-- 3. RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.image_generations enable row level security;
alter table public.sos_requests enable row level security;
alter table public.sos_recipients enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: 생성은 seed(service_role)만. 본인 이름 수정만 허용.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (public.can_view_profile(id));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friendships: 자기 관계만 조회. 생성은 seed(service_role)만 (일반 친구 추가 화면은 후순위).
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated using (auth.uid() in (user_low, user_high));

-- image_generations: 본인만. 경로는 반드시 본인 폴더.
drop policy if exists image_generations_select on public.image_generations;
create policy image_generations_select on public.image_generations
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists image_generations_insert on public.image_generations;
create policy image_generations_insert on public.image_generations
  for insert to authenticated
  with check (owner_id = auth.uid() and storage_path like auth.uid()::text || '/%');
drop policy if exists image_generations_update on public.image_generations;
create policy image_generations_update on public.image_generations
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists image_generations_delete on public.image_generations;
create policy image_generations_delete on public.image_generations
  for delete to authenticated using (owner_id = auth.uid());

-- sos_requests: 발신자와 기록된 수신자만 조회. 생성은 RPC 로만.
drop policy if exists sos_requests_select on public.sos_requests;
create policy sos_requests_select on public.sos_requests
  for select to authenticated using (sender_id = auth.uid() or public.is_sos_recipient(id));

-- sos_recipients: 본인 수신 행 또는 내가 보낸 요청의 모든 수신 행 조회. 갱신은 RPC/서버만.
drop policy if exists sos_recipients_select on public.sos_recipients;
create policy sos_recipients_select on public.sos_recipients
  for select to authenticated using (recipient_id = auth.uid() or public.is_sos_sender(request_id));

-- push_subscriptions: 본인 것만. 발송 서버는 service_role 로 읽는다.
drop policy if exists push_subscriptions_all_own on public.push_subscriptions;
create policy push_subscriptions_all_own on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 4. RPC
-- =========================================================

-- 내 친구 목록 (security invoker: profiles RLS 적용)
create or replace function public.my_friends()
returns table (id uuid, display_name text)
language sql stable security invoker
set search_path = public
as $$
  select p.id, p.display_name
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() in (f.user_low, f.user_high)
  order by p.display_name, p.id;
$$;

-- SOS 생성: 요청 + 수신자(생성 시점 친구 전원)를 한 트랜잭션에서 기록. 동일 idempotency_key 는 기존 요청 반환.
create or replace function public.create_sos_request(p_idempotency_key text, p_message text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_friend_count int;
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

  select count(*) into v_friend_count from public.friendships f where v_uid in (f.user_low, f.user_high);
  if v_friend_count = 0 then
    raise exception 'no_friends' using errcode = 'P0001';
  end if;

  begin
    insert into public.sos_requests (sender_id, message, idempotency_key)
    values (v_uid, p_message, p_idempotency_key)
    returning id into v_id;
  exception when unique_violation then
    select r.id into v_id from public.sos_requests r
     where r.sender_id = v_uid and r.idempotency_key = p_idempotency_key;
    return jsonb_build_object('request_id', v_id, 'created', false);
  end;

  insert into public.sos_recipients (request_id, recipient_id)
  select v_id, case when f.user_low = v_uid then f.user_high else f.user_low end
  from public.friendships f
  where v_uid in (f.user_low, f.user_high)
  on conflict do nothing;

  return jsonb_build_object('request_id', v_id, 'created', true);
end;
$$;

-- 최초 열람 기록: 수신자 본인만, 최초 시각은 덮어쓰지 않는다.
create or replace function public.mark_sos_read(p_request_id uuid)
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

  update public.sos_recipients
     set first_read_at = now()
   where request_id = p_request_id and recipient_id = v_uid and first_read_at is null
  returning first_read_at into v_ts;

  if not found then
    select first_read_at into v_ts from public.sos_recipients
     where request_id = p_request_id and recipient_id = v_uid;
    if not found then
      raise exception 'not_a_recipient' using errcode = '42501';
    end if;
  end if;
  return v_ts;
end;
$$;

revoke all on function public.my_friends() from public, anon;
revoke all on function public.create_sos_request(text, text) from public, anon;
revoke all on function public.mark_sos_read(uuid) from public, anon;
grant execute on function public.my_friends() to authenticated, service_role;
grant execute on function public.create_sos_request(text, text) to authenticated, service_role;
grant execute on function public.mark_sos_read(uuid) to authenticated, service_role;

-- =========================================================
-- 5. 비공개 Storage 버킷 (생성 결과 전용, 본인 폴더만 접근)
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generations', 'generations', false, 15728640, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists generations_select_own on storage.objects;
create policy generations_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists generations_insert_own on storage.objects;
create policy generations_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists generations_update_own on storage.objects;
create policy generations_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists generations_delete_own on storage.objects;
create policy generations_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- 6. Realtime (열린 앱의 목록·열람 갱신용. 백그라운드 푸시를 대체하지 않는다)
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_recipients'
  ) then
    alter publication supabase_realtime add table public.sos_recipients;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_requests'
  ) then
    alter publication supabase_realtime add table public.sos_requests;
  end if;
end
$$;
