"use client";

import { useCallback, useEffect, useState } from "react";
import { detectPushSupport, getExistingSubscription, registerSubscription, subscribeToPush, type PushSupport } from "@/lib/push/client";

type Props = {
  vapidPublicKey?: string;
  pushConfigured: boolean;
  compact?: boolean;
  /** 이미 켜져 있으면 아무것도 그리지 않는다 */
  hideWhenOn?: boolean;
  /** 설치된 앱(standalone) 또는 iPhone Safari 에서만 보인다 (홈 화면용) */
  onlyStandalone?: boolean;
};

type State =
  | { kind: "loading" }
  | { kind: "unsupported"; support: PushSupport }
  | { kind: "not-configured" }
  | { kind: "idle"; support: PushSupport }
  | { kind: "subscribing" }
  | { kind: "subscribed"; tested?: "sent" | "failed" | null }
  | { kind: "denied" }
  | { kind: "error"; message: string };

/**
 * 이 기기 알림 켜기. iPhone 은 홈 화면에 추가한 앱에서 버튼을 눌러야만 권한을 물을 수 있다(iOS 16.4+).
 * 켠 직후 확인 알림을 보내 앱을 닫아도 오는지 바로 확인하게 한다.
 */
export function PushSetup({ vapidPublicKey, pushConfigured, compact = false, hideWhenOn = false, onlyStandalone = false }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const sync = useCallback(async () => {
    const support = detectPushSupport();
    if (!support.supported) {
      setState({ kind: "unsupported", support });
      return;
    }
    if (!pushConfigured || !vapidPublicKey) {
      setState({ kind: "not-configured" });
      return;
    }
    const permission = Notification.permission;
    if (permission === "denied") {
      setState({ kind: "denied" });
      return;
    }
    if (permission === "granted") {
      try {
        const existing = await getExistingSubscription();
        if (existing) {
          // 계정이 바뀌었을 수 있으므로 현재 로그인 사용자 소유로 다시 등록한다
          await registerSubscription(existing);
          setState({ kind: "subscribed" });
          return;
        }
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : "구독 확인 실패" });
        return;
      }
    }
    setState({ kind: "idle", support });
  }, [pushConfigured, vapidPublicKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await sync();
    })();
    return () => {
      cancelled = true;
    };
  }, [sync]);

  async function enable() {
    if (!vapidPublicKey) return;
    setState({ kind: "subscribing" });
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "denied" } : { kind: "idle", support: detectPushSupport() });
        return;
      }
      const sub = await subscribeToPush(vapidPublicKey);
      await registerSubscription(sub);
      setState({ kind: "subscribed", tested: null });
      const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
      const data = res ? ((await res.json().catch(() => null)) as { ok?: boolean } | null) : null;
      setState({ kind: "subscribed", tested: data?.ok ? "sent" : "failed" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "알림 설정 실패" });
    }
  }

  const box = compact ? "rounded-[16px] border border-line bg-white px-4 py-3 text-[13px]" : "list-row min-h-[60px] py-3";

  if (state.kind === "loading") return compact && (hideWhenOn || onlyStandalone) ? null : <div className={`${box} text-sub`}>알림 상태 확인 중…</div>;
  // 홈 화면 안내는 설치된 앱(홈 화면 아이콘)으로 열었을 때만 보인다. iOS Safari 에서는 설치 안내만 남긴다.
  const support = detectPushSupport();
  if (onlyStandalone && !support.standalone && !(state.kind === "unsupported" && state.support.reason === "ios-not-installed")) return null;

  if (state.kind === "subscribed") {
    if (hideWhenOn && !state.tested) return null;
    return (
      <div className={`${box} flex items-center justify-between gap-3`} data-testid="push-on">
        <span>
          <span className="block font-bold">이 기기에서 알림 받는 중</span>
          {state.tested === "sent" ? <span className="block text-[12px] text-sub">확인 알림을 보냈어요. 앱을 닫아도 친구 SOS가 이렇게 와요.</span> : null}
          {state.tested === "failed" ? <span className="block text-[12px] text-danger">확인 알림을 보내지 못했어요. 잠시 뒤 다시 켜 주세요.</span> : null}
        </span>
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-ok" />
      </div>
    );
  }

  if (state.kind === "unsupported") {
    const ios = state.support.reason === "ios-not-installed";
    if (onlyStandalone && !ios) return null;
    return (
      <div className={`${box} text-sub`}>
        {ios ? (
          <>
            <p className="font-bold text-charcoal">홈 화면에 추가하면 앱을 닫아도 SOS 알림이 와요</p>
            <p className="mt-1">Safari 공유 버튼 → <b>홈 화면에 추가</b> → 홈 화면 아이콘으로 열고 알림을 켜 주세요. (iOS 16.4 이상)</p>
          </>
        ) : (
          <p>이 브라우저는 푸시 알림을 지원하지 않아요. 앱 안 알림(종)은 쓸 수 있어요.</p>
        )}
      </div>
    );
  }

  if (onlyStandalone && !(state.kind === "idle" && state.support.standalone) && state.kind !== "denied" && state.kind !== "error") return null;

  if (state.kind === "not-configured") return <div className={`${box} text-sub`}>푸시 연결 대기: 서버 알림 키가 설정되면 켤 수 있어요.</div>;

  if (state.kind === "denied") {
    return (
      <div className={`${box} text-sub`}>
        <p className="font-bold text-charcoal">알림이 꺼져 있어요</p>
        <p className="mt-1">iPhone 설정 → 알림 → 나도으른에서 허용으로 바꾼 뒤 앱을 다시 열어 주세요.</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={box}>
        <p className="font-bold text-danger">{state.message}</p>
        <button type="button" onClick={() => void sync()} className="mt-1 text-[13px] font-bold text-rust underline">
          다시 확인
        </button>
      </div>
    );
  }

  return (
    <div className={`${box} flex items-center justify-between gap-3`}>
      <span>
        <span className="block font-bold">이 기기 알림 켜기</span>
        <span className="block text-[12px] text-sub">앱을 닫아도 친구 SOS·응답·통금 알림을 받아요</span>
      </span>
      <button type="button" onClick={enable} disabled={state.kind === "subscribing"} className="h-9 shrink-0 rounded-[12px] bg-charcoal px-4 text-[13px] font-bold text-cream">
        {state.kind === "subscribing" ? "설정 중…" : "알림 켜기"}
      </button>
    </div>
  );
}
