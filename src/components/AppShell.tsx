import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack, IconClose } from "@/components/Icons";

type Props = {
  children: ReactNode;
  title?: string;
  /** 제목 위 작은 라벨 (예: NADO EOREUN · AI STUDIO) */
  eyebrow?: string;
  /** 제목 옆 보조 글자 (예: 날짜별 · 사진 7장) */
  subtitle?: string;
  back?: string;
  close?: string;
  /** 닫기 버튼을 제목 왼쪽에 둔다 (SOS 화면) */
  closeLeft?: boolean;
  right?: ReactNode;
  /** 홈처럼 직접 만든 머리말. false 면 머리말 없이 본문만 */
  header?: ReactNode | false;
  tone?: "light" | "dark" | "hero";
  /** 하단 탭 공간 확보 */
  tabs?: boolean;
};

/** 화면 틀: 393×852 기준 세로 스크롤, 머리말 + 본문. 하단 탭은 루트 레이아웃의 TabBar 가 그린다. */
export function AppShell({ children, title, eyebrow, subtitle, back, close, closeLeft, right, header, tone = "light", tabs = false }: Props) {
  const dark = tone === "dark";
  const bg = dark ? "bg-charcoal text-cream" : tone === "hero" ? "bg-hero" : "bg-warm";
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-[430px] flex-col ${bg}`}>
      <div className="safe-top" />
      {header === false ? null : header ?? (
        <header className="flex min-h-[64px] items-center justify-between gap-2 px-5 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            {back ? (
              <Link href={back} aria-label="뒤로" className="-ml-[10px] flex h-11 w-11 shrink-0 items-center justify-center">
                <IconBack />
              </Link>
            ) : null}
            {close && closeLeft ? (
              <Link href={close} aria-label="닫기" className="-ml-[10px] flex h-11 w-11 shrink-0 items-center justify-center">
                <IconClose />
              </Link>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className={`text-[11px] font-bold tracking-[1px] ${dark ? "text-petal" : "text-rust"}`}>{eyebrow}</p> : null}
              {title ? <h1 className={`truncate font-black tracking-tight ${eyebrow || !back ? "text-[22px]" : "text-[20px]"}`}>{title}</h1> : null}
              {subtitle ? <p className="text-[13px] text-sub">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            {close && !closeLeft ? (
              <Link href={close} aria-label="닫기" className="-mr-[10px] flex h-11 w-11 items-center justify-center">
                <IconClose />
              </Link>
            ) : null}
          </div>
        </header>
      )}
      <main className={`flex-1 px-5 ${tabs ? "pb-[calc(104px+env(safe-area-inset-bottom))]" : "pb-[calc(32px+env(safe-area-inset-bottom))]"}`}>{children}</main>
    </div>
  );
}
