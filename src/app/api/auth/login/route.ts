import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { isDataConfigured } from "@/lib/env";

export const runtime = "nodejs";

/** 아이디(또는 이메일)·비밀번호 로그인. 백엔드(Supabase/local)에 따라 세션 쿠키를 설정한다. */
export async function POST(request: Request) {
  if (!isDataConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured", message: "데이터 연결 대기" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { login?: string; email?: string; password?: string } | null;
  const login = (body?.login ?? body?.email)?.trim();
  const password = body?.password;
  if (!login || !password) {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }
  const data = await getData();
  const result = await data.signIn(login, password);
  if (!result.ok) return NextResponse.json({ ok: false, code: "invalid_credentials", message: result.message }, { status: 401 });
  return NextResponse.json({ ok: true, user: { id: result.user.id } });
}
