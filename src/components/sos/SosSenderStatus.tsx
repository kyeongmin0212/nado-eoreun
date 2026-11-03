"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SosStatusRow } from "@/lib/data/types";
import type { SituationSnapshot } from "@/lib/types";
import { CALL_LABEL, RESPOND_FALLBACK_LABEL, casualName } from "@/lib/copy";
import { LocalTime } from "@/components/LocalTime";
import { SosFriendView } from "@/components/sos/SosFriendView";
import { SosSummary } from "@/components/sos/SosSummary";
import { Confirm } from "@/components/ui";
import { IconClose, IconPhoneFill } from "@/components/Icons";
import { PUSH_LABEL, STATE_LABEL, STATE_PILL, TONE_PILL, deliverySummary, friendState } from "@/components/sos/status";

type Props = {
  requestId: string;
  senderName: string;
  createdAt: string;
  snapshot: SituationSnapshot | null;
  cancelledAt: string | null;
  initialRows: SosStatusRow[];
  /** 같은 화면에서 발송 준비로 돌아가기 (SOS-01 에서 바로 넘어온 경우) */
  onAgain?: () => void;
};

const IS_LOCAL_BACKEND = process.env.NEXT_PUBLIC_DATA_BACKEND === "local";
const POLL_MS = 2500;

/** SOS-03 발송 완료: 전송 상태와 친구 응답을 따로 보여주고 실시간으로 갱신한다. 발신자 전용. */
export function SosSenderStatus(props: Props) {
  const { requestId, snapshot } = props;
  const router = useRouter();
  const [rows, setRows] = useState<SosStatusRow[]>(props.initialRows);
  const [cancelledAt, setCancelledAt] = useState(props.cancelledAt);
  const [preview, setPreview] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/sos/${requestId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; cancelledAt?: string | null; recipients?: SosStatusRow[] };
      if (!data.ok || !data.recipients) return;
      setRows(data.recipients);
      setCancelledAt(data.cancelledAt ?? null);
    } catch {
      // 다음 이벤트·복귀 시 다시 시도
    }
  }, [requestId]);

  useEffect(() => {
    let cleanupRealtime: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    if (IS_LOCAL_BACKEND) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refetch();
      }, POLL_MS);
    } else {
      import("@/lib/supabase/client")
        .then(({ authedRealtime }) => authedRealtime())
        .then((supabase) => {
          const channel = supabase
            .channel(`sos-${requestId}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sos_recipients", filter: `request_id=eq.${requestId}` }, () => void refetch())
            .subscribe((status: string) => {
              if (status === "SUBSCRIBED") void refetch();
            });
          cleanupRealtime = () => void supabase.removeChannel(channel);
        })
        .catch(() => undefined);
      // 실시간 연결이 늦거나 끊겨도 몇 초 안에 따라잡는다.
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refetch();
      }, 10_000);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (timer) clearInterval(timer);
      cleanupRealtime?.();
    };
  }, [requestId, refetch]);

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sos/${requestId}/cancel`, { method: "POST" });
      if (res.ok) {
        setCancelledAt(new Date().toISOString());
        setCancelOpen(false);
        router.refresh();
        router.push("/");
      }
    } finally {
      setBusy(false);
    }
  }

  const delivery = deliverySummary(rows);
  const first = rows[0]?.name ?? "친구";
  const phone = snapshot?.realPhone;

  return (
    <div className="flex flex-col gap-[18px]" data-testid="sos-detail" data-request-id={requestId}>
      <SosSummary snapshot={snapshot} />

      <section aria-label="발송 상태" className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between rounded-[16px] bg-dusk px-4 py-[14px]">
          <span className="text-[14px]">발송 상태</span>
          <span data-testid="delivery-status" className={`rounded-[12px] px-[10px] py-1 text-[12px] font-bold ${TONE_PILL[delivery.tone]}`}>
            {cancelledAt ? "요청 취소됨" : delivery.label}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">친구 응답</h2>
          <span className="text-[12px] text-mist">
            <LocalTime iso={props.createdAt} mode="time" /> 보냄
          </span>
        </div>
        <ul className="flex flex-col gap-2" aria-live="polite">
          {rows.map((r) => {
            const st = friendState(r);
            return (
              <li key={r.recipientId} data-testid="recipient-row" data-recipient-name={r.name} className="flex items-center justify-between gap-3 rounded-[16px] bg-dusk px-4 py-[14px]">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold">{r.name}</span>
                  <span className="text-[11px] text-mist/80">{PUSH_LABEL[r.pushStatus]}</span>
                </span>
                <span data-testid="recipient-status" className={`shrink-0 rounded-[12px] px-[10px] py-1 text-[12px] font-bold ${STATE_PILL[st]}`}>
                  {STATE_LABEL[st]}
                </span>
              </li>
            );
          })}
        </ul>
        <span className="text-[12px] text-mist">전송 완료는 알림이 간 것이고, 친구가 확인했는지는 응답 상태로 따로 보여줘요.</span>

        <button type="button" onClick={() => setPreview(true)} className="flex h-[50px] items-center justify-center rounded-[14px] bg-coral text-[15px] font-black text-charcoal">
          {casualName(first)} 화면 미리보기
        </button>
        <div className="grid grid-cols-2 gap-2">
          {props.onAgain ? (
            <button type="button" onClick={props.onAgain} disabled={Boolean(cancelledAt)} className="h-[46px] rounded-[14px] border border-sub text-[14px] text-cream disabled:opacity-50">
              다른 친구에게 요청
            </button>
          ) : (
            <Link href="/sos" className={`flex h-[46px] items-center justify-center rounded-[14px] border border-sub text-[14px] text-cream ${cancelledAt ? "pointer-events-none opacity-50" : ""}`}>
              다른 친구에게 요청
            </Link>
          )}
          <button type="button" onClick={() => setCancelOpen(true)} disabled={Boolean(cancelledAt) || busy} className="h-[46px] rounded-[14px] border border-sub text-[14px] text-mist disabled:opacity-50">
            요청 취소
          </button>
        </div>
        {cancelledAt ? <p className="text-center text-[12px] text-mist">요청을 취소했어요. 친구 화면에도 취소됨으로 보여요.</p> : null}
      </section>

      {preview ? (
        <>
          <div className="sheet-backdrop" onClick={() => setPreview(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="친구 화면 미리보기" className="sheet sheet-in bg-warm text-charcoal">
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <span className="text-[13px] font-bold text-ink">{first}에게 보이는 화면 (미리보기)</span>
              <button type="button" onClick={() => setPreview(false)} aria-label="닫기" className="-mr-[10px] flex h-11 w-11 items-center justify-center">
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <SosFriendView
                senderName={props.senderName}
                snapshot={snapshot}
                when="방금"
                cancelled={Boolean(cancelledAt)}
                actions={
                  <span aria-hidden className={`pointer-events-none flex h-[58px] items-center justify-center gap-2 rounded-[16px] text-[16px] font-black ${phone ? "bg-sage text-sage-ink" : "bg-charcoal text-cream"}`}>
                    {phone ? (
                      <>
                        <IconPhoneFill size={20} />
                        {CALL_LABEL} · {phone}
                      </>
                    ) : (
                      RESPOND_FALLBACK_LABEL
                    )}
                  </span>
                }
              />
            </div>
          </div>
        </>
      ) : null}

      <Confirm open={cancelOpen} title="SOS 요청을 취소할까요?" body="친구 화면에 취소됨으로 보이고, 더는 응답을 받지 않아요." confirmLabel="요청 취소" danger busy={busy} onConfirm={cancel} onCancel={() => setCancelOpen(false)} />
    </div>
  );
}
