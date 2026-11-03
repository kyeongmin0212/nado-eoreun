import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { parseSituationInput } from "@/lib/validate";
import { writeSituation } from "@/lib/situation-write";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  return NextResponse.json({ ok: true, items: await data.listSituations(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** 상황 예약 생성 (본인). 동행인은 등록 친구 id. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const parsed = parseSituationInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, code: "invalid_input", message: parsed.message }, { status: 400 });
  try {
    const data = await getData();
    const r = await writeSituation(data, user.id, parsed.value, null);
    if (!r.ok) return NextResponse.json({ ok: false, code: "invalid_input", message: r.message }, { status: r.status });
    return NextResponse.json({ ok: true, item: r.item });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "db_error", message: err instanceof Error ? err.message : "저장 실패" }, { status: 500 });
  }
}
