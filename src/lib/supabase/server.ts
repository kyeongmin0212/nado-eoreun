import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseKey, publicSupabaseUrl } from "@/lib/env";

/** 서버 컴포넌트·라우트 핸들러용 Supabase 클라이언트 (요청 쿠키 기반, 요청마다 새로 생성). */
export async function createClient() {
  // cookies() 를 먼저 호출해 이 요청을 동적 렌더링으로 표시한다 (빌드 시 프리렌더 시도 방지).
  const cookieStore = await cookies();
  const url = publicSupabaseUrl();
  const key = publicSupabaseKey();
  if (!url || !key) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. proxy.ts 가 세션 갱신을 담당한다.
        }
      },
    },
  });
}
