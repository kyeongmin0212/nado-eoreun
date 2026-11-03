"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { INTRO_FLAG } from "@/components/IntroGate";
import { PASSWORD_MIN } from "@/lib/validate";
import { safeNext } from "@/lib/urls";

type Step = "email" | "code" | "verified";
type Note = { tone: "sub" | "ok" | "danger"; text: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

/** 이메일 인증 회원가입: 아이디(이메일) → 인증하기 → 인증번호 확인 → 비밀번호 · 비밀번호 확인 */
export function SignupForm({ configured, mailConfigured, next = null }: { configured: boolean; mailConfigured: boolean; next?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | "signup" | null>(null);
  const [emailNote, setEmailNote] = useState<Note>(null);
  const [codeNote, setCodeNote] = useState<Note>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (resendAt <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resendAt, now]);

  const usable = configured && mailConfigured;
  const e = email.trim().toLowerCase();
  const emailOk = EMAIL_RE.test(e);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const verified = step === "verified";
  const pwOk = password.length >= PASSWORD_MIN;
  const same = confirm.length > 0 && confirm === password;
  const canSubmit = usable && verified && pwOk && same && busy === null;

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string; retryAfter?: number; resendAfter?: number };
    return { res, data };
  }

  async function sendCode() {
    if (!usable || !emailOk || busy || wait > 0) return;
    setBusy("send");
    setEmailNote({ tone: "sub", text: "인증번호를 보내는 중…" });
    try {
      const { res, data } = await post("/api/auth/email/send", { email: e });
      if (!res.ok || !data.ok) {
        if (data.retryAfter) setResendAt(Date.now() + data.retryAfter * 1000);
        setEmailNote({ tone: "danger", text: data.message ?? "인증번호를 보내지 못했어요." });
        return;
      }
      setStep("code");
      setCode("");
      setCodeNote(null);
      setResendAt(Date.now() + (data.resendAfter ?? 60) * 1000);
      setNow(Date.now());
      setEmailNote({ tone: "ok", text: "인증번호를 보냈어요. 메일함(스팸함 포함)을 확인해 주세요." });
    } catch {
      setEmailNote({ tone: "danger", text: "네트워크 오류로 인증번호를 보내지 못했어요." });
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code) || busy) return;
    setBusy("verify");
    setCodeNote({ tone: "sub", text: "확인 중…" });
    try {
      const { res, data } = await post("/api/auth/email/verify", { email: e, code });
      if (!res.ok || !data.ok) {
        setCodeNote({ tone: "danger", text: data.message ?? "인증번호를 확인하지 못했어요." });
        return;
      }
      setStep("verified");
      setCodeNote(null);
      setEmailNote({ tone: "ok", text: "이메일 인증을 마쳤어요. 비밀번호를 정해 주세요." });
    } catch {
      setCodeNote({ tone: "danger", text: "네트워크 오류로 확인하지 못했어요." });
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!canSubmit) return;
    setBusy("signup");
    setError(null);
    try {
      const { res, data } = await post("/api/auth/signup", { email: e, password, passwordConfirm: confirm });
      if (!res.ok || !data.ok) {
        if (data.code === "not_verified") {
          setStep("email");
          setEmailNote({ tone: "danger", text: data.message ?? "이메일 인증을 다시 해 주세요." });
        }
        setError(data.message ?? "가입하지 못했어요.");
        return;
      }
      try {
        sessionStorage.removeItem(INTRO_FLAG);
      } catch {}
      router.refresh();
      router.replace(safeNext(next));
    } catch {
      setError("네트워크 오류로 가입하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  const toneClass = (n: Note) => (n?.tone === "ok" ? "text-ok" : n?.tone === "danger" ? "text-danger" : "text-sub");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {!configured ? <p className="rounded-2xl border border-line bg-white px-4 py-3 text-[14px] text-sub">데이터 연결 대기: 환경변수가 설정되면 가입할 수 있어요.</p> : null}
      {configured && !mailConfigured ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-[14px] text-sub">이메일 발송 연결 대기: 인증번호 메일 설정이 끝나면 가입할 수 있어요. 지금은 받은 테스트 계정으로 로그인해 주세요.</p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className="text-[13px] text-sub">
          아이디(이메일)
        </label>
        <div className="flex gap-2">
          <input
            id="signup-email"
            className="field min-w-0 flex-1"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            placeholder="example@email.com"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value);
              if (step !== "email") {
                setStep("email");
                setCode("");
                setCodeNote(null);
              }
              setEmailNote(null);
            }}
            disabled={!usable || busy === "signup"}
          />
          <button type="button" onClick={sendCode} disabled={!usable || !emailOk || busy !== null || wait > 0 || verified} className="btn btn-white h-[46px] shrink-0 px-4 text-[14px] font-bold">
            {busy === "send" ? "보내는 중…" : verified ? "인증 완료" : step === "code" ? (wait > 0 ? `다시 보내기 ${wait}초` : "다시 보내기") : wait > 0 ? `${wait}초 뒤` : "인증하기"}
          </button>
        </div>
        <p role="status" className={`min-h-[18px] text-[12px] ${toneClass(emailNote)}`}>
          {emailNote?.text ?? ""}
        </p>
      </div>
      {step === "code" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-code" className="text-[13px] text-sub">
            인증번호
          </label>
          <div className="flex gap-2">
            <input
              id="signup-code"
              className="field min-w-0 flex-1 tracking-[0.3em]"
              name="one-time-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6자리 숫자"
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={busy !== null}
            />
            <button type="button" onClick={verifyCode} disabled={code.length !== 6 || busy !== null} className="btn btn-dark h-[46px] shrink-0 px-4 text-[14px] font-bold">
              {busy === "verify" ? "확인 중…" : "확인"}
            </button>
          </div>
          <p role="status" className={`min-h-[18px] text-[12px] ${toneClass(codeNote)}`}>
            {codeNote?.text ?? "메일로 받은 6자리 숫자를 10분 안에 입력해 주세요."}
          </p>
        </div>
      ) : null}
      <label className="label">
        비밀번호
        <input className="field" type="password" name="new-password" autoComplete="new-password" placeholder={`${PASSWORD_MIN}자 이상`} value={password} onChange={(ev) => setPassword(ev.target.value)} disabled={!usable || !verified || busy === "signup"} />
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-pw2" className="text-[13px] text-sub">
          비밀번호 확인
        </label>
        <input id="signup-pw2" className="field" type="password" name="confirm-password" autoComplete="new-password" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} disabled={!usable || !verified || busy === "signup"} />
        <p className={`min-h-[18px] text-[12px] ${confirm.length === 0 ? "text-sub" : same ? "text-ok" : "text-danger"}`}>{confirm.length === 0 ? "" : same ? "비밀번호가 같아요." : "비밀번호가 서로 달라요."}</p>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={!canSubmit} className="btn btn-dark h-[54px] w-full">
        {busy === "signup" ? "가입 중…" : "가입하기"}
      </button>
      <p className="text-center text-[12px] leading-relaxed text-sub">
        만 19세 이상 성인만 가입할 수 있어요. 가입하면 이용약관·개인정보처리방침에 동의하게 돼요.
      </p>
    </form>
  );
}
