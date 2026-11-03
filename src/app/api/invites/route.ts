import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 초대 링크 생성 (7일 유효). 링크를 연 로그인 사용자가 수락하면 친구가 된다. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const data = await getData();
  const invite = await data.createInvite(user.id);
  const origin = new URL(request.url).origin;
  return NextResponse.json({ ok: true, token: invite.token, url: `${origin}/invite/${invite.token}`, expiresAt: invite.expires_at });
}
