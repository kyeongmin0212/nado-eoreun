import type { SosStatusRow } from "@/lib/data/types";
import type { PushStatus } from "@/lib/types";

export const PUSH_LABEL: Record<PushStatus, string> = {
  pending: "알림 발송 대기",
  sent: "알림 전송 완료",
  no_subscription: "알림 미설정 기기 · 앱 알림함에는 전달됨",
  failed: "알림 발송 실패 · 앱 알림함에는 전달됨",
  muted: "SOS 알림을 꺼둔 친구 · 앱 알림함에는 전달됨",
};

/** 발신자에게 보이는 친구 상태: 미확인 → 열람함 → 확인 · 통화 가능 */
export type FriendState = "unread" | "read" | "available";

export function friendState(r: SosStatusRow): FriendState {
  if (r.response === "available") return "available";
  if (r.firstReadAt) return "read";
  return "unread";
}

export const STATE_LABEL: Record<FriendState, string> = {
  unread: "미확인",
  read: "열람함",
  available: "확인 · 통화 가능",
};

/** 어두운 화면(SOS-03) 위 알약 색 */
export const STATE_PILL: Record<FriendState, string> = {
  unread: "bg-charcoal text-mist",
  read: "bg-end-bg text-end",
  available: "bg-peach text-ink",
};

/** 발송 상태 요약 (전송 완료 ≠ 친구 확인) */
export function deliverySummary(rows: SosStatusRow[]): { label: string; tone: "ok" | "wait" | "fail" } {
  if (rows.length === 0) return { label: "수신자 없음", tone: "fail" };
  if (rows.every((r) => r.pushStatus === "sent")) return { label: "전송 완료", tone: "ok" };
  if (rows.some((r) => r.pushStatus === "pending")) return { label: "전송 중", tone: "wait" };
  if (rows.some((r) => r.pushStatus === "sent")) return { label: "일부 전송 완료", tone: "wait" };
  if (rows.every((r) => r.pushStatus === "muted")) return { label: "알림 꺼둔 친구", tone: "wait" };
  if (rows.every((r) => r.pushStatus === "no_subscription" || r.pushStatus === "muted")) return { label: "앱 알림함에만 전달", tone: "wait" };
  return { label: "전송 실패", tone: "fail" };
}

export const TONE_PILL: Record<"ok" | "wait" | "fail", string> = {
  ok: "bg-ok-bg text-ok",
  wait: "bg-wait-bg text-wait",
  fail: "bg-[#f6d5d5] text-danger",
};
