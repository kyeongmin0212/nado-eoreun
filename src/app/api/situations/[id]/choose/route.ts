import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 같은 날짜에 여러 상황이 있을 때 오늘 사용할 상황 선택 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const item = await data.chooseSituation(user.id, id);
  if (!item) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}
