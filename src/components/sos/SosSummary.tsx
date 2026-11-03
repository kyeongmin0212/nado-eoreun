import Link from "next/link";
import type { SituationSnapshot } from "@/lib/types";
import { IconPhone, IconSpark } from "@/components/Icons";

/** SOS-01/03 「친구에게 전달할 상황 요약」 (어두운 카드) */
export function SosSummary({ snapshot, showSetup = false }: { snapshot: SituationSnapshot | null; showSetup?: boolean }) {
  return (
    <section aria-label="친구에게 전달될 상황 요약" className="flex flex-col gap-[10px] rounded-[20px] bg-dusk p-[18px]">
      <span className="flex items-center gap-1.5 text-[13px] text-blush">
        <IconSpark size={16} className="text-coral" strokeWidth={2} />
        친구에게 전달할 상황 요약
      </span>
      {snapshot ? (
        <p data-testid="sos-summary" className="text-[15px] leading-[1.6]">
          {snapshot.summary}
        </p>
      ) : (
        <p data-testid="sos-summary" className="text-[15px] leading-[1.6]">
          오늘 등록된 상황이 없어요. 이대로 보내면 친구에게 SOS 문구만 전달돼요.
        </p>
      )}
      <span className="text-[12px] text-mist">홈의 &apos;오늘의 상황&apos;에 사용자가 입력한 정보예요. 실제 위치를 확인한 내용은 아니에요.</span>
      {snapshot?.realName ? (
        <span className="flex items-center gap-1.5 text-[12px] text-petal">
          <IconPhone size={14} className="text-coral" strokeWidth={2} />
          실제 동행인({snapshot.realName}) 연락처는 SOS를 받은 친구에게만 전달돼요
        </span>
      ) : null}
      {!snapshot && showSetup ? (
        <Link href="/situations" className="flex h-10 items-center justify-center rounded-[12px] border border-sub text-[13px] text-cream">
          오늘의 상황 등록하기
        </Link>
      ) : null}
    </section>
  );
}
