import type { Metadata } from "next";
import Link from "next/link";
import { isDataConfigured, isMailConfigured } from "@/lib/env";
import { SignupForm } from "@/components/SignupForm";
import { IconBack } from "@/components/Icons";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const nextRaw = typeof sp.next === "string" ? sp.next : null;
  return (
    <div className="bg-splash mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 safe-top">
      <header className="flex min-h-[64px] items-center gap-2 pt-2">
        <Link href="/" aria-label="뒤로" className="-ml-[10px] flex h-11 w-11 items-center justify-center">
          <IconBack />
        </Link>
        <h1 className="text-[20px] font-black">회원가입</h1>
      </header>
      <div className="flex flex-1 flex-col pt-4 pb-10">
        <div className="card p-5">
          <SignupForm configured={isDataConfigured()} mailConfigured={isMailConfigured()} next={nextRaw} />
        </div>
        <p className="mt-5 text-center text-[14px] text-sub">
          이미 계정이 있나요?{" "}
          <Link href={nextRaw ? `/login?next=${encodeURIComponent(nextRaw)}` : "/login"} className="font-bold text-ink underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
