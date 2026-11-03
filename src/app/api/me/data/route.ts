import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 생성 사진·상황 기록 삭제 (계정은 유지). */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  const result = await data.deleteUserData(user.id);
  return NextResponse.json({ ok: true, ...result });
}
