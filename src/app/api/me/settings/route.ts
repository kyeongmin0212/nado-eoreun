import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { parseSettingsPatch } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  const profile = await data.getProfileFull(user.id);
  return NextResponse.json({ ok: true, profile }, { headers: { "Cache-Control": "no-store" } });
}

/** 통금·알림·화면 모드·이름·전화번호 설정 변경 (본인만). */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = parseSettingsPatch(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, code: "invalid_input", message: parsed.message }, { status: 400 });
  try {
    const data = await getData();
    const profile = await data.updateSettings(user.id, parsed.value);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "db_error", message: err instanceof Error ? err.message : "저장 실패" }, { status: 500 });
  }
}
