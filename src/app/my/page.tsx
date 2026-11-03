import type { Metadata } from "next";
import { integrationStatus, releaseId, vapidPublicKey } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { MyPage } from "@/components/my/MyPage";

export const metadata: Metadata = { title: "마이페이지" };

/** MY-01 마이페이지 */
export default async function MyRoute({ searchParams }: PageProps<"/my">) {
  const sp = await searchParams;
  const user = await requireUser("/my");
  const data = await getData();
  const [profile, friends, photos] = await Promise.all([data.getProfileFull(user.id), data.getFriendsWithConsent(user.id), data.listProfilePhotos(user.id)]);
  const status = integrationStatus();
  return (
    <AppShell title="마이페이지" close="/">
      {profile ? (
        <MyPage profile={profile} friends={friends} photos={photos} releaseId={releaseId()} vapidPublicKey={vapidPublicKey()} pushConfigured={status.push} openPhotos={sp.sheet === "photos"} openShare={sp.share === "1"} />
      ) : (
        <p className="card mt-3 p-5 text-[14px] text-sub">프로필이 없어요. 테스트 계정 초기화를 확인해 주세요.</p>
      )}
    </AppShell>
  );
}
