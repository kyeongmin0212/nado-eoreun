"use client";

import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** 브라우저용 Supabase 클라이언트 (publishable key, 쿠키 세션). */
export function createClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)가 없습니다.");
  }
  cached = createBrowserClient(url, key);
  return cached;
}

/**
 * Realtime 구독 전에 로그인 토큰을 실시간 연결에 넣는다.
 * 쿠키 세션은 비동기로 읽히므로 바로 구독하면 익명 역할로 접속해 RLS 표(notifications 등)의 구독이 거절된다.
 */
export async function authedRealtime() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) await supabase.realtime.setAuth(token);
  return supabase;
}
