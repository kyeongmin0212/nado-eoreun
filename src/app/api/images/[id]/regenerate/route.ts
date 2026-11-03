import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/image/prompts";
import { ImageGenerationError, orientationOf, runImageGeneration } from "@/lib/image/generate";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 편집본의 「다시 만들기」: 같은 원본·같은 편집 조건으로 새 버전을 다시 생성한다. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const data = await getData();
  const row = await data.getGeneration(user.id, id);
  if (!row) return NextResponse.json({ ok: false, code: "not_found", message: "사진을 찾을 수 없어요." }, { status: 404 });
  if (row.mode !== "edit" || !row.parent_id) {
    return NextResponse.json({ ok: false, code: "no_inputs", message: "원본 사진이 세션에 없어 다시 만들 수 없어요. 새 사진 만들기로 진행해 주세요." }, { status: 409 });
  }
  const parent = await data.readGenerationFile(user.id, row.parent_id);
  if (!parent) return NextResponse.json({ ok: false, code: "not_found", message: "원본 사진을 찾을 수 없어요." }, { status: 404 });
  const prompt = buildPrompt({ mode: "edit", people: [], pose: row.params?.pose ?? null, expression: row.params?.expression ?? null, text: row.params?.extra ?? null });
  let generated;
  try {
    generated = await runImageGeneration({ prompt, images: [parent.bytes], orientation: orientationOf(parent.bytes) });
  } catch (err) {
    if (err instanceof ImageGenerationError) return NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: err.status });
    return NextResponse.json({ ok: false, code: "provider_error", message: "이미지 편집 중 오류가 발생했어요." }, { status: 502 });
  }
  try {
    const next = await data.persistGeneration({
      userId: user.id,
      bytes: generated.bytes,
      mediaType: generated.mediaType,
      mode: "edit",
      promptText: row.prompt_text,
      modelId: generated.modelId,
      parentId: row.parent_id,
      version: row.version + 1,
      placeTag: row.place_tag,
      params: row.params,
    });
    return NextResponse.json({ ok: true, generationId: next.id, durationMs: generated.durationMs });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "save_failed", message: err instanceof Error ? err.message : "저장 실패" }, { status: 500 });
  }
}
