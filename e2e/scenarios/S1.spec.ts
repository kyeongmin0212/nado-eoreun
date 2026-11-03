import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { E2E_FRIEND1_NAME, E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../env"
import { logIn } from "../helpers"

test("S1 사용자가 등록된 내 사진과 동의받은 친구 사진을 재사용해 함께 찍은 사진을 만들고 저장한다", async ({ page }) => {
  await logIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

  // 1. 홈에서 '직접 만들기' 카드를 누른다.
  await page.getByRole("link", { name: /직접 만들기/ }).click()
  // 2. '친구 추가하기'를 누른다.
  await page.getByRole("button", { name: /친구 추가하기/ }).click()
  await expect(page.getByRole("button", { name: /친구 추가하기/ })).toHaveAttribute("aria-pressed", "true")
  // 3. '사진 선택하기'를 누른다.
  await page.getByRole("button", { name: "사진 선택하기" }).click()
  const sheet = page.getByRole("dialog", { name: "사진 선택" })
  await expect(sheet).toBeVisible()
  // 4. 사진 선택에서 '내 사진'을 누른다.
  await sheet.getByRole("button", { name: "내 사진", exact: true }).click()
  // 5. 등록된 내 '정면' 사진을 고른다.
  const tile = sheet.getByRole("button", { name: "내 정면 선택", exact: true })
  const src = await tile.locator("img").getAttribute("src")
  expect(src).toBeTruthy()
  const ownOriginal = (src as string).replace(/&w=\d+/, "")
  await tile.click()
  await expect(sheet.getByRole("button", { name: "내 정면 선택 해제", exact: true })).toBeVisible()
  // 6. '친구1'을 누른다.
  await sheet.getByRole("button", { name: E2E_FRIEND1_NAME, exact: true }).click()
  // 7. 사용 동의가 있는 친구1의 등록된 '정면' 사진을 고른다.
  await sheet.getByRole("button", { name: `${E2E_FRIEND1_NAME} 정면 선택`, exact: true }).click()
  // 8. '2장 선택 완료'를 누른다.
  await sheet.getByRole("button", { name: /^2장 선택 완료$/ }).click()
  await expect(sheet).toHaveCount(0)
  expect(ownOriginal, "내 등록 정면 사진의 원본 주소").toBeTruthy()
  const originalResponse = await page.request.get(ownOriginal)
  expect(originalResponse.ok()).toBeTruthy()
  const original = await originalResponse.body()
  // 9. '사진 생성하기'를 누른다.
  const generateRequest = page.waitForRequest((r) => r.url().endsWith("/api/images/generate") && r.method() === "POST")
  await page.getByRole("button", { name: "사진 생성하기" }).click()
  const sent = (await generateRequest).postData() ?? ""
  const people = JSON.parse(/name="people"\r\n\r\n([^\r]*)/.exec(sent)?.[1] ?? "[]") as { source: string; tag: string }[]
  await page.waitForURL(/\/editor\//, { timeout: 90_000 })
  const idResult = page.getByTestId("generation-result")
  await expect(idResult).toBeVisible({ timeout: 60_000 })
  const idImage = idResult.getByRole("img", { name: "생성 결과" })
  await expect(idImage).toBeVisible({ timeout: 60_000 })
  await expect.poll(async () => idImage.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 60_000 }).toBeGreaterThan(0)
  const id = (await idResult.getAttribute("data-generation-id")) as string
  expect(id, "생성 결과가 보관되어 ID 가 있어야 한다").toBeTruthy()
  // 10. 사진 편집 화면에서 '기기에 저장'을 누른다.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "기기에 저장" }).click(),
  ])
  const savedPath = await download.path()
  expect(savedPath).toBeTruthy()

  // expected: 실제 생성 결과가 AI 생성 표시와 함께 보이고(두 사람 합성 품질은 육안 확인), 저장한 파일이 결과 이미지와 일치하며 등록 원본과는 다르다.
  expect(people.map((p) => `${p.source}:${p.tag}`).sort(), "등록 사진 2장(내 사진·친구 사진)만 생성에 쓴다").toEqual(["profile:friend", "profile:self"])
  expect(sent).not.toContain('filename="p0.jpg"')
  await expect(page.getByTestId("generation-result")).toContainText("AI 생성")
  const saved = readFileSync(savedPath as string)
  const served = await (await page.request.get(`/api/images/${id}/file`)).body()
  expect(saved.length).toBeGreaterThan(10_000)
  expect(Buffer.compare(saved, served)).toBe(0)
  expect(Buffer.compare(served, original)).not.toBe(0)
})
