import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseUrl, serviceRoleKey } from "@/lib/env";

/**
 * 서비스 키 클라이언트. 서버 전용(푸시 발송, 수신자 상태 갱신).
 * 이 클라이언트를 쓰는 경로도 반드시 요청자의 인증·권한을 별도로 확인한다.
 */
export function createAdminClient(): SupabaseClient {
  const url = publicSupabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
