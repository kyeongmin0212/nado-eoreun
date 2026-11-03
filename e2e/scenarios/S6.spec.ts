import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { E2E_FRIEND1_EMAIL, E2E_FRIEND1_NAME, E2E_FRIEND1_PASSWORD, E2E_FRIEND2_NAME, E2E_USER_EMAIL, E2E_USER_NAME, E2E_USER_PASSWORD } from "../env"
import { logIn, tabBar } from "../helpers"

test("S6 사용자가 보관한 사진을 기기에 저장하고 SOS를 보낸 뒤 친구의 응답을 확인한다", async ({ page, browser }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 하단 '보관함' 메뉴를 누른다.
  await tabBar(page).getByRole("link", { name: "보관함" }).click()
  const latest = page.getByTestId("history-item").first()
  await expect(latest).toBeVisible()
  const selectedId = await latest.getAttribute("data-generation-id")
  // 2. 보관함에서 가장 최근의 본인 사진을 누른다.
  await latest.getByRole("link").click()
  const idResult = page.getByTestId("generation-result")
  await expect(idResult).toBeVisible({ timeout: 60_000 })
  const idImage = idResult.getByRole("img", { name: "생성 결과" })
  await expect(idImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => idImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const id = (await idResult.getAttribute("data-generation-id")) as string
  expect(id, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  expect(id).toBe(selectedId)
  // 3. 사진 편집 화면에서 '기기에 저장'을 누른다.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "기기에 저장" }).click(),
  ])
  const savedPath = await download.path()
  expect(savedPath).toBeTruthy()
  const saved = readFileSync(savedPath as string)
  // 읽기 전용 검증: 화면 조작으로 저장한 파일이 선택한 사진과 같은지 확인한다.
  const served = await (await page.request.get(`/api/images/${id}/file`)).body()

  // 4. 사진 편집 화면에서 '뒤로'를 누른다.
  await page.getByRole("button", { name: "뒤로", exact: true }).click()
  await page.waitForURL(/\/album$/)
  // 5. 하단 '홈' 메뉴를 누른다.
  await tabBar(page).getByRole("link", { name: "홈" }).click()
  // 6. 홈에서 'SOS 보내기'를 누른다.
  await page.getByRole("link", { name: /SOS 보내기/ }).click()
  // 7. SOS 화면의 'SOS 받을 친구'에서 '전체 친구 (2명)'을 고른다.
  await page.getByLabel("SOS 받을 친구").selectOption({ label: "전체 친구 (2명)" })
  // 8. 'SOS'를 누른다.
  await page.getByRole("button", { name: "SOS", exact: true }).click()
  const detail = page.getByTestId("sos-detail")
  await expect(detail).toBeVisible({ timeout: 30_000 })
  const requestId = (await detail.getAttribute("data-request-id")) as string
  expect(requestId).toBeTruthy()

  // 수신자 로그인은 시작 준비이며 시나리오 단계에 포함하지 않는다.
  const friendContext = await browser.newContext()
  const friendPage = await friendContext.newPage()
  await logIn(friendPage, E2E_FRIEND1_EMAIL, E2E_FRIEND1_PASSWORD)
  // 9. 친구1의 창에서 홈의 알림(종)을 누른다.
  await friendPage.getByRole("button", { name: /^알림/ }).click()
  const drawer = friendPage.getByRole("dialog", { name: "알림" })
  await expect(drawer).toBeVisible()
  // 10. 친구1의 창에서 알림 창의 친구 SOS 알림을 누른다.
  const item = drawer.locator(`[data-testid="notification-item"][data-kind="friend_sos"][data-link="/sos/${requestId}"]`)
  await expect(item).toBeVisible({ timeout: 20_000 })
  await item.click()
  await expect(friendPage.getByTestId("recipient-view")).toBeVisible({ timeout: 20_000 })

  // expected: 선택 사진 저장, 전원 수신 대상, 발신자 SOS 배너, 열람 구분, 사진 비공개 유지.
  expect(saved.length).toBeGreaterThan(10_000)
  expect(Buffer.compare(saved, served)).toBe(0)
  await expect(page.getByTestId("recipient-row")).toHaveCount(2)
  await expect(friendPage.getByTestId("recipient-view")).toContainText("SOS를 보냈어요")
  await expect(friendPage.getByTestId("recipient-view")).toContainText(E2E_USER_NAME)
  const row1 = page.getByTestId("recipient-row").filter({ hasText: E2E_FRIEND1_NAME })
  await expect(row1.getByTestId("recipient-status")).toHaveText("열람함", { timeout: 30_000 })
  const row2 = page.getByTestId("recipient-row").filter({ hasText: E2E_FRIEND2_NAME })
  await expect(row2.getByTestId("recipient-status")).toHaveText("미확인")
  // 11. 친구1의 창에서 '확인했어 · 전화할게'를 누른다.
  await friendPage.getByRole("button", { name: "확인했어 · 전화할게" }).click()
  await expect(friendPage.getByTestId("recipient-view")).toContainText("이제 직접 전화해 주세요")
  // expected(응답): 열람과 응답을 구분하고, 친구2의 상태는 바뀌지 않는다.
  await expect(row1.getByTestId("recipient-status")).toHaveText("확인 · 통화 가능", { timeout: 30_000 })
  await expect(row2.getByTestId("recipient-status")).toHaveText("미확인")
  await expect(friendPage.locator(`img[src^="/api/images/${id}/file"]`)).toHaveCount(0)
  const friendAccess = await friendPage.request.get(`/api/images/${id}/file`)
  expect(friendAccess.status()).toBe(404)
  await friendContext.close()
})
