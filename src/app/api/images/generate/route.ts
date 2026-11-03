import { NextResponse } from "next/server";
import { modeById } from "@/lib/image/modes";
import { placePreset, situationPreset } from "@/lib/image/presets";
import { arrangeImages, buildPrompt, type PersonRef } from "@/lib/image/prompts";
import { ImageGenerationError, detectOrientation, runImageGeneration, type Orientation } from "@/lib/image/generate";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import type { GenerationParams, PersonTag } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PEOPLE = 4;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const TAGS: PersonTag[] = ["self", "friend", "other"];

function bad(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function readImage(form: FormData, key: string): Promise<Uint8Array | null> {
  const v = form.get(key);
  if (!(v instanceof Blob) || v.size === 0) return null;
  if (!ALLOWED.has(v.type)) throw bad("invalid_input", "JPEG·PNG·WebP 사진만 사용할 수 있어요.");
  if (v.size > MAX_FILE_BYTES) throw bad("invalid_input", "사진이 너무 커요 (8MB 이하).");
  return new Uint8Array(await v.arrayBuffer());
}

type PeopleSpec = { source: "file" | "profile"; key?: string; id?: string; tag: PersonTag; name?: string };

/**
 * POST multipart/form-data (v2): mode, people(JSON), p0..pN, background?, hair?, preset?, situation?, text?, orientation
 * 업로드 원본은 이 요청의 메모리에서만 사용하고 저장하지 않는다. 등록 사진(profile)은 본인 또는 동의받은 친구의 것만 읽는다.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("unauthorized", "로그인이 필요합니다.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("invalid_input", "요청 형식이 올바르지 않아요.");
  }

  const mode = modeById(String(form.get("mode") ?? ""));
  if (!mode) return bad("invalid_input", "알 수 없는 사진 기능이에요.");

  const orientationRaw = String(form.get("orientation") ?? "portrait");
  let orientation: Orientation = (["portrait", "landscape", "square"] as const).includes(orientationRaw as Orientation) ? (orientationRaw as Orientation) : "portrait";

  const text = String(form.get("text") ?? "").trim();
  if (text.length > 300) return bad("invalid_input", "설명은 300자 이하로 적어 주세요.");
  const presetId = String(form.get("preset") ?? "").trim() || null;
  const preset = presetId ? placePreset(presetId) : undefined;
  if (presetId && !preset) return bad("invalid_input", "알 수 없는 장소 프리셋이에요.");
  const situationId = String(form.get("situation") ?? "").trim() || null;
  const situation = situationId ? situationPreset(situationId) : undefined;
  if (mode.id === "situation" && !situation) return bad("invalid_input", "상황을 골라 주세요.");

  let spec: PeopleSpec[];
  try {
    const parsed = JSON.parse(String(form.get("people") ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("people");
    spec = parsed as PeopleSpec[];
  } catch {
    return bad("invalid_input", "인물 사진 정보가 올바르지 않아요.");
  }
  if (spec.length > MAX_PEOPLE) return bad("invalid_input", `인물 사진은 ${MAX_PEOPLE}장까지 넣을 수 있어요.`);
  for (const p of spec) if (!TAGS.includes(p.tag)) return bad("invalid_input", "인물 구분 값이 올바르지 않아요.");

  const data = await getData();
  const images: Uint8Array[] = [];
  const people: PersonRef[] = [];
  const peopleParams: NonNullable<GenerationParams["people"]> = [];
  try {
    for (const p of spec) {
      let bytes: Uint8Array | null = null;
      if (p.source === "file") {
        if (!p.key || !/^p\d{1,2}$/.test(p.key)) return bad("invalid_input", "인물 사진 키가 올바르지 않아요.");
        bytes = await readImage(form, p.key);
      } else if (p.source === "profile" && p.id) {
        const file = await data.readProfilePhotoFile(user.id, p.id);
        if (!file) return bad("forbidden", "사용할 수 없는 등록 사진이 있어요 (삭제됐거나 사용 동의가 없어요).", 403);
        bytes = file.bytes;
      }
      if (!bytes) return bad("invalid_input", "인물 사진을 읽지 못했어요.");
      images.push(bytes);
      people.push({ tag: p.tag, name: p.name?.slice(0, 40) ?? null });
      peopleParams.push({ tag: p.tag, name: p.name?.slice(0, 40) ?? null, source: p.source });
    }
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return bad("invalid_input", "사진을 읽지 못했어요.");
  }

  // 모드별 입력 검증 (필수 자료 누락 시 생성하지 않는다)
  if (people.length < mode.minPeople) return bad("invalid_input", mode.minPeople === 1 ? "사진을 1장 이상 선택해 주세요." : "내 사진 1장과 친구 사진 1장이 필요해요.");
  if (mode.needsSelfAndOther && (!people.some((p) => p.tag === "self") || !people.some((p) => p.tag !== "self"))) {
    return bad("invalid_input", "내 사진 1장과 친구 사진 1장이 필요해요.");
  }

  let background: Uint8Array | null = null;
  let hair: Uint8Array | null = null;
  try {
    if (mode.backgroundPhoto) background = await readImage(form, "background");
    if (mode.hairPhoto) {
      hair = await readImage(form, "hair");
      if (!hair) return bad("invalid_input", "참고 헤어스타일 사진이 필요해요.");
    }
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return bad("invalid_input", "사진을 읽지 못했어요.");
  }
  if (mode.textRole === "background" && !preset && !background && text.length < 2) {
    return bad("invalid_input", "장소 프리셋을 고르거나 원하는 배경을 2자 이상 설명해 주세요.");
  }

  // 팀 지시문은 '첫 번째·두 번째 사진'으로 말하므로 이미지 순서를 지시문에 맞춘다(친구 추가하기는 내 사진이 첫 번째).
  const arranged = arrangeImages(mode.id, people, images, background, hair);
  if (arranged.images.length > 0) orientation = detectOrientation(arranged.images[0]) ?? orientation;
  const prompt = buildPrompt({
    mode: mode.id,
    people: arranged.people,
    hasBackgroundPhoto: Boolean(background),
    hasHairPhoto: Boolean(hair),
    preset: preset?.id ?? null,
    situation: situation?.id ?? null,
    text,
  });
  const allImages = arranged.images;

  let generated;
  try {
    generated = await runImageGeneration({ prompt, images: allImages, orientation });
  } catch (err) {
    if (err instanceof ImageGenerationError) return NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: err.status });
    return bad("provider_error", "이미지 생성 중 오류가 발생했어요.", 502);
  }
  if (generated.warnings.length) console.warn("[image] provider warnings", { mode: mode.id, warnings: generated.warnings });
  console.info("[image] generated", { mode: mode.id, provider: generated.provider, ms: generated.durationMs, people: people.length, bytes: generated.bytes.byteLength });

  const placeTag = situation?.placeTag ?? preset?.label ?? (mode.textRole === "background" && text ? text.slice(0, 20) : null);
  const params: GenerationParams = {
    preset: preset?.id ?? null,
    situation: situation?.id ?? null,
    background: mode.backgroundPhoto ? (background ? "photo" : preset ? "preset" : text ? "text" : null) : null,
    people: peopleParams,
    extra: text || null,
    hairRef: Boolean(hair),
  };

  try {
    const row = await data.persistGeneration({
      userId: user.id,
      bytes: generated.bytes,
      mediaType: generated.mediaType,
      mode: mode.id,
      promptText: text || null,
      modelId: generated.modelId,
      placeTag,
      params,
    });
    return NextResponse.json({ ok: true, saved: true, generationId: row.id, mediaType: row.media_type, durationMs: generated.durationMs, warnings: generated.warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "저장 실패";
    console.error("[image] persist failed", { mode: mode.id, message });
    return NextResponse.json({ ok: false, code: "save_failed", message: `생성은 됐지만 보관에 실패했어요: ${message}` }, { status: 500 });
  }
}
