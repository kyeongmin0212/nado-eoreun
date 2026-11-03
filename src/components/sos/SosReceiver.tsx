"use client";

import { useEffect, useRef, useState } from "react";
import type { SituationSnapshot, SosResponse } from "@/lib/types";
import { CALL_LABEL, RESPOND_FALLBACK_LABEL, casualName, withName } from "@/lib/copy";
import { INTRO_FLAG } from "@/components/IntroGate";
import { LocalTime } from "@/components/LocalTime";
import { SosFriendView } from "@/components/sos/SosFriendView";
import { IconPhoneFill } from "@/components/Icons";

type Props = {
  requestId: string;
  senderName: string;
  createdAt: string;
  snapshot: SituationSnapshot | null;
  cancelledAt: string | null;
  initial: { firstReadAt: string | null; response: SosResponse | null };
  viaPush: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/** SOS-02 친구가 받는 SOS: 화면이 뜨면 열람을 기록하고, 실제 동행인에게 전화하기를 누르면 「확인 · 통화 가능」으로 응답한다. */
export function SosReceiver(props: Props) {
  const { requestId, senderName, snapshot, viaPush } = props;
  const [response, setResponse] = useState<SosResponse | null>(props.initial.response);
  const [readState, setReadState] = useState<"recording" | "done" | "error">(props.initial.firstReadAt ? "done" : "recording");
  const [dial, setDial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recordedRef = useRef(false);
  const cancelled = Boolean(props.cancelledAt);
  const phone = snapshot?.realPhone ?? "";
  const tel = phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : null;

  useEffect(() => {
    if (!viaPush) return;
    try {
      sessionStorage.setItem(INTRO_FLAG, "1");
    } catch {}
  }, [viaPush]);

  // 요청 상세가 실제로 화면에 뜬 뒤에만 열람을 기록한다 (서버가 수신자 본인인지 확인).
  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    fetch(`/api/sos/${requestId}/read`, { method: "POST" })
      .then(async (res) => {
        const data = (await res.json()) as { ok: boolean };
        if (!data.ok) throw new Error("read failed");
        setReadState("done");
      })
      .catch(() => setReadState("error"));
  }, [requestId]);

  async function respond(): Promise<boolean> {
    if (response === "available") return true;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/sos/${requestId}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: "available" }) });
      const data = (await res.json().catch(() => null)) as { ok: boolean; message?: string } | null;
      if (!data?.ok) {
        setNotice(data?.message ?? "응답을 보내지 못했어요.");
        return false;
      }
      setResponse("available");
      return true;
    } catch {
      setNotice("네트워크 오류로 응답을 보내지 못했어요.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCall() {
    if (busy || cancelled) return;
    const ok = await respond();
    if (ok) setDial(true);
  }

  async function onFallback() {
    if (busy || cancelled) return;
    if (await respond()) setNotice(`${casualName(senderName)}에게 「확인 · 통화 가능」을 알렸어요. 이제 직접 전화해 주세요.`);
  }

  const actions = cancelled ? (
    <p className="rounded-[14px] bg-end-bg px-4 py-3 text-[13px] text-end">요청이 취소되어 더 응답하지 않아도 돼요.</p>
  ) : (
    <div className="flex flex-col gap-2">
      {tel ? (
        <>
          <button type="button" onClick={onCall} disabled={busy} className="flex h-[58px] items-center justify-center gap-2 rounded-[16px] bg-sage text-[16px] font-black text-sage-ink disabled:opacity-60">
            <IconPhoneFill size={20} />
            {CALL_LABEL} · {phone}
          </button>
          <span className="text-center text-[12px] text-sub">누르면 번호가 입력된 전화 화면이 열려요</span>
        </>
      ) : (
        <>
          <button type="button" onClick={onFallback} disabled={busy} className="btn btn-dark h-[58px] w-full text-[16px]">
            {RESPOND_FALLBACK_LABEL}
          </button>
          <span className="text-center text-[12px] text-sub">누르면 {casualName(senderName)}에게 확인했다고 알려 줘요</span>
        </>
      )}
      {response === "available" && !notice ? (
        <p role="status" data-testid="my-response" className="rounded-[12px] bg-ok-bg px-3 py-2 text-center text-[13px] text-ok">
          {casualName(senderName)}에게 「확인 · 통화 가능」을 알렸어요
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-[12px] bg-peach px-3 py-2 text-center text-[13px] text-ink">
          {notice}
        </p>
      ) : null}
      {readState === "error" ? <p className="text-center text-[12px] text-danger">열람 기록에 실패했어요. 화면을 다시 열면 다시 시도해요.</p> : null}
    </div>
  );

  return (
    <div data-testid="sos-detail" data-request-id={requestId}>
      <SosFriendView senderName={senderName} snapshot={snapshot} when={<LocalTime iso={props.createdAt} mode="relative" />} cancelled={cancelled} actions={actions} />

      {dial && tel ? (
        <div role="dialog" aria-modal="true" aria-label="전화 걸기" className="fixed inset-0 z-[80] mx-auto flex max-w-[430px] flex-col items-center bg-[#1C1C1E] px-8 pb-[calc(56px+env(safe-area-inset-bottom))] pt-[calc(96px+env(safe-area-inset-top))] text-white">
          <span className="text-[15px] text-[#AEAEB2]">
            {withName(senderName)} 실제 동행인 · {snapshot?.realName}
          </span>
          <span className="mt-[10px] text-[40px] tracking-[1px]">{phone}</span>
          <span className="mt-2 text-[13px] text-[#AEAEB2]">나도으른에서 번호를 불러왔어요</span>
          <div aria-hidden className="mt-11 grid grid-cols-[repeat(3,72px)] gap-x-[26px] gap-y-[18px]">
            {KEYS.map((k) => (
              <span key={k} className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#333336] text-[28px]">
                {k}
              </span>
            ))}
          </div>
          <a href={tel} aria-label="통화" data-testid="call-link" className="mt-auto flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#34C759]">
            <IconPhoneFill size={32} className="text-white" />
          </a>
          <button type="button" onClick={() => setDial(false)} className="mt-4 h-11 px-5 text-[16px]">
            취소
          </button>
        </div>
      ) : null}
    </div>
  );
}
