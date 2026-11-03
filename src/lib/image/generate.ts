import { generateImage, type ImageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { imageModelId, imageProvider, imageQuality, type ImageProvider } from "@/lib/env";

export type Orientation = "portrait" | "landscape" | "square";

export type GenerateInput = {
  prompt: string;
  /** 지시문의 Image 1..n 순서 그대로 */
  images: Uint8Array[];
  orientation: Orientation;
};

export type GenerateOutput = {
  bytes: Uint8Array;
  mediaType: string;
  modelId: string;
  provider: ImageProvider;
  warnings: string[];
  durationMs: number;
};

export class ImageGenerationError extends Error {
  code: "not_configured" | "provider_error";
  status: number;
  constructor(code: "not_configured" | "provider_error", message: string, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function sizeFor(orientation: Orientation): `${number}x${number}` {
  // GPT Image 계열 권장 크기. 입력 사진의 방향을 따른다.
  if (orientation === "portrait") return "1024x1536";
  if (orientation === "landscape") return "1536x1024";
  return "1024x1024";
}

/** 프로바이더별 모델 객체. OpenAI 직접 호출이 기본, Gateway 는 대체 경로. */
function resolveModel(): { provider: ImageProvider; modelId: string; model: ImageModel } {
  const provider = imageProvider();
  const modelId = imageModelId();
  if (provider === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { provider, modelId, model: openai.image(modelId) };
  }
  if (provider === "gateway") {
    // 문자열 모델 ID 는 AI SDK 기본 Gateway 프로바이더가 해석 (AI_GATEWAY_API_KEY)
    return { provider, modelId, model: modelId };
  }
  throw new ImageGenerationError("not_configured", "이미지 생성 연결 대기: OPENAI_API_KEY 가 설정되지 않았습니다.", 503);
}

/**
 * 참조 이미지 편집/생성 호출.
 * - OpenAI 직접: `@ai-sdk/openai@4.0.104` 의 image 모델이 `prompt.images` 를 /v1/images/edits 로 전송 (모델 `gpt-image-2.5-sunburst`).
 *   참조 이미지가 없으면 /v1/images/generations. `input_fidelity` 는 2.5 모델이 거부하므로 보내지 않는다.
 * - Gateway: `ai@7.0.156` 기본 프로바이더 (`openai/gpt-image-2.5-sunburst`).
 */
export async function runImageGeneration(input: GenerateInput): Promise<GenerateOutput> {
  const { provider, modelId, model } = resolveModel();
  const quality = imageQuality();
  const started = Date.now();

  try {
    const result = await generateImage({
      model,
      prompt: input.images.length > 0 ? { text: input.prompt, images: input.images } : input.prompt,
      size: sizeFor(input.orientation),
      n: 1,
      maxRetries: 1,
      providerOptions: {
        openai: {
          ...(quality ? { quality } : {}),
          outputFormat: "jpeg",
        },
      },
    });

    const image = result.image;
    const warnings = result.warnings.map((w) => JSON.stringify(w));
    return {
      bytes: image.uint8Array,
      mediaType: image.mediaType || "image/png",
      modelId,
      provider,
      warnings,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    if (err instanceof ImageGenerationError) throw err;
    const message = sanitizeProviderError(err);
    throw new ImageGenerationError("provider_error", message, 502);
  }
}

/** 공급자 오류 메시지에서 토큰·요청 본문이 섞이지 않도록 짧게 정리한다. */
function sanitizeProviderError(err: unknown): string {
  const anyErr = err as { message?: string; statusCode?: number; responseBody?: string; name?: string };
  const status = anyErr?.statusCode ? ` (HTTP ${anyErr.statusCode})` : "";
  let detail = "";
  if (anyErr?.responseBody) {
    try {
      const parsed = JSON.parse(anyErr.responseBody) as { error?: { message?: string } | string; message?: string };
      const inner = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
      detail = inner || parsed.message || "";
    } catch {
      detail = anyErr.responseBody.slice(0, 200);
    }
  }
  const base = detail || anyErr?.message || "알 수 없는 오류";
  return `이미지 생성 실패${status}: ${base.slice(0, 300)}`;
}

/** JPEG/PNG/WebP 헤더에서 가로·세로를 읽어 방향을 정한다 (서버에 저장된 사진용). */
export function orientationOf(bytes: Uint8Array): Orientation {
  return detectOrientation(bytes) ?? "portrait";
}

/** PNG·JPEG 크기를 읽을 수 있을 때만 방향을 돌려준다(못 읽으면 null). */
export function detectOrientation(bytes: Uint8Array): Orientation | null {
  const dims = readDimensions(bytes);
  if (!dims) return null;
  const ratio = dims.width / dims.height;
  return ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square";
}

function readDimensions(b: Uint8Array): { width: number; height: number } | null {
  // PNG
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // JPEG: SOF 마커 탐색
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  // WebP (VP8X / VP8 / VP8L 간단 처리)
  if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tag === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (tag === "VP8 ") return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  return null;
}
