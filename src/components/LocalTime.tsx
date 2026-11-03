"use client";

import { useSyncExternalStore } from "react";

type Props = { iso: string | null | undefined; mode?: "datetime" | "time" | "relative" };

function format(iso: string, mode: Props["mode"]) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (mode === "time") {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  if (mode === "relative") {
    const diff = Date.now() - d.getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return "방금";
    if (m < 60) return `${m}분 전`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}시간 전`;
  }
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const noopSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/** 기기 시간대 기준으로 표시 (서버 렌더 시간대와의 불일치를 피하기 위해 하이드레이션 후에만 포맷). */
export function LocalTime({ iso, mode = "datetime" }: Props) {
  const hydrated = useHydrated();
  if (!iso) return null;
  return <time dateTime={iso}>{hydrated ? format(iso, mode) : ""}</time>;
}
