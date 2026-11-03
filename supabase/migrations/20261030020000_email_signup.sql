-- 나도으른 — 이메일 인증 가입 (D83): 인증번호·가입 확인표·요청 수 제한. 서버(service_role)만 읽고 쓴다.
-- 중복 실행 가능.

create table if not exists public.email_verifications (
  email text primary key check (char_length(email) between 3 and 254),
  code_hash text,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_count int not null default 0,
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  verified_at timestamptz,
  ticket_hash text,
  ticket_expires_at timestamptz
);
alter table public.email_verifications enable row level security;
revoke all on table public.email_verifications from anon, authenticated;
grant all on table public.email_verifications to service_role;

create table if not exists public.auth_rate_limits (
  key text primary key check (char_length(key) <= 200),
  count int not null default 0,
  window_started_at timestamptz not null default now()
);
alter table public.auth_rate_limits enable row level security;
revoke all on table public.auth_rate_limits from anon, authenticated;
grant all on table public.auth_rate_limits to service_role;

-- 가입 여부 확인: auth.users 는 서버만 조회한다.
create or replace function public.auth_email_taken(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email));
$$;
revoke all on function public.auth_email_taken(text) from public, anon, authenticated;
grant execute on function public.auth_email_taken(text) to service_role;

-- 요청 수 제한: 창(window) 안 요청 수를 원자적으로 늘리고 허용 여부를 돌려준다.
create or replace function public.auth_rate_hit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  insert into public.auth_rate_limits as r (key, count, window_started_at) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when r.window_started_at < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_started_at = case when r.window_started_at < now() - make_interval(secs => p_window_seconds) then now() else r.window_started_at end
  returning count into v_count;
  return v_count <= p_max;
end
$$;
revoke all on function public.auth_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.auth_rate_hit(text, int, int) to service_role;
