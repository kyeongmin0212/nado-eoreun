import { expect, test } from "@playwright/test"
import { E2E_FRIEND1_EMAIL, E2E_FRIEND1_NAME, E2E_FRIEND1_PASSWORD, E2E_FRIEND2_NAME, E2E_USER_EMAIL, E2E_USER_NAME, E2E_USER_PASSWORD } from "../env"
import { logIn } from "../helpers"

test("S4 사용자가 친구 전원에게 SOS를 보내고 친구의 열람·응답을 확인한다", async ({ page, browser }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 홈에서 'SOS 보내기'를 누른다.
  await page.getByRole("link", { name: /SOS 보내기/ }).click()
  // 2. SOS 화면의 'SOS 받을 친구'에서 '전체 친구 (2명)'을 고른다.
  await page.getByLabel("SOS 받을 친구").selectOption({ label: "전체 친구 (2명)" })
  // 3. 'SOS'를 누른다.
  await page.getByRole("button", { name: "SOS", exact: true }).click()
  const detail = page.getByTestId("sos-detail")
  await expect(detail).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId("sos-phase")).toHaveText("발송 완료")
  const requestId = (await detail.getAttribute("data-request-id")) as string
  expect(requestId).toBeTruthy()

  // 발신자 화면: 친구1·친구2 모두 수신 대상, 아직 미확인
  const row1 = page.getByTestId("recipient-row").filter({ hasText: E2E_FRIEND1_NAME })
  const row2 = page.getByTestId("recipient-row").filter({ hasText: E2E_FRIEND2_NAME })
  await expect(page.getByTestId("recipient-row")).toHaveCount(2)
  await expect(row1.getByTestId("recipient-status")).toHaveText("미확인")
  await expect(row2.getByTestId("recipient-status")).toHaveText("미확인")

  // 수신자 창 로그인 준비
  const friendContext = await browser.newContext()
  const friendPage = await friendContext.newPage()
  await logIn(friendPage, E2E_FRIEND1_EMAIL, E2E_FRIEND1_PASSWORD)
  // 4. 친구1의 창에서 홈의 알림(종)을 누른다.
  await friendPage.getByRole("button", { name: /^알림/ }).click()
  const drawer = friendPage.getByRole("dialog", { name: "알림" })
  await expect(drawer).toBeVisible()
  // 5. 친구1의 창에서 알림 창의 친구 SOS 알림을 누른다.
  const item = drawer.locator(`[data-testid="notification-item"][data-kind="friend_sos"][data-link="/sos/${requestId}"]`)
  await expect(item).toBeVisible({ timeout: 20_000 })
  await item.click()
  await expect(friendPage.getByTestId("recipient-view")).toBeVisible({ timeout: 20_000 })

  // expected(열람): 친구1의 화면에 발신자가 SOS를 보냈다는 배너와 사전 입력 안내, 발신자 화면에서 친구1 열람함·친구2 미확인
  await expect(friendPage.getByTestId("recipient-view")).toContainText("SOS를 보냈어요")
  await expect(friendPage.getByTestId("recipient-view")).toContainText(E2E_USER_NAME)
  await expect(friendPage.getByTestId("recipient-view")).toContainText("연락을 기다리고 있어요")
  await expect(row1.getByTestId("recipient-status")).toHaveText("열람함", { timeout: 30_000 })
  await expect(row2.getByTestId("recipient-status")).toHaveText("미확인")

  // 6. 친구1의 창에서 '확인했어 · 전화할게'를 누른다.
  await friendPage.getByRole("button", { name: "확인했어 · 전화할게" }).click()
  await expect(friendPage.getByTestId("recipient-view")).toContainText("이제 직접 전화해 주세요")

  // expected(응답): 발신자 화면에서 친구1 '확인 · 통화 가능', 친구2 미확인
  await expect(row1.getByTestId("recipient-status")).toHaveText("확인 · 통화 가능", { timeout: 30_000 })
  await expect(row2.getByTestId("recipient-status")).toHaveText("미확인")
  await friendContext.close()
})
