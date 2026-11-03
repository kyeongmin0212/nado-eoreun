import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

/** 연결 설정 여부만 반환한다 (값·키 없음). 화면의 `연결 대기` 표시에 사용. */
export async function GET() {
  return NextResponse.json({ ok: true, ...integrationStatus() }, { headers: { "Cache-Control": "no-store" } });
}
