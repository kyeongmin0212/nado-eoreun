import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageGeneration, ImageMode, GenerationParams } from "@/lib/types";

export const GENERATIONS_BUCKET = "generations";

export function extensionFor(mediaType: string): string {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";
  return "png";
}

export type PersistInput = {
  supabase: SupabaseClient;
  userId: string;
  bytes: Uint8Array;
  mediaType: string;
  mode: ImageMode;
  promptText?: string | null;
  modelId?: string | null;
  parentId?: string | null;
  version?: number;
  placeTag?: string | null;
  params?: GenerationParams | null;
};

/**
 * 결과를 본인 폴더(<userId>/...)의 비공개 버킷에 올리고 내역 행을 만든다.
 * 사용자 세션 클라이언트로 수행하므로 RLS/Storage 정책이 실제로 적용된다.
 */
export async function persistGeneration(input: PersistInput): Promise<ImageGeneration> {
  const id = crypto.randomUUID();
  const path = `${input.userId}/${id}.${extensionFor(input.mediaType)}`;
  const body = new Blob([input.bytes as BlobPart], { type: input.mediaType });

  const { error: uploadError } = await input.supabase.storage
    .from(GENERATIONS_BUCKET)
    .upload(path, body, { contentType: input.mediaType, upsert: false, cacheControl: "0" });
  if (uploadError) {
    throw new Error(`저장 실패(storage): ${uploadError.message}`);
  }

  const { data, error: insertError } = await input.supabase
    .from("image_generations")
    .insert({
      id,
      owner_id: input.userId,
      mode: input.mode,
      status: "completed",
      storage_path: path,
      media_type: input.mediaType,
      prompt_text: input.promptText ?? null,
      model_id: input.modelId ?? null,
      parent_id: input.parentId ?? null,
      version: input.version ?? 1,
      place_tag: input.placeTag ?? null,
      params: input.params ?? null,
    })
    .select("*")
    .single();

  if (insertError || !data) {
    // DB 기록 실패 시 방금 올린 파일을 정리해 고아 파일을 남기지 않는다.
    await input.supabase.storage.from(GENERATIONS_BUCKET).remove([path]).catch(() => undefined);
    throw new Error(`저장 실패(db): ${insertError?.message ?? "unknown"}`);
  }
  return data as ImageGeneration;
}

/** 버킷 안의 사용자 폴더(하위 폴더 포함) 파일 경로 목록 */
export async function listUserObjects(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (prefix: string) => {
    const { data } = await supabase.storage.from(GENERATIONS_BUCKET).list(prefix, { limit: 1000 });
    for (const entry of data ?? []) {
      const full = `${prefix}/${entry.name}`;
      // 폴더는 id 가 null 이다
      if ((entry as { id?: string | null }).id == null) await walk(full);
      else out.push(full);
    }
  };
  await walk(userId);
  return out;
}
