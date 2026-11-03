import { getData } from "@/lib/data";
import { pushToUsers } from "@/lib/push/notify";
import { effectiveCurfew, formatHmKo, hmToMinutes, nowHmKst, todayKst } from "@/lib/time";

export type CurfewJobResult = { checked: number; sent: number; noSubscription: number; failed: number; skipped: number; date: string };

/**
 * 통금 알림: 통금 시각 N분 전부터 통금 전까지의 창 안에 있고 오늘 아직 알리지 않은 사용자에게 1회 푸시한다.
 * Supabase 배포는 pg_cron 이 1분마다 /api/cron/curfew 를 호출하고, docker(local)는 서버 안의 타이머가 호출한다.
 */
export async function runCurfewJob(now: Date = new Date()): Promise<CurfewJobResult> {
  const data = await getData();
  const today = todayKst(now);
  const { hour, minute } = nowHmKst(now);
  const nowMin = hour * 60 + minute;
  const candidates = await data.listCurfewCandidates();
  const result: CurfewJobResult = { checked: candidates.length, sent: 0, noSubscription: 0, failed: 0, skipped: 0, date: today };
  const due = candidates.filter((c) => {
    if (c.notifiedOn === today) return false;
    const curfewMin = hmToMinutes(effectiveCurfew(c.curfewTime, c.overrideTime, c.overrideDate, today));
    const diff = curfewMin - nowMin; // 통금까지 남은 분 (오늘 기준)
    return diff > 0 && diff <= c.notifyMinutes;
  });
  result.skipped = candidates.length - due.length;
  for (const c of due) {
    const cur = effectiveCurfew(c.curfewTime, c.overrideTime, c.overrideDate, today);
    const before = c.notifyMinutes >= 60 ? `${c.notifyMinutes / 60}시간` : `${c.notifyMinutes}분`;
    const outcome = await pushToUsers(data, [c.userId], {
      title: "나도으른 · 곧 통금!",
      body: `통금 ${before} 전이에요 (${formatHmKo(cur)} 통금). 슬슬 준비할까요?`,
      url: "/",
      tag: `curfew-${today}`,
    });
    const o = outcome.get(c.userId);
    if (o?.status === "sent") result.sent += 1;
    else if (o?.status === "no_subscription") result.noSubscription += 1;
    else result.failed += 1;
    // 구독이 없어도 오늘은 다시 시도하지 않는다 (같은 날 반복 알림 방지)
    await data.markCurfewNotified(c.userId, today);
  }
  // 보관 기간(30일) 정리: 매시 7분에 한 번
  if (minute === 7) {
    try {
      const purged = await data.purgeExpired(30);
      if (purged.generations || purged.situations) console.info("[retention] purged", purged);
    } catch (err) {
      console.warn("[retention] purge failed", err instanceof Error ? err.message : err);
    }
  }
  return result;
}
