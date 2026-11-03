"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { INTRO_FLAG } from "@/components/IntroGate";
import { safeNext } from "@/lib/urls";

/** 아이디(또는 이메일)·비밀번호 로그인 */
export function LoginForm({ next, configured }: { next: string | null; configured: boolean }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: login.trim(), password }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message || `로그인 실패 (${res.status})`);
        return;
      }
      try {
        sessionStorage.removeItem(INTRO_FLAG);
      } catch {}
      router.refresh();
      router.replace(safeNext(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {!configured ? <p className="rounded-2xl border border-line bg-white px-4 py-3 text-[14px] text-sub">데이터 연결 대기: 환경변수가 설정되면 로그인할 수 있어요.</p> : null}
      <label className="label">
        아이디(이메일)
        <input className="field" name="username" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={login} onChange={(e) => setLogin(e.target.value)} disabled={!configured || pending} placeholder="example@email.com" />
      </label>
      <label className="label">
        비밀번호
        <input className="field" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!configured || pending} />
      </label>
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-dark h-[54px] w-full" disabled={!configured || pending || !login || !password}>
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
