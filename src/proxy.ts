import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 자산·서비스 워커·아이콘·manifest 는 제외한다.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|icons/|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)",
  ],
};
