"use client";

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSupport = {
  supported: boolean;
  reason?: "no-sw" | "no-push" | "no-notification" | "ios-not-installed";
  standalone: boolean;
  ios: boolean;
};

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, standalone: false, ios: false };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "no-sw", standalone, ios };
  if (!("Notification" in window)) {
    return { supported: false, reason: ios && !standalone ? "ios-not-installed" : "no-notification", standalone, ios };
  }
  if (!("PushManager" in window)) {
    return { supported: false, reason: ios && !standalone ? "ios-not-installed" : "no-push", standalone, ios };
  }
  return { supported: true, standalone, ios };
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** 이미 등록된 서비스 워커의 구독. 서비스 워커가 없으면 기다리지 않고 null. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  // 서비스 워커가 준비되지 않으면 무한정 기다리지 않는다 (차단된 환경·등록 실패).
  const reg = await withTimeout(navigator.serviceWorker.ready, 10_000, "알림 준비(서비스 워커)가 끝나지 않았어요. 앱을 다시 열어 주세요.");
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

/** 서버에 구독을 등록/갱신한다 (현재 로그인 사용자 소유로). */
export async function registerSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent.slice(0, 200),
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || `구독 저장 실패 (${res.status})`);
  }
}

/** 로그아웃 전에 호출: 서버 행 삭제 + 브라우저 구독 해제. */
export async function removeSubscriptionForLogout(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    await withTimeout(
      (async () => {
        const sub = await getExistingSubscription();
        if (!sub) return;
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      })(),
      4000,
      "timeout",
    );
  } catch {
    // 로그아웃·탈퇴를 막지 않는다.
  }
}
