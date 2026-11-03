import type { DataBackend } from "@/lib/data/types";
import type { PushStatus } from "@/lib/types";
import { isPushConfigured } from "@/lib/env";
import { sendPush, type PushPayload } from "@/lib/push/server";

export type PushOutcome = { status: PushStatus; error?: string };

/**
 * 여러 사용자의 모든 구독에 발송하고 사용자별 결과를 돌려준다.
 * `sent` 는 푸시 서비스의 수락 응답이며 기기 도착 증거가 아니다. 404/410 구독은 정리한다.
 */
export async function pushToUsers(data: DataBackend, userIds: string[], payload: PushPayload): Promise<Map<string, PushOutcome>> {
  const out = new Map<string, PushOutcome>();
  if (userIds.length === 0) return out;
  if (!isPushConfigured()) {
    // 서버에 푸시 키가 없으면(docker 등) 휴대폰 알림은 보낼 수 없고 앱 알림함으로만 전달된다. 실패로 표시하지 않는다.
    for (const id of userIds) out.set(id, { status: "no_subscription", error: "push_not_configured" });
    return out;
  }
  const subs = await data.getSubscriptionsFor(userIds);
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const goneIds: string[] = [];
  // 사용자·기기별 발송을 한꺼번에 보낸다 (여러 친구에게 SOS 를 보낼 때 순서대로 기다리지 않는다).
  await Promise.all(
    userIds.map(async (id) => {
      const list = byUser.get(id) ?? [];
      if (list.length === 0) {
        out.set(id, { status: "no_subscription" });
        return;
      }
      const results = await Promise.all(list.map((s) => sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload).then((res) => ({ s, res }))));
      for (const { s, res } of results) if (!res.ok && res.gone) goneIds.push(s.id);
      if (results.some(({ res }) => res.ok)) {
        out.set(id, { status: "sent" });
      } else {
        const first = results.find(({ res }) => !res.ok)?.res;
        out.set(id, { status: results.every(({ res }) => !res.ok && res.gone) ? "no_subscription" : "failed", error: first && !first.ok ? first.message : "unknown" });
      }
    }),
  );
  await data.deleteSubscriptions(goneIds);
  return out;
}
