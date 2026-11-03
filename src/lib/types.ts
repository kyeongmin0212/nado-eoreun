/** 테이블 행 타입 (supabase/migrations 와 src/lib/data/local/schema.sql 에 동기화). */

/** 사진 기능 모드. new_background·merge_background·background_create 는 이전 행 표시용이다. */
export type ImageMode =
  | "add_friend"
  | "new_background"
  | "merge_background"
  | "background_swap"
  | "background_create"
  | "hairstyle"
  | "situation"
  | "edit";

export type Theme = "light" | "dark" | "system";

export type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  created_at: string;
  /** 기본 통금 "HH:MM" (Asia/Seoul) */
  curfew_time: string;
  /** 오늘만 적용하는 통금 */
  curfew_override_time: string | null;
  curfew_override_date: string | null;
  curfew_notify_minutes: number;
  notify_curfew: boolean;
  notify_sos: boolean;
  notify_response: boolean;
  theme: Theme;
  phone: string | null;
};

export type SettingsPatch = Partial<
  Pick<Profile, "display_name" | "curfew_time" | "curfew_notify_minutes" | "notify_curfew" | "notify_sos" | "notify_response" | "theme" | "phone">
>;

export type PersonTag = "self" | "friend" | "other";

export type GenerationParams = {
  preset?: string | null;
  situation?: string | null;
  background?: "preset" | "text" | "photo" | null;
  people?: { tag: PersonTag; name?: string | null; source: "file" | "profile" }[];
  pose?: string | null;
  expression?: string | null;
  extra?: string | null;
  hairRef?: boolean;
  companion?: string | null;
};

export type ImageGeneration = {
  id: string;
  owner_id: string;
  mode: ImageMode;
  status: "completed" | "failed";
  storage_path: string;
  media_type: string;
  prompt_text: string | null;
  model_id: string | null;
  created_at: string;
  parent_id: string | null;
  version: number;
  place_tag: string | null;
  params: GenerationParams | null;
  updated_at: string;
};

export type Weather = "sunny" | "cloudy" | "rain" | "snow";

export type Situation = {
  id: string;
  user_id: string;
  /** YYYY-MM-DD */
  target_date: string;
  end_date: string | null;
  weather: Weather | null;
  place: string;
  /** 표시용 이름 목록 (저장 시 친구 이름으로 채운다) */
  companion: string;
  companion_ids: string[];
  real_name: string;
  real_phone: string;
  summary: string;
  scene: string;
  memo: string;
  chosen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SituationInput = {
  target_date: string;
  place: string;
  companion_ids: string[];
  real_name: string;
  real_phone: string;
  memo: string;
};

export type SituationSnapshot = {
  date: string;
  place: string;
  companion: string;
  companionIds?: string[];
  realName?: string;
  realPhone?: string;
  memo: string;
  summary?: string;
  weather?: Weather | null;
  scene?: string;
};

export type SosResponse = "available" | "unavailable";

export type SosRequest = {
  id: string;
  sender_id: string;
  message: string;
  idempotency_key: string;
  created_at: string;
  situation_snapshot: SituationSnapshot | null;
  cancelled_at: string | null;
};

export type PushStatus = "pending" | "sent" | "no_subscription" | "failed" | "muted";

export type SosRecipient = {
  request_id: string;
  recipient_id: string;
  first_read_at: string | null;
  push_status: PushStatus;
  push_error: string | null;
  push_attempted_at: string | null;
  response: SosResponse | null;
  responded_at: string | null;
};

export type PhotoSlot = "front" | "left" | "right" | "full" | "extra";

export type ProfilePhoto = {
  id: string;
  user_id: string;
  slot: PhotoSlot;
  storage_path: string;
  media_type: string;
  created_at: string;
};

export type PhotoConsent = {
  owner_id: string;
  grantee_id: string;
  granted: boolean;
  updated_at: string;
};

export type FriendInvite = {
  id: string;
  token: string;
  inviter_id: string;
  created_at: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
};

export type NotificationKind = "friend_sos" | "sos_reply" | "photo_consent" | "invite_accepted" | "companion";

export type AppNotification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  from_id: string | null;
  from_name: string | null;
  text: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};
