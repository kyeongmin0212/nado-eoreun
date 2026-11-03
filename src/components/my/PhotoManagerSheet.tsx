"use client";

import { useState } from "react";
import type { PhotoSlot, ProfilePhoto } from "@/lib/types";
import { prepareImage } from "@/lib/image/client-prepare";
import { profilePhotoSrc } from "@/lib/urls";
import { Confirm } from "@/components/ui";
import { IconCamera, IconGallery, IconPlus } from "@/components/Icons";

export const SLOTS: { id: Exclude<PhotoSlot, "extra">; label: string; short: string }[] = [
  { id: "front", label: "정면", short: "정면" },
  { id: "left", label: "왼쪽 측면", short: "왼쪽" },
  { id: "right", label: "오른쪽 측면", short: "오른쪽" },
  { id: "full", label: "전신", short: "전신" },
];

type Props = { photos: ProfilePhoto[]; onChange: (next: ProfilePhoto[]) => void; onClose: () => void };

/** MY-01 「사진 관리」 시트: 등록 사진 교체(타일 누르기)·삭제(×)·기타 +(카메라/갤러리) */
export function PhotoManagerSheet({ photos, onChange, onClose }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [chooser, setChooser] = useState(false);
  const [removing, setRemoving] = useState<ProfilePhoto | null>(null);

  async function upload(slot: PhotoSlot, file: File | undefined, label: string) {
    if (!file) return;
    setBusy(slot);
    setNote(null);
    setChooser(false);
    try {
      const prepared = await prepareImage(file);
      const form = new FormData();
      form.set("slot", slot);
      form.set("image", prepared.blob, `${slot}.jpg`);
      const res = await fetch("/api/profile-photos", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as { ok: boolean; photo?: ProfilePhoto; message?: string } | null;
      if (!data?.ok || !data.photo) {
        setNote(data?.message ?? "등록하지 못했어요.");
        return;
      }
      onChange([...photos.filter((p) => slot === "extra" || p.slot !== slot), data.photo]);
      setNote(`${label} 사진을 등록했어요`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "사진을 불러오지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: ProfilePhoto, label: string) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/profile-photos/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        onChange(photos.filter((x) => x.id !== p.id));
        setNote(`${label} 사진을 삭제했어요. 최근 모습이 담긴 사진으로 다시 등록해 주세요.`);
      } else setNote("삭제하지 못했어요.");
    } finally {
      setBusy(null);
      setRemoving(null);
    }
  }

  const extras = photos.filter((p) => p.slot === "extra");
  const labelOf = (p: ProfilePhoto) => (p.slot === "extra" ? `추가 사진 ${extras.findIndex((x) => x.id === p.id) + 1}` : (SLOTS.find((s) => s.id === p.slot)?.label ?? "사진"));

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="내 사진 관리" className="sheet sheet-in max-h-[calc(100dvh-56px)]">
        <div aria-hidden className="sheet-handle mt-3" />
        <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between">
            <span className="flex flex-col gap-0.5">
              <h2 className="text-[18px] font-black">내 사진 관리</h2>
              <span className="text-[12px] text-sub">등록 사진 {photos.length}장 · 사진을 눌러 교체할 수 있어요</span>
            </span>
            <button type="button" onClick={onClose} aria-label="닫기" className="-mr-[10px] h-11 w-11 text-[22px]">
              ×
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((s) => {
              const p = photos.find((x) => x.slot === s.id);
              return (
                <div key={s.id} className="relative h-[120px]">
                  <label className={`flex h-[120px] w-full cursor-pointer flex-col items-center gap-1.5 rounded-[14px] border-2 p-1.5 ${p ? "border-line bg-white" : "border-dashed border-dash bg-warm"}`}>
                    <span className="relative w-full flex-1 overflow-hidden rounded-[10px] bg-blush bg-center bg-no-repeat" style={{ backgroundImage: `url(/angles/${s.id}.svg)`, backgroundSize: 40 }}>
                      {p ? <img src={profilePhotoSrc(p.id, p.created_at, 240)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                    </span>
                    <span className="text-[12px]">{busy === s.id ? "등록 중…" : p ? s.label : `${s.label} 등록`}</span>
                    <input type="file" accept="image/*" className="sr-only" aria-label={p ? `${s.label} 사진 교체` : `${s.label} 사진 등록`} disabled={Boolean(busy)} onChange={(e) => void upload(s.id, e.target.files?.[0], s.label)} />
                  </label>
                  {p ? (
                    <button type="button" onClick={() => setRemoving(p)} aria-label={`${s.label} 사진 삭제`} className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-charcoal text-[15px] leading-none text-warm">
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
            {extras.map((p, i) => (
              <div key={p.id} className="relative h-[120px]">
                <div className="flex h-[120px] w-full flex-col items-center gap-1.5 rounded-[14px] border-2 border-line bg-white p-1.5">
                  <span className="relative w-full flex-1 overflow-hidden rounded-[10px] bg-peach">
                    <img src={profilePhotoSrc(p.id, p.created_at, 240)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  </span>
                  <span className="text-[12px]">추가 사진 {i + 1}</span>
                </div>
                <button type="button" onClick={() => setRemoving(p)} aria-label={`추가 사진 ${i + 1} 삭제`} className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-charcoal text-[15px] leading-none text-warm">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setChooser(true)} disabled={Boolean(busy)} className="flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-dash bg-warm text-[13px] font-bold text-ink">
              <IconPlus size={20} />
              {busy === "extra" ? "등록 중…" : "기타 +"}
            </button>
          </div>
          {note ? (
            <p role="status" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-ink">
              {note}
            </p>
          ) : null}
          <p className="text-[12px] leading-[1.5] text-sub">기타 +는 갤러리나 카메라로 추가 사진을 등록해요. 다양한 각도의 사진이 많을수록 AI 사진이 자연스러워져요.</p>
          <button type="button" onClick={onClose} className="h-[52px] shrink-0 rounded-[16px] bg-charcoal text-[15px] font-bold text-warm">
            완료
          </button>
        </div>
      </div>

      {chooser ? (
        <div className="fixed inset-0 z-[75] flex flex-col justify-end gap-2 bg-charcoal/45 px-[10px] pb-[calc(24px+env(safe-area-inset-bottom))]">
          <div role="dialog" aria-label="사진 추가 방법" className="mx-auto w-full max-w-[410px] overflow-hidden rounded-[16px] bg-white">
            <span className="block px-4 pb-[10px] pt-[14px] text-center text-[13px] text-sub">추가 사진을 어떻게 등록할까요?</span>
            <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 border-t border-line text-[16px]">
              <IconCamera size={20} />
              사진 촬영
              <input type="file" accept="image/*" capture="user" aria-label="사진 촬영으로 추가" className="sr-only" onChange={(e) => void upload("extra", e.target.files?.[0], "추가")} />
            </label>
            <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 border-t border-line text-[16px]">
              <IconGallery size={20} />
              갤러리에서 선택
              <input type="file" accept="image/*" aria-label="갤러리에서 추가" className="sr-only" onChange={(e) => void upload("extra", e.target.files?.[0], "추가")} />
            </label>
          </div>
          <button type="button" onClick={() => setChooser(false)} className="mx-auto h-14 w-full max-w-[410px] rounded-[16px] bg-white text-[16px] font-bold">
            취소
          </button>
        </div>
      ) : null}

      <Confirm open={removing !== null} title="이 사진을 삭제할까요?" body="삭제하면 친구도 더 이상 이 사진을 쓸 수 없어요." confirmLabel="삭제" danger busy={Boolean(removing && busy === removing.id)} onConfirm={() => removing && remove(removing, labelOf(removing))} onCancel={() => setRemoving(null)} />
    </>
  );
}
