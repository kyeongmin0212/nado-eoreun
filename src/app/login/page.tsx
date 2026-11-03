import type { Metadata } from "next";
import Link from "next/link";
import { isDataConfigured } from "@/lib/env";
import { LoginForm } from "@/components/LoginForm";
import { IconBack } from "@/components/Icons";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const nextRaw = typeof sp.next === "string" ? sp.next : null;
  return (
    <div className="bg-splash mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 safe-top">
      <header className="flex min-h-[64px] items-center pt-2">
        <Link href="/" aria-label="뒤로" className="-ml-[10px] flex h-11 w-11 items-center justify-center">
          <IconBack />
        </Link>
      </header>
      <div className="flex flex-1 flex-col justify-center pb-16">
        <img src="/brand/logo.png" alt="나도으른" className="mx-auto w-[220px]" />
        <p className="mt-4 text-center text-[15px] text-sub">오늘도 으른답게, 마음 편히 놀다 와</p>
        <div className="card mt-8 p-5">
          <LoginForm next={nextRaw} configured={isDataConfigured()} />
        </div>
        <p className="mt-5 text-center text-[14px] text-sub">
          아직 계정이 없나요?{" "}
          <Link href={nextRaw ? `/signup?next=${encodeURIComponent(nextRaw)}` : "/signup"} className="font-bold text-ink underline">
            회원가입하기
          </Link>
        </p>
      </div>
    </div>
  );
}
