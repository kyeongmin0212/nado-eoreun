import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * 보관함 저장 선택: action = "overwrite"(원본 덮어쓰기) | "new"(새 버전으로 유지).
 * 생성 결과는 생성 시점에 이미 보관되므로 "new" 는 기록만 확인한다.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action === "overwrite" ? "overwrite" : "new";
  const data = await getData();
  const row = await data.getGeneration(user.id, id);
  if (!row) return NextResponse.json({ ok: false, code: "not_found", message: "사진을 찾을 수 없어요." }, { status: 404 });
  if (action === "new" || !row.parent_id) return NextResponse.json({ ok: true, generationId: row.id, action: "new" });
  const result = await data.overwriteGeneration(user.id, row.parent_id, row.id);
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  return NextResponse.json({ ok: true, generationId: row.parent_id, action: "overwrite" });
}
