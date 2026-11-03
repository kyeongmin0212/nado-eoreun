import { expect, test } from "@playwright/test"
import { E2E_FRIEND1_EMAIL, E2E_FRIEND1_NAME, E2E_FRIEND1_PASSWORD, E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../env"
import { logIn } from "../helpers"

const PLACE = "부산 해운대 카페"
const REAL_NAME = "민준"
const REAL_PHONE = "010-1234-5678"

test("S8 사용자가 오늘의 상황을 SOS로 전달하고 친구가 연락처를 확인해 응답한다", async ({ page, browser }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 홈의 '오늘의 상황' 카드에서 '상황 등록하기'를 누른다.
  await page.getByTestId("situation-card").getByRole("link", { name: "상황 등록하기" }).click()
  // 2. '장소'에 '부산 해운대 카페'를 입력한다.
  await page.getByLabel("장소", { exact: true }).fill(PLACE)
  // 3. '부모님께 알린 동행인'에서 '친구1'만 고른다.
  const group = page.getByRole("group", { name: /부모님께 알린 동행인/ })
  const pressed = group.getByRole("button", { pressed: true })
  await expect(pressed).toHaveCount(0)
  await group.getByRole("button", { name: E2E_FRIEND1_NAME, exact: true }).click()
  await expect(group.getByRole("button", { pressed: true })).toHaveCount(1)
  // 4. 실제 동행인 연락처의 '이름'에 '민준'을 입력한다.
  await page.getByLabel("이름", { exact: true }).fill(REAL_NAME)
  // 5. '휴대폰 번호'에 '01012345678'을 입력한다.
  await page.getByLabel("휴대폰 번호").fill(REAL_PHONE.replace(/-/g, ""))
  await expect(page.getByLabel("휴대폰 번호")).toHaveValue(REAL_PHONE)
  // 6. '상황 메모'에 '점심은 돼지국밥'을 입력한다.
  await page.getByLabel("상황 메모").fill("점심은 돼지국밥")
  // 7. '상황 저장하기'를 누른다.
  await page.getByRole("button", { name: "상황 저장하기" }).click()

  // expected(홈): 오늘의 상황 카드가 활성화되고 장소·동행인·실제 동행인이 표시된다.
  const card = page.getByTestId("situation-card")
  await expect(card).toContainText("활성화", { timeout: 20_000 })
  await expect(card.getByTestId("situation-place")).toHaveText(PLACE)
  await expect(card.getByTestId("situation-companion")).toContainText(E2E_FRIEND1_NAME)
  await expect(card.getByTestId("situation-real")).toHaveText(`${REAL_NAME} · ${REAL_PHONE}`)

  // 8. 홈에서 'SOS 보내기'를 누른다.
  await page.getByRole("link", { name: /SOS 보내기/ }).click()
  // expected(SOS-01): 상황 요약에 장소, 실제 동행인 연락처 안내, 받을 친구는 동행인(친구1)으로 자동 선택
  await expect(page.getByTestId("sos-summary")).toContainText(PLACE)
  await expect(page.getByText(`실제 동행인(${REAL_NAME}) 연락처는 SOS를 받은 친구에게만 전달돼요`)).toBeVisible()
  await expect(page.getByLabel("SOS 받을 친구").locator("option:checked")).toHaveText(E2E_FRIEND1_NAME)
  // 9. SOS 화면에서 'SOS'를 누른다.
  await page.getByRole("button", { name: "SOS", exact: true }).click()
  const detail = page.getByTestId("sos-detail")
  await expect(detail).toBeVisible({ timeout: 30_000 })
  const requestId = (await detail.getAttribute("data-request-id")) as string
  await expect(page.getByTestId("recipient-row")).toHaveCount(1)

  const friendContext = await browser.newContext()
  const friendPage = await friendContext.newPage()
  await logIn(friendPage, E2E_FRIEND1_EMAIL, E2E_FRIEND1_PASSWORD)
  // 10. 친구1의 창에서 홈의 알림(종)을 누른다.
  await friendPage.getByRole("button", { name: /^알림/ }).click()
  const drawer = friendPage.getByRole("dialog", { name: "알림" })
  await expect(drawer).toBeVisible()
  // 11. 친구1의 창에서 알림 창의 친구 SOS 알림을 누른다.
  const item = drawer.locator(`[data-testid="notification-item"][data-kind="friend_sos"][data-link="/sos/${requestId}"]`)
  await expect(item).toBeVisible({ timeout: 20_000 })
  await item.click()
  await expect(friendPage.getByTestId("recipient-view")).toBeVisible({ timeout: 20_000 })

  // expected(SOS-02): 사용자가 입력한 장소·실제 동행인, 사전 입력 안내
  const view = friendPage.getByTestId("recipient-view")
  await expect(view).toContainText(PLACE)
  await expect(view.getByTestId("real-companion")).toHaveText(`${REAL_NAME} · ${REAL_PHONE}`)
  await expect(view).toContainText("실제 위치를 확인한 정보는 아니에요")
  const row1 = page.getByTestId("recipient-row").filter({ hasText: E2E_FRIEND1_NAME })
  await expect(row1.getByTestId("recipient-status")).toHaveText("열람함", { timeout: 30_000 })
  // 12. 친구1의 창에서 '실제 동행인에게 전화하기 · 010-1234-5678'을 누른다.
  await friendPage.getByRole("button", { name: `실제 동행인에게 전화하기 · ${REAL_PHONE}` }).click()

  // expected: 번호가 채워진 전화 화면(tel 링크)이 열리고, 발신자 화면에서 친구1이 '확인 · 통화 가능'으로 바뀐다.
  const dial = friendPage.getByRole("dialog", { name: "전화 걸기" })
  await expect(dial).toContainText(REAL_PHONE)
  await expect(dial.getByRole("link", { name: "통화" })).toHaveAttribute("href", `tel:${REAL_PHONE.replace(/-/g, "")}`)
  await expect(row1.getByTestId("recipient-status")).toHaveText("확인 · 통화 가능", { timeout: 30_000 })
  await friendContext.close()
})
