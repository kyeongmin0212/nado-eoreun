import Link from "next/link";
import { APP_SUBLINE, APP_TAGLINE } from "@/lib/copy";

/**
 * LOGIN-01: 로그인하지 않은 사람이 `/` 에서 보는 첫 화면. 서비스 이름과 하는 일을 보여준다.
 * 시작 방법은 아이디 가입·로그인 하나로 단순화했다(카카오·Apple·휴대폰 로그인은 출시 단계 과제, docs/DECISIONS.md D65).
 */
export function Landing() {
  return (
    <div className="bg-splash mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 safe-top">
      <main className="flex flex-1 flex-col items-center justify-center pt-10 text-center">
        <img src="/brand/logo.png" alt="나도으른" className="w-[300px] max-w-[80%]" />
        <h1 className="mt-6 text-[20px] font-bold text-charcoal">{APP_TAGLINE}</h1>
        <p className="mx-auto mt-2 max-w-[280px] text-[15px] leading-relaxed text-sub">{APP_SUBLINE}</p>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-bold text-ink">
          <span aria-hidden className="h-2 w-2 rounded-full bg-coral" />만 19세 이상 성인만 가입할 수 있어요
        </p>
        <ul className="mt-6 w-full space-y-1 text-left text-[13px] text-sub">
          <li>· 통금 타이머와 오늘의 상황을 미리 정해 두고</li>
          <li>· AI 사진(배경·친구·헤어·상황)을 만들고</li>
          <li>· 부모님 전화가 오면 친구에게 SOS로 바로 알려요</li>
        </ul>
      </main>
      <div className="flex flex-col gap-3 pb-4">
        <Link href="/signup" className="btn btn-dark h-[56px] w-full text-[16px]">
          회원가입하기
        </Link>
        <Link href="/login" className="btn btn-white h-[56px] w-full text-[16px] font-bold">
          로그인
        </Link>
      </div>
      <p className="pb-[calc(20px+env(safe-area-inset-bottom))] text-center text-[12px] leading-relaxed text-sub">
        시작하면 <b className="text-ink">이용약관</b>과 <b className="text-ink">개인정보처리방침</b>에 동의하게 돼요.
        <br />
        AI로 만든 사진은 편집 화면에 항상 AI 생성 표시가 붙어요.
      </p>
    </div>
  );
}
