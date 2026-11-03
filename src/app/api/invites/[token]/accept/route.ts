import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { notifyInviteAccepted } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { token } = await ctx.params;
  if (!token || token.length > 64) return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  const data = await getData();
  const result = await data.acceptInvite(user.id, token);
  if (!result.ok) return NextResponse.json(result, { status: result.code === "not_found" ? 404 : 409 });
  if (!result.alreadyFriends) {
    const me = await data.getProfile(user.id);
    await notifyInviteAccepted(data, result.friendId, user.id, me?.display_name ?? "친구").catch(() => undefined);
  }
  return NextResponse.json(result);
}
