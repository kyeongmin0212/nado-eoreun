/** 비공개 이미지 주소. 버전이 들어간 주소는 브라우저에 오래 캐시된다 (파일이 바뀌면 버전이 바뀐다). */
export function generationSrc(id: string, version?: number | string | null, updatedAt?: string | null, width?: 160 | 240 | 360 | 480): string {
  const v = `${version ?? 1}-${updatedAt ? new Date(updatedAt).getTime() : 0}`;
  return `/api/images/${id}/file?v=${encodeURIComponent(v)}${width ? `&w=${width}` : ""}`;
}

export function profilePhotoSrc(id: string, createdAt?: string | null, width?: 160 | 240 | 360 | 480): string {
  return `/api/profile-photos/${id}/file?v=${createdAt ? new Date(createdAt).getTime() : 1}${width ? `&w=${width}` : ""}`;
}

/** 로그인·가입 뒤 이동할 내부 경로만 허용한다 (외부 주소로 보내지 않는다). */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
