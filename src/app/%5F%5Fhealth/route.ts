import { NextResponse } from "next/server";
import { releaseId } from "@/lib/env";

/**
 * 대시보드·주최 측 실행이 보는 배포 상태 경로 GET /__health.
 * 인증·리다이렉트 없이 200 과 배포 커밋을 반환한다. (Next.js 는 `_` 로 시작하는 폴더를 주소로 만들지 않으므로 %5F%5Fhealth 로 둔다)
 */
export async function GET() {
  return NextResponse.json({ releaseId: releaseId() }, { headers: { "Cache-Control": "no-store" } });
}
