/**
 * 실제 이미지 생성 1건 스모크 테스트 (OPENAI_API_KEY 필요, 과금 발생).
 * 실행: pnpm smoke:image <mode> <imageA> [imageB] [text] [--out=dir]
 *   mode: add_friend(내 사진+친구 사진) | background_create(인물 사진+배경 설명) | background_swap(인물 사진+배경 사진)
 * 앱과 같은 프롬프트(src/lib/image/prompts.ts)·모델·옵션을 사용한다.
 * (Node 네이티브 TS 실행은 `@/` 별칭을 못 풀므로 상대 경로 .ts 로 가져온다. 앱 경로 자체는 /api/images/generate 로 검증한다.)
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateImage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildPrompt } from "../src/lib/image/prompts.ts";
import { imageModelId, imageProvider, imageQuality } from "../src/lib/env.ts";
import type { ImageMode } from "../src/lib/types.ts";

loadEnv({ path: ".env.local", override: false });

type Orientation = "portrait" | "landscape" | "square";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const outFlag = process.argv.find((a) => a.startsWith("--out="));
const [modeArg, imageA, imageB, ...rest] = args;
const modes: ImageMode[] = ["add_friend", "background_create", "background_swap"];

if (!modeArg || !modes.includes(modeArg as ImageMode) || !imageA) {
  console.error("사용법: pnpm smoke:image <mode> <imageA> [imageB] [text] [--out=dir]");
  process.exit(1);
}
const mode = modeArg as ImageMode;
const images: Uint8Array[] = [new Uint8Array(readFileSync(imageA))];
let text: string | undefined;
if (mode === "background_create") {
  text = [imageB, ...rest].filter(Boolean).join(" ");
  if (!text) {
    console.error("background_create 모드는 배경 설명 텍스트가 필요합니다.");
    process.exit(1);
  }
} else {
  if (!imageB) {
    console.error(`${mode} 모드는 두 번째 이미지가 필요합니다.`);
    process.exit(1);
  }
  images.push(new Uint8Array(readFileSync(imageB)));
}
const orientation = (process.env.SMOKE_ORIENTATION as Orientation) || "portrait";
const size: `${number}x${number}` = orientation === "landscape" ? "1536x1024" : orientation === "square" ? "1024x1024" : "1024x1536";

async function main() {
  const provider = imageProvider();
  const modelId = imageModelId();
  if (provider !== "openai") {
    console.error(JSON.stringify({ ok: false, code: "not_configured", message: "OPENAI_API_KEY 가 없습니다.", provider }));
    process.exit(1);
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const quality = imageQuality();
  const started = Date.now();
  const result = await generateImage({
    model: openai.image(modelId),
    prompt: {
      text: buildPrompt({
        mode,
        people: mode === "add_friend" ? [{ tag: "self" }, { tag: "friend" }] : [{ tag: "self" }],
        hasBackgroundPhoto: mode === "background_swap",
        text,
      }),
      images,
    },
    size,
    n: 1,
    maxRetries: 1,
    providerOptions: { openai: { ...(quality ? { quality } : {}), outputFormat: "jpeg"} },
  });
  const dir = outFlag ? outFlag.slice("--out=".length) : join(process.cwd(), ".smoke-out");
  mkdirSync(dir, { recursive: true });
  const ext = result.image.mediaType === "image/jpeg" ? "jpg" : result.image.mediaType === "image/webp" ? "webp" : "png";
  const file = join(dir, `${mode}-${Date.now()}.${ext}`);
  writeFileSync(file, result.image.uint8Array);
  console.log(
    JSON.stringify(
      {
        ok: true, mode, provider, modelId, mediaType: result.image.mediaType, bytes: result.image.uint8Array.byteLength,
        durationMs: Date.now() - started, warnings: result.warnings, file,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  const anyErr = err as { statusCode?: number; responseBody?: string; message?: string };
  console.error(JSON.stringify({ ok: false, mode, status: anyErr?.statusCode, message: (anyErr?.responseBody || anyErr?.message || "").slice(0, 400) }, null, 2));
  process.exit(1);
});
