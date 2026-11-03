import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { pushToUsers } from "@/lib/push/notify";

export const runtime = "nodejs";

/** 이 계정의 모든 기기로 확인용 알림을 보낸다 (알림 켜기 직후 앱을 닫아도 오는지 확인). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  const out = await pushToUsers(data, [user.id], { title: "나도으른", body: "알림이 켜졌어요. 앱을 닫아도 친구 SOS가 이렇게 와요.", url: "/", tag: "push-test" });
  const o = out.get(user.id);
  return NextResponse.json({ ok: o?.status === "sent", status: o?.status ?? "failed", error: o?.error ?? null });
}
