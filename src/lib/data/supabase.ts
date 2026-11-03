import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppNotification,
  NotificationKind,
  FriendInvite,
  ImageGeneration,
  PhotoConsent,
  PhotoSlot,
  Profile,
  ProfilePhoto,
  PushStatus,
  SettingsPatch,
  Situation,
  SituationSnapshot,
  SosRecipient,
  SosRequest,
  SosResponse,
} from "@/lib/types";
import type {
  AcceptInviteResult,
  CreateSosResult,
  CurfewCandidate,
  DataBackend,
  DeleteResult,
  EmailVerification,
  FriendWithConsent,
  MarkReadResult,
  PersistInput,
  ProfileLite,
  PushSub,
  ReceivedItem,
  RespondResult,
  SentItem,
  SessionUser,
  SignInResult,
  SignUpResult,
  SituationWrite,
  NewNotification,
  SosStatusRow,
  UsablePerson,
} from "@/lib/data/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayNameFromEmail, verificationFromRow, verificationToRow } from "@/lib/auth/email-signup";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseKey, publicSupabaseUrl } from "@/lib/env";
import { GENERATIONS_BUCKET, extensionFor, listUserObjects, persistGeneration as persistToSupabase } from "@/lib/image/storage";
import { makeThumbnail, thumbPath, withThumbPaths } from "@/lib/image/thumb";

/**
 * 목록용 썸네일: 저장소에 이미 있으면 그대로, 없으면 원본을 줄여 저장한 뒤 돌려준다.
 * 권한 확인은 호출 전에 끝났으므로 저장소 접근은 서버 관리 키로 한다. 실패하면 null(원본으로 대체).
 */
async function cachedThumb(path: string, width: number, loadOriginal: () => Promise<Uint8Array | null>): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  const tpath = thumbPath(path, width);
  const { data: hit } = await admin.storage.from(GENERATIONS_BUCKET).download(tpath);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const original = await loadOriginal();
  if (!original) return null;
  const thumb = await makeThumbnail(original, width);
  if (!thumb) return null;
  await admin.storage
    .from(GENERATIONS_BUCKET)
    .upload(tpath, new Blob([thumb as BlobPart], { type: "image/webp" }), { contentType: "image/webp", upsert: true, cacheControl: "31536000" })
    .catch(() => undefined);
  return thumb;
}

function hm(v: unknown): string {
  const s = String(v ?? "23:00");
  return s.length >= 5 ? s.slice(0, 5) : s;
}
/** 아이디 가입 계정의 Auth 이메일 (실제로 메일을 보내지 않는 예약 도메인) */
export function usernameEmail(username: string): string {
  return `${username.toLowerCase()}@id.nado-eoreun.invalid`;
}

function toProfile(r: Record<string, unknown>): Profile {
  return {
    id: String(r.id),
    display_name: String(r.display_name),
    username: (r.username as string | null) ?? null,
    created_at: String(r.created_at),
    curfew_time: hm(r.curfew_time),
    curfew_override_time: r.curfew_override_time == null ? null : hm(r.curfew_override_time),
    curfew_override_date: (r.curfew_override_date as string | null) ?? null,
    curfew_notify_minutes: Number(r.curfew_notify_minutes ?? 30),
    notify_curfew: Boolean(r.notify_curfew ?? true),
    notify_sos: Boolean(r.notify_sos ?? true),
    notify_response: Boolean(r.notify_response ?? true),
    theme: (r.theme as Profile["theme"]) ?? "system",
    phone: (r.phone as string | null) ?? null,
  };
}
function rpcCode(message: string): string {
  return message.split(/[\s:]/)[0] ?? message;
}
function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** Vercel 시연 배포용: Supabase Auth·Postgres(RLS)·Storage. 본인 행은 사용자 세션 클라이언트로 조회해 RLS 가 실제로 적용된다. */
export class SupabaseBackend implements DataBackend {
  readonly kind = "supabase" as const;

  async getSessionUser(): Promise<SessionUser | null> {
    if (!publicSupabaseUrl() || !publicSupabaseKey()) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const claims = data.claims as { sub: string; email?: string };
    return { id: claims.sub, email: claims.email ?? null };
  }

  async signIn(login: string, password: string): Promise<SignInResult> {
    const supabase = await createClient();
    const key = login.trim().toLowerCase();
    const email = key.includes("@") ? key : usernameEmail(key);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, message: error?.message === "Invalid login credentials" ? "아이디 또는 비밀번호가 맞지 않아요." : `로그인 실패: ${error?.message ?? "unknown"}` };
    }
    return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
  }

  async isEmailRegistered(email: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("auth_email_taken", { p_email: email.toLowerCase() });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
    const e = email.toLowerCase();
    const name = displayNameFromEmail(e);
    const admin = createAdminClient();
    // 이메일 소유는 앱의 인증번호로 이미 확인했으므로 확인 메일 없이 바로 확인된 계정으로 만든다.
    const { data, error } = await admin.auth.admin.createUser({ email: e, password, email_confirm: true, user_metadata: { display_name: name } });
    if (error || !data.user) {
      const msg = error?.message ?? "unknown";
      if (/already|registered|exists/i.test(msg)) return { ok: false, code: "taken", message: "이미 가입된 이메일이에요. 로그인해 주세요." };
      if (/password/i.test(msg)) return { ok: false, code: "invalid", message: "비밀번호가 너무 짧거나 쉬워요." };
      return { ok: false, code: "error", message: `가입 실패: ${msg}` };
    }
    const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, display_name: name });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      return { ok: false, code: "error", message: `가입 실패(프로필): ${pErr.message}` };
    }
    const r = await this.signIn(e, password);
    return r.ok ? { ok: true, user: r.user } : { ok: false, code: "error", message: r.message };
  }

  async getEmailVerification(email: string): Promise<EmailVerification | null> {
    const admin = createAdminClient();
    const { data, error } = await admin.from("email_verifications").select("*").eq("email", email).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? verificationFromRow(data as Record<string, unknown>) : null;
  }

  async putEmailVerification(row: EmailVerification): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("email_verifications").upsert(verificationToRow(row));
    if (error) throw new Error(error.message);
  }

  async deleteEmailVerification(email: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("email_verifications").delete().eq("email", email);
    if (error) throw new Error(error.message);
  }

  async hitRateLimit(key: string, windowMs: number, max: number): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("auth_rate_hit", { p_key: key, p_window_seconds: Math.ceil(windowMs / 1000), p_max: max });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  // ---------- 프로필·설정·친구 ----------

  async getProfile(userId: string): Promise<ProfileLite | null> {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle();
    return data ? { id: String(data.id), display_name: String(data.display_name) } : null;
  }

  async getProfiles(ids: string[]): Promise<ProfileLite[]> {
    if (ids.length === 0) return [];
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    return (data ?? []).map((p) => ({ id: String(p.id), display_name: String(p.display_name) }));
  }

  async getProfileFull(userId: string): Promise<Profile | null> {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data ? toProfile(data as Record<string, unknown>) : null;
  }

  async updateSettings(userId: string, patch: SettingsPatch): Promise<Profile | null> {
    const supabase = await createClient();
    const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
    if (patch.curfew_time !== undefined || patch.curfew_notify_minutes !== undefined) update.curfew_notified_on = null;
    const { data, error } = await supabase.from("profiles").update(update).eq("id", userId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProfile(data as Record<string, unknown>) : null;
  }

  async setTodayCurfew(userId: string, time: string, notifyMinutes: number, dateKey: string): Promise<Profile | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ curfew_override_time: time, curfew_override_date: dateKey, curfew_notify_minutes: notifyMinutes, curfew_notified_on: null, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProfile(data as Record<string, unknown>) : null;
  }

  async getFriends(): Promise<ProfileLite[]> {
    const supabase = await createClient();
    const { data } = await supabase.rpc("my_friends");
    return ((data ?? []) as { id: string; display_name: string }[]).map((p) => ({ id: p.id, display_name: p.display_name }));
  }

  async getFriendsWithConsent(userId: string): Promise<FriendWithConsent[]> {
    const friends = await this.getFriends();
    if (friends.length === 0) return [];
    const supabase = await createClient();
    const ids = friends.map((f) => f.id);
    const [{ data: consents }, { data: photos }] = await Promise.all([
      supabase.from("photo_consents").select("owner_id, grantee_id, granted").or(`owner_id.eq.${userId},grantee_id.eq.${userId}`),
      // RLS: 동의받은 친구의 사진만 보인다
      supabase.from("profile_photos").select("user_id").in("user_id", ids),
    ]);
    const countOf = new Map<string, number>();
    for (const p of photos ?? []) countOf.set(String(p.user_id), (countOf.get(String(p.user_id)) ?? 0) + 1);
    const rows = (consents ?? []) as { owner_id: string; grantee_id: string; granted: boolean }[];
    return friends.map((f) => ({
      ...f,
      allowsMe: rows.some((c) => c.owner_id === f.id && c.grantee_id === userId && c.granted),
      iAllow: rows.some((c) => c.owner_id === userId && c.grantee_id === f.id && c.granted),
      photoCount: countOf.get(f.id) ?? 0,
    }));
  }

  // ---------- 오늘의 상황 ----------

  async listSituations(userId: string): Promise<Situation[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("situations").select("*").eq("user_id", userId).order("target_date", { ascending: false }).order("created_at", { ascending: false }).limit(200);
    return (data ?? []) as Situation[];
  }

  async getSituation(userId: string, id: string): Promise<Situation | null> {
    const supabase = await createClient();
    const { data } = await supabase.from("situations").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    return (data as Situation | null) ?? null;
  }

  async createSituation(userId: string, input: SituationWrite): Promise<Situation> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("situations")
      .insert({ user_id: userId, target_date: input.target_date, place: input.place, companion: input.companion, companion_ids: input.companion_ids, real_name: input.real_name, real_phone: input.real_phone, memo: input.memo, summary: input.summary })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "상황 저장 실패");
    return data as Situation;
  }

  async updateSituation(userId: string, id: string, input: SituationWrite): Promise<Situation | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("situations")
      .update({ target_date: input.target_date, place: input.place, companion: input.companion, companion_ids: input.companion_ids, real_name: input.real_name, real_phone: input.real_phone, memo: input.memo, summary: input.summary, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Situation | null) ?? null;
  }

  async setSituationSummary(userId: string, id: string, summary: string): Promise<void> {
    const supabase = await createClient();
    await supabase.from("situations").update({ summary: summary.slice(0, 600) }).eq("id", id).eq("user_id", userId);
  }

  async deleteSituation(userId: string, id: string): Promise<DeleteResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("situations").delete().eq("id", id).eq("user_id", userId).select("id");
    if (error) return { ok: false, code: "error", message: error.message };
    return data && data.length > 0 ? { ok: true } : { ok: false, code: "not_found", message: "상황을 찾을 수 없어요." };
  }

  async chooseSituation(userId: string, id: string): Promise<Situation | null> {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data } = await supabase.from("situations").update({ chosen_at: now, updated_at: now }).eq("id", id).eq("user_id", userId).select("*").maybeSingle();
    return (data as Situation | null) ?? null;
  }

  // ---------- AI 프로필 사진·동의·초대 ----------

  async listProfilePhotos(userId: string): Promise<ProfilePhoto[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("profile_photos").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    return (data ?? []) as ProfilePhoto[];
  }

  async listUsablePhotos(userId: string): Promise<UsablePerson[]> {
    const [me, friends] = await Promise.all([this.getProfile(userId), this.getFriendsWithConsent(userId)]);
    const supabase = await createClient();
    const ids = [userId, ...friends.map((f) => f.id)];
    // RLS: 본인 + 동의받은 친구의 사진만 반환된다
    const { data } = await supabase.from("profile_photos").select("*").in("user_id", ids).order("created_at", { ascending: true });
    const rows = (data ?? []) as ProfilePhoto[];
    const out: UsablePerson[] = [];
    if (me) out.push({ person: me, isSelf: true, consented: true, photos: rows.filter((r) => r.user_id === userId) });
    for (const f of friends) {
      out.push({ person: { id: f.id, display_name: f.display_name }, isSelf: false, consented: f.allowsMe, photos: f.allowsMe ? rows.filter((r) => r.user_id === f.id) : [] });
    }
    return out;
  }

  async addProfilePhoto(userId: string, slot: PhotoSlot, bytes: Uint8Array, mediaType: string): Promise<ProfilePhoto> {
    const supabase = await createClient();
    const id = crypto.randomUUID();
    const path = `${userId}/profile/${id}.${extensionFor(mediaType)}`;
    const { error: upErr } = await supabase.storage.from(GENERATIONS_BUCKET).upload(path, new Blob([bytes as BlobPart], { type: mediaType }), { contentType: mediaType, upsert: false, cacheControl: "0" });
    if (upErr) throw new Error(`저장 실패(storage): ${upErr.message}`);
    if (slot !== "extra") {
      const { data: old } = await supabase.from("profile_photos").delete().eq("user_id", userId).eq("slot", slot).select("storage_path");
      const paths = (old ?? []).map((o) => String(o.storage_path));
      if (paths.length) await supabase.storage.from(GENERATIONS_BUCKET).remove(withThumbPaths(paths)).catch(() => undefined);
    }
    const { data, error } = await supabase.from("profile_photos").insert({ id, user_id: userId, slot, storage_path: path, media_type: mediaType }).select("*").single();
    if (error || !data) {
      await supabase.storage.from(GENERATIONS_BUCKET).remove([path]).catch(() => undefined);
      throw new Error(`저장 실패(db): ${error?.message ?? "unknown"}`);
    }
    return data as ProfilePhoto;
  }

  async deleteProfilePhoto(userId: string, id: string): Promise<DeleteResult> {
    const supabase = await createClient();
    const { data: row } = await supabase.from("profile_photos").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!row) return { ok: false, code: "not_found", message: "사진을 찾을 수 없어요." };
    const { error: rmErr } = await supabase.storage.from(GENERATIONS_BUCKET).remove(withThumbPaths([String(row.storage_path)]));
    if (rmErr) return { ok: false, code: "file_delete_failed", message: `파일 삭제 실패: ${rmErr.message}` };
    await supabase.from("profile_photos").delete().eq("id", id).eq("user_id", userId);
    return { ok: true };
  }

  async readProfilePhotoFile(viewerId: string, id: string, thumbWidth?: number | null): Promise<{ row: ProfilePhoto; bytes: Uint8Array; mediaType: string } | null> {
    const supabase = await createClient();
    // RLS: 본인 또는 사용 동의를 받은 친구의 행만 조회된다
    const { data: row } = await supabase.from("profile_photos").select("*").eq("id", id).maybeSingle();
    if (!row) return null;
    const client: SupabaseClient = String(row.user_id) === viewerId ? supabase : createAdminClient();
    const path = String(row.storage_path);
    const load = async () => {
      const { data: blob, error } = await client.storage.from(GENERATIONS_BUCKET).download(path);
      return error || !blob ? null : new Uint8Array(await blob.arrayBuffer());
    };
    if (thumbWidth) {
      const thumb = await cachedThumb(path, thumbWidth, load);
      if (thumb) return { row: row as ProfilePhoto, bytes: thumb, mediaType: "image/webp" };
    }
    const bytes = await load();
    return bytes ? { row: row as ProfilePhoto, bytes, mediaType: String(row.media_type) } : null;
  }

  async listConsentsGiven(ownerId: string): Promise<PhotoConsent[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("photo_consents").select("*").eq("owner_id", ownerId);
    return (data ?? []) as PhotoConsent[];
  }

  async setConsent(ownerId: string, granteeId: string, granted: boolean): Promise<PhotoConsent | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("photo_consents")
      .upsert({ owner_id: ownerId, grantee_id: granteeId, granted, updated_at: new Date().toISOString() }, { onConflict: "owner_id,grantee_id" })
      .select("*")
      .maybeSingle();
    if (error) return null; // 친구가 아니면 RLS with check 에서 거부된다
    return (data as PhotoConsent | null) ?? null;
  }

  async createInvite(userId: string): Promise<FriendInvite> {
    const supabase = await createClient();
    const token = randomToken();
    const { data, error } = await supabase
      .from("friend_invites")
      .insert({ token, inviter_id: userId, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "초대 생성 실패");
    return data as FriendInvite;
  }

  async getInvite(token: string): Promise<{ invite: FriendInvite; inviterName: string } | null> {
    const supabase = await createClient();
    const { data } = await supabase.rpc("invite_info", { p_token: token });
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return {
      invite: { id: String(r.id), token: String(r.token), inviter_id: String(r.inviter_id), created_at: String(r.created_at), expires_at: String(r.expires_at), accepted_by: (r.accepted_by as string | null) ?? null, accepted_at: (r.accepted_at as string | null) ?? null },
      inviterName: String(r.inviter_name ?? "친구"),
    };
  }

  async acceptInvite(_userId: string, token: string): Promise<AcceptInviteResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("accept_friend_invite", { p_token: token });
    if (error) {
      const code = rpcCode(error.message);
      if (code === "not_found") return { ok: false, code, message: "초대 링크를 찾을 수 없어요." };
      if (code === "expired") return { ok: false, code, message: "초대 링크가 만료됐어요." };
      if (code === "self") return { ok: false, code, message: "내가 만든 초대 링크예요." };
      if (code === "used") return { ok: false, code, message: "이미 사용된 초대 링크예요." };
      return { ok: false, code: "error", message: error.message };
    }
    const r = data as { friend_id: string; friend_name: string; already_friends: boolean };
    return { ok: true, friendId: r.friend_id, friendName: r.friend_name ?? "친구", alreadyFriends: Boolean(r.already_friends) };
  }

  // ---------- 생성 사진 ----------

  async listGenerations(userId: string): Promise<ImageGeneration[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("image_generations").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(200);
    return (data ?? []) as ImageGeneration[];
  }

  async getGeneration(userId: string, id: string): Promise<ImageGeneration | null> {
    const supabase = await createClient();
    const { data } = await supabase.from("image_generations").select("*").eq("id", id).eq("owner_id", userId).maybeSingle();
    return (data as ImageGeneration | null) ?? null;
  }

  async persistGeneration(input: PersistInput): Promise<ImageGeneration> {
    const supabase = await createClient();
    return persistToSupabase({ supabase, ...input });
  }

  async readGenerationFile(userId: string, id: string, thumbWidth?: number | null): Promise<{ row: ImageGeneration; bytes: Uint8Array; mediaType: string } | null> {
    const row = await this.getGeneration(userId, id);
    if (!row) return null;
    const supabase = await createClient();
    const load = async () => {
      const { data: blob, error } = await supabase.storage.from(GENERATIONS_BUCKET).download(row.storage_path);
      return error || !blob ? null : new Uint8Array(await blob.arrayBuffer());
    };
    if (thumbWidth) {
      const thumb = await cachedThumb(row.storage_path, thumbWidth, load);
      if (thumb) return { row, bytes: thumb, mediaType: "image/webp" };
    }
    const bytes = await load();
    return bytes ? { row, bytes, mediaType: row.media_type } : null;
  }

  async deleteGeneration(userId: string, id: string): Promise<DeleteResult> {
    const row = await this.getGeneration(userId, id);
    if (!row) return { ok: false, code: "not_found", message: "내역을 찾을 수 없어요." };
    const supabase = await createClient();
    const { error: removeError } = await supabase.storage.from(GENERATIONS_BUCKET).remove(withThumbPaths([row.storage_path]));
    if (removeError) return { ok: false, code: "file_delete_failed", message: `파일 삭제 실패: ${removeError.message}. 내역은 유지됩니다.` };
    const { error: dbError } = await supabase.from("image_generations").delete().eq("id", id).eq("owner_id", userId);
    if (dbError) return { ok: false, code: "partial_delete", message: `파일은 삭제됐지만 내역 삭제에 실패했어요: ${dbError.message}` };
    return { ok: true };
  }

  async overwriteGeneration(userId: string, targetId: string, sourceId: string): Promise<DeleteResult> {
    const [target, source] = await Promise.all([this.getGeneration(userId, targetId), this.getGeneration(userId, sourceId)]);
    if (!target || !source) return { ok: false, code: "not_found", message: "사진을 찾을 수 없어요." };
    if (target.id === source.id) return { ok: true };
    const supabase = await createClient();
    const { error } = await supabase
      .from("image_generations")
      .update({ storage_path: source.storage_path, media_type: source.media_type, params: source.params, version: source.version, updated_at: new Date().toISOString() })
      .eq("id", targetId)
      .eq("owner_id", userId);
    if (error) return { ok: false, code: "error", message: error.message };
    await supabase.from("image_generations").update({ parent_id: targetId }).eq("parent_id", sourceId).eq("owner_id", userId);
    await supabase.from("image_generations").delete().eq("id", sourceId).eq("owner_id", userId);
    await supabase.storage.from(GENERATIONS_BUCKET).remove(withThumbPaths([target.storage_path])).catch(() => undefined);
    return { ok: true };
  }

  // ---------- SOS ----------

  async createSosRequest(_userId: string, idempotencyKey: string, message: string, recipientIds: string[] | null, snapshot: SituationSnapshot | null): Promise<CreateSosResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_sos_request", {
      p_idempotency_key: idempotencyKey,
      p_message: message,
      p_recipient_ids: recipientIds,
      p_snapshot: snapshot,
    });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("no_friends")) return { ok: false, code: "no_friends", message: "등록된 친구가 없어 보낼 수 없어요." };
      if (msg.includes("invalid_recipient")) return { ok: false, code: "invalid", message: "친구가 아닌 수신자가 있어요." };
      if (msg.includes("invalid_")) return { ok: false, code: "invalid", message: "요청 식별자가 올바르지 않아요." };
      return { ok: false, code: "error", message: `요청 기록 실패: ${msg}` };
    }
    const r = data as { request_id: string; created: boolean };
    return { ok: true, requestId: r.request_id, created: r.created };
  }

  async getSosRequest(_userId: string, requestId: string): Promise<SosRequest | null> {
    const supabase = await createClient();
    const { data } = await supabase.from("sos_requests").select("*").eq("id", requestId).maybeSingle();
    return (data as SosRequest | null) ?? null;
  }

  async getSosRecipients(_userId: string, requestId: string): Promise<SosRecipient[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("sos_recipients").select("*").eq("request_id", requestId);
    return (data ?? []) as SosRecipient[];
  }

  async getSosStatus(_userId: string, requestId: string): Promise<SosStatusRow[] | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sos_status", { p_request_id: requestId });
    if (error) return null;
    return ((data ?? []) as { recipient_id: string; display_name: string; first_read_at: string | null; push_status: PushStatus; response: SosResponse | null; responded_at: string | null }[]).map((r) => ({
      recipientId: r.recipient_id,
      name: r.display_name,
      firstReadAt: r.first_read_at,
      pushStatus: r.push_status,
      response: r.response,
      respondedAt: r.responded_at,
    }));
  }

  async markSosRead(_userId: string, requestId: string): Promise<MarkReadResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_sos_read", { p_request_id: requestId });
    if (error) {
      if (error.message.includes("not_a_recipient")) return { ok: false, code: "not_a_recipient", message: "이 요청의 수신자가 아니에요." };
      return { ok: false, code: "error", message: error.message };
    }
    return { ok: true, firstReadAt: (data as string | null) ?? null };
  }

  async respondSos(_userId: string, requestId: string, response: SosResponse): Promise<RespondResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("respond_sos", { p_request_id: requestId, p_response: response });
    if (error) {
      if (error.message.includes("not_a_recipient")) return { ok: false, code: "not_a_recipient", message: "이 요청의 수신자가 아니에요." };
      if (error.message.includes("cancelled")) return { ok: false, code: "cancelled", message: "취소된 요청이에요." };
      return { ok: false, code: "error", message: error.message };
    }
    return { ok: true, respondedAt: String(data) };
  }

  async cancelSos(_userId: string, requestId: string): Promise<DeleteResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_sos", { p_request_id: requestId });
    if (error) return { ok: false, code: error.message.includes("not_sender") ? "not_found" : "error", message: "요청을 취소하지 못했어요." };
    return { ok: true };
  }

  async listReceived(userId: string): Promise<ReceivedItem[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("sos_recipients").select("request_id, first_read_at, response").eq("recipient_id", userId).limit(100);
    const rows = (data ?? []) as { request_id: string; first_read_at: string | null; response: SosResponse | null }[];
    if (rows.length === 0) return [];
    const { data: reqs } = await supabase.from("sos_requests").select("id, sender_id, created_at, cancelled_at, situation_snapshot").in("id", rows.map((r) => r.request_id));
    const reqMap = new Map((reqs ?? []).map((r) => [String(r.id), r]));
    const senderIds = [...new Set((reqs ?? []).map((r) => String(r.sender_id)))];
    const profiles = await this.getProfiles(senderIds);
    const nameOf = new Map(profiles.map((p) => [p.id, p.display_name]));
    return rows
      .map((r) => {
        const req = reqMap.get(r.request_id);
        if (!req) return null;
        const snap = req.situation_snapshot as SituationSnapshot | null;
        return {
          requestId: r.request_id,
          createdAt: String(req.created_at),
          senderId: String(req.sender_id),
          senderName: nameOf.get(String(req.sender_id)) ?? "친구",
          firstReadAt: r.first_read_at,
          response: r.response,
          cancelledAt: (req.cancelled_at as string | null) ?? null,
          place: snap?.place || null,
        } satisfies ReceivedItem;
      })
      .filter((x): x is ReceivedItem => x !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listSent(userId: string): Promise<SentItem[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("sos_requests")
      .select("id, created_at, cancelled_at, sos_recipients(first_read_at, response)")
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return ((data ?? []) as unknown as { id: string; created_at: string; cancelled_at: string | null; sos_recipients: { first_read_at: string | null; response: string | null }[] }[]).map((r) => ({
      requestId: r.id,
      createdAt: r.created_at,
      total: r.sos_recipients.length,
      read: r.sos_recipients.filter((x) => x.first_read_at).length,
      responded: r.sos_recipients.filter((x) => x.response).length,
      cancelledAt: r.cancelled_at,
    }));
  }

  async countUnread(userId: string): Promise<number> {
    const items = await this.listReceived(userId);
    return items.filter((i) => !i.firstReadAt && !i.cancelledAt).length;
  }

  // ---------- 푸시 ----------

  async updatePushStatus(requestId: string, recipientId: string, status: PushStatus, error: string | null): Promise<void> {
    const admin = createAdminClient();
    await admin.from("sos_recipients").update({ push_status: status, push_error: error, push_attempted_at: new Date().toISOString() }).eq("request_id", requestId).eq("recipient_id", recipientId);
  }

  async getSubscriptionsFor(userIds: string[]): Promise<PushSub[]> {
    if (userIds.length === 0) return [];
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
    return (data ?? []) as PushSub[];
  }

  async deleteSubscriptions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const admin = createAdminClient();
    await admin.from("push_subscriptions").delete().in("id", ids);
  }

  async upsertSubscription(userId: string, endpoint: string, p256dh: string, auth: string, userAgent: string | null): Promise<void> {
    const supabase = await createClient();
    const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("push_subscriptions").update({ p256dh, auth, user_agent: userAgent, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await supabase.from("push_subscriptions").insert({ user_id: userId, endpoint, p256dh, auth, user_agent: userAgent });
    if (!error) return;
    if (error.code === "23505") {
      // 같은 endpoint 가 다른 사용자 소유: 관리자 권한으로 소유자를 현재 사용자로 교체
      const admin = createAdminClient();
      const { error: adminError } = await admin.from("push_subscriptions").update({ user_id: userId, p256dh, auth, user_agent: userAgent, updated_at: new Date().toISOString() }).eq("endpoint", endpoint);
      if (adminError) throw new Error(adminError.message);
      return;
    }
    throw new Error(error.message);
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    const supabase = await createClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
  }

  async listNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    const rows = (data ?? []) as Omit<AppNotification, "from_name">[];
    const names = await this.getProfiles([...new Set(rows.map((r) => r.from_id).filter((x): x is string => Boolean(x)))]);
    const nameOf = new Map(names.map((p) => [p.id, p.display_name]));
    return rows.map((r) => ({ ...r, kind: r.kind as NotificationKind, from_name: r.from_id ? (nameOf.get(r.from_id) ?? null) : null }));
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
    return count ?? 0;
  }

  async markNotificationsRead(userId: string, ids: string[] | null, link?: string): Promise<void> {
    const supabase = await createClient();
    const now = new Date().toISOString();
    let q = supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    if (link) q = q.eq("link", link);
    else if (ids) {
      if (ids.length === 0) return;
      q = q.in("id", ids);
    }
    await q;
  }

  async addNotifications(rows: NewNotification[]): Promise<void> {
    if (rows.length === 0) return;
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(rows.map((n) => ({ user_id: n.userId, kind: n.kind, from_id: n.fromId, text: n.text.slice(0, 300), link: n.link })));
    if (error) console.warn("[noti] insert failed", error.message);
  }

  async getNotifyPrefs(userIds: string[]): Promise<Map<string, { notifySos: boolean; notifyResponse: boolean }>> {
    const map = new Map<string, { notifySos: boolean; notifyResponse: boolean }>();
    if (userIds.length === 0) return map;
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id, notify_sos, notify_response").in("id", userIds);
    for (const r of data ?? []) map.set(String(r.id), { notifySos: Boolean(r.notify_sos), notifyResponse: Boolean(r.notify_response) });
    return map;
  }

  async listCurfewCandidates(): Promise<CurfewCandidate[]> {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id, curfew_time, curfew_override_time, curfew_override_date, curfew_notify_minutes, curfew_notified_on").eq("notify_curfew", true);
    return (data ?? []).map((r) => ({
      userId: String(r.id),
      curfewTime: hm(r.curfew_time),
      overrideTime: r.curfew_override_time == null ? null : hm(r.curfew_override_time),
      overrideDate: (r.curfew_override_date as string | null) ?? null,
      notifyMinutes: Number(r.curfew_notify_minutes ?? 30),
      notifiedOn: (r.curfew_notified_on as string | null) ?? null,
    }));
  }

  async markCurfewNotified(userId: string, dateKey: string): Promise<void> {
    const admin = createAdminClient();
    await admin.from("profiles").update({ curfew_notified_on: dateKey }).eq("id", userId);
  }

  // ---------- 설정 ----------

  async deleteUserData(userId: string): Promise<{ generations: number; situations: number }> {
    const supabase = await createClient();
    const gens = await this.listGenerations(userId);
    if (gens.length) await supabase.storage.from(GENERATIONS_BUCKET).remove(withThumbPaths(gens.map((g) => g.storage_path))).catch(() => undefined);
    const { data: g } = await supabase.from("image_generations").delete().eq("owner_id", userId).select("id");
    const { data: s } = await supabase.from("situations").delete().eq("user_id", userId).select("id");
    return { generations: g?.length ?? 0, situations: s?.length ?? 0 };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [profile, friends, situations, generations, sent, received, consents, photos] = await Promise.all([
      this.getProfileFull(userId),
      this.getFriends(),
      this.listSituations(userId),
      this.listGenerations(userId),
      this.listSent(userId),
      this.listReceived(userId),
      this.listConsentsGiven(userId),
      this.listProfilePhotos(userId),
    ]);
    return { exportedAt: new Date().toISOString(), profile, friends, situations, generations, sos: { sent, received }, photoConsents: consents, profilePhotos: photos };
  }

  async deleteAccount(userId: string): Promise<void> {
    const admin = createAdminClient();
    const paths = await listUserObjects(admin, userId).catch(() => [] as string[]);
    if (paths.length) await admin.storage.from(GENERATIONS_BUCKET).remove(paths).catch(() => undefined);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
  }

  async purgeExpired(days: number): Promise<{ generations: number; situations: number }> {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: old } = await admin.from("image_generations").select("id, storage_path").lt("created_at", cutoff).limit(500);
    const rows = (old ?? []) as { id: string; storage_path: string }[];
    if (rows.length) {
      await admin.storage.from(GENERATIONS_BUCKET).remove(withThumbPaths(rows.map((r) => r.storage_path))).catch(() => undefined);
      await admin.from("image_generations").delete().in("id", rows.map((r) => r.id));
    }
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    await admin.from("email_verifications").delete().lt("last_sent_at", dayAgo);
    await admin.from("auth_rate_limits").delete().lt("window_started_at", dayAgo);
    const cutoffDate = cutoff.slice(0, 10);
    const { data: s } = await admin.from("situations").delete().lt("target_date", cutoffDate).select("id");
    return { generations: rows.length, situations: s?.length ?? 0 };
  }
}
