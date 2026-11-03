"use client";

import { useEffect } from "react";

/** 서비스 워커 등록. 알림 표시와 클릭 이동만 담당하며 개인 사진을 캐시하지 않는다. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[sw] 등록 실패", err);
    });
  }, []);
  return null;
}
