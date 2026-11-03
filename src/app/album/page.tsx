import type { Metadata } from "next";
import Link from "next/link";
import { MODE_LABEL } from "@/lib/image/modes";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { dateKeyKst, formatDateKo, todayKst } from "@/lib/time";
import { generationSrc } from "@/lib/urls";
import { AppShell } from "@/components/AppShell";
import { IconPlus } from "@/components/Icons";

export const metadata: Metadata = { title: "보관함" };

const FILLS = ["#F9D9CF", "#FDEDE8", "#E9DDE0", "#F5B8A8", "#EDE6F0"];

/** ALBUM-01 보관함: 날짜별 3열 정사각 타일 */
export default async function AlbumPage() {
  const user = await requireUser("/album");
  const data = await getData();
  const items = await data.listGenerations(user.id);
  const today = todayKst();
  const groups = new Map<string, typeof items>();
  for (const g of items) {
    const key = dateKeyKst(new Date(g.created_at));
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }

  return (
    <AppShell
      title="보관함"
      subtitle={`날짜별 · 사진 ${items.length}장`}
      tabs
      right={
        <Link href="/create" className="flex h-10 items-center gap-1.5 rounded-[20px] bg-charcoal px-[14px] text-[13px] font-bold text-cream">
          <IconPlus size={16} className="text-coral" strokeWidth={2.2} />새 사진 만들기
        </Link>
      }
    >
      <div className="flex flex-col gap-[18px] pt-2">
        {items.length === 0 ? (
          <div className="card flex flex-col items-center gap-1 p-6 text-center">
            <p className="text-[16px] font-bold">아직 만든 사진이 없어요</p>
            <p className="text-[13px] text-sub">만들기 탭에서 첫 사진을 만들어 보세요.</p>
            <Link href="/create" className="btn btn-dark mt-3 w-full">
              사진 만들러 가기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-[18px]" data-testid="history-list">
            {[...groups.entries()].map(([date, list], gi) => (
              <section key={date} className="flex flex-col gap-[10px]">
                <h2 className="text-[15px] font-bold">{formatDateKo(date, today)}</h2>
                <ul className="grid grid-cols-3 gap-2">
                  {list.map((g, i) => {
                    const label = g.place_tag ?? MODE_LABEL[g.mode];
                    return (
                      <li key={g.id} data-testid="history-item" data-generation-id={g.id} data-created={g.created_at}>
                        <Link href={`/editor/${g.id}`} aria-label={`${label} 사진 다시 편집`} className="relative block aspect-square overflow-hidden rounded-[14px]" style={{ backgroundColor: FILLS[(i + gi * 2) % FILLS.length] }}>
                          <img src={generationSrc(g.id, g.version, g.updated_at, 360)} alt="" loading={gi === 0 && i < 6 ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                          <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-[8px] bg-white px-1.5 py-0.5 text-[11px] font-bold text-charcoal">{label}</span>
                          {g.version > 1 ? <span className="absolute right-1.5 top-1.5 rounded-[8px] bg-charcoal px-1.5 py-0.5 text-[10px] font-bold text-cream">v{g.version}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        <p className="text-[12px] text-sub">사진을 누르면 다시 편집할 수 있어요. 저장할 때 덮어쓸지 새 버전으로 남길지 고를 수 있어요.</p>
      </div>
    </AppShell>
  );
}
