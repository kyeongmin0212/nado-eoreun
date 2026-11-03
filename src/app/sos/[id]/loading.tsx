/** SOS 요청 화면을 여는 동안: 받은 친구(밝은 화면)·발신자(어두운 화면)를 미리 알 수 없어 중립 표시만 한다. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 bg-warm px-5 pt-[calc(16px+env(safe-area-inset-top))]" aria-busy="true">
      <div className="skeleton h-[68px] rounded-[18px]" aria-hidden />
      <div className="skeleton h-16 w-3/4 rounded-[14px]" aria-hidden />
      <div className="skeleton h-[220px] rounded-[20px]" aria-hidden />
      <div className="skeleton h-[58px] rounded-[16px]" aria-hidden />
      <span className="sr-only" role="status">
        불러오는 중
      </span>
    </div>
  );
}
