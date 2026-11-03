import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { EmailVerification } from "@/lib/data/types";

/**
 * 이메일 인증 가입 규칙 (D83). 인증번호 6자리를 메일로 보내고, 맞히면 30분짜리 가입 확인표(httpOnly 쿠키)를 준다.
 * 비밀번호를 정하는 마지막 단계에서 확인표를 확인한 뒤에만 계정을 만든다(확인 전에는 계정이 생기지 않는다).
 */
export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_AFTER_MS = 60_000;
export const SENDS_PER_HOUR = 5;
export const IP_SENDS_PER_HOUR = 20;
export const MAX_ATTEMPTS = 5;
export const TICKET_TTL_MS = 30 * 60_000;
export const SIGNUP_COOKIE = "nado_signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function normalizeEmail(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v.length > 254 || !EMAIL_RE.test(v)) return { ok: false, message: "이메일 주소를 정확히 입력해 주세요." };
  if (v.endsWith(".invalid") || v.endsWith(".local")) return { ok: false, message: "받을 수 있는 이메일 주소를 입력해 주세요." };
  return { ok: true, value: v };
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`nado-email-code:${email}:${code}`).digest("hex");
}

export function newTicket(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTicket(ticket: string): string {
  return createHash("sha256").update(`nado-signup-ticket:${ticket}`).digest("hex");
}

export function sameHash(a: string | null | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** 가입 직후 이름: 이메일 @ 앞부분(마이페이지에서 바꿀 수 있다) */
export function displayNameFromEmail(email: string): string {
  return email.split("@")[0].slice(0, 20) || "나도으른";
}

/** Vercel·프록시가 넣는 접속 주소. 없으면 같은 칸을 함께 쓴다. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

function iso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function verificationFromRow(r: Record<string, unknown>): EmailVerification {
  return {
    email: String(r.email),
    codeHash: (r.code_hash as string | null) ?? null,
    expiresAt: iso(r.expires_at) ?? new Date(0).toISOString(),
    attempts: Number(r.attempts ?? 0),
    sentCount: Number(r.sent_count ?? 0),
    windowStartedAt: iso(r.window_started_at) ?? new Date(0).toISOString(),
    lastSentAt: iso(r.last_sent_at) ?? new Date(0).toISOString(),
    verifiedAt: iso(r.verified_at),
    ticketHash: (r.ticket_hash as string | null) ?? null,
    ticketExpiresAt: iso(r.ticket_expires_at),
  };
}

export function verificationToRow(v: EmailVerification): Record<string, unknown> {
  return {
    email: v.email,
    code_hash: v.codeHash,
    expires_at: v.expiresAt,
    attempts: v.attempts,
    sent_count: v.sentCount,
    window_started_at: v.windowStartedAt,
    last_sent_at: v.lastSentAt,
    verified_at: v.verifiedAt,
    ticket_hash: v.ticketHash,
    ticket_expires_at: v.ticketExpiresAt,
  };
}
