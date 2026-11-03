import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/env";
import { runCurfewJob } from "@/lib/curfew/job";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 통금 알림 스케줄러 진입점. `x-cron-secret` 헤더가 CRON_SECRET 과 같을 때만 실행한다. */
async function handle(request: Request) {
  const secret = cronSecret();
  if (!secret) return NextResponse.json({ ok: false, code: "not_configured", message: "CRON_SECRET 미설정" }, { status: 503 });
  const given = request.headers.get("x-cron-secret") ?? "";
  if (given.length !== secret.length || given !== secret) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  try {
    const result = await runCurfewJob();
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "error", message: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
