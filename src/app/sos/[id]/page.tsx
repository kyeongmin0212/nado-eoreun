import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { SosHeader } from "@/components/sos/SosHeader";
import { SosSenderStatus } from "@/components/sos/SosSenderStatus";
import { SosReceiver } from "@/components/sos/SosReceiver";
import { IconClose } from "@/components/Icons";

export const metadata: Metadata = { title: "SOS" };

/** SOS-03(발신자: 발송 완료) / SOS-02(받은 친구) */
export default async function SosDetailPage({ params, searchParams }: PageProps<"/sos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const viaPush = sp.via === "push";
  const user = await requireUser(`/sos/${id}${viaPush ? "?via=push" : ""}`);
  const data = await getData();

  // 발신자 또는 기록된 수신자만 조회된다. 권한이 없으면 내용을 공개하지 않는다.
  const request = await data.getSosRequest(user.id, id);
  if (!request) notFound();
  const [senderProfile, rows] = await Promise.all([data.getProfile(request.sender_id), data.getSosStatus(user.id, id)]);
  const senderName = senderProfile?.display_name ?? "친구";
  const isSender = request.sender_id === user.id;

  if (isSender) {
    return (
      <AppShell header={false} tone="dark">
        <SosHeader phase={request.cancelled_at ? "cancelled" : "sent"} />
        <SosSenderStatus requestId={request.id} senderName={senderName} createdAt={request.created_at} snapshot={request.situation_snapshot} cancelledAt={request.cancelled_at} initialRows={rows ?? []} />
      </AppShell>
    );
  }
  const mine = (rows ?? []).find((r) => r.recipientId === user.id);
  if (!mine) notFound();
  return (
    <AppShell
      header={
        <header className="flex items-center justify-between px-5 pt-2">
          <span className="text-[13px] font-bold text-ink">친구 SOS</span>
          <Link href="/" aria-label="닫기" className="-mr-[10px] flex h-11 w-11 items-center justify-center">
            <IconClose />
          </Link>
        </header>
      }
    >
      <SosReceiver requestId={request.id} senderName={senderName} createdAt={request.created_at} snapshot={request.situation_snapshot} cancelledAt={request.cancelled_at} initial={{ firstReadAt: mine.firstReadAt, response: mine.response }} viaPush={viaPush} />
    </AppShell>
  );
}
