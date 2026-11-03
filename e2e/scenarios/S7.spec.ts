import { expect, test } from "@playwright/test"
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../env"
import { fixture, logIn, tabBar } from "../helpers"

test("S7 사용자가 같은 입력으로 사진을 다시 만들고 보관함에서 새 결과를 확인한다", async ({ page }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 하단 '만들기' 메뉴를 누른다.
  await tabBar(page).getByRole("link", { name: "만들기" }).click()
  // 2. '사진 선택하기'를 누른다.
  await page.getByRole("button", { name: "사진 선택하기" }).click()
  const sheet = page.getByRole("dialog", { name: "사진 선택" })
  await expect(sheet).toBeVisible()
  // 3. 사진 선택에서 '내 사진'을 누른다.
  await sheet.getByRole("button", { name: "내 사진", exact: true }).click()
  // 4. '기타 +'를 누른다.
  await sheet.getByRole("button", { name: /^기타 \+/ }).click()
  // 5. '갤러리에서 선택'으로 테스트용 두 사람 사진을 올린다.
  await page.getByRole("dialog", { name: "사진 추가 방법" }).getByLabel("갤러리에서 선택").setInputFiles(fixture("together.jpg"))
  await expect(sheet.getByRole("button", { name: /갤러리 사진 \d+ 선택 해제/ })).toHaveCount(1, { timeout: 15_000 })
  // 6. '1장 선택 완료'를 누른다.
  await sheet.getByRole("button", { name: /^1장 선택 완료$/ }).click()
  await expect(sheet).toHaveCount(0)
  // 7. '추가 요청사항'에 '바다'를 입력한다.
  await page.getByLabel("추가 요청사항 (선택)").fill("바다")
  // 8. '사진 생성하기'를 누른다.
  await page.getByRole("button", { name: "사진 생성하기" }).click()
  await page.waitForURL(/\/editor\//, { timeout: 90_000 })
  const firstIdResult = page.getByTestId("generation-result")
  await expect(firstIdResult).toBeVisible({ timeout: 60_000 })
  const firstIdImage = firstIdResult.getByRole("img", { name: "생성 결과" })
  await expect(firstIdImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => firstIdImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const firstId = (await firstIdResult.getAttribute("data-generation-id")) as string
  expect(firstId, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  // 9. 사진 편집 화면에서 '다시 만들기'를 누른다.
  await page.getByRole("button", { name: "다시 만들기" }).click()
  const secondIdResult = page.getByTestId("generation-result")
  await expect(secondIdResult).not.toHaveAttribute("data-generation-id", firstId, { timeout: 90_000 })
  await expect(secondIdResult).toBeVisible({ timeout: 60_000 })
  const secondIdImage = secondIdResult.getByRole("img", { name: "생성 결과" })
  await expect(secondIdImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => secondIdImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const secondId = (await secondIdResult.getAttribute("data-generation-id")) as string
  expect(secondId, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  expect(secondId).not.toBe(firstId)
  // 10. 새 편집 화면에서 '보관함에 저장'을 누른다.
  await page.getByRole("button", { name: "보관함에 저장" }).click()
  await page.waitForURL(/\/album$/, { timeout: 30_000 })

  // expected: 새 결과가 직전 결과보다 먼저 보이고 직전 결과도 보관된다. 두 파일은 서로 다르다.
  const items = page.getByTestId("history-item")
  await expect(items.first()).toHaveAttribute("data-generation-id", secondId)
  await expect(page.locator(`[data-testid="history-item"][data-generation-id="${firstId}"]`)).toHaveCount(1)
  const a = await (await page.request.get(`/api/images/${firstId}/file`)).body()
  const b = await (await page.request.get(`/api/images/${secondId}/file`)).body()
  expect(Buffer.compare(a, b)).not.toBe(0)
})
