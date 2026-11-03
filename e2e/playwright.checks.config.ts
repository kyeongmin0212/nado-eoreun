import { defineConfig } from "@playwright/test"
import { E2E_BASE_URL } from "./env"

/** 채점 시나리오(S1~S8) 밖의 검사 (이메일 인증 가입·탈퇴). 메일 수신기와 함께 실행: checks/signup.spec.ts 머리말 참고 */
export default defineConfig({
  testDir: "./checks",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
})
