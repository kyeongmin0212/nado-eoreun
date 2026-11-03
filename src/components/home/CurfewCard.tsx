"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatHmKo, hmToMinutes, nowHmKst } from "@/lib/time";

type Props = { curfewTime: string; notifyMinutes: number; isOverride: boolean };

const WINDOW_MIN = 5 * 60; // 통금 5시간 전부터 막대가 줄어든다
const LATE_MIN = 6 * 60; // 통금이 지나면 6시간 동안 '지났어'
const ALERTS = [10, 30, 60, 120];

const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

function alertText(n: number) {
  return n >= 60 ? `${n / 60}시간 전` : `${n}분 전`;
}

/** 디자인 원본의 통금 계산: 남은 시간 / 5시간 비율 막대, 알림 시점 흰 선, 임박 주황, 지남 6시간 */
export function curfewView(curfewTime: string, alert: number, now: Date) {
  const { hour, minute } = nowHmKst(now);
  const nowMin = hour * 60 + minute + now.getSeconds() / 60;
  const target = hmToMinutes(curfewTime);
  const passedToday = nowMin - target;
  const isLate = passedToday >= 0 && passedToday < LATE_MIN;
  const lateFromYesterday = passedToday < 0 && passedToday + 1440 < LATE_MIN;
  let left = target - nowMin;
  if (left <= 0) left += 1440;
  if (isLate || lateFromYesterday) {
    const passed = isLate ? passedToday : passedToday + 1440;
    const ph = Math.floor(passed / 60);
    const pm = Math.floor(passed % 60);
    return { text: `통금 ${ph > 0 ? `${ph}시간 ` : ""}${pm}분 지났어`, ratio: 0, color: "#FFB547", late: true };
  }
  const mins = Math.ceil(left);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const body = `${h > 0 ? `${h}시간 ` : ""}${m}분 남았어`;
  const soon = mins <= alert;
  return { text: soon ? `곧 통금! ${body}` : body, ratio: Math.max(0, Math.min(1, left / WINDOW_MIN)), color: soon ? "#FFB547" : "#F5A390", late: false };
}

export function CurfewCard({ curfewTime, notifyMinutes, isOverride }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(curfewTime);
  const [draftAlert, setDraftAlert] = useState(ALERTS.includes(notifyMinutes) ? notifyMinutes : 30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 저장 직후 즉시 반영 (서버 새로고침 전에도 화면이 바로 바뀐다)
  const [local, setLocal] = useState<{ time: string; alert: number } | null>(null);
  const time = local?.time ?? curfewTime;
  const alert = local?.alert ?? notifyMinutes;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const v = curfewView(time, alert, now);
  const markerPct = Math.min(100, (alert / WINDOW_MIN) * 100);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/curfew-today", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time: draftTime, notifyMinutes: draftAlert }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "저장하지 못했어요.");
        return;
      }
      setLocal({ time: draftTime, alert: draftAlert });
      setOpen(false);
      router.refresh();
    } catch {
      setError("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="통금 타이머" className="card-dark flex flex-col gap-3 px-5 py-[18px]" data-testid="curfew-card">
      <div className="flex items-center justify-between">
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] text-blush">통금까지{isOverride || local ? " · 오늘만" : ""}</span>
          <span className="text-[22px] font-black" style={{ color: v.color }} data-testid="curfew-remaining" suppressHydrationWarning>
            {hydrated ? v.text : " "}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setDraftTime(time);
            setDraftAlert(ALERTS.includes(alert) ? alert : 30);
            setOpen(true);
          }}
          className="h-8 rounded-[12px] bg-dusk px-[14px] text-[13px] text-cream"
        >
          시간 설정
        </button>
      </div>
      <div role="progressbar" aria-label="통금까지 남은 시간" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v.ratio * 100)} className="relative h-[22px] overflow-hidden rounded-[11px] bg-dusk">
        <div className="absolute inset-y-0 left-0 rounded-[11px]" style={{ width: `${hydrated ? (v.ratio * 100).toFixed(2) : 0}%`, background: v.late ? "#FFB547" : v.color, transition: "width 1s linear" }} />
        <div aria-hidden className="absolute inset-y-0 w-[2px] bg-warm" style={{ left: `${markerPct.toFixed(2)}%` }} />
      </div>
      <div className="flex justify-between text-[12px] text-mist">
        <span data-testid="curfew-label">{formatHmKo(time)} 통금</span>
        <span>흰 선 = {alertText(alert)} 알림</span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[66] flex items-end bg-charcoal/55">
          <div role="dialog" aria-label="오늘 통금 시간 설정" className="sheet-in mx-auto flex w-full max-w-[430px] flex-col gap-4 rounded-t-[24px] bg-white px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-3 text-charcoal">
            <div aria-hidden className="sheet-handle" />
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-black">오늘 통금 시간</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="-mr-[10px] h-11 w-11 text-[20px]">
                ×
              </button>
            </div>
            <label className="label">
              통금 시각
              <input type="time" value={draftTime} onChange={(e) => e.target.value && setDraftTime(e.target.value)} className="h-14 w-full rounded-[14px] border border-line bg-warm px-4 py-[13px] text-[22px] font-bold leading-[28px] text-charcoal" />
            </label>
            <div className="flex flex-col gap-2">
              <span id="alert-label" className="text-[13px] text-sub">
                미리 알림
              </span>
              <div role="group" aria-labelledby="alert-label" className="grid grid-cols-4 gap-1.5">
                {ALERTS.map((n) => (
                  <button key={n} type="button" aria-pressed={draftAlert === n} onClick={() => setDraftAlert(n)} className={`h-11 rounded-[12px] text-[13px] ${draftAlert === n ? "bg-coral font-bold" : "border border-line bg-white"}`}>
                    {alertText(n)}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[13px] text-sub">오늘만 적용돼요. 매일 쓸 기본 통금은 MY &gt; 기본 통금 시간에서 바꿀 수 있어요.</span>
            {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
            <div className="grid grid-cols-2 gap-[10px]">
              <button type="button" onClick={() => setOpen(false)} className="h-[52px] rounded-[16px] border border-line bg-white text-[15px]">
                취소
              </button>
              <button type="button" onClick={save} disabled={busy} className="h-[52px] rounded-[16px] bg-charcoal text-[15px] font-bold text-warm">
                {busy ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
