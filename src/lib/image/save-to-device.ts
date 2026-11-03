"use client";

/**
 * iPhone 에서 실제 가능한 저장 흐름:
 * 1) Web Share API(파일 공유) → 공유 시트에서 `이미지 저장` 선택 가능
 * 2) 미지원 시 다운로드 링크 → 파일 앱에 저장
 * 사진 보관함 자동 저장을 보장하지 않는다.
 */
export async function saveImageToDevice(src: string, filename: string): Promise<"shared" | "downloaded"> {
  const res = await fetch(src, { credentials: "same-origin" });
  if (!res.ok) throw new Error("이미지를 불러오지 못했어요.");
  const blob = await res.blob();
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
  const file = new File([blob], `${filename}.${ext}`, { type: blob.type || "image/png" });

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iOS 에서만 공유 시트(사진 앱 저장)를 쓰고, 그 외 환경은 다운로드로 저장한다 (결정적 동작).
  if (isIOS && typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "나도으른" });
      return "shared";
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw new Error("저장을 취소했어요.");
      // 공유 실패 시 다운로드로 폴백
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
