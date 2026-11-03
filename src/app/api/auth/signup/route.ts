import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { isDataConfigured } from "@/lib/env";
import { checkPassword } from "@/lib/validate";
import { SIGNUP_COOKIE, hashTicket, normalizeEmail, sameHash } from "@/lib/auth/email-signup";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

/** 가입 3단계: 인증을 마친 이메일(아이디) + 비밀번호 + 비밀번호 확인. 성공하면 바로 로그인 쿠키를 준다. */
export async function POST(request: Request) {
  if (!isDataConfigured()) return fail("not_configured", "데이터 연결 대기", 503);
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string; passwordConfirm?: string } | null;
  const parsed = normalizeEmail(body?.email);
  if (!parsed.ok) return fail("invalid_email", parsed.message, 400);
  const email = parsed.value;
  const p = checkPassword(body?.password);
  if (!p.ok) return fail("invalid_password", p.message, 400);
  if (body?.passwordConfirm !== body?.password) return fail("password_mismatch", "비밀번호가 서로 달라요.", 400);

  const store = await cookies();
  const ticket = store.get(SIGNUP_COOKIE)?.value;
  const data = await getData();
  const row = await data.getEmailVerification(email);
  const valid = Boolean(ticket && row?.verifiedAt && row.ticketExpiresAt && Date.parse(row.ticketExpiresAt) > Date.now() && sameHash(row.ticketHash, hashTicket(ticket as string)));
  if (!valid) return fail("not_verified", "이메일 인증이 끝나지 않았거나 시간이 지났어요. 인증번호를 다시 받아 주세요.", 403);

  const result = await data.signUpWithEmail(email, p.value);
  if (!result.ok) return fail(result.code, result.message, result.code === "taken" ? 409 : result.code === "invalid" ? 400 : 500);
  await data.deleteEmailVerification(email);
  store.set(SIGNUP_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true, user: { id: result.user.id } });
}
