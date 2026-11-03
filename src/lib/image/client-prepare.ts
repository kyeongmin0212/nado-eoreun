"use client";

import type { Orientation } from "@/lib/image/generate";

export type PreparedImage = {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  orientation: Orientation;
  originalName: string;
};

const MAX_EDGE = 1536;
const JPEG_QUALITY = 0.9;

/**
 * iPhone 사진을 업로드 전에 정규화한다.
 * - EXIF 회전을 적용해 그린 뒤 JPEG 로 다시 인코딩 (HEIC 는 Safari 가 디코드할 수 있으면 함께 변환)
 * - 긴 변 1536px 로 축소해 요청 본문 크기를 제한
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없어요 (canvas 미지원).");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("이미지 변환에 실패했어요.");

  const ratio = width / height;
  const orientation: Orientation = ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square";
  return { blob, previewUrl: URL.createObjectURL(blob), width, height, orientation, originalName: file.name };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // 일부 형식(HEIC 등)은 createImageBitmap 이 실패할 수 있어 <img> 로 재시도한다.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("이 사진 형식은 열 수 없어요. JPEG·PNG·WebP 사진을 선택해 주세요."));
      img.src = url;
    });
    return img;
  } finally {
    // drawImage 이후 해제되도록 지연
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
