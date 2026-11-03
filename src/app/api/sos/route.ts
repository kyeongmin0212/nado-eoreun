import { NextResponse } from "next/server";
import { SOS_MESSAGE, SOS_TITLE, sosBody } from "@/lib/copy";
import { pushToUsers } from "@/lib/push/notify";
import { notifyFriendSos } from "@/lib/notify";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { activeSituation, toSnapshot } from "@/lib/situations";
import type { PushStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * SOS 발송: 인증 → 오늘 활성 상황 스냅샷(실제 동행인 연락처 포함, 받은 친구에게만 공개) →
 * 요청+수신자 기록(idempotent) → 알림 센터 행 → Web Push. 알림을 끈 친구는 `muted` (앱 안 알림에는 남는다).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized", message: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { idempotencyKey?: string; recipientIds?: string[] | null } | null;
  const key = body?.idempotencyKey;
  if (!key || typeof key !== "string" || key.length < 8 || key.length > 128) {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "요청 식별자가 올바르지 않아요." }, { status: 400 });
  }
  let recipientIds: string[] | null = null;
  if (Array.isArray(body?.recipientIds)) {
    recipientIds = body!.recipientIds!.filter((x) => typeof x === "string").slice(0, 50);
    if (recipientIds.length === 0) return NextResponse.json({ ok: false, code: "invalid_input", message: "받을 친구를 골라 주세요." }, { status: 400 });
  }

  const data = await getData();
  const [situations, profile] = await Promise.all([data.listSituations(user.id), data.getProfile(user.id)]);
  const senderName = profile?.display_name ?? "친구";
  const active = activeSituation(situations);
  const snapshot = active ? toSnapshot(active, senderName) : null;

  const created = await data.createSosRequest(user.id, key, SOS_MESSAGE, recipientIds, snapshot);
  if (!created.ok) {
    const status = created.code === "no_friends" ? 409 : created.code === "invalid" ? 400 : 500;
    return NextResponse.json({ ok: false, code: created.code, message: created.message }, { status });
  }
  const requestId = created.requestId;

  // 아직 발송 시도하지 않은 수신자만 발송 (재시도·중복 클릭에도 중복 알림 방지)
  const rows = await data.getSosRecipients(user.id, requestId);
  const pending = rows.filter((r) => r.push_status === "pending");
  const outcomes = new Map<string, { status: PushStatus; error?: string }>();
  if (pending.length > 0) {
    await notifyFriendSos(data, requestId, user.id, senderName, pending.map((r) => r.recipient_id)).catch((e) => console.warn("[sos] notification insert failed", e));
    const prefs = await data.getNotifyPrefs(pending.map((r) => r.recipient_id));
    const targets = pending.filter((r) => prefs.get(r.recipient_id)?.notifySos !== false).map((r) => r.recipient_id);
    for (const r of pending) if (!targets.includes(r.recipient_id)) outcomes.set(r.recipient_id, { status: "muted" });
    const payload = { title: SOS_TITLE, body: sosBody(senderName), url: `/sos/${requestId}?via=push`, tag: `sos-${requestId}` };
    for (const [id, o] of await pushToUsers(data, targets, payload)) outcomes.set(id, o);
    await Promise.all([...outcomes].map(([id, o]) => data.updatePushStatus(requestId, id, o.status, o.error ?? null)));
  }

  const all = rows.map((r) => outcomes.get(r.recipient_id)?.status ?? r.push_status);
  const summary = {
    total: rows.length,
    sent: all.filter((s) => s === "sent").length,
    noSubscription: all.filter((s) => s === "no_subscription").length,
    failed: all.filter((s) => s === "failed").length,
    muted: all.filter((s) => s === "muted").length,
  };
  console.info("[sos] request", { requestId, created: created.created, summary });
  return NextResponse.json({ ok: true, id: requestId, created: created.created, summary });
}
