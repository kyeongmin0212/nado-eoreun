-- 나도으른 — 권한 보강: 기본 권한으로 부여된 TRUNCATE/REFERENCES/TRIGGER 를 authenticated 에서 제거한다.
-- (TRUNCATE 는 RLS 를 우회하므로 일반 사용자 역할에 두지 않는다.) 중복 실행 가능.
revoke truncate, references, trigger on table
  public.profiles, public.friendships, public.image_generations,
  public.sos_requests, public.sos_recipients, public.push_subscriptions
  from authenticated;
revoke all on table
  public.profiles, public.friendships, public.image_generations,
  public.sos_requests, public.sos_recipients, public.push_subscriptions
  from anon;
