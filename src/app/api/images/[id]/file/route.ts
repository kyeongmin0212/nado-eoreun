import { NextResponse } from "next/server";
import { extensionFor } from "@/lib/image/storage";
import { parseThumbWidth } from "@/lib/image/thumb";
import { getData } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * 본인 결과 파일을 인증된 세션으로 제공한다. 서명 URL 을 노출하지 않고
 * 개인 사진이 공용 캐시에 남지 않도록 no-store 로 응답한다.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const sp = new URL(request.url).searchParams;
  const download = sp.get("download") === "1";
  // ?w= 는 목록용 작은 사본(WebP, 저장소에 캐시). 기기 저장·편집 미리보기는 원본을 그대로 쓴다.
  const width = download ? null : parseThumbWidth(sp.get("w"));
  const data = await getData();
  const file = await data.readGenerationFile(user.id, id, width);
  if (!file) return new NextResponse("Not found", { status: 404 });

  // ?v=<버전> 이 붙은 주소는 내용이 바뀌지 않으므로 브라우저(개인) 캐시에 오래 둔다. 공용 캐시에는 남기지 않는다.
  const cacheControl = sp.get("v") ? "private, max-age=31536000, immutable" : "private, no-store";
  const filename = `nado-eoreun-${file.row.id.slice(0, 8)}.${extensionFor(file.row.media_type)}`;
  return new NextResponse(new Blob([file.bytes as BlobPart]), {
    headers: {
      "Content-Type": file.mediaType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": cacheControl,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
