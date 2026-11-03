import { generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { imageProvider } from "@/lib/env";

/** 짧은 문장 생성용 텍스트 모델. OpenAI 직접(OPENAI_API_KEY) 우선, 없으면 AI Gateway. */
function textModel(): LanguageModel | null {
  const id = process.env.TEXT_MODEL_ID?.trim() || "gpt-4.1-mini";
  const provider = imageProvider();
  if (provider === "openai") return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id.replace(/^openai\//, ""));
  if (provider === "gateway") return id.includes("/") ? id : `openai/${id}`;
  return null;
}

/** 시간 제한 안에서 한 문단을 만든다. 실패·미설정이면 null (호출 쪽이 템플릿으로 대체). */
export async function shortText(system: string, prompt: string, timeoutMs = 6000): Promise<string | null> {
  const model = textModel();
  if (!model) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const { text } = await generateText({ model, system, prompt, maxOutputTokens: 220, temperature: 0.4, abortSignal: ac.signal, maxRetries: 0 });
    const out = text.trim().replace(/\s+/g, " ");
    return out.length > 0 ? out.slice(0, 600) : null;
  } catch (err) {
    console.warn("[text] summary failed", err instanceof Error ? err.message.slice(0, 160) : err);
    return null;
  } finally {
    clearTimeout(t);
  }
}
