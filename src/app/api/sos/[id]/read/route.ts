import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 수신자가 요청 상세를 실제로 연 뒤 호출. 최초 시각만 기록하고 이후 호출은 덮어쓰지 않는다. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const result = await data.markSosRead(user.id, id);
  if (result.ok) await data.markNotificationsRead(user.id, null, `/sos/${id}`).catch(() => undefined);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code, message: result.message }, { status: result.code === "not_a_recipient" ? 403 : 500 });
  }
  return NextResponse.json({ ok: true, firstReadAt: result.firstReadAt });
}
