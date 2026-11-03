-- 나도으른 docker(local) 모드 스키마 v2. 앱이 처음 뜰 때 적용한다 (중복 실행 가능).
create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);
alter table users add column if not exists curfew_time text not null default '23:00';
alter table users add column if not exists curfew_notify_minutes int not null default 30;
alter table users add column if not exists notify_curfew boolean not null default true;
alter table users add column if not exists notify_sos boolean not null default true;
alter table users add column if not exists notify_response boolean not null default true;
alter table users add column if not exists theme text not null default 'system';
alter table users add column if not exists phone text;
alter table users add column if not exists curfew_notified_on date;
alter table users add column if not exists updated_at timestamptz not null default now();

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists friendships (
  user_low uuid not null references users(id) on delete cascade,
  user_high uuid not null references users(id) on delete cascade,
  primary key (user_low, user_high),
  check (user_low < user_high)
);
create table if not exists image_generations (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  mode text not null,
  status text not null default 'completed',
  storage_path text not null,
  media_type text not null default 'image/jpeg',
  prompt_text text,
  model_id text,
  created_at timestamptz not null default now()
);
alter table image_generations add column if not exists parent_id uuid references image_generations(id) on delete set null;
alter table image_generations add column if not exists version int not null default 1;
alter table image_generations add column if not exists place_tag text;
alter table image_generations add column if not exists params jsonb;
alter table image_generations add column if not exists updated_at timestamptz not null default now();
create index if not exists image_generations_owner_created_idx on image_generations (owner_id, created_at desc);

create table if not exists sos_requests (
  id uuid primary key,
  sender_id uuid not null references users(id) on delete cascade,
  message text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (sender_id, idempotency_key)
);
alter table sos_requests add column if not exists situation_snapshot jsonb;
alter table sos_requests add column if not exists cancelled_at timestamptz;

create table if not exists sos_recipients (
  request_id uuid not null references sos_requests(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  first_read_at timestamptz,
  push_status text not null default 'pending',
  push_error text,
  push_attempted_at timestamptz,
  primary key (request_id, recipient_id)
);
alter table sos_recipients add column if not exists response text;
alter table sos_recipients add column if not exists responded_at timestamptz;

create table if not exists push_subscriptions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v2: 오늘의 상황 예약
create table if not exists situations (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  target_date date not null,
  end_date date,
  weather text,
  place text not null default '',
  companion text not null default '',
  scene text not null default '',
  memo text not null default '',
  chosen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists situations_user_date_idx on situations (user_id, target_date desc);

-- v2: AI 프로필 사진
create table if not exists profile_photos (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  slot text not null,
  storage_path text not null,
  media_type text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);
create index if not exists profile_photos_user_idx on profile_photos (user_id);

-- v2: 사진 사용 동의 (owner 가 grantee 에게 자기 사진 사용을 허용)
create table if not exists photo_consents (
  owner_id uuid not null references users(id) on delete cascade,
  grantee_id uuid not null references users(id) on delete cascade,
  granted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (owner_id, grantee_id)
);

-- v2: 친구 초대 링크
create table if not exists friend_invites (
  id uuid primary key,
  token text not null unique,
  inviter_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references users(id) on delete set null,
  accepted_at timestamptz
);

-- v3: 아이디 가입·오늘만 통금·동행인 친구·실제 동행인 연락처·요약·알림 센터
alter table users add column if not exists username text;
create unique index if not exists users_username_key on users (username) where username is not null;
alter table users add column if not exists curfew_override_time text;
alter table users add column if not exists curfew_override_date date;
alter table situations add column if not exists companion_ids uuid[] not null default '{}';
alter table situations add column if not exists real_name text not null default '';
alter table situations add column if not exists real_phone text not null default '';
alter table situations add column if not exists summary text not null default '';
create table if not exists notifications (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  from_id uuid references users(id) on delete set null,
  text text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);

-- 이메일 인증 가입 (D83): 인증번호·가입 확인표·요청 수 제한 (서버 전용)
create table if not exists email_verifications (
  email text primary key,
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
create table if not exists auth_rate_limits (
  key text primary key,
  count int not null default 0,
  window_started_at timestamptz not null default now()
);
