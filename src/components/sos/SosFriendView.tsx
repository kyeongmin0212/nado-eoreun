import type { ReactNode } from "react";
import type { SituationSnapshot } from "@/lib/types";
import { casualName, casualSubject, withName } from "@/lib/copy";
import { IconInfo } from "@/components/Icons";

/** SOS-02 본문(친구가 받는 화면). 받은 화면과 발신자의 「화면 미리보기」가 같이 쓴다. */
export function SosFriendView({ senderName, snapshot, when, cancelled, actions }: { senderName: string; snapshot: SituationSnapshot | null; when: ReactNode; cancelled?: boolean; actions?: ReactNode }) {
  const a = casualSubject(senderName);
  const real = snapshot?.realName ? `${snapshot.realName}${snapshot.realPhone ? ` · ${snapshot.realPhone}` : ""}` : null;
  return (
    <div className="flex flex-col gap-4" data-testid="recipient-view">
      <div role="status" className="flex items-center gap-3 rounded-[18px] bg-charcoal px-4 py-[14px] text-cream">
        <img src="/brand/icon-128.png" alt="" className="h-10 w-10 rounded-[10px] object-cover" />
        <span className="flex flex-col gap-0.5">
          <span className="text-[12px] text-petal">나도으른 · {when}</span>
          <span className="text-[14px] font-bold">{cancelled ? `${a} SOS 요청을 취소했어요` : `${a} SOS를 보냈어요`}</span>
        </span>
      </div>

      <h1 className="text-[22px] font-black leading-[1.4]">
        {cancelled ? (
          <>
            {a} 요청을
            <br />
            취소했어요
          </>
        ) : (
          <>
            지금 {a}
            <br />
            연락을 기다리고 있어요
          </>
        )}
      </h1>

      <section aria-label="사용자가 입력한 상황 정보" className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-[18px]">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <IconInfo size={16} className="text-coral" strokeWidth={2} />
          사용자가 입력한 상황 정보
        </span>
        {snapshot ? (
          <dl className="grid grid-cols-[56px_minmax(0,1fr)] gap-y-2 text-[14px]">
            <dt className="text-sub">장소</dt>
            <dd className="font-medium">{snapshot.place || "-"}</dd>
            {snapshot.companion ? (
              <>
                <dt className="text-sub">함께</dt>
                <dd className="font-medium">{snapshot.companion} (부모님께 알린 동행인)</dd>
              </>
            ) : null}
            {real ? (
              <>
                <dt className="text-sub">실제</dt>
                <dd className="font-medium" data-testid="real-companion">
                  {real}
                </dd>
              </>
            ) : null}
            {snapshot.memo ? (
              <>
                <dt className="text-sub">메모</dt>
                <dd className="font-medium">{snapshot.memo}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-[14px] text-sub">{a} 오늘의 상황을 등록하지 않았어요.</p>
        )}
        <div className="flex flex-col gap-0.5 rounded-[12px] bg-peach p-3">
          <span className="text-[12px] font-bold text-ink">요청한 도움</span>
          <span className="text-[14px] text-ink">{snapshot?.realName ? `실제 동행인(${snapshot.realName})에게 바로 전화해서 ${withName(senderName)} 상황을 맞춰 주세요` : `${casualName(senderName)}에게 전화해서 상황을 맞춰 주세요`}</span>
        </div>
        <span className="text-[12px] text-sub">{a} 미리 입력한 내용이며, 실제 위치를 확인한 정보는 아니에요</span>
      </section>

      {actions}
    </div>
  );
}
