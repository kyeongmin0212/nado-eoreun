import nodemailer from "nodemailer";
import { mailConfig } from "@/lib/env";

/** 가입 인증번호 메일. SMTP(예: Gmail 앱 비밀번호) 환경변수가 없으면 보내지 않는다. */
export async function sendSignupCode(to: string, code: string): Promise<void> {
  const cfg = mailConfig();
  if (!cfg) throw new Error("mail_not_configured");
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transport.sendMail({
    from: cfg.from,
    to,
    subject: `[나도으른] 이메일 인증번호 ${code}`,
    text: `나도으른 회원가입 인증번호는 ${code} 예요.\n10분 안에 가입 화면에 입력해 주세요.\n직접 요청하지 않았다면 이 메일은 무시해 주세요.`,
    html: `<div style="font-family:-apple-system,sans-serif;line-height:1.6;color:#2E2A33"><p>나도으른 회원가입 인증번호예요.</p><p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:12px 0">${code}</p><p>10분 안에 가입 화면에 입력해 주세요.<br/>직접 요청하지 않았다면 이 메일은 무시해 주세요.</p></div>`,
  });
}
