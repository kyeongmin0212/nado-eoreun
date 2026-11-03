"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { withName } from "@/lib/copy";

/** 초대 링크 수락: 친구 관계만 만든다. 사진 사용 동의는 마이페이지 공유 설정에서 따로 허용한다. */
export function InviteAccept({ token, inviterName }: { token: string; inviterName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok: boolean; friendName?: string; alreadyFriends?: boolean; message?: string } | null;
      if (!data?.ok) {
        setError(data?.message ?? "수락하지 못했어요.");
        return;
      }
      const name = data.friendName ?? inviterName;
      setDone(data.alreadyFriends ? `${withName(name)}는 이미 친구예요.` : `${withName(name)} 친구가 됐어요.`);
      router.refresh();
    } catch {
      setError("네트워크 오류로 수락하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card flex flex-col gap-2 p-5 text-center">
        <p className="text-[17px] font-black">{done}</p>
        <p className="text-[13px] text-sub">내 사진을 등록하고 공유 설정에서 사용을 허용하면 함께 AI 사진을 만들 수 있어요.</p>
        <Link href="/my?sheet=photos" className="btn btn-dark mt-2 w-full">
          내 사진 등록하기
        </Link>
        <Link href="/friends" className="btn btn-white w-full">
          친구 목록 보기
        </Link>
      </div>
    );
  }
  return (
    <div className="card flex flex-col gap-2 p-5">
      <p className="text-[17px] font-black">{inviterName}님의 친구 초대</p>
      <p className="text-[13px] leading-relaxed text-sub">수락하면 서로 SOS를 보낼 수 있어요. 내 사진 사용 동의는 마이페이지 공유 설정에서 따로 허용해요.</p>
      {error ? (
        <p role="alert" className="text-[13px] font-bold text-danger">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={accept} disabled={busy} className="btn btn-dark mt-2 w-full">
        {busy ? "수락 중…" : "초대 수락하기"}
      </button>
    </div>
  );
}
