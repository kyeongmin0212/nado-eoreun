/**
 * 서버 시작 시 1회 실행. docker(local) 모드에서는 외부 스케줄러가 없으므로
 * 서버 안의 타이머가 1분마다 통금 알림 작업을 돌린다. Supabase 배포(Vercel)는 pg_cron → /api/cron/curfew 를 쓴다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const inProcess = process.env.DATA_BACKEND === "local" || process.env.CURFEW_SCHEDULER === "inprocess";
  if (!inProcess || process.env.CURFEW_SCHEDULER === "off") return;
  const { runCurfewJob } = await import("@/lib/curfew/job");
  const tick = async () => {
    try {
      const r = await runCurfewJob();
      if (r.sent || r.failed) console.info("[curfew] tick", r);
    } catch (err) {
      console.warn("[curfew] tick failed", err instanceof Error ? err.message : err);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, 60_000);
}
