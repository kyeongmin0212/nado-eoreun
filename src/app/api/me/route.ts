import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 회원 탈퇴: 사진·상황·SOS·구독을 모두 지우고 계정을 삭제한다. 복구할 수 없다. */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "탈퇴") return NextResponse.json({ ok: false, code: "confirm_required", message: "확인 문구가 필요해요." }, { status: 400 });
  const data = await getData();
  try {
    await data.deleteAccount(user.id);
  } catch (err) {
    return NextResponse.json({ ok: false, code: "error", message: err instanceof Error ? err.message : "탈퇴 처리 실패" }, { status: 500 });
  }
  await data.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
