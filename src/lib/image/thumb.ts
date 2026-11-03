/** 목록·선택 화면용 작은 사본 폭 (원본은 그대로 두고 요청할 때 줄인다) */
export const THUMB_WIDTHS = [160, 240, 360, 480] as const;

export function parseThumbWidth(raw: string | null): number | null {
  const n = Number(raw);
  return (THUMB_WIDTHS as readonly number[]).includes(n) ? n : null;
}

/**
 * 원본을 폭 w 의 WebP 로 줄인다. sharp 를 불러오지 못하거나 변환에 실패하면 null (호출부가 원본을 보낸다).
 */
export async function makeThumbnail(bytes: Uint8Array, width: number): Promise<Uint8Array | null> {
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    return new Uint8Array(out);
  } catch (err) {
    console.warn("[thumb] resize failed, sending original", err instanceof Error ? err.message : err);
    return null;
  }
}

/** 원본 옆에 두는 썸네일 사본 경로 (원본이 바뀌면 경로도 바뀐다) */
export function thumbPath(storagePath: string, width: number): string {
  return `${storagePath}.w${width}.webp`;
}

/** 원본을 지울 때 함께 지울 썸네일 경로들 */
export function withThumbPaths(paths: string[]): string[] {
  return paths.flatMap((p) => [p, ...THUMB_WIDTHS.map((w) => thumbPath(p, w))]);
}
