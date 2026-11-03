import type { Metadata } from "next";
import { isPushConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { activeSituation, toSnapshot } from "@/lib/situations";
import { AppShell } from "@/components/AppShell";
import { SosComposer } from "@/components/sos/SosComposer";

// 이 화면에서 「홈 화면에 추가」하면 SOS-01 이 바로 열리는 아이콘이 생긴다 (웹앱 단계의 SOS 위젯 대신).
export const metadata: Metadata = { title: "SOS", manifest: "/sos-manifest", appleWebApp: { capable: true, title: "나도으른 SOS", statusBarStyle: "black-translucent" } };

/** SOS-01 발송 준비 */
export default async function SosComposePage({ searchParams }: PageProps<"/sos">) {
  const sp = await searchParams;
  const user = await requireUser("/sos");
  const data = await getData();
  const [profile, friends, situations] = await Promise.all([data.getProfile(user.id), data.getFriends(user.id), data.listSituations(user.id)]);
  const name = profile?.display_name ?? "나";
  const active = activeSituation(situations);
  const snapshot = active ? toSnapshot(active, name) : null;
  return (
    <AppShell header={false} tone="dark">
      <SosComposer senderName={name} friends={friends} snapshot={snapshot} preselect={typeof sp.to === "string" ? sp.to : null} pushConfigured={isPushConfigured()} />
    </AppShell>
  );
}
