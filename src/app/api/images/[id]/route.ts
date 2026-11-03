import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 본인 내역 삭제: 파일 → DB 순서. 파일 삭제 실패 시 DB 행을 남기고 실패를 그대로 보고한다. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized", message: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const result = await data.deleteGeneration(user.id, id);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json({ ok: true });
}
