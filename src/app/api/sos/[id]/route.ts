import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 요청의 전원 상태 (발신자·수신자 모두). 발신 화면의 재조회·폴링과 수신 화면의 「발신자 상태 화면 보기」에 쓴다. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const request = await data.getSosRequest(user.id, id);
  if (!request) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  const rows = (await data.getSosStatus(user.id, id)) ?? [];
  return NextResponse.json({ ok: true, createdAt: request.created_at, cancelledAt: request.cancelled_at, recipients: rows }, { headers: { "Cache-Control": "no-store" } });
}
