import { NextResponse } from "next/server";

/**
 * SOS 화면 전용 manifest. iPhone 에서 SOS 화면을 열고 '홈 화면에 추가'하면 바로 SOS-01 이 열리는 아이콘이 생긴다
 * (기능명세서 최종: 웹앱 단계의 홈 화면 바로가기).
 */
export function GET() {
  return NextResponse.json(
    {
      name: "나도으른 SOS",
      short_name: "SOS",
      id: "/sos",
      start_url: "/sos",
      scope: "/",
      display: "standalone",
      background_color: "#2E2A33",
      theme_color: "#2E2A33",
      lang: "ko",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
