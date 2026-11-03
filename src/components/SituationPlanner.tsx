"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ProfileLite } from "@/lib/data/types";
import type { Situation } from "@/lib/types";
import { formatDateKo, situationStatus } from "@/lib/time";
import { formatPhoneInput } from "@/lib/validate";
import { Confirm } from "@/components/ui";

type Props = { initial: Situation[]; friends: ProfileLite[]; today: string; editId: string | null };

const STATUS_LABEL = { active: "오늘 활성", scheduled: "예정", ended: "종료" } as const;
const STATUS_CLASS = { active: "badge-peach", scheduled: "badge-wait", ended: "badge-end" } as const;
const AVATAR = [
  ["#FDEDE8", "#8A3A2E"],
  ["#EDE6F0", "#4E4556"],
  ["#E9DDE0", "#4E4556"],
];

/** HOME-02 오늘의 상황 예약: 사용 날짜·장소·부모님께 알린 동행인(등록 친구)·실제 동행인 연락처·메모 */
export function SituationPlanner({ initial, friends, today, editId }: Props) {
  const router = useRouter();
  const editing = initial.find((s) => s.id === editId) ?? null;
  const [id, setId] = useState<string | null>(editing?.id ?? null);
  const [date, setDate] = useState(editing?.target_date ?? today);
  const [place, setPlace] = useState(editing?.place ?? "");
  const [companions, setCompanions] = useState<string[]>(editing?.companion_ids ?? []);
  const [realName, setRealName] = useState(editing?.real_name ?? "");
  const [realPhone, setRealPhone] = useState(editing?.real_phone ?? "");
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Situation | null>(null);

  const nameOf = new Map(friends.map((f) => [f.id, f.display_name]));
  const picked = companions.map((x) => nameOf.get(x)).filter(Boolean) as string[];
  const sosNote = picked.length ? `${picked.join(", ")}이(가) SOS 받을 친구로 자동 지정돼요` : "동행인을 고르면 SOS 받을 친구로 자동 지정돼요";

  function load(s: Situation) {
    setId(s.id);
    setDate(s.target_date);
    setPlace(s.place);
    setCompanions(s.companion_ids ?? []);
    setRealName(s.real_name ?? "");
    setRealPhone(s.real_phone ?? "");
    setMemo(s.memo);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggle(fid: string) {
    setCompanions((prev) => (prev.includes(fid) ? prev.filter((x) => x !== fid) : [...prev, fid]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = { target_date: date, place: place.trim(), companion_ids: companions, real_name: realName.trim(), real_phone: realPhone.trim(), memo: memo.trim() };
      const res = await fetch(id ? `/api/situations/${id}` : "/api/situations", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "저장하지 못했어요.");
        return;
      }
      // 저장하면 홈 '오늘의 상황' 카드에 바로 반영된다
      router.refresh();
      router.push("/");
    } catch {
      setError("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Situation) {
    setBusy(true);
    try {
      const res = await fetch(`/api/situations/${s.id}`, { method: "DELETE" });
      if (!res.ok) setError("삭제하지 못했어요.");
      else {
        if (id === s.id) setId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  async function choose(s: Situation) {
    await fetch(`/api/situations/${s.id}/choose`, { method: "POST" });
    router.refresh();
  }

  const activeCount = initial.filter((s) => situationStatus(s.target_date, s.end_date, today) === "active").length;

  return (
    <div className="flex flex-col gap-4 pt-1">
      <form onSubmit={submit} aria-label="상황 예약 설정" className="card flex flex-col gap-[14px] p-[18px]" noValidate>
        <h2 className="text-[15px] font-bold">{id ? "상황 수정" : "상황 예약 설정"}</h2>
        <label className="label">
          사용 날짜
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="label">
          장소
          <input className="field" placeholder="부산 해운대 카페" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} required />
        </label>
        <div className="flex flex-col gap-2">
          <span id="comp-label" className="text-[13px] text-sub">
            부모님께 알린 동행인 (등록된 친구에서 선택)
          </span>
          <div role="group" aria-labelledby="comp-label" className="flex flex-wrap gap-2">
            {friends.map((f, i) => {
              const on = companions.includes(f.id);
              const [bg, fg] = AVATAR[i % AVATAR.length];
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(f.id)}
                  className={`flex h-11 items-center gap-2 rounded-[22px] pl-2 pr-[14px] text-[14px] ${on ? "border-2 border-coral bg-white font-bold" : "border-2 border-line bg-warm"}`}
                >
                  <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black" style={{ background: bg, color: fg }}>
                    {f.display_name.slice(0, 1)}
                  </span>
                  {f.display_name}
                </button>
              );
            })}
            <Link href="/friends" className="flex h-11 items-center rounded-[22px] border border-dashed border-[#D9CBC4] px-[14px] text-[14px] text-sub">
              + 친구 추가
            </Link>
          </div>
          <div className="flex items-center gap-2 rounded-[12px] bg-peach px-3 py-[10px] text-[13px] text-ink">
            <span aria-hidden>✈︎</span>
            <span>{sosNote}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-sub">실제 동행인 연락처</span>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-sub">
              이름
              <input className="field min-w-0 px-3" placeholder="이름" value={realName} maxLength={40} onChange={(e) => setRealName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-sub">
              휴대폰 번호
              <input className="field min-w-0" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={realPhone} onChange={(e) => setRealPhone(formatPhoneInput(e.target.value))} />
            </label>
          </div>
          <span className="text-[12px] leading-[1.5] text-sub">이 번호는 SOS를 받은 친구에게만 보여요. 친구가 확인을 누르면 이 번호로 바로 전화할 수 있어요. 동행인에게도 번호를 공유한다고 미리 알려 주세요.</span>
        </div>
        <label className="label">
          상황 메모
          <textarea className="field" rows={3} placeholder="점심은 돼지국밥, 저녁엔 숙소에서 쉬는 중" value={memo} maxLength={500} onChange={(e) => setMemo(e.target.value)} />
        </label>
        {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
        <button type="submit" disabled={busy || !place.trim() || !date} className="btn btn-dark h-[52px] w-full">
          {busy ? "저장 중…" : id ? "수정 저장하기" : "상황 저장하기"}
        </button>
        {id ? (
          <button type="button" onClick={() => setId(null)} className="text-[13px] text-sub underline">
            새 상황으로 쓰기
          </button>
        ) : null}
        <span className="text-[12px] leading-[1.5] text-sub">장소와 메모 등은 사용자가 입력한 설정이며 실제 관측·위치 확인 정보가 아니에요.</span>
      </form>

      <section aria-label="예약 목록" className="flex flex-col gap-[10px]">
        <h2 className="text-[15px] font-bold">예약 목록</h2>
        {initial.length === 0 ? (
          <p className="card p-5 text-center text-[13px] text-sub">아직 예약한 상황이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="situation-list">
            {initial.map((s) => {
              const st = situationStatus(s.target_date, s.end_date, today);
              return (
                <li key={s.id} data-testid="situation-item" data-status={st} className="flex items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-[14px]">
                  <button type="button" onClick={() => load(s)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <span className="text-[13px] text-sub">{formatDateKo(s.target_date, today)}</span>
                    <span className="truncate text-[15px] font-bold">
                      {s.place || "장소 미입력"}
                      {s.companion ? ` · ${s.companion}` : ""}
                    </span>
                  </button>
                  {st === "active" && activeCount > 1 ? (
                    <button type="button" onClick={() => choose(s)} className="text-[12px] font-bold text-rust">
                      오늘 사용
                    </button>
                  ) : null}
                  <span className={`badge ${STATUS_CLASS[st]}`}>{STATUS_LABEL[st]}</span>
                  <button type="button" onClick={() => setDeleting(s)} aria-label={`${formatDateKo(s.target_date, today)} 상황 삭제`} className="-mr-2 h-8 w-8 text-[18px] text-sub">
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Confirm open={deleting !== null} title="이 상황을 삭제할까요?" body={deleting ? `${formatDateKo(deleting.target_date, today)} · ${deleting.place}` : null} confirmLabel="삭제" danger busy={busy} onConfirm={() => deleting && remove(deleting)} onCancel={() => setDeleting(null)} />
    </div>
  );
}
