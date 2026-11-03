import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 발신자의 요청 취소. 취소 뒤 수신자는 응답할 수 없고 화면에 취소됨으로 표시된다. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const result = await data.cancelSos(user.id, id);
  if (!result.ok) return NextResponse.json(result, { status: result.code === "not_found" ? 404 : 500 });
  return NextResponse.json({ ok: true });
}
