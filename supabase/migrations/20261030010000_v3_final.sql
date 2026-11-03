-- 나도으른 — 스키마 v3 (디자인 최종안): 아이디 가입·오늘만 통금·동행인 친구·실제 동행인 연락처·상황 요약·알림 센터
-- 중복 실행 가능.

-- 1. profiles: 아이디(가입용)·오늘만 적용하는 통금
alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{4,20}$');
create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;
alter table public.profiles add column if not exists curfew_override_time time;
alter table public.profiles add column if not exists curfew_override_date date;

-- 2. situations: 부모님께 알린 동행인(등록 친구) + 실제 동행인 연락처 + 요약
alter table public.situations add column if not exists companion_ids uuid[] not null default '{}';
alter table public.situations add column if not exists real_name text not null default '';
alter table public.situations add column if not exists real_phone text not null default '';
alter table public.situations add column if not exists summary text not null default '';
alter table public.situations drop constraint if exists situations_real_len;
alter table public.situations add constraint situations_real_len check (char_length(real_name) <= 40 and char_length(real_phone) <= 20 and char_length(summary) <= 600);

-- 3. 알림 센터 (친구 SOS·SOS 응답·사진 동의·초대 수락·동행인 지정)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('friend_sos', 'sos_reply', 'photo_consent', 'invite_accepted', 'companion')),
  from_id uuid references public.profiles(id) on delete set null,
  text text not null check (char_length(text) <= 300),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.%-]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant all on table public.notifications to service_role;
revoke all on table public.notifications from anon;
revoke insert, delete, truncate, references, trigger on table public.notifications from authenticated;

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 알림 행의 보낸 사람 이름을 볼 수 있게 할 필요는 없다(서버가 문구에 이름을 넣어 저장한다).

-- 4. Realtime: 새 알림 즉시 표시
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
