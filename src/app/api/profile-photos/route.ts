import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import type { PhotoSlot } from "@/lib/types";

export const runtime = "nodejs";

const SLOTS: PhotoSlot[] = ["front", "left", "right", "full", "extra"];
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 본인 + 사용 동의를 받은 친구의 등록 사진 (사진 선택 바텀시트용). scope=mine 이면 본인만. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const scope = new URL(request.url).searchParams.get("scope");
  const data = await getData();
  if (scope === "mine") {
    return NextResponse.json({ ok: true, photos: await data.listProfilePhotos(user.id) }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, people: await data.listUsablePhotos(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** 등록 사진 추가/교체: multipart slot + image */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, code: "invalid_input", message: "요청 형식 오류" }, { status: 400 });
  const slot = String(form.get("slot") ?? "") as PhotoSlot;
  const image = form.get("image");
  if (!SLOTS.includes(slot)) return NextResponse.json({ ok: false, code: "invalid_input", message: "사진 구분이 올바르지 않아요." }, { status: 400 });
  if (!(image instanceof Blob) || image.size === 0 || !ALLOWED.has(image.type)) {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "JPEG·PNG·WebP 사진만 등록할 수 있어요." }, { status: 400 });
  }
  if (image.size > 8 * 1024 * 1024) return NextResponse.json({ ok: false, code: "invalid_input", message: "사진이 너무 커요 (8MB 이하)." }, { status: 400 });
  try {
    const data = await getData();
    const photo = await data.addProfilePhoto(user.id, slot, new Uint8Array(await image.arrayBuffer()), image.type);
    return NextResponse.json({ ok: true, photo });
  } catch (err) {
    return NextResponse.json({ ok: false, code: "save_failed", message: err instanceof Error ? err.message : "저장 실패" }, { status: 500 });
  }
}
