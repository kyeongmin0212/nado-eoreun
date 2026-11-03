import { redirect } from "next/navigation";
import { getData } from "@/lib/data";
import type { SessionUser } from "@/lib/data/types";

export type { SessionUser };

/** 현재 요청의 인증 사용자 (백엔드 공통). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const data = await getData();
  return data.getSessionUser();
}

/** 페이지용: 미로그인 시 로그인 화면으로 보낸다. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const qs = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${qs}`);
  }
  return user;
}
