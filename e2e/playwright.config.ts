import { defineConfig } from "@playwright/test"
import { E2E_BASE_URL } from "./env"

/**
 * 로컬·CI용 설정. docker compose up 뒤 `npx playwright test` 로 주최 측 실행과 같은 조건을 미리 확인한다.
 * 주최 측 실행은 이 파일을 쓰지 않고 같은 화면 크기의 자체 설정으로 e2e/scenarios/S<n>.spec.ts 만 돌린다.
 * docs/scenarios.yaml 의 platform 이 mobile 이므로 mobile 프로젝트만 둔다.
 */
export default defineConfig({
  testDir: "./scenarios",
  testMatch: /[\\/]S[1-9]\d*\.spec\.ts$/,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
})
