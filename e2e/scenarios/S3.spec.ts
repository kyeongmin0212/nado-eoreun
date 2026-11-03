import { expect, test } from "@playwright/test"
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../env"
import { fixture, logIn } from "../helpers"

test("S3 사용자가 장소 프리셋으로 배경을 바꾸고 포즈를 고친 새 버전을 보관함에 저장한다", async ({ page }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 홈에서 '직접 만들기' 카드를 누른다.
  await page.getByRole("link", { name: /직접 만들기/ }).click()
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
  // 7. 장소 프리셋 '바닷가'를 누른다.
  await page.getByRole("button", { name: "바닷가", exact: true }).click()
  // 8. '사진 생성하기'를 누른다.
  await page.getByRole("button", { name: "사진 생성하기" }).click()
  await page.waitForURL(/\/editor\//, { timeout: 90_000 })
  const originalIdResult = page.getByTestId("generation-result")
  await expect(originalIdResult).toBeVisible({ timeout: 60_000 })
  const originalIdImage = originalIdResult.getByRole("img", { name: "생성 결과" })
  await expect(originalIdImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => originalIdImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const originalId = (await originalIdResult.getAttribute("data-generation-id")) as string
  expect(originalId, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  // 9. 사진 편집 화면의 '포즈 변경'에서 '브이'를 누른다.
  await expect(page.getByRole("tab", { name: "포즈 변경" })).toHaveAttribute("aria-selected", "true")
  await page.getByRole("button", { name: "브이", exact: true }).click()
  await expect(page.getByRole("region", { name: "선택한 편집" })).toContainText("포즈: 브이")
  await expect(page.getByRole("region", { name: "선택한 편집" })).toContainText("미적용")
  // 10. '변경 적용'을 누른다.
  await page.getByRole("button", { name: "변경 적용" }).click()
  const editIdResult = page.getByTestId("generation-result")
  await expect(editIdResult).not.toHaveAttribute("data-generation-id", originalId, { timeout: 90_000 })
  await expect(editIdResult).toBeVisible({ timeout: 60_000 })
  const editIdImage = editIdResult.getByRole("img", { name: "생성 결과" })
  await expect(editIdImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => editIdImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const editId = (await editIdResult.getAttribute("data-generation-id")) as string
  expect(editId, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  await expect(page.getByRole("region", { name: "선택한 편집" })).toContainText("적용됨")
  // 11. 새 편집 화면에서 '보관함에 저장'을 누른다.
  await page.getByRole("button", { name: "보관함에 저장" }).click()
  // 12. 저장 방법에서 '새 버전으로 저장'을 누른다.
  await page.getByRole("dialog", { name: "어떻게 저장할까요?" }).getByRole("button", { name: "새 버전으로 저장" }).click()
  await page.waitForURL(/\/album$/, { timeout: 30_000 })

  // expected: 보관함에 원래 결과와 새 버전이 모두 있고 새 버전이 먼저 보인다. 포즈 품질은 육안 확인한다.
  const items = page.getByTestId("history-item")
  await expect(items.first()).toHaveAttribute("data-generation-id", editId)
  await expect(page.locator(`[data-testid="history-item"][data-generation-id="${originalId}"]`)).toHaveCount(1)
  expect(editId).not.toBe(originalId)
  const before = await (await page.request.get(`/api/images/${originalId}/file`)).body()
  const after = await (await page.request.get(`/api/images/${editId}/file`)).body()
  expect(Buffer.compare(before, after), "새 버전은 원래 결과와 다른 파일이다").not.toBe(0)
})
