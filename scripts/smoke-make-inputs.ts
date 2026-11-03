/**
 * 스모크 테스트용 가상 입력 사진 생성 (실제 인물 사진이 없을 때만 사용).
 * 같은 OpenAI 이미지 모델로 텍스트→이미지 4장을 만들어 .smoke-out/inputs/ 에 저장한다.
 * 실행: pnpm smoke:inputs   (OPENAI_API_KEY 필요, 과금 발생)
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateImage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

loadEnv({ path: ".env.local", override: false });

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = openai.image(process.env.IMAGE_MODEL_ID || "gpt-image-2.5-sunburst");

const jobs: Array<{ name: string; prompt: string; size: `${number}x${number}` }> = [
  {
    name: "selfie-a.jpg",
    size: "1024x1536",
    prompt:
      "Photorealistic candid smartphone selfie of ONE young East Asian woman in her mid-20s, alone, shoulder-length wavy dark brown hair, warm smile, wearing a beige knit cardigan, standing on a quiet tree-lined city street at dusk with string lights in the background. Natural lighting, slight wide-angle selfie perspective. Exactly one person.",
  },
  {
    name: "friend-b.jpg",
    size: "1024x1536",
    prompt:
      "Photorealistic portrait photo of ONE young East Asian woman in her mid-20s, short black bob hair with straight bangs, round tortoiseshell glasses, bright smile, wearing a navy sweatshirt, sitting in a bright cafe. Face clearly visible, natural lighting. Exactly one person.",
  },
  {
    name: "together.jpg",
    size: "1024x1536",
    prompt:
      "Photorealistic photo of TWO young East Asian women friends in their mid-20s standing side by side in a cozy living room, both smiling at the camera. Left: shoulder-length wavy dark brown hair, beige knit cardigan. Right: short black bob with bangs and round tortoiseshell glasses, navy sweatshirt. Indoor warm lighting, sofa and bookshelf behind them. Exactly two people.",
  },
  {
    name: "background-beach.jpg",
    size: "1536x1024",
    prompt:
      "Photorealistic wide photo of an empty sandy beach at golden hour, gentle waves, soft orange sky, a few rocks on the left, no people, no text.",
  },
];

async function main() {
  const dir = join(process.cwd(), ".smoke-out", "inputs");
  mkdirSync(dir, { recursive: true });
  for (const job of jobs) {
    const t0 = Date.now();
    const result = await generateImage({
      model,
      prompt: job.prompt,
      size: job.size,
      n: 1,
      providerOptions: { openai: { quality: "medium", outputFormat: "jpeg" } },
    });
    const file = join(dir, job.name);
    writeFileSync(file, result.image.uint8Array);
    console.log(JSON.stringify({ file: job.name, mediaType: result.image.mediaType, bytes: result.image.uint8Array.byteLength, ms: Date.now() - t0, warnings: result.warnings }));
  }
}

main().catch((e) => {
  console.error("실패:", e?.message ?? e);
  process.exit(1);
});
