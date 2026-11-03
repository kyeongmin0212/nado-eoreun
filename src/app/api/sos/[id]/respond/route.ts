import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { notifySosReply } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * 친구의 응답: '실제 동행인에게 전화하기'(또는 '확인했어 · 전화할게')를 누르면 '확인 · 통화 가능'으로 기록하고
 * 보낸 사람에게 알림 센터 행 + (설정 시) 푸시를 보낸다. 실제 통화 연결은 기기의 전화 앱이 한다.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  // 화면의 응답 버튼은 하나('실제 동행인에게 전화하기' 또는 '확인했어 · 전화할게')이므로 '확인 · 통화 가능'만 기록한다.
  const response = "available";
  const data = await getData();
  const before = (await data.getSosRecipients(user.id, id)).find((r) => r.recipient_id === user.id);
  const result = await data.respondSos(user.id, id, response);
  if (!result.ok) {
    const status = result.code === "not_a_recipient" ? 403 : result.code === "cancelled" ? 409 : 500;
    return NextResponse.json({ ok: false, code: result.code, message: result.message }, { status });
  }
  // 같은 응답을 여러 번 눌러도 보낸 사람에게는 처음 한 번만 알린다.
  if (before?.response !== "available") {
    try {
      const [req, me] = await Promise.all([data.getSosRequest(user.id, id), data.getProfile(user.id)]);
      if (req) await notifySosReply(data, id, req.sender_id, user.id, me?.display_name ?? "친구");
    } catch (err) {
      console.warn("[sos] reply notify failed", err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json({ ok: true, respondedAt: result.respondedAt, response });
}
