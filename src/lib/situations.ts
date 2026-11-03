import type { Situation, SituationSnapshot } from "@/lib/types";
import { casualSubject, withName } from "@/lib/copy";
import { situationStatus, todayKst } from "@/lib/time";
import { shortText } from "@/lib/ai/text";

/** 오늘 활성인 상황. 여러 개면 사용자가 고른 것(chosen_at 최신), 없으면 최근 수정본. */
export function activeSituation(list: Situation[], today: string = todayKst()): Situation | null {
  const candidates = list.filter((s) => situationStatus(s.target_date, s.end_date, today) === "active");
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const chosen = candidates.filter((s) => s.chosen_at).sort((a, b) => new Date(b.chosen_at!).getTime() - new Date(a.chosen_at!).getTime());
  if (chosen[0]) return chosen[0];
  return [...candidates].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
}

export function activeCandidates(list: Situation[], today: string = todayKst()): Situation[] {
  return list.filter((s) => situationStatus(s.target_date, s.end_date, today) === "active");
}

export function toSnapshot(s: Situation, senderName: string): SituationSnapshot {
  return {
    date: s.target_date,
    place: s.place,
    companion: s.companion,
    companionIds: s.companion_ids,
    realName: s.real_name,
    realPhone: s.real_phone,
    memo: s.memo,
    summary: s.summary || templateSummary(senderName, s.place, s.companion, s.memo),
  };
}

/** AI 를 쓸 수 없을 때의 요약 (사용자 입력값임을 전제로 한 서술) */
export function templateSummary(senderName: string, place: string, companion: string, memo: string): string {
  const who = companion ? `${withName(companion.split(",")[0].trim())} ` : "";
  const where = place ? `${place}에` : "어딘가에";
  const base = `${casualSubject(senderName)} 지금 ${who}${where} 있다고 입력했어요.`;
  if (!memo) return base;
  // 따옴표 안 메모가 받침으로 끝나면 '이라는', 아니면 '라는'
  const last = memo.trim().charCodeAt(memo.trim().length - 1);
  const jong = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${base} "${memo}"${jong ? "이라는" : "라는"} 메모가 있어요.`;
}

/** 오늘의 상황을 친구에게 보낼 한 문단으로 요약 (SOS-01). 실패하면 템플릿. */
export async function summarizeSituation(senderName: string, place: string, companion: string, memo: string): Promise<string> {
  const fallback = templateSummary(senderName, place, companion, memo);
  const ai = await shortText(
    "너는 친구에게 보낼 상황 요약을 쓰는 비서다. 사용자가 직접 입력한 정보만 사용하고, 확인되지 않은 사실(실제 위치·시간·사람)을 지어내지 않는다. 장소와 사람 이름은 입력한 글자 그대로 쓴다. 존댓말 '~했어요' 체로 2문장 이내, 120자 이내로 쓴다. '~라고 입력했어요'처럼 사용자 입력이라는 점을 드러낸다.",
    `보낸 사람: ${senderName}\n장소: ${place || "미입력"}\n부모님께 알린 동행인: ${companion || "없음"}\n메모: ${memo || "없음"}\n예시: "지은이가 지금 수진이와 부산 해운대 카페에 있다고 입력했어요. 점심은 돼지국밥을 먹었고, 저녁에는 숙소에서 쉴 예정이라는 메모가 있어요."`,
  );
  return ai ?? fallback;
}
