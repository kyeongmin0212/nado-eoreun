"use client";

import Link from "next/link";
import { useState } from "react";
import { useNotifications } from "@/components/NotificationProvider";
import { NotificationDrawer } from "@/components/home/NotificationDrawer";
import { IconBellD } from "@/components/Icons";

/** HOME-01 머리말: 앱 아이콘 + 나도으른, 알림(종)·MY 38px 동그라미 */
export function HomeHeader({ vapidPublicKey, pushConfigured }: { vapidPublicKey?: string; pushConfigured: boolean }) {
  const { unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const label = unread > 9 ? "9+" : String(unread);
  return (
    <header className="flex items-center justify-between px-5 pt-[28px]">
      <span className="flex items-center gap-[10px]">
        <img src="/brand/icon-128.png" alt="나도으른" className="h-11 w-11 rounded-[12px]" />
        <span className="text-[18px] font-black tracking-[-0.5px]">
          나도<span className="text-coral">으른</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`알림${unread > 0 ? ` ${unread}개 안 읽음` : ""}`}
          className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-white"
        >
          <IconBellD size={18} />
          {unread > 0 ? (
            <span aria-hidden className="absolute -right-[3px] -top-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-[#FDE6DE] bg-coral px-1 text-[10px] font-black text-charcoal">
              {label}
            </span>
          ) : null}
        </button>
        <Link href="/my" aria-label="마이페이지" className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-white text-[12px] font-black tracking-[0.5px]">
          MY
        </Link>
      </span>
      {open ? <NotificationDrawer onClose={() => setOpen(false)} vapidPublicKey={vapidPublicKey} pushConfigured={pushConfigured} /> : null}
    </header>
  );
}
