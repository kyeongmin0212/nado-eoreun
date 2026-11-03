import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string };

/** 구독 등록/갱신. endpoint 는 유일하므로 계정 전환 시 소유자가 현재 사용자로 바뀐다. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized", message: "로그인이 필요합니다." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint) || endpoint.length > 2048) {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "구독 정보가 올바르지 않아요." }, { status: 400 });
  }
  try {
    const data = await getData();
    await data.upsertSubscription(user.id, endpoint, p256dh, auth, body?.userAgent?.slice(0, 200) ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "db_error", message: err instanceof Error ? err.message : "구독 저장 실패" }, { status: 500 });
  }
}

/** 로그아웃 전 구독 행 삭제 (본인 소유만). */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  const data = await getData();
  await data.deleteSubscription(user.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
