"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AppNotification, NotificationKind } from "@/lib/types";
import { useNotifications } from "@/components/NotificationProvider";
import { PushSetup } from "@/components/PushSetup";
import { IconClose } from "@/components/Icons";

const KIND_LABEL: Record<NotificationKind, string> = {
  friend_sos: "친구 SOS",
  sos_reply: "SOS 응답",
  photo_consent: "사진 동의",
  invite_accepted: "친구 초대",
  companion: "동행인",
};

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return d === 1 ? "어제" : `${d}일 전`;
}

function initialOf(n: AppNotification): string {
  if (n.from_name) return n.from_name.trim().slice(0, 1);
  return n.text.trim().slice(0, 1);
}

/** HOME-01 알림 창: 위에서 내려오는 친구 상호작용 목록. 친구 SOS·SOS 응답은 해당 SOS 화면으로, 나머지는 읽음 처리. */
export function NotificationDrawer({ onClose, vapidPublicKey, pushConfigured }: { onClose: () => void; vapidPublicKey?: string; pushConfigured: boolean }) {
  const router = useRouter();
  const { items, loaded, refresh, markRead } = useNotifications();

  useEffect(() => {
    void refresh();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh, onClose]);

  function open(n: AppNotification) {
    void markRead([n.id]);
    if ((n.kind === "friend_sos" || n.kind === "sos_reply") && n.link) {
      onClose();
      router.push(n.link);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-charcoal/35">
      <div role="dialog" aria-label="알림" className="noti-drop mx-auto flex w-full max-w-[430px] flex-col gap-3 rounded-b-[24px] bg-white px-5 pb-4 pt-[calc(20px+env(safe-area-inset-top))] shadow-[0_12px_30px_rgba(46,42,51,0.18)]">
        <div className="flex items-center justify-between pt-2">
          <h2 className="text-[18px] font-black">알림</h2>
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => void markRead("all")} className="h-9 px-[10px] text-[13px] font-bold text-rust">
              모두 읽음
            </button>
            <button type="button" onClick={onClose} aria-label="알림 닫기" className="-mr-[10px] flex h-10 w-10 items-center justify-center">
              <IconClose />
            </button>
          </span>
        </div>
        <PushSetup compact vapidPublicKey={vapidPublicKey} pushConfigured={pushConfigured} hideWhenOn />
        <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto" data-testid="notification-list">
          {!loaded ? <li className="skeleton h-[64px]" /> : null}
          {loaded && items.length === 0 ? <li className="rounded-[14px] bg-warm px-4 py-5 text-center text-[13px] text-sub">아직 알림이 없어요</li> : null}
          {items.map((n) => {
            const sos = n.kind === "friend_sos" || n.kind === "sos_reply";
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  data-testid="notification-item"
                  data-kind={n.kind}
                  data-link={n.link ?? ""}
                  className={`flex w-full items-start gap-3 rounded-[14px] p-3 text-left ${n.read_at ? "bg-white" : "bg-peach"}`}
                >
                  <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-black ${sos ? "bg-charcoal text-coral" : "bg-blush text-ink"}`}>
                    {initialOf(n)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14px] leading-[1.4]">{n.text}</span>
                    <span className="text-[12px] text-sub">
                      {KIND_LABEL[n.kind]} · {timeAgo(n.created_at)}
                    </span>
                  </span>
                  {!n.read_at ? <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Link href="/friends" onClick={onClose} className="flex h-11 items-center justify-center rounded-[14px] border border-line bg-warm text-[14px]">
          친구 탭에서 보기
        </Link>
      </div>
      <button type="button" aria-label="알림 닫기" onClick={onClose} className="flex-1" />
    </div>
  );
}
