import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { notifyConsent } from "@/lib/notify";

export const runtime = "nodejs";

/** 내가 친구별로 허용한 사진 사용 동의 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  return NextResponse.json({ ok: true, friends: await data.getFriendsWithConsent(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** 동의 승인·철회: { granteeId, granted }. 친구가 아니면 거부된다. 철회 뒤의 새 생성에는 내 사진을 쓸 수 없다. */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { granteeId?: string; granted?: boolean } | null;
  if (!body?.granteeId || typeof body.granted !== "boolean" || body.granteeId === user.id) {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "요청 값이 올바르지 않아요." }, { status: 400 });
  }
  const data = await getData();
  const consent = await data.setConsent(user.id, body.granteeId, body.granted);
  if (!consent) return NextResponse.json({ ok: false, code: "not_friend", message: "친구에게만 동의를 설정할 수 있어요." }, { status: 403 });
  if (body.granted) {
    const me = await data.getProfile(user.id);
    await notifyConsent(data, user.id, me?.display_name ?? "친구", body.granteeId).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, consent });
}
