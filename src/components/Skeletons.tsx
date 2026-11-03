import type { ReactNode } from "react";

/** 화면 전환 직후 바로 보이는 자리 표시 (loading.tsx). 실제 화면과 같은 틀·제목을 먼저 그린다. */
function Bar({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return <div aria-hidden className={`${dark ? "skeleton-dark" : "skeleton"} ${className}`} />;
}

function Frame({ title, eyebrow, subtitle, dark = false, hero = false, tabs = true, right, children }: { title?: string; eyebrow?: string; subtitle?: string; dark?: boolean; hero?: boolean; tabs?: boolean; right?: ReactNode; children: ReactNode }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-[430px] flex-col ${dark ? "bg-charcoal text-cream" : hero ? "bg-hero" : "bg-warm"}`} aria-busy="true">
      <div className="safe-top" />
      <header className="flex min-h-[64px] items-center justify-between gap-2 px-5 pt-2">
        <div className="min-w-0">
          {eyebrow ? <p className={`text-[11px] font-bold tracking-[1px] ${dark ? "text-petal" : "text-rust"}`}>{eyebrow}</p> : null}
          {title ? <h1 className="truncate text-[22px] font-black tracking-tight">{title}</h1> : <Bar className="h-7 w-32" dark={dark} />}
          {subtitle ? <p className="text-[13px] text-sub">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <main className={`flex flex-1 flex-col gap-4 px-5 pt-2 ${tabs ? "pb-[calc(104px+env(safe-area-inset-bottom))]" : "pb-8"}`}>
        {children}
        <span className="sr-only" role="status">
          불러오는 중
        </span>
      </main>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Frame hero>
      <Bar className="h-[62px] rounded-[18px]" />
      <Bar className="h-[150px] rounded-[20px]" />
      <Bar className="h-[176px] rounded-[20px]" />
      <Bar className="h-[64px] rounded-[18px]" />
      <div className="grid grid-cols-2 gap-[10px]">
        <Bar className="h-[110px] rounded-[18px]" />
        <Bar className="h-[110px] rounded-[18px]" />
      </div>
    </Frame>
  );
}

export function CreateSkeleton() {
  return (
    <Frame title="사진 만들기" eyebrow="NADO EOREUN · AI STUDIO">
      <Bar className="h-12 rounded-[14px]" />
      <div className="grid grid-cols-3 gap-2">
        <Bar className="h-[92px]" />
        <Bar className="h-[92px]" />
        <Bar className="h-[92px]" />
      </div>
      <Bar className="h-[170px] rounded-[18px]" />
      <Bar className="h-[180px] rounded-[18px]" />
      <Bar className="h-[54px]" />
    </Frame>
  );
}

export function AlbumSkeleton() {
  return (
    <Frame title="보관함">
      <Bar className="h-5 w-28 rounded-[8px]" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Bar key={i} className="aspect-square rounded-[14px]" />
        ))}
      </div>
    </Frame>
  );
}

export function FriendsSkeleton() {
  return (
    <Frame title="친구">
      <Bar className="h-5 w-24 rounded-[8px]" />
      {Array.from({ length: 3 }, (_, i) => (
        <Bar key={i} className="h-[70px]" />
      ))}
      <Bar className="h-[170px] rounded-[18px]" />
    </Frame>
  );
}

export function ListSkeleton({ title, tabs = false }: { title: string; tabs?: boolean }) {
  return (
    <Frame title={title} tabs={tabs}>
      <Bar className="h-[180px] rounded-[20px]" />
      <Bar className="h-[220px] rounded-[18px]" />
      <Bar className="h-[160px] rounded-[18px]" />
    </Frame>
  );
}

export function DarkSkeleton({ title }: { title: string }) {
  return (
    <Frame title={title} dark tabs={false}>
      <Bar dark className="h-[170px] rounded-[20px]" />
      <Bar dark className="h-12 rounded-[14px]" />
      <div className="flex justify-center py-3">
        <Bar dark className="h-[180px] w-[180px] rounded-full" />
      </div>
    </Frame>
  );
}

export function EditorSkeleton() {
  return (
    <Frame title="사진 편집" dark tabs={false}>
      <Bar dark className="aspect-[3/4] rounded-[22px]" />
      <div className="flex gap-2">
        <Bar dark className="h-10 w-24 rounded-[20px]" />
        <Bar dark className="h-10 w-24 rounded-[20px]" />
      </div>
      <Bar dark className="h-[120px] rounded-[18px]" />
    </Frame>
  );
}
