"use client";

import { useMemo, useRef, useState } from "react";
import type { ProfileLite, SosStatusRow } from "@/lib/data/types";
import type { SituationSnapshot } from "@/lib/types";
import { SOS_SEND_LABEL } from "@/lib/copy";
import { SosHeader } from "@/components/sos/SosHeader";
import { SosSenderStatus } from "@/components/sos/SosSenderStatus";
import { SosSummary } from "@/components/sos/SosSummary";
import { IconCheck } from "@/components/Icons";

type Props = { senderName: string; friends: ProfileLite[]; snapshot: SituationSnapshot | null; preselect: string | null; pushConfigured: boolean };
type ApiResponse = { ok: true; id: string } | { ok: false; code: string; message: string };
type Option = { value: string; label: string; ids: string[] | null };

/** SOS-01 발송 준비: 상황 요약 → 받을 친구(오늘의 상황 동행인 자동 선택) → SOS 버튼. 여기서만 발송한다. */
export function SosComposer({ senderName, friends, snapshot, preselect, pushConfigured }: Props) {
  const [sent, setSent] = useState<{ id: string; createdAt: string; rows: SosStatusRow[] } | null>(null);
  const companions = useMemo(() => (snapshot?.companionIds ?? []).map((id) => friends.find((f) => f.id === id)).filter((f): f is ProfileLite => Boolean(f)), [snapshot, friends]);
  const options = useMemo<Option[]>(() => {
    const list: Option[] = friends.map((f) => ({ value: f.id, label: f.display_name, ids: [f.id] }));
    if (companions.length > 1) list.unshift({ value: "companions", label: companions.map((c) => c.display_name).join(", "), ids: companions.map((c) => c.id) });
    list.push({ value: "all", label: `전체 친구 (${friends.length}명)`, ids: null });
    return list;
  }, [friends, companions]);
  const initial = preselect && options.some((o) => o.value === preselect) ? preselect : companions.length > 1 ? "companions" : companions.length === 1 ? companions[0].id : "all";
  const [to, setTo] = useState<string>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const chosen = options.find((o) => o.value === to) ?? options[options.length - 1];
  const autoPicked = to === initial && companions.length > 0 && !preselect;
  const targetName = chosen.ids === null ? "전체 친구" : chosen.label;

  async function send() {
    if (pending || friends.length === 0) return;
    setPending(true);
    setError(null);
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    try {
      const res = await fetch("/api/sos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: keyRef.current, recipientIds: chosen.ids }) });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!data?.ok) {
        setError((data && !data.ok && data.message) || "SOS 전송에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      keyRef.current = null;
      // 같은 화면에서 「발송 완료」로 바꾸고 주소만 요청 화면으로 바꾼다 (새로고침·뒤로가기 대비).
      const detail = await fetch(`/api/sos/${data.id}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ ok: boolean; createdAt?: string; recipients?: SosStatusRow[] }>)
        .catch(() => null);
      setSent({ id: data.id, createdAt: detail?.createdAt ?? new Date().toISOString(), rows: detail?.recipients ?? [] });
      window.history.replaceState(null, "", `/sos/${data.id}`);
    } catch {
      setError("네트워크 오류로 전송하지 못했어요. 다시 누르면 같은 요청으로 이어져요.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <>
        <SosHeader phase="sent" />
        <SosSenderStatus
          requestId={sent.id}
          senderName={senderName}
          createdAt={sent.createdAt}
          snapshot={snapshot}
          cancelledAt={null}
          initialRows={sent.rows}
          onAgain={() => {
            setSent(null);
            window.history.replaceState(null, "", "/sos");
          }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SosHeader phase="ready" />
      <SosSummary snapshot={snapshot} showSetup />
      <label className="flex flex-col gap-2 text-[13px] text-mist">
        SOS 받을 친구
        <span className="relative block">
          <select aria-label="SOS 받을 친구" value={to} onChange={(e) => setTo(e.target.value)} disabled={pending || friends.length === 0} className="h-12 w-full appearance-none rounded-[14px] border-0 bg-dusk pl-4 pr-12 text-[15px] text-cream">
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E9DDE0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-[18px] top-1/2 -translate-y-1/2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </label>
      {autoPicked ? (
        <span className="-mt-[10px] flex items-center gap-1.5 text-[12px] text-petal">
          <IconCheck size={14} className="text-coral" strokeWidth={2} />
          오늘의 상황 동행인({companions.map((c) => c.display_name).join(", ")})이 자동으로 선택됐어요
        </span>
      ) : null}
      {!pushConfigured ? <span className="-mt-2 text-[12px] text-mist">푸시 연결 대기: 친구의 앱 알림함에만 전달돼요.</span> : null}

      <div className="flex flex-col items-center gap-[14px] py-[10px]">
        <button type="button" onClick={send} disabled={pending || friends.length === 0} aria-busy={pending} aria-label={SOS_SEND_LABEL} className="h-[180px] w-[180px] rounded-full border-[10px] border-[#5A3A3A] bg-coral text-[30px] font-black text-charcoal transition-transform active:scale-95 disabled:opacity-60">
          {pending ? <span aria-hidden className="spinner" /> : SOS_SEND_LABEL}
        </button>
        <span className="text-center text-[14px] text-mist">{friends.length === 0 ? "등록된 친구가 없어 보낼 수 없어요." : `누르면 ${targetName}에게 알림 요청을 보내요`}</span>
      </div>

      {error ? (
        <p role="alert" className="rounded-[14px] bg-[#5a3a3a] px-4 py-3 text-[13px] font-bold text-cream">
          {error}
        </p>
      ) : null}
    </div>
  );
}
