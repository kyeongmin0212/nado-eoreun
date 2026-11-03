import type { SettingsPatch, SituationInput } from "@/lib/types";
import { isValidDateKey } from "@/lib/time";

export type Invalid = { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 010-0000-0000 형식으로 정리 (숫자 9~11자리). 빈 값은 빈 문자열. */
export function normalizePhone(raw: string): string | null {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (d.length === 0) return "";
  if (d.length < 9 || d.length > 11) return null;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith("02") ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
}

/** 입력 중 자동 하이픈 (디자인 원본과 같은 규칙) */
export function formatPhoneInput(raw: string): string {
  const d = String(raw).replace(/[^0-9]/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function parseSituationInput(body: unknown): { ok: true; value: SituationInput } | Invalid {
  const b = (body ?? {}) as Record<string, unknown>;
  const target = String(b.target_date ?? "").trim();
  if (!isValidDateKey(target)) return { ok: false, message: "사용 날짜를 선택해 주세요." };
  const place = String(b.place ?? "").trim();
  const memo = String(b.memo ?? "").trim();
  const realName = String(b.real_name ?? "").trim();
  const phone = normalizePhone(String(b.real_phone ?? ""));
  if (place.length === 0) return { ok: false, message: "장소를 적어 주세요." };
  if (place.length > 80) return { ok: false, message: "장소는 80자 이하로 적어 주세요." };
  if (memo.length > 500) return { ok: false, message: "메모는 500자 이하로 적어 주세요." };
  if (realName.length > 40) return { ok: false, message: "실제 동행인 이름은 40자 이하로 적어 주세요." };
  if (phone === null) return { ok: false, message: "휴대폰 번호를 010-0000-0000 형식으로 적어 주세요." };
  const ids = Array.isArray(b.companion_ids) ? (b.companion_ids as unknown[]).map(String).filter((x) => UUID.test(x)) : [];
  if (ids.length > 10) return { ok: false, message: "동행인은 10명까지 고를 수 있어요." };
  return { ok: true, value: { target_date: target, place, companion_ids: [...new Set(ids)], real_name: realName, real_phone: phone, memo } };
}

export function parseSettingsPatch(body: unknown): { ok: true; value: SettingsPatch } | Invalid {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: SettingsPatch = {};
  if (b.display_name !== undefined) {
    const v = String(b.display_name).trim();
    if (v.length < 1 || v.length > 40) return { ok: false, message: "이름은 1~40자여야 해요." };
    out.display_name = v;
  }
  if (b.curfew_time !== undefined) {
    const v = String(b.curfew_time).slice(0, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return { ok: false, message: "통금 시각 형식이 올바르지 않아요." };
    out.curfew_time = v;
  }
  if (b.curfew_notify_minutes !== undefined) {
    const v = Number(b.curfew_notify_minutes);
    if (!Number.isInteger(v) || v < 0 || v > 180) return { ok: false, message: "알림 시간은 0~180분이어야 해요." };
    out.curfew_notify_minutes = v;
  }
  for (const key of ["notify_curfew", "notify_sos", "notify_response"] as const) {
    if (b[key] !== undefined) {
      if (typeof b[key] !== "boolean") return { ok: false, message: "알림 설정 값이 올바르지 않아요." };
      out[key] = b[key] as boolean;
    }
  }
  if (b.theme !== undefined) {
    const v = String(b.theme);
    if (!["light", "dark", "system"].includes(v)) return { ok: false, message: "화면 모드 값이 올바르지 않아요." };
    out.theme = v as SettingsPatch["theme"];
  }
  if (b.phone !== undefined) {
    const v = b.phone == null ? null : String(b.phone).trim().slice(0, 30);
    out.phone = v && v.length > 0 ? v : null;
  }
  return { ok: true, value: out };
}

/** 아이디: 영문 소문자·숫자·밑줄 4~20자 */
export const USERNAME_RULE = /^[a-z0-9_]{4,20}$/;
export const PASSWORD_MIN = 8;

export function checkUsername(raw: unknown): { ok: true; value: string } | Invalid {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!USERNAME_RULE.test(v)) return { ok: false, message: "아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 만들어 주세요." };
  return { ok: true, value: v };
}

export function checkPassword(raw: unknown): { ok: true; value: string } | Invalid {
  const v = String(raw ?? "");
  if (v.length < PASSWORD_MIN) return { ok: false, message: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.` };
  if (v.length > 72) return { ok: false, message: "비밀번호는 72자 이하로 만들어 주세요." };
  return { ok: true, value: v };
}
