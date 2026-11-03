import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모든 화면이 로그인 사용자별 동적 데이터이므로 Cache Components(PPR) 모델 대신
  // 기존 동적 렌더링 모델을 사용한다. (docs/DECISIONS.md D21 참고)
  // docker 실행용 standalone 산출물 (Vercel 배포에는 영향 없음)
  output: "standalone",
  // 개발 서버의 좌하단 Dev Tools 버튼이 모바일 폭에서 하단 탭을 가려 탭 조작(E2E 포함)을 막으므로 끈다. 프로덕션에는 없다.
  devIndicators: false,
  cacheComponents: false,
  partialPrefetching: false,
  experimental: {
    // 방금 본 탭으로 돌아가면 30초 동안은 서버 왕복 없이 바로 보여준다.
    // 사진 생성·저장·상황 저장처럼 내용을 바꾸는 동작 뒤에는 router.refresh() 로 이 캐시를 비운다.
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
