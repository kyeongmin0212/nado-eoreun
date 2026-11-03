import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { APP_NAME } from "@/lib/copy";

export const metadata: Metadata = { title: "약관·문의" };

/** 이용약관·개인정보처리방침·문의 (초안). 확정 문구가 오면 교체한다. */
export default function LegalPage() {
  return (
    <AppShell title="약관 · 문의" back="/my">
      <div className="space-y-4 pt-1 text-[13px] leading-relaxed text-charcoal">
        <p className="badge badge-wait">초안 — 확정 문구로 교체 예정</p>
        <section className="card p-4">
          <h2 className="text-[15px] font-extrabold">이용약관 (요약)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-charcoal-soft">
            <li>{APP_NAME}은 사진 준비와 친구 SOS를 돕는 서비스예요. 통화·부모 연락을 대신하지 않아요.</li>
            <li>AI 합성 이미지는 실제 촬영·치료·위치의 증빙이 아니며, 편집 화면의 결과에는 AI 생성 표시가 붙어요.</li>
            <li>친구의 사진은 그 친구가 사용을 허용한 경우에만 생성에 쓸 수 있어요.</li>
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="text-[15px] font-extrabold">개인정보처리방침 (요약)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-charcoal-soft">
            <li>저장하는 정보: 계정·프로필, 등록한 AI 프로필 사진, 생성 결과, 오늘의 상황, SOS 요청·응답, 알림 구독.</li>
            <li>생성에 올린 일회성 사진은 처리 후 저장하지 않아요. 등록 사진과 생성 결과는 본인 전용 비공개 저장소에 보관해요.</li>
            <li>설정에서 기록 삭제·데이터 내려받기·회원 탈퇴를 직접 할 수 있어요.</li>
          </ul>
        </section>
        <section id="support" className="card p-4">
          <h2 className="text-[15px] font-extrabold">고객센터 · 문의</h2>
          <p className="mt-2 text-charcoal-soft">문의 채널은 준비 중이에요. 시연 기간에는 팀에 직접 알려 주세요.</p>
        </section>
      </div>
    </AppShell>
  );
}
