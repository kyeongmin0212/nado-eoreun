"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { AppNotification } from "@/lib/types";

type Ctx = {
  items: AppNotification[];
  unread: number;
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: (ids: string[] | "all") => Promise<void>;
};

const NotificationContext = createContext<Ctx | null>(null);

export function useNotifications(): Ctx {
  const c = useContext(NotificationContext);
  if (!c) return { items: [], unread: 0, loaded: false, refresh: async () => {}, markRead: async () => {} };
  return c;
}

const IS_LOCAL_BACKEND = process.env.NEXT_PUBLIC_DATA_BACKEND === "local";
const POLL_MS = 3000;

/**
 * 알림 센터: 목록·안 읽은 수를 앱 전체에서 공유하고, 새 알림이 오면 화면 위 배너를 내린다.
 * Supabase 는 Realtime INSERT 구독(즉시), docker(local)는 3초 폴링. 운영체제 푸시와는 별개다.
 */
export function NotificationProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 새 알림(친구 동의·초대 수락·동행인 지정·SOS 응답)이 오면 지금 화면의 서버 데이터도 다시 받는다.
  const refreshScreen = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 300);
  }, [router]);

  const showToast = useCallback((n: AppNotification) => {
    setToast(n);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; items?: AppNotification[]; unread?: number };
      if (!data.ok || !data.items) return;
      const fresh = data.items.filter((n) => !seen.current.has(n.id));
      for (const n of data.items) seen.current.add(n.id);
      setItems(data.items);
      setUnread(data.unread ?? 0);
      setLoaded(true);
      // 첫 불러오기에서는 배너를 띄우지 않는다. 이후 새로 들어온 안 읽은 알림만 띄운다.
      if (!first.current) {
        const newest = fresh.find((n) => !n.read_at);
        if (newest) {
          showToast(newest);
          refreshScreen();
        }
      }
      first.current = false;
    } catch {
      // 다음 주기에 다시 시도
    }
  }, [userId, showToast, refreshScreen]);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cleanup: (() => void) | undefined;
    const kick = setTimeout(() => void refresh(), 0);
    if (IS_LOCAL_BACKEND) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, POLL_MS);
    } else {
      import("@/lib/supabase/client")
        .then(({ authedRealtime }) => authedRealtime())
        .then((supabase) => {
          const channel = supabase
            .channel(`noti-${userId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
              const n = payload.new as unknown as AppNotification;
              if (seen.current.has(n.id)) return;
              seen.current.add(n.id);
              setItems((prev) => [{ ...n, from_name: null }, ...prev].slice(0, 30));
              setUnread((u) => u + 1);
              showToast({ ...n, from_name: null });
              refreshScreen();
            })
            .subscribe();
          cleanup = () => {
            supabase.removeChannel(channel);
          };
        })
        .catch(() => undefined);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(kick);
      if (timer) clearInterval(timer);
      cleanup?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refresh, showToast, refreshScreen]);

  const markRead = useCallback(
    async (ids: string[] | "all") => {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
      setUnread((u) => (ids === "all" ? 0 : Math.max(0, u - items.filter((n) => ids.includes(n.id) && !n.read_at).length)));
      try {
        const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids === "all" ? { all: true } : { ids }) });
        const data = (await res.json().catch(() => null)) as { unread?: number } | null;
        if (typeof data?.unread === "number") setUnread(data.unread);
      } catch {}
    },
    [items],
  );

  const value = useMemo(() => ({ items, unread, loaded, refresh, markRead }), [items, unread, loaded, refresh, markRead]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {toast ? (
        <button
          type="button"
          role="status"
          onClick={() => {
            const t = toast;
            setToast(null);
            void markRead([t.id]);
            if (t.link) router.push(t.link);
          }}
          className="noti-drop fixed inset-x-3 top-[calc(12px+env(safe-area-inset-top))] z-[70] mx-auto flex max-w-[406px] items-center gap-3 rounded-[18px] bg-charcoal px-[14px] py-3 text-left text-cream shadow-[0_10px_24px_rgba(46,42,51,0.25)]"
        >
          <img src="/brand/icon-128.png" alt="" className="h-9 w-9 shrink-0 rounded-[9px]" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] text-petal">나도으른 · 방금</span>
            <span className="text-[14px] font-bold leading-snug">{toast.text}</span>
          </span>
        </button>
      ) : null}
    </NotificationContext.Provider>
  );
}
