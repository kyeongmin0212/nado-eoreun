"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TABS } from "@/lib/copy";
import { IconFriendsD, IconHomeD, IconPhotoD, IconStarD } from "@/components/Icons";

const ICONS = { "/": IconHomeD, "/create": IconStarD, "/album": IconPhotoD, "/friends": IconFriendsD } as const;

/** 하단 탭이 보이는 화면 (나머지는 모달형 화면) */
export function isTabRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "/create" || pathname === "/create/scene" || pathname === "/album" || pathname === "/friends";
}

function activeTab(pathname: string): string {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/create")) return "/create";
  if (pathname.startsWith("/album")) return "/album";
  if (pathname.startsWith("/friends")) return "/friends";
  return "";
}

/** 누른 탭이 응답을 기다리는 동안 아이콘 아래에 작은 점을 깜박인다 */
function PendingDot() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-coral transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} />;
}

/**
 * 앱 전체에 한 번만 두는 하단 탭. 화면을 오가도 다시 그려지지 않는다.
 * 누르는 즉시 선택 표시를 옮기고(낙관적 표시), 탭 주소는 운영 환경에서 각 화면의 loading 경계까지 자동 프리페치된다.
 */
export function TabBar({ authed }: { authed: boolean }) {
  const pathname = usePathname();
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);
  if (!authed || !isTabRoute(pathname)) return null;
  // 주소가 바뀌면 낙관적 표시는 자연히 실제 위치로 대체된다.
  const cur = tapped && tapped.from === pathname ? tapped.href : activeTab(pathname);
  return (
    <nav aria-label="하단 탭" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white safe-bottom">
      <ul className="mx-auto grid max-w-[430px] grid-cols-4 pt-[10px]">
        {TABS.map((tab) => {
          const on = cur === tab.href;
          const Icon = ICONS[tab.href];
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={activeTab(pathname) === tab.href ? "page" : undefined}
                onClick={() => setTapped({ href: tab.href, from: pathname })}
                className={`flex h-[48px] flex-col items-center gap-[3px] text-[11px] ${on ? "font-bold text-charcoal" : "text-sub"}`}
              >
                <span className="relative">
                  <Icon size={24} strokeWidth={2} className={on ? "text-coral" : "text-sub"} />
                  <PendingDot />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
