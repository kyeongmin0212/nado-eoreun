import Link from "next/link";
import type { Situation } from "@/lib/types";
import { IconPhotoD, IconSendD, IconStarD } from "@/components/Icons";

/** HOME-01 오늘의 상황 카드 (당일 자동 활성화). 동행인 = SOS 받을 친구. */
export function SituationCard({ active }: { active: Situation | null }) {
  if (!active) {
    return (
      <section aria-label="오늘의 상황" className="card flex flex-col gap-3 px-5 py-[18px]" data-testid="situation-card">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">오늘의 상황</h2>
          <span className="badge badge-sm badge-end">비활성</span>
        </div>
        <p className="text-[14px] text-sub">등록된 상황이 없어요</p>
        <p className="text-[12px] text-sub">장소·동행인·실제 동행인 연락처를 미리 적어 두면 오늘 홈에 표시되고 SOS에 함께 보내져요.</p>
        <Link href="/situations" className="btn btn-dark h-[46px] text-[14px]">
          상황 등록하기
        </Link>
      </section>
    );
  }
  const real = active.real_name || active.real_phone ? `${active.real_name || "이름 미입력"}${active.real_phone ? ` · ${active.real_phone}` : ""}` : "미입력";
  return (
    <section aria-label="오늘의 상황" className="card flex flex-col gap-3 px-5 py-[18px]" data-testid="situation-card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold">오늘의 상황</h2>
          <span className="badge badge-sm badge-peach">활성화</span>
        </span>
        <Link href={`/situations?edit=${active.id}`} className="flex h-8 items-center rounded-[12px] bg-peach px-3 text-[13px] text-ink">
          수정
        </Link>
      </div>
      <dl className="grid grid-cols-[84px_minmax(0,1fr)] gap-y-2 text-[14px]">
        <dt className="text-sub">장소</dt>
        <dd className="font-medium" data-testid="situation-place">
          {active.place || "장소 미입력"}
        </dd>
        <dt className="text-sub">동행인</dt>
        <dd className="font-medium" data-testid="situation-companion">
          {active.companion || "미지정"} {active.companion && active.companion_ids?.length ? <span className="text-[12px] font-normal text-sub">(등록한 친구)</span> : null}
        </dd>
        <dt className="text-sub">실제 동행인</dt>
        <dd className="font-medium" data-testid="situation-real">
          {real}
        </dd>
        <dt className="text-sub">메모</dt>
        <dd className="font-medium">{active.memo || "메모 없음"}</dd>
      </dl>
      <div className="flex flex-col gap-0.5 rounded-[12px] bg-warm px-3 py-[10px]">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          <IconSendD size={14} className="text-coral" />
          SOS 연동 중
        </span>
        <span className="text-[12px] text-sub">SOS 받을 친구: {active.companion && active.companion_ids?.length ? `${active.companion}(동행인)` : "전체 친구"} · 오늘 상황을 함께 보내요</span>
      </div>
    </section>
  );
}

/** HOME-01 SOS 바: 누르면 SOS-01. 여기서는 보내지 않는다. */
export function SosBar() {
  return (
    <Link href="/sos" className="flex items-center justify-between rounded-[20px] bg-coral px-5 py-[18px] text-charcoal" data-testid="sos-bar">
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium">엄마한테 전화 왔어?</span>
        <span className="text-[20px] font-black">SOS 보내기</span>
      </span>
      <span aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-charcoal text-[14px] font-black text-coral">
        SOS
      </span>
    </Link>
  );
}

/** HOME-01 사진 만들기 카드 2개 */
export function CreateCards() {
  return (
    <section aria-label="사진 만들기" className="flex flex-col gap-[10px]">
      <h2 className="text-[16px] font-bold">사진 만들기</h2>
      <div className="grid grid-cols-2 gap-[10px]">
        <Link href="/create" className="flex min-h-[104px] flex-col items-start gap-2 rounded-[16px] border border-line bg-white px-[14px] py-4">
          <IconPhotoD size={24} className="text-coral" />
          <span className="text-[15px] font-bold">직접 만들기</span>
          <span className="text-[12px] text-sub">배경·친구·헤어를 내가 골라요</span>
        </Link>
        <Link href="/create/scene" className="flex min-h-[104px] flex-col items-start gap-2 rounded-[16px] border border-line bg-white px-[14px] py-4">
          <IconStarD size={24} className="text-coral" />
          <span className="text-[15px] font-bold">상황으로 만들기</span>
          <span className="text-[12px] text-sub">준비된 상황을 골라 바로 만들어요</span>
        </Link>
      </div>
    </section>
  );
}
