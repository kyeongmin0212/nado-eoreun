import { expect, test } from "@playwright/test"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

/**
 * 검사(채점 시나리오 아님): 이메일 인증번호 가입 → 비밀번호 → 로그인 상태 홈 → 다시 로그인 → 회원 탈퇴.
 * 앱은 검사용 메일 수신기(checks/mail-sink.mjs)로 메일을 보내도록 띄운다:
 *   SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false pnpm dev
 *   node checks/mail-sink.mjs   →   npx playwright test -c playwright.checks.config.ts
 */
const SINK = process.env.MAIL_SINK_FILE || path.join(tmpdir(), "nado-mail-sink.jsonl")

/** 메일 원문의 제목(=?UTF-8?B?…?= 여러 조각)·본문(base64)을 풀어 6자리 인증번호를 찾는다. */
function codeFrom(raw: string): string | null {
  // 이어진 인코딩 조각 사이의 줄바꿈·공백은 원문에 없는 글자다(RFC 2047).
  const decoded = raw
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_m, enc: string, txt: string) =>
      enc.toLowerCase() === "b" ? Buffer.from(txt, "base64").toString("utf8") : Buffer.from(txt.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_h, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"),
    )
  const subject = decoded.match(/인증번호\s*(\d{6})/)
  if (subject) return subject[1]
  const b64 = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Za-z0-9+/=]{16,}$/.test(l))
    .join("")
  const body = Buffer.from(b64, "base64").toString("utf8").match(/인증번호[^\d]{0,10}(\d{6})/)
  return body ? body[1] : null
}

async function waitForCode(email: string, after: number): Promise<string> {
  let code: string | null = null
  await expect
    .poll(
      () => {
        if (!existsSync(SINK)) return null
        const mails = readFileSync(SINK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { at: string; to: string[]; raw: string })
        const mine = mails.filter((m) => m.to.includes(email) && Date.parse(m.at) >= after).pop()
        code = mine ? codeFrom(mine.raw) : null
        return code
      },
      { timeout: 20_000, message: "검사용 메일 수신기에 인증번호 메일이 와야 한다" },
    )
    .toMatch(/^\d{6}$/)
  return code as unknown as string
}

test("이메일 인증번호로 가입하고, 인증 없이는 가입할 수 없으며, 탈퇴하면 계정이 지워진다", async ({ page, browser }) => {
  const email = `chk.${Date.now()}.${randomBytes(2).toString("hex")}@example.com`
  const pw = randomBytes(9).toString("base64url")

  await page.goto("/")
  await page.getByRole("link", { name: "회원가입하기" }).click()
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible()
  // 인증 전에는 비밀번호를 정할 수 없다.
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeDisabled()

  const sentAt = Date.now() - 1000
  await page.getByLabel("아이디(이메일)").fill(email)
  await page.getByRole("button", { name: "인증하기" }).click()
  await expect(page.getByText("인증번호를 보냈어요")).toBeVisible()
  const code = await waitForCode(email, sentAt)

  // 틀린 번호는 거절된다.
  await page.getByLabel("인증번호").fill(code === "000000" ? "111111" : "000000")
  await page.getByRole("button", { name: "확인", exact: true }).click()
  await expect(page.getByText("인증번호가 맞지 않아요")).toBeVisible()
  await page.getByLabel("인증번호").fill(code)
  await page.getByRole("button", { name: "확인", exact: true }).click()
  await expect(page.getByText("이메일 인증을 마쳤어요")).toBeVisible()

  await page.getByLabel("비밀번호", { exact: true }).fill(pw)
  await page.getByLabel("비밀번호 확인").fill(`${pw}x`)
  await expect(page.getByText("비밀번호가 서로 달라요.")).toBeVisible()
  await expect(page.getByRole("button", { name: "가입하기" })).toBeDisabled()
  await page.getByLabel("비밀번호 확인").fill(pw)
  await page.getByRole("button", { name: "가입하기" }).click()
  await expect(page.getByRole("link", { name: /SOS 보내기/ })).toBeVisible({ timeout: 30_000 })

  // 인증을 거치지 않은 가입 요청은 막히고, 이미 가입된 이메일에는 인증번호를 보내지 않는다.
  const outsider = await browser.newContext()
  const direct = await outsider.request.post("/api/auth/signup", { data: { email: `x${email}`, password: pw, passwordConfirm: pw } })
  expect(direct.status()).toBe(403)
  const dup = await outsider.request.post("/api/auth/email/send", { data: { email } })
  expect(dup.status()).toBe(409)
  await outsider.close()

  // 이메일과 비밀번호로 다시 로그인할 수 있다 (새 창).
  const again = await browser.newContext()
  const againPage = await again.newPage()
  await againPage.goto("/login")
  await againPage.getByLabel("아이디(이메일)").fill(email)
  await againPage.getByLabel("비밀번호").fill(pw)
  await againPage.getByRole("button", { name: "로그인", exact: true }).click()
  await expect(againPage.getByRole("link", { name: /SOS 보내기/ })).toBeVisible({ timeout: 30_000 })
  await again.close()

  // 마이페이지 → 회원 탈퇴 → 확인. 탈퇴 뒤에는 같은 이메일로 다시 인증번호를 받을 수 있다.
  await page.getByRole("link", { name: "마이페이지" }).click()
  await page.getByRole("button", { name: "회원 탈퇴" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "탈퇴", exact: true }).click()
  await expect(page.getByRole("link", { name: "회원가입하기" })).toBeVisible({ timeout: 30_000 })
  const reuse = await page.request.post("/api/auth/email/send", { data: { email } })
  expect(reuse.status()).toBe(200)
})
