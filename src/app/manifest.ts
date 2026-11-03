import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/copy";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "통금이 있는 성인이 오늘의 상황을 미리 정하고, AI 사진과 친구 SOS로 대응하는 모바일 웹앱",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDE6DE",
    theme_color: "#FDE6DE",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // 홈 화면 바로가기(안드로이드 길게 누르기). iOS 는 SOS 화면에서 '홈 화면에 추가'로 따로 만든다.
    shortcuts: [{ name: "SOS 보내기", short_name: "SOS", url: "/sos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] }],
  };
}
