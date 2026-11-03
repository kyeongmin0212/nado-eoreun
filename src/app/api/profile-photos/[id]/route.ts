import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const result = await data.deleteProfilePhoto(user.id, id);
  if (!result.ok) return NextResponse.json(result, { status: result.code === "not_found" ? 404 : 500 });
  return NextResponse.json({ ok: true });
}
