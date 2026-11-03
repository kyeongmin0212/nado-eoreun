import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { todayKst } from "@/lib/time";

export const runtime = "nodejs";

/** 오늘만 적용하는 통금 시각 + 미리 알림(10·30·60·120분 전). 기본 통금은 마이페이지에서 바꾼다. */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { time?: string; notifyMinutes?: number } | null;
  const time = String(body?.time ?? "").slice(0, 5);
  const minutes = Number(body?.notifyMinutes);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NextResponse.json({ ok: false, code: "invalid_input", message: "통금 시각 형식이 올바르지 않아요." }, { status: 400 });
  if (![10, 30, 60, 120].includes(minutes)) return NextResponse.json({ ok: false, code: "invalid_input", message: "미리 알림은 10분·30분·1시간·2시간 전 중에서 골라 주세요." }, { status: 400 });
  const data = await getData();
  const profile = await data.setTodayCurfew(user.id, time, minutes, todayKst());
  return NextResponse.json({ ok: true, profile });
}
