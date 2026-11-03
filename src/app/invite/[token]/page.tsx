import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { InviteAccept } from "@/components/friends/InviteAccept";

export const metadata: Metadata = { title: "친구 초대" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await requireUser(`/invite/${token}`);
  const data = await getData();
  const found = await data.getInvite(token);
  return (
    <AppShell title="친구 초대" back="/friends">
      {!found ? (
        <p className="card mt-3 p-5 text-center text-[14px] text-sub">초대 링크를 찾을 수 없어요.</p>
      ) : found.invite.inviter_id === user.id ? (
        <p className="card mt-3 p-5 text-center text-[14px] text-sub">내가 만든 초대 링크예요. 친구에게 보내 주세요.</p>
      ) : (
        <div className="mt-3">
          <InviteAccept token={token} inviterName={found.inviterName} />
        </div>
      )}
    </AppShell>
  );
}
