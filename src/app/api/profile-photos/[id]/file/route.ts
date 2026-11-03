import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { parseThumbWidth } from "@/lib/image/thumb";

export const runtime = "nodejs";

/** 등록 사진 파일. 소유자 또는 사용 동의를 받은 친구만 볼 수 있다. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const sp = new URL(request.url).searchParams;
  const width = parseThumbWidth(sp.get("w"));
  const data = await getData();
  const file = await data.readProfilePhotoFile(user.id, id, width);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Blob([file.bytes as BlobPart]), {
    headers: {
      "Content-Type": file.mediaType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": sp.get("v") ? "private, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
