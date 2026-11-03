import { NextResponse } from "next/server";
import { EXPRESSION_OPTIONS, POSE_OPTIONS, editOption } from "@/lib/image/presets";
import { buildPrompt } from "@/lib/image/prompts";
import { ImageGenerationError, orientationOf, runImageGeneration } from "@/lib/image/generate";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 포즈·표정 재편집: 보관된 결과를 입력으로 새 버전을 만든다 (parent_id = 원본). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { pose?: string | null; expression?: string | null; text?: string } | null;
  const pose = editOption(POSE_OPTIONS, body?.pose)?.id ?? null;
  const expression = editOption(EXPRESSION_OPTIONS, body?.expression)?.id ?? null;
  const text = String(body?.text ?? "").trim().slice(0, 300);
  if (!pose && !expression) return NextResponse.json({ ok: false, code: "invalid_input", message: "포즈나 표정을 골라 주세요." }, { status: 400 });

  const data = await getData();
  const source = await data.readGenerationFile(user.id, id);
  if (!source) return NextResponse.json({ ok: false, code: "not_found", message: "사진을 찾을 수 없어요." }, { status: 404 });

  const prompt = buildPrompt({ mode: "edit", people: [], pose, expression, text });
  let generated;
  try {
    generated = await runImageGeneration({ prompt, images: [source.bytes], orientation: orientationOf(source.bytes) });
  } catch (err) {
    if (err instanceof ImageGenerationError) return NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: err.status });
    return NextResponse.json({ ok: false, code: "provider_error", message: "이미지 편집 중 오류가 발생했어요." }, { status: 502 });
  }
  try {
    const rootId = source.row.parent_id ?? source.row.id;
    const row = await data.persistGeneration({
      userId: user.id,
      bytes: generated.bytes,
      mediaType: generated.mediaType,
      mode: "edit",
      promptText: text || null,
      modelId: generated.modelId,
      parentId: rootId,
      version: source.row.version + 1,
      placeTag: source.row.place_tag,
      params: { ...(source.row.params ?? {}), pose, expression, extra: text || null },
    });
    return NextResponse.json({ ok: true, generationId: row.id, durationMs: generated.durationMs });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "save_failed", message: err instanceof Error ? err.message : "저장 실패" }, { status: 500 });
  }
}
