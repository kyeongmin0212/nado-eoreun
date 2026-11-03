import { expect, test } from "@playwright/test"
import { E2E_FRIEND1_EMAIL, E2E_FRIEND1_PASSWORD, E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../env"
import { fixture, logIn } from "../helpers"

test("S5 사용자가 생성 사진을 보관함에서 날짜별 최신순으로 확인한다", async ({ page, browser }) => {
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
  const idResult = page.getByTestId("generation-result")
  await expect(idResult).toBeVisible({ timeout: 60_000 })
  const idImage = idResult.getByRole("img", { name: "생성 결과" })
  await expect(idImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => idImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const id = (await idResult.getAttribute("data-generation-id")) as string
  expect(id, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  // 9. 사진 편집 화면에서 '보관함에 저장'을 누른다.
  await page.getByRole("button", { name: "보관함에 저장" }).click()
  await page.waitForURL(/\/album$/, { timeout: 30_000 })

  const check = async () => {
    const today = page.getByTestId("history-list").locator("section").first()
    await expect(today.getByRole("heading", { level: 2 })).toContainText("(오늘)")
    await expect(today.locator(`[data-testid="history-item"][data-generation-id="${id}"]`)).toHaveCount(1)
    const items = page.getByTestId("history-item")
    await expect(items.first()).toHaveAttribute("data-generation-id", id, { timeout: 15_000 })
    // 시드 보관 사진 2개 이상이 함께 있고 생성 시점 내림차순이다.
    expect(await items.count()).toBeGreaterThanOrEqual(3)
    const created = await items.evaluateAll((els) => els.map((el) => new Date(el.getAttribute("data-created") ?? "").getTime()))
    for (let i = 1; i < created.length; i++) expect(created[i - 1]).toBeGreaterThanOrEqual(created[i])
    const ids = await items.evaluateAll((els) => els.map((el) => el.getAttribute("data-generation-id")))
    for (const imageId of ids) {
      expect(imageId).toBeTruthy()
      const file = await page.request.get(`/api/images/${imageId}/file?w=160`)
      expect(file.status()).toBe(200)
    }
    return { ids, created }
  }
  const before = await check()
  // 10. 브라우저를 새로고침한다.
  await page.reload()
  const after = await check()
  // expected: 새로고침 뒤에도 같은 결과·순서가 유지된다.
  expect(after).toEqual(before)

  // expected(본인 보관): 별도 계정 로그인은 검사 준비이며 파일 조회는 읽기 전용이다.
  // 위 화면에 표시된 모든 사진은 본인에게 200, 같은 친구 관계의 타 계정에게는 404여야 한다.
  const friendContext = await browser.newContext()
  const friendPage = await friendContext.newPage()
  await logIn(friendPage, E2E_FRIEND1_EMAIL, E2E_FRIEND1_PASSWORD)
  for (const imageId of after.ids) {
    const friendAccess = await friendPage.request.get(`/api/images/${imageId}/file?w=160`)
    expect(friendAccess.status(), "친구 관계가 생성 사진의 조회 권한을 주지 않는다").toBe(404)
  }
  await friendContext.close()
})
