import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 알림 목록 + 안 읽은 수 (본인) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  const [items, unread] = await Promise.all([data.listNotifications(user.id, 30), data.countUnreadNotifications(user.id)]);
  return NextResponse.json({ ok: true, items, unread }, { headers: { "Cache-Control": "no-store" } });
}

/** 읽음 처리: { ids: string[] } 또는 { all: true } */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { ids?: string[]; all?: boolean } | null;
  const data = await getData();
  if (body?.all) await data.markNotificationsRead(user.id, null);
  else if (Array.isArray(body?.ids)) await data.markNotificationsRead(user.id, body!.ids!.filter((x) => typeof x === "string").slice(0, 100));
  else return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  return NextResponse.json({ ok: true, unread: await data.countUnreadNotifications(user.id) });
}
