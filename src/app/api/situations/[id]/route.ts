import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { parseSituationInput } from "@/lib/validate";
import { writeSituation } from "@/lib/situation-write";

export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = parseSituationInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, code: "invalid_input", message: parsed.message }, { status: 400 });
  const data = await getData();
  const r = await writeSituation(data, user.id, parsed.value, id);
  if (!r.ok) return NextResponse.json({ ok: false, code: r.status === 404 ? "not_found" : "invalid_input", message: r.message }, { status: r.status });
  return NextResponse.json({ ok: true, item: r.item });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const result = await data.deleteSituation(user.id, id);
  if (!result.ok) return NextResponse.json(result, { status: result.code === "not_found" ? 404 : 500 });
  return NextResponse.json({ ok: true });
}
