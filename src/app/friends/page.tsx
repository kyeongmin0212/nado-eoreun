import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { InviteSection } from "@/components/friends/InviteSheet";

export const metadata: Metadata = { title: "친구" };

/** FRIEND-01 친구: 등록된 친구(사진 사용 동의 상태) + 친구 초대하기. 내 AI 프로필은 MY 로 옮겼다. */
export default async function FriendsPage() {
  const user = await requireUser("/friends");
  const data = await getData();
  const [friends, me] = await Promise.all([data.getFriendsWithConsent(user.id), data.getProfile(user.id)]);

  return (
    <AppShell title="친구" tabs right={<span className="text-[13px] text-sub">등록 {friends.length}명</span>}>
      <div className="flex flex-col gap-4 pt-2">
        <section aria-label="등록된 친구" className="flex flex-col gap-[10px]">
          <div className="flex justify-between">
            <h2 className="text-[15px] font-bold">등록된 친구</h2>
            <span className="text-[13px] text-sub">{friends.length}명</span>
          </div>
          {friends.length === 0 ? <p className="rounded-[16px] border border-line bg-white px-4 py-4 text-[14px] text-sub">아직 친구가 없어요. 아래 초대 링크로 연결해 보세요.</p> : null}
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li key={f.id} data-testid="friend-row" className="flex items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-[14px]">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-peach text-[15px] font-black text-ink">
                  {f.display_name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold">{f.display_name}</span>
                  <span className="text-[12px] text-sub">{f.allowsMe ? `AI 사진 사용 가능${f.photoCount > 0 ? ` · 등록 사진 ${f.photoCount}장` : ""}` : "사진 사용 동의 대기"}</span>
                </span>
                <span className={`badge badge-sm ${f.allowsMe ? "badge-ok" : "badge-wait"}`}>{f.allowsMe ? "동의 완료" : "동의 대기"}</span>
              </li>
            ))}
          </ul>
        </section>
        <InviteSection myName={me?.display_name ?? "나"} />
      </div>
    </AppShell>
  );
}
