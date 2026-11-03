import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { isDataConfigured } from "@/lib/env";
import { MAX_ATTEMPTS, SIGNUP_COOKIE, TICKET_TTL_MS, hashCode, hashTicket, newTicket, normalizeEmail, sameHash } from "@/lib/auth/email-signup";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

/** 가입 2단계: 인증번호 확인. 맞으면 30분짜리 가입 확인표를 httpOnly 쿠키로 준다(인증번호는 다시 못 쓴다). */
export async function POST(request: Request) {
  if (!isDataConfigured()) return fail("not_configured", "데이터 연결 대기", 503);
  const body = (await request.json().catch(() => null)) as { email?: string; code?: string } | null;
  const parsed = normalizeEmail(body?.email);
  if (!parsed.ok) return fail("invalid_email", parsed.message, 400);
  const email = parsed.value;
  const code = String(body?.code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return fail("invalid_code", "인증번호 6자리를 입력해 주세요.", 400);

  const data = await getData();
  const row = await data.getEmailVerification(email);
  if (!row || !row.codeHash || Date.parse(row.expiresAt) < Date.now()) return fail("expired", "인증번호가 만료됐어요. 다시 받아 주세요.", 400);
  if (row.attempts >= MAX_ATTEMPTS) return fail("too_many", "인증번호를 여러 번 틀렸어요. 새 인증번호를 받아 주세요.", 429);
  if (!sameHash(row.codeHash, hashCode(email, code))) {
    const attempts = row.attempts + 1;
    await data.putEmailVerification({ ...row, attempts });
    const left = MAX_ATTEMPTS - attempts;
    return fail("wrong_code", left > 0 ? `인증번호가 맞지 않아요. (${left}번 더 시도할 수 있어요)` : "인증번호를 여러 번 틀렸어요. 새 인증번호를 받아 주세요.", 400);
  }

  const ticket = newTicket();
  const expires = new Date(Date.now() + TICKET_TTL_MS);
  await data.putEmailVerification({ ...row, codeHash: null, attempts: row.attempts + 1, verifiedAt: new Date().toISOString(), ticketHash: hashTicket(ticket), ticketExpiresAt: expires.toISOString() });
  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(SIGNUP_COOKIE, ticket, { httpOnly: true, sameSite: "lax", path: "/", expires, secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false" });
  return res;
}
