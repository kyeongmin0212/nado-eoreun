"use client";

import { useMemo, useRef, useState } from "react";
import type { PhotoSlot, ProfilePhoto } from "@/lib/types";
import type { UsablePerson } from "@/lib/data/types";
import { prepareImage } from "@/lib/image/client-prepare";
import type { PhotoPick } from "@/lib/image/session-inputs";
import { profilePhotoSrc } from "@/lib/urls";
import { IconCamera, IconClose, IconGallery, IconPlus } from "@/components/Icons";

export const SLOT_LABEL: Record<PhotoSlot, string> = { front: "정면", left: "왼쪽 측면", right: "오른쪽 측면", full: "전신", extra: "추가 사진" };
const SLOT_ART: Record<PhotoSlot, string> = { front: "front", left: "left", right: "right", full: "full", extra: "extra" };

type Props = { open: boolean; onClose: () => void; initial: PhotoPick[]; onDone: (picks: PhotoPick[]) => void; people: UsablePerson[] };

type Person = { id: string; name: string; isSelf: boolean; consented: boolean; photos: ProfilePhoto[] };
const SHOW = 3;

/** UPLOAD-01 사진 선택 바텀시트: 나와 사용 동의한 친구의 사진만. 기타 + 는 내 사진만(카메라·갤러리). */
export function UploadSheet(props: Props) {
  if (!props.open) return null;
  return <UploadSheetBody {...props} />;
}

function UploadSheetBody({ onClose, initial, onDone, people: raw }: Props) {
  const people: Person[] = useMemo(() => raw.map((u) => ({ id: u.person.id, name: u.isSelf ? "내 사진" : u.person.display_name, isSelf: u.isSelf, consented: u.isSelf || u.consented, photos: u.photos })), [raw]);
  const me = people.find((p) => p.isSelf) ?? null;
  const [personId, setPersonId] = useState<string>(me?.id ?? people[0]?.id ?? "");
  const [expanded, setExpanded] = useState(false);
  const [picks, setPicks] = useState<PhotoPick[]>(initial);
  const [extra, setExtra] = useState<PhotoPick[]>(() => initial.filter((p) => p.kind === "file"));
  const [chooser, setChooser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const nextNo = useRef(initial.filter((p) => p.kind === "file").length + 1);

  const shown = expanded ? people : people.slice(0, SHOW);
  const hidden = people.length - SHOW;
  const cur = people.find((p) => p.id === personId) ?? people[0];
  const curPicks = picks.filter((p) => (p.kind === "profile" ? p.personId === cur?.id : cur?.isSelf));

  const isPicked = (key: string) => picks.some((p) => (p.kind === "profile" ? p.id === key : p.localId === key));
  function toggleProfile(ph: ProfilePhoto, person: Person) {
    setPicks((prev) =>
      prev.some((p) => p.kind === "profile" && p.id === ph.id)
        ? prev.filter((p) => !(p.kind === "profile" && p.id === ph.id))
        : [...prev, { kind: "profile", id: ph.id, personId: person.id, personName: person.isSelf ? "나" : person.name, tag: person.isSelf ? "self" : "friend", slot: ph.slot, createdAt: ph.created_at }],
    );
  }
  function toggleFile(p: PhotoPick) {
    if (p.kind !== "file") return;
    setPicks((prev) => (prev.some((k) => k.kind === "file" && k.localId === p.localId) ? prev.filter((k) => !(k.kind === "file" && k.localId === p.localId)) : [...prev, p]));
  }
  function selectAll() {
    if (!cur) return;
    setPicks((prev) => {
      const rest = prev.filter((p) => (p.kind === "profile" ? p.personId !== cur.id : !cur.isSelf));
      const mine = cur.photos.map((ph) => ({ kind: "profile" as const, id: ph.id, personId: cur.id, personName: cur.isSelf ? "나" : cur.name, tag: cur.isSelf ? ("self" as const) : ("friend" as const), slot: ph.slot, createdAt: ph.created_at }));
      return [...rest, ...mine, ...(cur.isSelf ? extra : [])];
    });
  }
  function clearAll() {
    if (!cur) return;
    setPicks((prev) => prev.filter((p) => (p.kind === "profile" ? p.personId !== cur.id : !cur.isSelf)));
  }

  async function addFiles(files: FileList | null, source: "camera" | "gallery") {
    setChooser(false);
    if (!files || files.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const added: PhotoPick[] = [];
      for (const f of Array.from(files).slice(0, 4)) {
        const image = await prepareImage(f);
        const label = `${source === "camera" ? "촬영한 사진" : "갤러리 사진"} ${nextNo.current++}`;
        added.push({ kind: "file", localId: crypto.randomUUID(), image, personName: "나", tag: "self", label });
      }
      setExtra((prev) => [...prev, ...added]);
      setPicks((prev) => [...prev, ...added]);
      setNote(`${added.map((a) => (a.kind === "file" ? a.label : "")).join(", ")}을 추가하고 선택했어요`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "사진을 불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const total = picks.length;
  const summary = people
    .map((p) => {
      const n = picks.filter((k) => (k.kind === "profile" ? k.personId === p.id : p.isSelf)).length;
      return n > 0 ? `${p.isSelf ? "나" : p.name} ${n}장` : null;
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="sheet-backdrop bg-sub/90" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="사진 선택" className="sheet sheet-in top-[56px] max-h-none bg-warm">
        <div aria-hidden className="sheet-handle mt-[10px]" />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-3">
          <header className="flex items-start justify-between">
            <span className="flex flex-col gap-0.5">
              <h1 className="text-[20px] font-black">사진 선택</h1>
              <span className="text-[13px] text-sub">나와 사용 동의한 친구의 사진만 쓸 수 있어요</span>
            </span>
            <button type="button" onClick={onClose} aria-label="닫기" className="-mr-[10px] flex h-11 w-11 items-center justify-center">
              <IconClose />
            </button>
          </header>

          <section aria-label="인물 선택" className="flex flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">1. 인물 선택</h2>
              <span className="text-[12px] text-sub">여러 명을 함께 고를 수 있어요</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {shown.map((p) => {
                const n = picks.filter((k) => (k.kind === "profile" ? k.personId === p.id : p.isSelf)).length;
                const on = p.id === cur?.id;
                const count = p.isSelf ? p.photos.length + extra.length : p.photos.length;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={p.name}
                    aria-pressed={on}
                    disabled={!p.consented}
                    onClick={() => setPersonId(p.id)}
                    className={`flex flex-col items-center gap-1 rounded-[14px] px-1 py-3 ${!p.consented ? "border-2 border-dashed border-mist bg-warm opacity-70" : on ? "border-2 border-coral bg-peach" : `border-2 bg-white ${n > 0 ? "border-dash" : "border-line"}`}`}
                  >
                    <span aria-hidden className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-black ${p.consented ? "bg-peach text-ink" : "bg-end-bg text-end"}`}>
                      {p.isSelf ? "나" : p.name.slice(0, 1)}
                    </span>
                    <span className="max-w-full truncate text-[13px] font-bold">{p.name}</span>
                    <span className={`text-[11px] ${p.consented && n > 0 ? "font-bold text-rust" : "text-sub"}`}>{!p.consented ? "동의 대기" : n > 0 ? `${n}장 선택` : `${count}장 등록`}</span>
                  </button>
                );
              })}
              {hidden > 0 ? (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="flex flex-col items-center gap-1 rounded-[14px] border-2 border-dashed border-dash bg-white px-1 py-3">
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-[13px] font-black text-warm">
                    {expanded ? "−" : `+${hidden}`}
                  </span>
                  <span className="text-[13px] font-bold">{expanded ? "접기" : "더보기"}</span>
                  <span className="text-[11px] text-sub">{expanded ? "" : "친구 목록"}</span>
                </button>
              ) : null}
            </div>
            {people.some((p) => !p.consented) ? <span className="text-[12px] text-sub">동의 대기 중인 친구는 사진 사용을 승인하면 고를 수 있어요</span> : null}
          </section>

          {cur ? (
            <section aria-label="사진 목록" className="flex flex-col gap-[10px]">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold">{cur.isSelf ? "2. 내 사진" : `2. ${cur.name}의 사진`}</h2>
                <span className="text-[13px] font-bold text-rust">{curPicks.length}장 선택</span>
              </div>
              <span className="text-[12px] text-sub">{cur.isSelf ? "마이페이지에 등록한 사진이에요 · 기타 +로 카메라나 갤러리 사진을 더할 수 있어요" : `${cur.name}이(가) 직접 등록한 사진이에요`}</span>
              <div className="grid grid-cols-3 gap-2">
                {cur.photos.map((ph) => {
                  const on = isPicked(ph.id);
                  const label = SLOT_LABEL[ph.slot];
                  return (
                    <div key={ph.id} className="relative h-[120px]">
                      <button type="button" aria-pressed={on} aria-label={`${cur.isSelf ? "내" : cur.name} ${label}${on ? " 선택 해제" : " 선택"}`} onClick={() => toggleProfile(ph, cur)} className={`flex h-[120px] w-full flex-col items-center gap-1.5 rounded-[14px] border-2 bg-white p-1.5 ${on ? "border-coral" : "border-line"}`}>
                        <span className="relative w-full flex-1 overflow-hidden rounded-[10px] bg-blush">
                          <img src={profilePhotoSrc(ph.id, ph.created_at, 240)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                        </span>
                        <span className="text-[12px]">{label}</span>
                      </button>
                      {on ? <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-coral text-[14px] font-black">✓</span> : null}
                    </div>
                  );
                })}
                {cur.isSelf
                  ? extra.map((p) =>
                      p.kind === "file" ? (
                        <div key={p.localId} className="relative h-[120px]">
                          <button type="button" aria-pressed={isPicked(p.localId)} aria-label={`${p.label}${isPicked(p.localId) ? " 선택 해제" : " 선택"}`} onClick={() => toggleFile(p)} className={`flex h-[120px] w-full flex-col items-center gap-1.5 rounded-[14px] border-2 bg-white p-1.5 ${isPicked(p.localId) ? "border-coral" : "border-line"}`}>
                            <span className="relative w-full flex-1 overflow-hidden rounded-[10px] bg-peach">
                              <img src={p.image.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            </span>
                            <span className="max-w-full truncate text-[12px]">{p.label}</span>
                          </button>
                          {isPicked(p.localId) ? <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-coral text-[14px] font-black">✓</span> : null}
                        </div>
                      ) : null,
                    )
                  : null}
                {cur.isSelf ? (
                  <button type="button" onClick={() => setChooser(true)} disabled={busy} className="flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-dash bg-warm text-[13px] font-bold text-ink">
                    <IconPlus size={20} />
                    {busy ? "준비 중…" : "기타 +"}
                  </button>
                ) : null}
              </div>
              {!cur.isSelf && cur.photos.length === 0 ? <span className="text-[12px] text-sub">{cur.name}이(가) 아직 사진을 등록하지 않았어요.</span> : null}
              {cur.isSelf && cur.photos.length === 0 && extra.length === 0 ? <span className="text-[12px] text-sub">등록한 사진이 없어요. 기타 +로 이번에 쓸 사진을 추가하거나 마이페이지에서 등록해 주세요.</span> : null}
              {note ? (
                <span role="status" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-ink">
                  {note}
                </span>
              ) : null}
              <div className="flex justify-between">
                <button type="button" onClick={selectAll} className="h-9 rounded-[18px] border border-line bg-white px-[14px] text-[13px]">
                  전체 선택
                </button>
                <button type="button" onClick={clearAll} className="h-9 px-[14px] text-[13px] text-sub">
                  선택 해제
                </button>
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-1 rounded-[14px] border border-line bg-white px-4 py-[14px] text-[14px]">
            <div className="flex justify-between">
              <span>선택된 사진</span>
              <span className="font-bold text-rust">{total}장</span>
            </div>
            <span className="text-[12px] text-sub">{summary || "아직 고른 사진이 없어요"}</span>
          </div>
          <button type="button" onClick={() => onDone(picks)} disabled={total === 0 || busy} className="btn btn-dark h-[52px] w-full shrink-0">
            {total}장 선택 완료
          </button>
        </div>
      </div>

      {chooser ? (
        <div className="fixed inset-0 z-[75] flex flex-col justify-end gap-2 bg-charcoal/45 px-[10px] pb-[calc(24px+env(safe-area-inset-bottom))]">
          <div role="dialog" aria-label="사진 추가 방법" className="mx-auto w-full max-w-[410px] overflow-hidden rounded-[16px] bg-white">
            <span className="block px-4 pb-[10px] pt-[14px] text-center text-[13px] text-sub">내 사진을 어떻게 추가할까요?</span>
            <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 border-t border-line text-[16px]">
              <IconCamera size={20} />
              사진 촬영
              <input type="file" accept="image/*" capture="user" aria-label="사진 촬영" className="sr-only" onChange={(e) => void addFiles(e.target.files, "camera")} />
            </label>
            <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 border-t border-line text-[16px]">
              <IconGallery size={20} />
              갤러리에서 선택
              <input type="file" accept="image/*" multiple aria-label="갤러리에서 선택" className="sr-only" onChange={(e) => void addFiles(e.target.files, "gallery")} />
            </label>
          </div>
          <button type="button" onClick={() => setChooser(false)} className="mx-auto h-14 w-full max-w-[410px] rounded-[16px] bg-white text-[16px] font-bold">
            취소
          </button>
        </div>
      ) : null}
    </>
  );
}

export { SLOT_ART };
