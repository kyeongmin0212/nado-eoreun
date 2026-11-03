"use client";

import type { PreparedImage } from "@/lib/image/client-prepare";
import type { ImageMode, PersonTag } from "@/lib/types";
import { profilePhotoSrc } from "@/lib/urls";

/** 사진 선택 바텀시트에서 고른 한 장: 등록 사진(나·동의한 친구) 또는 이번에만 쓰는 내 갤러리·카메라 사진 */
export type PhotoPick =
  | { kind: "profile"; id: string; personId: string; personName: string; tag: PersonTag; slot: string; createdAt?: string }
  | { kind: "file"; localId: string; image: PreparedImage; personName: string; tag: PersonTag; label: string };

export type GenerationInputs = {
  mode: ImageMode;
  people: PhotoPick[];
  hair: PreparedImage | null;
  preset: string | null;
  situation: string | null;
  text: string;
};

/**
 * 생성에 쓴 입력을 같은 세션(페이지 로드) 안에서만 기억한다. 원본 사진은 서버에 저장하지 않으므로(D23·D56),
 * 편집기의 「다시 만들기」와 「원본 비교」는 여기서 읽는다. 새로고침하면 사라진다.
 */
const store = new Map<string, GenerationInputs>();

export function rememberInputs(generationId: string, inputs: GenerationInputs) {
  store.set(generationId, inputs);
}

export function recallInputs(generationId: string): GenerationInputs | undefined {
  return store.get(generationId);
}

export function firstPersonPreview(inputs: GenerationInputs | undefined): string | null {
  if (!inputs) return null;
  const f = inputs.people.find((p) => p.kind === "file");
  if (f && f.kind === "file") return f.image.previewUrl;
  const p = inputs.people.find((p) => p.kind === "profile");
  if (p && p.kind === "profile") return profilePhotoSrc(p.id, p.createdAt);
  return null;
}

/** multipart 본문 구성 (생성 API) */
export function buildGenerateForm(inputs: GenerationInputs): FormData {
  const form = new FormData();
  form.set("mode", inputs.mode);
  form.set("text", inputs.text.trim());
  if (inputs.preset) form.set("preset", inputs.preset);
  if (inputs.situation) form.set("situation", inputs.situation);
  const people: { source: "file" | "profile"; key?: string; id?: string; tag: PersonTag; name: string }[] = [];
  let i = 0;
  let orientation: string | null = null;
  for (const p of inputs.people) {
    if (p.kind === "file") {
      const key = `p${i++}`;
      form.set(key, p.image.blob, `${key}.jpg`);
      people.push({ source: "file", key, tag: p.tag, name: p.personName });
      if (!orientation) orientation = p.image.orientation;
    } else {
      people.push({ source: "profile", id: p.id, tag: p.tag, name: p.personName });
    }
  }
  form.set("people", JSON.stringify(people));
  if (inputs.hair) form.set("hair", inputs.hair.blob, "hair.jpg");
  form.set("orientation", orientation ?? "portrait");
  return form;
}
