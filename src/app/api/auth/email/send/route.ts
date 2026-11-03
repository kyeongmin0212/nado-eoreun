import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { isDataConfigured, isMailConfigured } from "@/lib/env";
import { sendSignupCode } from "@/lib/mail";
import { CODE_TTL_MS, IP_SENDS_PER_HOUR, RESEND_AFTER_MS, SENDS_PER_HOUR, clientIp, hashCode, newCode, normalizeEmail } from "@/lib/auth/email-signup";

export const runtime = "nodejs";

const HOUR = 3_600_000;

function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

/** 가입 1단계: 이메일로 6자리 인증번호를 보낸다. 이미 가입된 이메일에는 보내지 않는다. */
export async function POST(request: Request) {
  if (!isDataConfigured()) return fail("not_configured", "데이터 연결 대기", 503);
  if (!isMailConfigured()) return fail("mail_not_configured", "이메일 발송이 아직 설정되지 않아 지금은 가입할 수 없어요.", 503);
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const parsed = normalizeEmail(body?.email);
  if (!parsed.ok) return fail("invalid_email", parsed.message, 400);
  const email = parsed.value;

  const data = await getData();
  if (await data.isEmailRegistered(email)) return fail("taken", "이미 가입된 이메일이에요. 로그인해 주세요.", 409);

  const now = Date.now();
  const prev = await data.getEmailVerification(email);
  if (prev && now - Date.parse(prev.lastSentAt) < RESEND_AFTER_MS) {
    const retryAfter = Math.ceil((RESEND_AFTER_MS - (now - Date.parse(prev.lastSentAt))) / 1000);
    return fail("cooldown", `${retryAfter}초 뒤에 다시 보낼 수 있어요.`, 429, { retryAfter });
  }
  const sameWindow = prev && now - Date.parse(prev.windowStartedAt) < HOUR;
  if (sameWindow && prev.sentCount >= SENDS_PER_HOUR) return fail("too_many", "인증번호를 너무 많이 요청했어요. 1시간 뒤에 다시 시도해 주세요.", 429);
  if (!(await data.hitRateLimit(`signup-ip:${clientIp(request)}`, HOUR, IP_SENDS_PER_HOUR))) {
    return fail("too_many", "인증번호 요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.", 429);
  }

  const code = newCode();
  try {
    await sendSignupCode(email, code);
  } catch (err) {
    console.warn("[auth] signup code mail failed", err instanceof Error ? err.message.slice(0, 160) : err);
    return fail("send_failed", "인증번호 메일을 보내지 못했어요. 주소를 확인하고 다시 시도해 주세요.", 502);
  }
  await data.putEmailVerification({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
    attempts: 0,
    sentCount: sameWindow ? prev.sentCount + 1 : 1,
    windowStartedAt: sameWindow ? prev.windowStartedAt : new Date(now).toISOString(),
    lastSentAt: new Date(now).toISOString(),
    verifiedAt: null,
    ticketHash: null,
    ticketExpiresAt: null,
  });
  return NextResponse.json({ ok: true, email, expiresIn: CODE_TTL_MS / 1000, resendAfter: RESEND_AFTER_MS / 1000 });
}
