import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "node:crypto";
import type {
  AppNotification,
  NotificationKind,
  FriendInvite,
  GenerationParams,
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
import { getPool } from "@/lib/data/local/db";
import { SESSION_COOKIE, SESSION_TTL_MS, hashPassword, newSessionToken, verifyPassword } from "@/lib/data/local/auth";
import { getObject, putObject, removeDir, removeObject } from "@/lib/data/local/storage";
import { extensionFor } from "@/lib/image/storage";
import { displayNameFromEmail, verificationFromRow, verificationToRow } from "@/lib/auth/email-signup";
import { makeThumbnail, thumbPath, withThumbPaths } from "@/lib/image/thumb";

type Row = Record<string, unknown>;


/** 원본과 썸네일 사본을 함께 지운다 */
async function removeWithThumbs(path: string): Promise<void> {
  await removeObject(path);
  for (const p of withThumbPaths([path]).slice(1)) await removeObject(p).catch(() => undefined);
}

/** 목록용 썸네일: 파일로 캐시하고 없으면 만들어 둔다. 실패하면 null(원본으로 대체) */
async function localThumb(path: string, width: number): Promise<Uint8Array | null> {
  const tpath = thumbPath(path, width);
  const hit = await getObject(tpath);
  if (hit) return hit;
  const original = await getObject(path);
  if (!original) return null;
  const thumb = await makeThumbnail(original, width);
  if (thumb) await putObject(tpath, thumb).catch(() => undefined);
  return thumb;
}

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}
function isoOrNull(v: unknown): string | null {
  return v == null ? null : iso(v);
}
function hm(v: unknown): string {
  const s = String(v ?? "23:00");
  return s.length >= 5 ? s.slice(0, 5) : s;
}
function toGeneration(r: Row): ImageGeneration {
  return {
    id: String(r.id),
    owner_id: String(r.owner_id),
    mode: r.mode as ImageGeneration["mode"],
    status: r.status as ImageGeneration["status"],
    storage_path: String(r.storage_path),
    media_type: String(r.media_type),
    prompt_text: (r.prompt_text as string | null) ?? null,
    model_id: (r.model_id as string | null) ?? null,
    created_at: iso(r.created_at),
    parent_id: (r.parent_id as string | null) ?? null,
    version: Number(r.version ?? 1),
    place_tag: (r.place_tag as string | null) ?? null,
    params: (r.params as GenerationParams | null) ?? null,
    updated_at: iso(r.updated_at ?? r.created_at),
  };
}
function toProfile(r: Row): Profile {
  return {
    id: String(r.id),
    display_name: String(r.display_name),
    username: (r.username as string | null) ?? null,
    created_at: iso(r.created_at),
    curfew_time: hm(r.curfew_time),
    curfew_override_time: r.curfew_override_time == null ? null : hm(r.curfew_override_time),
    curfew_override_date: r.curfew_override_date == null ? null : String(r.curfew_override_date).slice(0, 10),
    curfew_notify_minutes: Number(r.curfew_notify_minutes ?? 30),
    notify_curfew: Boolean(r.notify_curfew ?? true),
    notify_sos: Boolean(r.notify_sos ?? true),
    notify_response: Boolean(r.notify_response ?? true),
    theme: (r.theme as Profile["theme"]) ?? "system",
    phone: (r.phone as string | null) ?? null,
  };
}
function toSituation(r: Row): Situation {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    target_date: String(r.target_date).slice(0, 10),
    end_date: r.end_date == null ? null : String(r.end_date).slice(0, 10),
    weather: (r.weather as Situation["weather"]) ?? null,
    place: String(r.place ?? ""),
    companion: String(r.companion ?? ""),
    companion_ids: Array.isArray(r.companion_ids) ? (r.companion_ids as unknown[]).map(String) : [],
    real_name: String(r.real_name ?? ""),
    real_phone: String(r.real_phone ?? ""),
    summary: String(r.summary ?? ""),
    scene: String(r.scene ?? ""),
    memo: String(r.memo ?? ""),
    chosen_at: isoOrNull(r.chosen_at),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}
function toPhoto(r: Row): ProfilePhoto {
  return { id: String(r.id), user_id: String(r.user_id), slot: r.slot as PhotoSlot, storage_path: String(r.storage_path), media_type: String(r.media_type), created_at: iso(r.created_at) };
}
function toConsent(r: Row): PhotoConsent {
  return { owner_id: String(r.owner_id), grantee_id: String(r.grantee_id), granted: Boolean(r.granted), updated_at: iso(r.updated_at) };
}
function toInvite(r: Row): FriendInvite {
  return {
    id: String(r.id),
    token: String(r.token),
    inviter_id: String(r.inviter_id),
    created_at: iso(r.created_at),
    expires_at: iso(r.expires_at),
    accepted_by: (r.accepted_by as string | null) ?? null,
    accepted_at: isoOrNull(r.accepted_at),
  };
}
function toRecipient(r: Row): SosRecipient {
  return {
    request_id: String(r.request_id),
    recipient_id: String(r.recipient_id),
    first_read_at: isoOrNull(r.first_read_at),
    push_status: r.push_status as PushStatus,
    push_error: (r.push_error as string | null) ?? null,
    push_attempted_at: isoOrNull(r.push_attempted_at),
    response: (r.response as SosResponse | null) ?? null,
    responded_at: isoOrNull(r.responded_at),
  };
}
function toRequest(r: Row): SosRequest {
  return {
    id: String(r.id),
    sender_id: String(r.sender_id),
    message: String(r.message),
    idempotency_key: String(r.idempotency_key),
    created_at: iso(r.created_at),
    situation_snapshot: (r.situation_snapshot as SituationSnapshot | null) ?? null,
    cancelled_at: isoOrNull(r.cancelled_at),
  };
}

const FRIEND_IDS_SQL = `select case when user_low = $1 then user_high else user_low end as fid from friendships where $1 in (user_low, user_high)`;

/** docker(local) 모드: 컨테이너 Postgres + 앱 세션 쿠키 + 파일 저장. 모든 조회에 소유자/수신자 조건을 건다. */
export class LocalBackend implements DataBackend {
  readonly kind = "local" as const;

  async getSessionUser(): Promise<SessionUser | null> {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { rows } = await getPool().query(
      `select u.id, u.email from sessions s join users u on u.id = s.user_id where s.token = $1 and s.expires_at > now()`,
      [token],
    );
    if (!rows[0]) return null;
    return { id: String(rows[0].id), email: String(rows[0].email) };
  }

  async signIn(login: string, password: string): Promise<SignInResult> {
    const key = login.trim().toLowerCase();
    const { rows } = key.includes("@")
      ? await getPool().query(`select id, email, password_hash from users where email = $1`, [key])
      : await getPool().query(`select id, email, password_hash from users where username = $1`, [key]);
    const row = rows[0];
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      return { ok: false, message: "아이디 또는 비밀번호가 맞지 않아요." };
    }
    return this.startSession(String(row.id), String(row.email));
  }

  private async startSession(userId: string, email: string): Promise<SignInResult> {
    const token = newSessionToken();
    const expires = new Date(Date.now() + SESSION_TTL_MS);
    await getPool().query(`insert into sessions (token, user_id, expires_at) values ($1, $2, $3)`, [token, userId, expires]);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires, secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false" });
    return { ok: true, user: { id: userId, email } };
  }

  async isEmailRegistered(email: string): Promise<boolean> {
    const { rows } = await getPool().query(`select 1 from users where email = $1`, [email.toLowerCase()]);
    return rows.length > 0;
  }

  async signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
    const id = randomUUID();
    const e = email.toLowerCase();
    try {
      await getPool().query(`insert into users (id, email, password_hash, display_name) values ($1, $2, $3, $4)`, [id, e, hashPassword(password), displayNameFromEmail(e)]);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") return { ok: false, code: "taken", message: "이미 가입된 이메일이에요. 로그인해 주세요." };
      return { ok: false, code: "error", message: `가입 실패: ${err instanceof Error ? err.message : "unknown"}` };
    }
    const r = await this.startSession(id, e);
    return r.ok ? { ok: true, user: r.user } : { ok: false, code: "error", message: r.message };
  }

  async getEmailVerification(email: string): Promise<EmailVerification | null> {
    const { rows } = await getPool().query(`select * from email_verifications where email = $1`, [email]);
    return rows[0] ? verificationFromRow(rows[0] as Record<string, unknown>) : null;
  }

  async putEmailVerification(row: EmailVerification): Promise<void> {
    const r = verificationToRow(row);
    await getPool().query(
      `insert into email_verifications (email, code_hash, expires_at, attempts, sent_count, window_started_at, last_sent_at, verified_at, ticket_hash, ticket_expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = excluded.attempts, sent_count = excluded.sent_count,
         window_started_at = excluded.window_started_at, last_sent_at = excluded.last_sent_at, verified_at = excluded.verified_at, ticket_hash = excluded.ticket_hash, ticket_expires_at = excluded.ticket_expires_at`,
      [r.email, r.code_hash, r.expires_at, r.attempts, r.sent_count, r.window_started_at, r.last_sent_at, r.verified_at, r.ticket_hash, r.ticket_expires_at],
    );
  }

  async deleteEmailVerification(email: string): Promise<void> {
    await getPool().query(`delete from email_verifications where email = $1`, [email]);
  }

  async hitRateLimit(key: string, windowMs: number, max: number): Promise<boolean> {
    const { rows } = await getPool().query(
      `insert into auth_rate_limits as r (key, count, window_started_at) values ($1, 1, now())
       on conflict (key) do update set
         count = case when r.window_started_at < now() - ($2::int * interval '1 millisecond') then 1 else r.count + 1 end,
         window_started_at = case when r.window_started_at < now() - ($2::int * interval '1 millisecond') then now() else r.window_started_at end
       returning count`,
      [key, windowMs],
    );
    return Number(rows[0]?.count ?? 0) <= max;
  }

  async signOut(): Promise<void> {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await getPool().query(`delete from sessions where token = $1`, [token]);
    store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  }

  // ---------- 프로필·설정·친구 ----------

  async getProfile(userId: string): Promise<ProfileLite | null> {
    const { rows } = await getPool().query(`select id, display_name from users where id = $1`, [userId]);
    return rows[0] ? { id: String(rows[0].id), display_name: String(rows[0].display_name) } : null;
  }

  async getProfiles(ids: string[]): Promise<ProfileLite[]> {
    if (ids.length === 0) return [];
    const { rows } = await getPool().query(`select id, display_name from users where id = any($1::uuid[])`, [ids]);
    return rows.map((r) => ({ id: String(r.id), display_name: String(r.display_name) }));
  }

  async getProfileFull(userId: string): Promise<Profile | null> {
    const { rows } = await getPool().query(`select * from users where id = $1`, [userId]);
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async updateSettings(userId: string, patch: SettingsPatch): Promise<Profile | null> {
    const sets: string[] = [];
    const vals: unknown[] = [userId];
    const push = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (patch.display_name !== undefined) push("display_name", patch.display_name);
    if (patch.curfew_time !== undefined) push("curfew_time", patch.curfew_time);
    if (patch.curfew_notify_minutes !== undefined) push("curfew_notify_minutes", patch.curfew_notify_minutes);
    if (patch.notify_curfew !== undefined) push("notify_curfew", patch.notify_curfew);
    if (patch.notify_sos !== undefined) push("notify_sos", patch.notify_sos);
    if (patch.notify_response !== undefined) push("notify_response", patch.notify_response);
    if (patch.theme !== undefined) push("theme", patch.theme);
    if (patch.phone !== undefined) push("phone", patch.phone);
    if (sets.length === 0) return this.getProfileFull(userId);
    // 통금 시각이 바뀌면 오늘 알림 여부를 초기화해 새 시각 기준으로 다시 알린다.
    if (patch.curfew_time !== undefined || patch.curfew_notify_minutes !== undefined) sets.push("curfew_notified_on = null");
    sets.push("updated_at = now()");
    const { rows } = await getPool().query(`update users set ${sets.join(", ")} where id = $1 returning *`, vals);
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async setTodayCurfew(userId: string, time: string, notifyMinutes: number, dateKey: string): Promise<Profile | null> {
    const { rows } = await getPool().query(
      `update users set curfew_override_time = $2, curfew_override_date = $3, curfew_notify_minutes = $4, curfew_notified_on = null, updated_at = now() where id = $1 returning *`,
      [userId, time, dateKey, notifyMinutes],
    );
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async getFriends(userId: string): Promise<ProfileLite[]> {
    const { rows } = await getPool().query(
      `select u.id, u.display_name from friendships f
         join users u on u.id = case when f.user_low = $1 then f.user_high else f.user_low end
        where $1 in (f.user_low, f.user_high) order by u.display_name, u.id`,
      [userId],
    );
    return rows.map((r) => ({ id: String(r.id), display_name: String(r.display_name) }));
  }

  async getFriendsWithConsent(userId: string): Promise<FriendWithConsent[]> {
    const friends = await this.getFriends(userId);
    if (friends.length === 0) return [];
    const ids = friends.map((f) => f.id);
    const [{ rows: consents }, { rows: counts }] = await Promise.all([
      getPool().query(`select owner_id, grantee_id, granted from photo_consents where (owner_id = $1 and grantee_id = any($2::uuid[])) or (grantee_id = $1 and owner_id = any($2::uuid[]))`, [userId, ids]),
      getPool().query(`select user_id, count(*)::int as n from profile_photos where user_id = any($1::uuid[]) group by user_id`, [ids]),
    ]);
    const countOf = new Map(counts.map((r) => [String(r.user_id), Number(r.n)]));
    return friends.map((f) => ({
      ...f,
      allowsMe: consents.some((c) => String(c.owner_id) === f.id && String(c.grantee_id) === userId && Boolean(c.granted)),
      iAllow: consents.some((c) => String(c.owner_id) === userId && String(c.grantee_id) === f.id && Boolean(c.granted)),
      photoCount: countOf.get(f.id) ?? 0,
    }));
  }

  // ---------- 오늘의 상황 ----------

  async listSituations(userId: string): Promise<Situation[]> {
    const { rows } = await getPool().query(`select * from situations where user_id = $1 order by target_date desc, created_at desc limit 200`, [userId]);
    return rows.map(toSituation);
  }

  async getSituation(userId: string, id: string): Promise<Situation | null> {
    const { rows } = await getPool().query(`select * from situations where id = $1 and user_id = $2`, [id, userId]);
    return rows[0] ? toSituation(rows[0]) : null;
  }

  async createSituation(userId: string, input: SituationWrite): Promise<Situation> {
    const { rows } = await getPool().query(
      `insert into situations (id, user_id, target_date, place, companion, companion_ids, real_name, real_phone, memo, summary)
       values ($1, $2, $3, $4, $5, $6::uuid[], $7, $8, $9, $10) returning *`,
      [randomUUID(), userId, input.target_date, input.place, input.companion, input.companion_ids, input.real_name, input.real_phone, input.memo, input.summary],
    );
    return toSituation(rows[0]);
  }

  async updateSituation(userId: string, id: string, input: SituationWrite): Promise<Situation | null> {
    const { rows } = await getPool().query(
      `update situations set target_date = $3, place = $4, companion = $5, companion_ids = $6::uuid[], real_name = $7, real_phone = $8, memo = $9, summary = $10, updated_at = now()
        where id = $1 and user_id = $2 returning *`,
      [id, userId, input.target_date, input.place, input.companion, input.companion_ids, input.real_name, input.real_phone, input.memo, input.summary],
    );
    return rows[0] ? toSituation(rows[0]) : null;
  }

  async setSituationSummary(userId: string, id: string, summary: string): Promise<void> {
    await getPool().query(`update situations set summary = $3 where id = $1 and user_id = $2`, [id, userId, summary.slice(0, 600)]);
  }

  async deleteSituation(userId: string, id: string): Promise<DeleteResult> {
    const { rowCount } = await getPool().query(`delete from situations where id = $1 and user_id = $2`, [id, userId]);
    return rowCount ? { ok: true } : { ok: false, code: "not_found", message: "상황을 찾을 수 없어요." };
  }

  async chooseSituation(userId: string, id: string): Promise<Situation | null> {
    const { rows } = await getPool().query(`update situations set chosen_at = now(), updated_at = now() where id = $1 and user_id = $2 returning *`, [id, userId]);
    return rows[0] ? toSituation(rows[0]) : null;
  }

  // ---------- AI 프로필 사진·동의·초대 ----------

  async listProfilePhotos(userId: string): Promise<ProfilePhoto[]> {
    const { rows } = await getPool().query(`select * from profile_photos where user_id = $1 order by created_at asc`, [userId]);
    return rows.map(toPhoto);
  }

  async listUsablePhotos(userId: string): Promise<UsablePerson[]> {
    const [me, friends, mine] = await Promise.all([this.getProfile(userId), this.getFriendsWithConsent(userId), this.listProfilePhotos(userId)]);
    const out: UsablePerson[] = [];
    if (me) out.push({ person: me, isSelf: true, consented: true, photos: mine });
    const consentedIds = friends.filter((f) => f.allowsMe).map((f) => f.id);
    const { rows } = consentedIds.length
      ? await getPool().query(`select * from profile_photos where user_id = any($1::uuid[]) order by created_at asc`, [consentedIds])
      : { rows: [] as Row[] };
    for (const f of friends) {
      out.push({ person: { id: f.id, display_name: f.display_name }, isSelf: false, consented: f.allowsMe, photos: f.allowsMe ? rows.filter((r) => String(r.user_id) === f.id).map(toPhoto) : [] });
    }
    return out;
  }

  async addProfilePhoto(userId: string, slot: PhotoSlot, bytes: Uint8Array, mediaType: string): Promise<ProfilePhoto> {
    const id = randomUUID();
    const path = `${userId}/profile/${id}.${extensionFor(mediaType)}`;
    await putObject(path, bytes);
    if (slot !== "extra") {
      const { rows } = await getPool().query(`delete from profile_photos where user_id = $1 and slot = $2 returning storage_path`, [userId, slot]);
      for (const r of rows) await removeWithThumbs(String(r.storage_path)).catch(() => undefined);
    }
    const { rows } = await getPool().query(
      `insert into profile_photos (id, user_id, slot, storage_path, media_type) values ($1, $2, $3, $4, $5) returning *`,
      [id, userId, slot, path, mediaType],
    );
    return toPhoto(rows[0]);
  }

  async deleteProfilePhoto(userId: string, id: string): Promise<DeleteResult> {
    const { rows } = await getPool().query(`delete from profile_photos where id = $1 and user_id = $2 returning storage_path`, [id, userId]);
    if (!rows[0]) return { ok: false, code: "not_found", message: "사진을 찾을 수 없어요." };
    await removeWithThumbs(String(rows[0].storage_path)).catch(() => undefined);
    return { ok: true };
  }

  async readProfilePhotoFile(viewerId: string, id: string, thumbWidth?: number | null): Promise<{ row: ProfilePhoto; bytes: Uint8Array; mediaType: string } | null> {
    const { rows } = await getPool().query(
      `select p.* from profile_photos p where p.id = $1 and (
         p.user_id = $2
         or (exists (select 1 from friendships f where least(p.user_id, $2::uuid) = f.user_low and greatest(p.user_id, $2::uuid) = f.user_high)
             and exists (select 1 from photo_consents c where c.owner_id = p.user_id and c.grantee_id = $2 and c.granted)))`,
      [id, viewerId],
    );
    if (!rows[0]) return null;
    const row = toPhoto(rows[0]);
    if (thumbWidth) {
      const thumb = await localThumb(row.storage_path, thumbWidth);
      if (thumb) return { row, bytes: thumb, mediaType: "image/webp" };
    }
    const bytes = await getObject(row.storage_path);
    return bytes ? { row, bytes, mediaType: row.media_type } : null;
  }

  async listConsentsGiven(ownerId: string): Promise<PhotoConsent[]> {
    const { rows } = await getPool().query(`select * from photo_consents where owner_id = $1`, [ownerId]);
    return rows.map(toConsent);
  }

  async setConsent(ownerId: string, granteeId: string, granted: boolean): Promise<PhotoConsent | null> {
    const { rows: fr } = await getPool().query(`select 1 from friendships where user_low = least($1::uuid, $2::uuid) and user_high = greatest($1::uuid, $2::uuid)`, [ownerId, granteeId]);
    if (!fr[0]) return null;
    const { rows } = await getPool().query(
      `insert into photo_consents (owner_id, grantee_id, granted) values ($1, $2, $3)
       on conflict (owner_id, grantee_id) do update set granted = excluded.granted, updated_at = now() returning *`,
      [ownerId, granteeId, granted],
    );
    return toConsent(rows[0]);
  }

  async createInvite(userId: string): Promise<FriendInvite> {
    const token = randomBytes(18).toString("base64url");
    const { rows } = await getPool().query(
      `insert into friend_invites (id, token, inviter_id, expires_at) values ($1, $2, $3, now() + interval '7 days') returning *`,
      [randomUUID(), token, userId],
    );
    return toInvite(rows[0]);
  }

  async getInvite(token: string): Promise<{ invite: FriendInvite; inviterName: string } | null> {
    const { rows } = await getPool().query(`select i.*, u.display_name from friend_invites i join users u on u.id = i.inviter_id where i.token = $1`, [token]);
    if (!rows[0]) return null;
    return { invite: toInvite(rows[0]), inviterName: String(rows[0].display_name) };
  }

  async acceptInvite(userId: string, token: string): Promise<AcceptInviteResult> {
    const found = await this.getInvite(token);
    if (!found) return { ok: false, code: "not_found", message: "초대 링크를 찾을 수 없어요." };
    const inv = found.invite;
    if (inv.inviter_id === userId) return { ok: false, code: "self", message: "내가 만든 초대 링크예요." };
    if (new Date(inv.expires_at).getTime() < Date.now()) return { ok: false, code: "expired", message: "초대 링크가 만료됐어요." };
    if (inv.accepted_at && inv.accepted_by !== userId) return { ok: false, code: "used", message: "이미 사용된 초대 링크예요." };
    const [low, high] = userId < inv.inviter_id ? [userId, inv.inviter_id] : [inv.inviter_id, userId];
    const { rows: existing } = await getPool().query(`select 1 from friendships where user_low = $1 and user_high = $2`, [low, high]);
    await getPool().query(`insert into friendships (user_low, user_high) values ($1, $2) on conflict do nothing`, [low, high]);
    await getPool().query(`update friend_invites set accepted_by = $2, accepted_at = coalesce(accepted_at, now()) where id = $1`, [inv.id, userId]);
    return { ok: true, friendId: inv.inviter_id, friendName: found.inviterName, alreadyFriends: Boolean(existing[0]) };
  }

  // ---------- 생성 사진 ----------

  async listGenerations(userId: string): Promise<ImageGeneration[]> {
    const { rows } = await getPool().query(`select * from image_generations where owner_id = $1 order by created_at desc limit 200`, [userId]);
    return rows.map(toGeneration);
  }

  async getGeneration(userId: string, id: string): Promise<ImageGeneration | null> {
    const { rows } = await getPool().query(`select * from image_generations where id = $1 and owner_id = $2`, [id, userId]);
    return rows[0] ? toGeneration(rows[0]) : null;
  }

  async persistGeneration(input: PersistInput): Promise<ImageGeneration> {
    const id = randomUUID();
    const path = `${input.userId}/${id}.${extensionFor(input.mediaType)}`;
    await putObject(path, input.bytes);
    try {
      const { rows } = await getPool().query(
        `insert into image_generations (id, owner_id, mode, status, storage_path, media_type, prompt_text, model_id, parent_id, version, place_tag, params)
         values ($1, $2, $3, 'completed', $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
        [id, input.userId, input.mode, path, input.mediaType, input.promptText ?? null, input.modelId ?? null, input.parentId ?? null, input.version ?? 1, input.placeTag ?? null, input.params ? JSON.stringify(input.params) : null],
      );
      return toGeneration(rows[0]);
    } catch (err) {
      await removeWithThumbs(path).catch(() => undefined);
      throw new Error(`저장 실패(db): ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  async readGenerationFile(userId: string, id: string, thumbWidth?: number | null): Promise<{ row: ImageGeneration; bytes: Uint8Array; mediaType: string } | null> {
    const row = await this.getGeneration(userId, id);
    if (!row) return null;
    if (thumbWidth) {
      const thumb = await localThumb(row.storage_path, thumbWidth);
      if (thumb) return { row, bytes: thumb, mediaType: "image/webp" };
    }
    const bytes = await getObject(row.storage_path);
    if (!bytes) return null;
    return { row, bytes, mediaType: row.media_type };
  }

  async deleteGeneration(userId: string, id: string): Promise<DeleteResult> {
    const row = await this.getGeneration(userId, id);
    if (!row) return { ok: false, code: "not_found", message: "내역을 찾을 수 없어요." };
    try {
      await removeWithThumbs(row.storage_path);
    } catch (err) {
      return { ok: false, code: "file_delete_failed", message: `파일 삭제 실패: ${err instanceof Error ? err.message : "unknown"}. 내역은 유지됩니다.` };
    }
    await getPool().query(`delete from image_generations where id = $1 and owner_id = $2`, [id, userId]);
    return { ok: true };
  }

  async overwriteGeneration(userId: string, targetId: string, sourceId: string): Promise<DeleteResult> {
    const [target, source] = await Promise.all([this.getGeneration(userId, targetId), this.getGeneration(userId, sourceId)]);
    if (!target || !source) return { ok: false, code: "not_found", message: "사진을 찾을 수 없어요." };
    if (target.id === source.id) return { ok: true };
    await getPool().query(
      `update image_generations set storage_path = $3, media_type = $4, params = $5, version = $6, updated_at = now() where id = $1 and owner_id = $2`,
      [targetId, userId, source.storage_path, source.media_type, source.params ? JSON.stringify(source.params) : null, source.version],
    );
    // 편집본 행은 지우되 파일은 이제 원본 행이 가리키므로 남긴다. 이전 원본 파일은 제거한다.
    await getPool().query(`update image_generations set parent_id = $1 where parent_id = $2`, [targetId, sourceId]);
    await getPool().query(`delete from image_generations where id = $1 and owner_id = $2`, [sourceId, userId]);
    await removeWithThumbs(target.storage_path).catch(() => undefined);
    return { ok: true };
  }

  // ---------- SOS ----------

  async createSosRequest(userId: string, idempotencyKey: string, message: string, recipientIds: string[] | null, snapshot: SituationSnapshot | null): Promise<CreateSosResult> {
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) return { ok: false, code: "invalid", message: "요청 식별자가 올바르지 않아요." };
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const existing = await client.query(`select id from sos_requests where sender_id = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
      if (existing.rows[0]) {
        await client.query("commit");
        return { ok: true, requestId: String(existing.rows[0].id), created: false };
      }
      const friends = await client.query(FRIEND_IDS_SQL, [userId]);
      const friendIds = friends.rows.map((r) => String(r.fid));
      if (friendIds.length === 0) {
        await client.query("rollback");
        return { ok: false, code: "no_friends", message: "등록된 친구가 없어 보낼 수 없어요." };
      }
      let targets = friendIds;
      if (recipientIds) {
        const unique = [...new Set(recipientIds)];
        targets = unique.filter((id) => friendIds.includes(id));
        if (targets.length !== unique.length) {
          await client.query("rollback");
          return { ok: false, code: "invalid", message: "친구가 아닌 수신자가 있어요." };
        }
        if (targets.length === 0) {
          await client.query("rollback");
          return { ok: false, code: "no_friends", message: "받을 친구를 골라 주세요." };
        }
      }
      const id = randomUUID();
      await client.query(`insert into sos_requests (id, sender_id, message, idempotency_key, situation_snapshot) values ($1, $2, $3, $4, $5)`, [id, userId, message, idempotencyKey, snapshot ? JSON.stringify(snapshot) : null]);
      for (const fid of targets) {
        await client.query(`insert into sos_recipients (request_id, recipient_id) values ($1, $2) on conflict do nothing`, [id, fid]);
      }
      await client.query("commit");
      return { ok: true, requestId: id, created: true };
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      const again = await getPool().query(`select id from sos_requests where sender_id = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
      if (again.rows[0]) return { ok: true, requestId: String(again.rows[0].id), created: false };
      return { ok: false, code: "error", message: `요청 기록 실패: ${err instanceof Error ? err.message : "unknown"}` };
    } finally {
      client.release();
    }
  }

  async getSosRequest(userId: string, requestId: string): Promise<SosRequest | null> {
    const { rows } = await getPool().query(
      `select r.* from sos_requests r where r.id = $1 and (r.sender_id = $2 or exists (select 1 from sos_recipients rc where rc.request_id = r.id and rc.recipient_id = $2))`,
      [requestId, userId],
    );
    return rows[0] ? toRequest(rows[0]) : null;
  }

  async getSosRecipients(userId: string, requestId: string): Promise<SosRecipient[]> {
    const { rows } = await getPool().query(
      `select rc.* from sos_recipients rc join sos_requests r on r.id = rc.request_id
        where rc.request_id = $1 and (r.sender_id = $2 or rc.recipient_id = $2)`,
      [requestId, userId],
    );
    return rows.map(toRecipient);
  }

  async getSosStatus(userId: string, requestId: string): Promise<SosStatusRow[] | null> {
    const req = await this.getSosRequest(userId, requestId);
    if (!req) return null;
    const { rows } = await getPool().query(
      `select rc.*, u.display_name from sos_recipients rc join users u on u.id = rc.recipient_id where rc.request_id = $1 order by u.display_name, u.id`,
      [requestId],
    );
    return rows.map((r) => ({
      recipientId: String(r.recipient_id),
      name: String(r.display_name),
      firstReadAt: isoOrNull(r.first_read_at),
      pushStatus: r.push_status as PushStatus,
      response: (r.response as SosResponse | null) ?? null,
      respondedAt: isoOrNull(r.responded_at),
    }));
  }

  async markSosRead(userId: string, requestId: string): Promise<MarkReadResult> {
    const updated = await getPool().query(
      `update sos_recipients set first_read_at = now() where request_id = $1 and recipient_id = $2 and first_read_at is null returning first_read_at`,
      [requestId, userId],
    );
    if (updated.rows[0]) return { ok: true, firstReadAt: iso(updated.rows[0].first_read_at) };
    const existing = await getPool().query(`select first_read_at from sos_recipients where request_id = $1 and recipient_id = $2`, [requestId, userId]);
    if (!existing.rows[0]) return { ok: false, code: "not_a_recipient", message: "이 요청의 수신자가 아니에요." };
    return { ok: true, firstReadAt: isoOrNull(existing.rows[0].first_read_at) };
  }

  async respondSos(userId: string, requestId: string, response: SosResponse): Promise<RespondResult> {
    const { rows: req } = await getPool().query(`select cancelled_at from sos_requests where id = $1`, [requestId]);
    if (req[0]?.cancelled_at) return { ok: false, code: "cancelled", message: "취소된 요청이에요." };
    const { rows } = await getPool().query(
      `update sos_recipients set response = $3, responded_at = now(), first_read_at = coalesce(first_read_at, now())
        where request_id = $1 and recipient_id = $2 returning responded_at`,
      [requestId, userId, response],
    );
    if (!rows[0]) return { ok: false, code: "not_a_recipient", message: "이 요청의 수신자가 아니에요." };
    return { ok: true, respondedAt: iso(rows[0].responded_at) };
  }

  async cancelSos(userId: string, requestId: string): Promise<DeleteResult> {
    const { rowCount } = await getPool().query(`update sos_requests set cancelled_at = coalesce(cancelled_at, now()) where id = $1 and sender_id = $2`, [requestId, userId]);
    return rowCount ? { ok: true } : { ok: false, code: "not_found", message: "요청을 찾을 수 없어요." };
  }

  async listReceived(userId: string): Promise<ReceivedItem[]> {
    const { rows } = await getPool().query(
      `select rc.request_id, rc.first_read_at, rc.response, r.created_at, r.sender_id, r.cancelled_at, r.situation_snapshot, u.display_name
         from sos_recipients rc join sos_requests r on r.id = rc.request_id join users u on u.id = r.sender_id
        where rc.recipient_id = $1 order by r.created_at desc limit 100`,
      [userId],
    );
    return rows.map((r) => ({
      requestId: String(r.request_id),
      createdAt: iso(r.created_at),
      senderId: String(r.sender_id),
      senderName: String(r.display_name),
      firstReadAt: isoOrNull(r.first_read_at),
      response: (r.response as SosResponse | null) ?? null,
      cancelledAt: isoOrNull(r.cancelled_at),
      place: ((r.situation_snapshot as SituationSnapshot | null)?.place ?? null) || null,
    }));
  }

  async listSent(userId: string): Promise<SentItem[]> {
    const { rows } = await getPool().query(
      `select r.id, r.created_at, r.cancelled_at, count(rc.*)::int as total, count(rc.first_read_at)::int as read, count(rc.response)::int as responded
         from sos_requests r left join sos_recipients rc on rc.request_id = r.id
        where r.sender_id = $1 group by r.id order by r.created_at desc limit 50`,
      [userId],
    );
    return rows.map((r) => ({ requestId: String(r.id), createdAt: iso(r.created_at), total: Number(r.total), read: Number(r.read), responded: Number(r.responded), cancelledAt: isoOrNull(r.cancelled_at) }));
  }

  async countUnread(userId: string): Promise<number> {
    const { rows } = await getPool().query(
      `select count(*)::int as n from sos_recipients rc join sos_requests r on r.id = rc.request_id where rc.recipient_id = $1 and rc.first_read_at is null and r.cancelled_at is null`,
      [userId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  // ---------- 푸시 ----------

  async updatePushStatus(requestId: string, recipientId: string, status: PushStatus, error: string | null): Promise<void> {
    await getPool().query(`update sos_recipients set push_status = $3, push_error = $4, push_attempted_at = now() where request_id = $1 and recipient_id = $2`, [requestId, recipientId, status, error]);
  }

  async getSubscriptionsFor(userIds: string[]): Promise<PushSub[]> {
    if (userIds.length === 0) return [];
    const { rows } = await getPool().query(`select id, user_id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::uuid[])`, [userIds]);
    return rows.map((r) => ({ id: String(r.id), user_id: String(r.user_id), endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) }));
  }

  async deleteSubscriptions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await getPool().query(`delete from push_subscriptions where id = any($1::uuid[])`, [ids]);
  }

  async upsertSubscription(userId: string, endpoint: string, p256dh: string, auth: string, userAgent: string | null): Promise<void> {
    await getPool().query(
      `insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent) values ($1, $2, $3, $4, $5, $6)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, updated_at = now()`,
      [randomUUID(), userId, endpoint, p256dh, auth, userAgent],
    );
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await getPool().query(`delete from push_subscriptions where user_id = $1 and endpoint = $2`, [userId, endpoint]);
  }

  async listNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
    const { rows } = await getPool().query(
      `select n.*, u.display_name as from_name from notifications n left join users u on u.id = n.from_id where n.user_id = $1 order by n.created_at desc limit $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      kind: r.kind as NotificationKind,
      from_id: (r.from_id as string | null) ?? null,
      from_name: (r.from_name as string | null) ?? null,
      text: String(r.text),
      link: (r.link as string | null) ?? null,
      read_at: isoOrNull(r.read_at),
      created_at: iso(r.created_at),
    }));
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const { rows } = await getPool().query(`select count(*)::int as n from notifications where user_id = $1 and read_at is null`, [userId]);
    return Number(rows[0]?.n ?? 0);
  }

  async markNotificationsRead(userId: string, ids: string[] | null, link?: string): Promise<void> {
    if (link) {
      await getPool().query(`update notifications set read_at = now() where user_id = $1 and link = $2 and read_at is null`, [userId, link]);
      return;
    }
    if (ids === null) {
      await getPool().query(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [userId]);
      return;
    }
    if (ids.length === 0) return;
    await getPool().query(`update notifications set read_at = now() where user_id = $1 and id = any($2::uuid[]) and read_at is null`, [userId, ids]);
  }

  async addNotifications(rows: NewNotification[]): Promise<void> {
    for (const n of rows) {
      await getPool().query(`insert into notifications (id, user_id, kind, from_id, text, link) values ($1, $2, $3, $4, $5, $6)`, [randomUUID(), n.userId, n.kind, n.fromId, n.text.slice(0, 300), n.link]);
    }
  }

  async getNotifyPrefs(userIds: string[]): Promise<Map<string, { notifySos: boolean; notifyResponse: boolean }>> {
    const map = new Map<string, { notifySos: boolean; notifyResponse: boolean }>();
    if (userIds.length === 0) return map;
    const { rows } = await getPool().query(`select id, notify_sos, notify_response from users where id = any($1::uuid[])`, [userIds]);
    for (const r of rows) map.set(String(r.id), { notifySos: Boolean(r.notify_sos), notifyResponse: Boolean(r.notify_response) });
    return map;
  }

  async listCurfewCandidates(): Promise<CurfewCandidate[]> {
    const { rows } = await getPool().query(`select id, curfew_time, curfew_override_time, curfew_override_date, curfew_notify_minutes, curfew_notified_on from users where notify_curfew`);
    return rows.map((r) => ({
      userId: String(r.id),
      curfewTime: hm(r.curfew_time),
      overrideTime: r.curfew_override_time == null ? null : hm(r.curfew_override_time),
      overrideDate: r.curfew_override_date == null ? null : String(r.curfew_override_date).slice(0, 10),
      notifyMinutes: Number(r.curfew_notify_minutes ?? 30),
      notifiedOn: r.curfew_notified_on == null ? null : String(r.curfew_notified_on).slice(0, 10),
    }));
  }

  async markCurfewNotified(userId: string, dateKey: string): Promise<void> {
    await getPool().query(`update users set curfew_notified_on = $2 where id = $1`, [userId, dateKey]);
  }

  // ---------- 설정 ----------

  async deleteUserData(userId: string): Promise<{ generations: number; situations: number }> {
    const gens = await this.listGenerations(userId);
    for (const g of gens) await removeWithThumbs(g.storage_path).catch(() => undefined);
    const { rowCount: g } = await getPool().query(`delete from image_generations where owner_id = $1`, [userId]);
    const { rowCount: s } = await getPool().query(`delete from situations where user_id = $1`, [userId]);
    return { generations: g ?? 0, situations: s ?? 0 };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [profile, friends, situations, generations, sent, received, consents, photos] = await Promise.all([
      this.getProfileFull(userId),
      this.getFriends(userId),
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
    await removeDir(userId).catch(() => undefined);
    await getPool().query(`delete from users where id = $1`, [userId]);
  }

  async purgeExpired(days: number): Promise<{ generations: number; situations: number }> {
    const { rows } = await getPool().query(`delete from image_generations where created_at < now() - ($1 || ' days')::interval returning storage_path`, [String(days)]);
    for (const r of rows) await removeWithThumbs(String(r.storage_path)).catch(() => undefined);
    const { rowCount } = await getPool().query(`delete from situations where target_date < (now() at time zone 'Asia/Seoul')::date - $1::int`, [days]);
    await getPool().query(`delete from email_verifications where last_sent_at < now() - interval '1 day'`);
    await getPool().query(`delete from auth_rate_limits where window_started_at < now() - interval '1 day'`);
    return { generations: rows.length, situations: rowCount ?? 0 };
  }
}
