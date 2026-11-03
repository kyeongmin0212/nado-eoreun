import { expect, test } from "@playwright/test"
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../env"
import { fixture, logIn, tabBar } from "../helpers"

test("S2 사용자가 인물 사진과 설명만으로 배경을 바꾼다", async ({ page }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 하단 '만들기' 메뉴를 누른다.
  await tabBar(page).getByRole("link", { name: "만들기" }).click()
  await expect(page.getByRole("button", { name: /배경 바꾸기/ })).toHaveAttribute("aria-pressed", "true")
  // 2. '배경 바꾸기'가 선택된 상태에서 '사진 선택하기'를 누른다.
  await page.getByRole("button", { name: "사진 선택하기" }).click()
  const sheet = page.getByRole("dialog", { name: "사진 선택" })
  await expect(sheet).toBeVisible()
  // 3. 사진 선택에서 '내 사진'을 누른다.
  await sheet.getByRole("button", { name: "내 사진", exact: true }).click()
  // 4. '기타 +'를 누른다.
  await sheet.getByRole("button", { name: /^기타 \+/ }).click()
  // 5. '갤러리에서 선택'으로 테스트용 두 사람 사진을 올린다.
  await page.getByRole("dialog", { name: "사진 추가 방법" }).getByLabel("갤러리에서 선택").setInputFiles(fixture("together.jpg"))
  const picked = sheet.getByRole("button", { name: /갤러리 사진 \d+ 선택 해제/ })
  await expect(picked).toHaveCount(1, { timeout: 15_000 })
  // 앱이 실제로 올리는 사진(줄인 JPEG)은 선택 칸의 미리보기와 같은 파일이다. 읽기만 한다.
  const previewSrc = (await picked.locator("img").getAttribute("src")) as string
  const uploaded = Buffer.from(await page.evaluate(async (url) => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), previewSrc))
  // 6. '1장 선택 완료'를 누른다.
  await sheet.getByRole("button", { name: /^1장 선택 완료$/ }).click()
  await expect(sheet).toHaveCount(0)
  // 7. 장소 프리셋은 '설정 안 함'으로 두고 '추가 요청사항'에 '바다'를 입력한다.
  await expect(page.getByRole("button", { name: "설정 안 함" })).toHaveAttribute("aria-pressed", "true")
  await page.getByLabel("추가 요청사항 (선택)").fill("바다")
  // 8. '사진 생성하기'를 누른다.
  await page.getByRole("button", { name: "사진 생성하기" }).click()
  await page.waitForURL(/\/editor\//, { timeout: 90_000 })
  const idResult = page.getByTestId("generation-result")
  await expect(idResult).toBeVisible({ timeout: 60_000 })
  const idImage = idResult.getByRole("img", { name: "생성 결과" })
  await expect(idImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => idImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const id = (await idResult.getAttribute("data-generation-id")) as string
  expect(id, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()

  // expected: AI 표시와, 실제로 올린 사진과 다른 생성 파일을 확인한다.
  await expect(page.getByTestId("generation-result")).toContainText("AI 생성")
  const served = await (await page.request.get(`/api/images/${id}/file`)).body()
  expect(served.length).toBeGreaterThan(10_000)
  expect(uploaded.length, "올린 두 사람 사진").toBeGreaterThan(10_000)
  expect(Buffer.compare(served, uploaded)).not.toBe(0)
})
