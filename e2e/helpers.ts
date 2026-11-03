import { expect, type Page } from "@playwright/test"
import path from "node:path"

/**
 * 첫 화면(/)에서 '로그인' 을 눌러 들어간다. 홈의 'SOS 보내기' 바가 보이면 로그인 완료다.
 * 로그인 칸은 '아이디(이메일)' 이며 시드 계정 이메일을 넣는다.
 */
export async function logIn(page: Page, login: string, password: string) {
  await page.goto("/")
  await page.getByRole("link", { name: "로그인", exact: true }).click()
  await page.getByLabel("아이디").fill(login)
  await page.getByLabel("비밀번호").fill(password)
  await page.getByRole("button", { name: "로그인", exact: true }).click()
  await expect(page.getByRole("link", { name: /SOS 보내기/ })).toBeVisible({ timeout: 30_000 })
}

export function fixture(name: string) {
  return path.join(__dirname, "fixtures", name)
}

export function tabBar(page: Page) {
  return page.getByRole("navigation", { name: "하단 탭" })
}
