import { after } from "next/server";
import type { DataBackend } from "@/lib/data/types";
import type { Situation, SituationInput } from "@/lib/types";
import { summarizeSituation, templateSummary } from "@/lib/situations";
import { notifyCompanions } from "@/lib/notify";

/**
 * 상황 저장 공통: 동행인은 등록 친구만 허용하고 이름을 채운다. 요약은 템플릿으로 먼저 저장하고
 * 응답 뒤(after)에 AI 한 문단 요약으로 바꾼다(저장 버튼이 AI 를 기다리지 않게). 새로 지정된 동행인에게 알림.
 */
export async function writeSituation(data: DataBackend, userId: string, input: SituationInput, id: string | null): Promise<{ ok: true; item: Situation } | { ok: false; status: number; message: string }> {
  const [friends, me, before] = await Promise.all([data.getFriends(userId), data.getProfile(userId), id ? data.getSituation(userId, id) : Promise.resolve(null)]);
  if (id && !before) return { ok: false, status: 404, message: "상황을 찾을 수 없어요." };
  const friendMap = new Map(friends.map((f) => [f.id, f.display_name]));
  const notFriend = input.companion_ids.filter((x) => !friendMap.has(x));
  if (notFriend.length > 0) return { ok: false, status: 400, message: "동행인은 등록된 친구에서만 고를 수 있어요." };
  const names = input.companion_ids.map((x) => friendMap.get(x) as string);
  const companion = names.join(", ");
  const myName = me?.display_name ?? "나";
  const summary = templateSummary(myName, input.place, companion, input.memo);
  const write = { ...input, companion, summary };
  const item = id ? await data.updateSituation(userId, id, write) : await data.createSituation(userId, write);
  if (!item) return { ok: false, status: 404, message: "상황을 찾을 수 없어요." };

  const added = input.companion_ids.filter((x) => !(before?.companion_ids ?? []).includes(x));
  after(async () => {
    try {
      const ai = await summarizeSituation(myName, input.place, companion, input.memo);
      if (ai && ai !== summary) await data.setSituationSummary(userId, item.id, ai);
    } catch (err) {
      console.warn("[situation] summary update failed", err instanceof Error ? err.message : err);
    }
    try {
      if (added.length) await notifyCompanions(data, userId, myName, added);
    } catch (err) {
      console.warn("[situation] companion notify failed", err instanceof Error ? err.message : err);
    }
  });
  return { ok: true, item };
}
