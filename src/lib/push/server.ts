import webpush, { WebPushError } from "web-push";
import { isPushConfigured } from "@/lib/env";

export type PushPayload = {
  title: string;
  body: string;
  url: string; // 같은 origin 의 상대 경로만
  tag?: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; gone: boolean; statusCode?: number; message: string };

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!isPushConfigured()) {
    throw new Error("Web Push 연결 대기: VAPID 환경변수가 설정되지 않았습니다.");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
}

/** 단일 구독에 발송. 404/410 은 구독 만료(gone) 로 구분한다. 수락 응답은 기기 도착 증거가 아니다. */
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<SendResult> {
  ensureConfigured();
  try {
    // topic 헤더는 넣지 않는다(일부 푸시 서비스 호환성). 같은 알림 묶음은 서비스 워커의 tag 로 처리한다.
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60 * 4, // 4시간 안에 전달되지 않으면 푸시 서비스가 폐기
      urgency: "high",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof WebPushError) {
      const gone = err.statusCode === 404 || err.statusCode === 410;
      return { ok: false, gone, statusCode: err.statusCode, message: `push service ${err.statusCode}` };
    }
    const message = err instanceof Error ? err.message : "unknown error";
    return { ok: false, gone: false, message: message.slice(0, 200) };
  }
}
