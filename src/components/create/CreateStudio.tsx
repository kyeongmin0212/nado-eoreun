"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UsablePerson } from "@/lib/data/types";
import type { PreparedImage } from "@/lib/image/client-prepare";
import { prepareImage } from "@/lib/image/client-prepare";
import { DIRECT_MODES, modeById, type ModeDefinition } from "@/lib/image/modes";
import { PLACE_PRESETS, SITUATION_CATEGORIES, SITUATION_PRESETS, situationPreset, type SituationCategory } from "@/lib/image/presets";
import { buildGenerateForm, rememberInputs, type GenerationInputs, type PhotoPick } from "@/lib/image/session-inputs";
import { profilePhotoSrc } from "@/lib/urls";
import { UploadSheet } from "@/components/create/UploadSheet";
import { Notice } from "@/components/ui";
import { IconGallery, IconHair, IconSpark, IconUpload } from "@/components/Icons";

type Tab = "direct" | "scene";
type Props = { tab: Tab; initialMode: string | null; imageConfigured: boolean; people: UsablePerson[] };

const SCENE_FILLS = ["#F9D9CF", "#E9DDE0", "#FDEDE8", "#EDE6F0"];

/** PHOTO-01 직접 만들기(/create) · PHOTO-02 상황으로 만들기(/create/scene) — 디자인 최종안 */
export function CreateStudio({ tab, initialMode, imageConfigured, people }: Props) {
  const router = useRouter();
  const [modeId, setModeId] = useState<string>(initialMode && DIRECT_MODES.some((m) => m.id === initialMode) ? initialMode : "background_swap");
  const [picks, setPicks] = useState<PhotoPick[]>([]);
  const [hair, setHair] = useState<PreparedImage | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [category, setCategory] = useState<SituationCategory>("daily");
  const [scene, setScene] = useState<string>("study");
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const mode: ModeDefinition = (tab === "scene" ? modeById("situation") : modeById(modeId)) ?? DIRECT_MODES[0];

  const missing = useMemo(() => {
    const list: string[] = [];
    if (picks.length < mode.minPeople) list.push(mode.minPeople === 1 ? "사진 1장" : "내 사진 1장 + 친구 사진 1장");
    else if (mode.needsSelfAndOther && (!picks.some((p) => p.tag === "self") || !picks.some((p) => p.tag !== "self"))) list.push("내 사진과 친구 사진 각 1장");
    if (mode.hairPhoto && !hair) list.push("참고 헤어 사진");
    if (mode.textRole === "background" && !place && text.trim().length < 2) list.push("장소 프리셋 또는 추가 요청사항");
    return list;
  }, [picks, mode, hair, place, text]);

  const busy = phase === "generating";
  const canGenerate = missing.length === 0 && !busy && imageConfigured;

  async function generate() {
    if (!canGenerate) return;
    setError(null);
    setPhase("generating");
    const controller = new AbortController();
    abortRef.current = controller;
    const inputs: GenerationInputs = { mode: mode.id, people: picks, hair: mode.hairPhoto ? hair : null, preset: mode.placePresets ? place : null, situation: mode.id === "situation" ? scene : null, text };
    try {
      const res = await fetch("/api/images/generate", { method: "POST", body: buildGenerateForm(inputs), signal: controller.signal });
      const data = (await res.json().catch(() => null)) as { ok: boolean; generationId?: string; message?: string } | null;
      if (!data) {
        setError(`서버 응답을 읽지 못했어요 (HTTP ${res.status}).`);
        return;
      }
      if (!data.ok || !data.generationId) {
        setError(data.message ?? "생성에 실패했어요.");
        return;
      }
      rememberInputs(data.generationId, inputs);
      // 보관함·홈의 캐시된 화면을 비우고 편집 화면으로 간다.
      router.refresh();
      router.push(`/editor/${data.generationId}`);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError("네트워크 오류로 생성 요청이 끝나지 않았어요. 입력은 유지되니 다시 시도해 주세요.");
    } finally {
      setPhase("idle");
      abortRef.current = null;
    }
  }

  async function onHairFile(file: File | undefined) {
    if (!file) return;
    try {
      setHair(await prepareImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 불러오지 못했어요.");
    }
  }

  const scenes = SITUATION_PRESETS.filter((s) => s.category === category);
  const chosen = situationPreset(scene);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="만들기 방식" className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-peach p-1">
        <Link href="/create" replace role="tab" aria-selected={tab === "direct"} className={`flex h-10 items-center justify-center rounded-[10px] text-[14px] ${tab === "direct" ? "bg-white font-bold text-charcoal" : "text-ink"}`}>
          직접 만들기
        </Link>
        <Link href="/create/scene" replace role="tab" aria-selected={tab === "scene"} className={`flex h-10 items-center justify-center rounded-[10px] text-[14px] ${tab === "scene" ? "bg-white font-bold text-charcoal" : "text-ink"}`}>
          상황으로 만들기
        </Link>
      </div>

      {!imageConfigured ? <Notice>이미지 생성 연결 대기: OpenAI API 키가 설정되면 실제 생성이 가능해요. 샘플 결과는 표시하지 않아요.</Notice> : null}

      {tab === "direct" ? (
        <>
          <h2 className="text-[16px] font-bold">어떤 사진을 만들까요?</h2>
          <div className="grid grid-cols-3 gap-2">
            {DIRECT_MODES.map((m) => {
              const on = m.id === modeId;
              return (
                <button key={m.id} type="button" aria-pressed={on} disabled={busy} onClick={() => setModeId(m.id)} className={`flex min-h-[92px] flex-col items-start gap-1 rounded-[16px] border-2 px-[10px] py-3 text-left ${on ? "border-coral bg-peach" : "border-line bg-white"}`}>
                  <span className="text-[14px] font-bold leading-[1.3]">{m.title}</span>
                  <span className="text-[11px] leading-[1.35] text-sub">{m.description}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <h2 className="text-[16px] font-bold">어떤 상황을 만들까요?</h2>
          <div role="group" aria-label="상황 카테고리" className="grid grid-cols-3 gap-1.5">
            {SITUATION_CATEGORIES.map((c) => {
              const on = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => {
                    setCategory(c.id);
                    setScene(SITUATION_PRESETS.find((s) => s.category === c.id)?.id ?? scene);
                  }}
                  className={`h-[38px] rounded-[19px] text-[13px] ${on ? "bg-charcoal font-bold text-cream" : "border border-line bg-white text-sub"}`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            {scenes.map((s, i) => {
              const on = s.id === scene;
              return (
                <button key={s.id} type="button" aria-pressed={on} disabled={busy} onClick={() => setScene(s.id)} className={`flex flex-col overflow-hidden rounded-[16px] border-2 bg-white p-0 text-left ${on ? "border-coral" : "border-line"}`}>
                  <span aria-hidden className="block h-[96px] w-full bg-cover bg-center" style={{ backgroundColor: SCENE_FILLS[i % SCENE_FILLS.length], backgroundImage: `url(/scenes/${s.id}.svg)` }} />
                  <span className="px-[10px] pb-[10px] pt-2 text-[13px] font-bold">{s.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <section aria-label="사진 업로드" className="flex flex-col gap-[10px] rounded-[18px] border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">사진 업로드</h2>
          {mode.minPeople > 0 ? <span className="badge badge-sm badge-required">필수</span> : null}
        </div>
        <div className="dropzone">
          {picks.length === 0 ? (
            <>
              {tab === "direct" ? <IconUpload size={28} className="text-coral" strokeWidth={2} /> : null}
              <span className="text-[14px] font-bold">{tab === "direct" ? mode.uploadHint : "사진을 추가해 주세요"}</span>
              <span className="text-[12px] text-sub">내 사진 · 동의한 친구 사진</span>
            </>
          ) : (
            <>
              <ul aria-label="고른 사진" className="flex flex-wrap justify-center gap-2">
                {picks.map((p) => (
                  <li key={p.kind === "file" ? p.localId : p.id} className="relative">
                    <img src={p.kind === "file" ? p.image.previewUrl : profilePhotoSrc(p.id, p.createdAt, 160)} alt={`${p.personName} 사진`} className="h-16 w-16 rounded-[12px] bg-blush object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate rounded-b-[12px] bg-charcoal/60 px-1 text-center text-[10px] font-bold text-white">{p.personName}</span>
                  </li>
                ))}
              </ul>
              <span className="text-[12px] text-sub">{picks.length}장 선택됨</span>
            </>
          )}
          <button type="button" onClick={() => setSheetOpen(true)} disabled={busy} className="pill-btn mt-1">
            사진 선택하기
          </button>
        </div>
        {mode.needsSelfAndOther ? <span className="text-[12px] text-sub">내 사진 1장과 사용 동의한 친구의 사진 1장 이상을 골라 주세요.</span> : null}
      </section>

      {tab === "direct" && mode.hairPhoto ? (
        <section aria-label="참고 헤어 사진" className="flex flex-col gap-[10px] rounded-[18px] border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">참고 헤어 사진</h2>
            <span className="badge badge-sm badge-required">필수</span>
          </div>
          <span className="text-[12px] text-sub">원하는 헤어스타일이 잘 보이는 사진 1장을 갤러리에서 골라 주세요</span>
          {hair ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-peach p-[10px]">
              <img src={hair.previewUrl} alt="참고 헤어 사진 미리보기" className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-bold text-ink">갤러리 사진</span>
                <span className="text-[12px] text-ink">이 헤어스타일로 바꿔요</span>
              </span>
              <button type="button" onClick={() => setHair(null)} disabled={busy} className="h-9 px-2 text-[12px] text-ink underline">
                빼기
              </button>
            </div>
          ) : null}
          <label className={`flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[22px] border border-line bg-white text-[14px] ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {hair ? <IconGallery size={18} className="text-coral" /> : <IconHair size={18} className="text-coral" />}
            {hair ? "갤러리 다시 열기" : "갤러리에서 참고 사진 고르기"}
            <input type="file" accept="image/*" aria-label="참고 헤어 사진 고르기" className="sr-only" onChange={(e) => void onHairFile(e.target.files?.[0])} />
          </label>
          <span className="text-[12px] text-sub">참고 사진은 헤어스타일을 따라 할 때만 쓰이고 저장되지 않아요</span>
        </section>
      ) : null}

      <section aria-label="세부 설정" className="flex flex-col gap-[10px] rounded-[18px] border border-line bg-white p-4">
        <h2 className="text-[15px] font-bold">세부 설정</h2>
        {tab === "direct" ? (
          <>
            <span className="text-[12px] text-sub">장소 프리셋 · 설정 안 함을 고르면 추가 요청사항만 반영해요</span>
            <div role="group" aria-label="장소 프리셋" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={place === null} disabled={busy} onClick={() => setPlace(null)} className="chip">
                설정 안 함
              </button>
              {PLACE_PRESETS.map((p) => (
                <button key={p.id} type="button" aria-pressed={place === p.id} disabled={busy} onClick={() => setPlace(p.id)} className="chip">
                  {p.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-0.5 rounded-[12px] bg-peach px-3 py-[10px]">
            <span className="text-[13px] font-bold text-ink">선택된 상황: {chosen?.label ?? "-"}</span>
            <span className="text-[12px] text-ink">촬영 시점과 장면 구성이 자동 적용돼요</span>
          </div>
        )}
        <label className="label text-[12px]">
          추가 요청사항 (선택)
          <textarea rows={2} className="field text-[14px]" placeholder={mode.textPlaceholder} maxLength={300} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
        </label>
      </section>

      {error ? (
        <div role="alert" className="rounded-[16px] border border-[#f0c9c4] bg-white p-4">
          <p className="text-[14px] font-bold text-danger">{error}</p>
          <p className="mt-1 text-[12px] text-sub">고른 사진과 설정은 그대로 남아 있어요.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={generate} disabled={!canGenerate} aria-busy={busy} className="flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-[16px] bg-charcoal text-[16px] font-bold text-cream disabled:opacity-45">
          {busy ? <span aria-hidden className="spinner" /> : <IconSpark size={20} className="text-coral" strokeWidth={2} />}
          {busy ? "사진을 만드는 중…" : "사진 생성하기"}
        </button>
        {missing.length > 0 && !busy ? <p className="px-1 text-[12px] text-sub">필요한 입력: {missing.join(", ")}</p> : null}
        {busy ? (
          <p role="status" className="px-1 text-[12px] text-sub">
            실제 모델이 만드는 중이에요. 보통 수십 초 걸리니 화면을 유지해 주세요.
          </p>
        ) : (
          <p className="px-1 text-[12px] leading-relaxed text-sub">{mode.resultNote} 편집 화면의 결과에는 AI 생성 표시가 붙어요.</p>
        )}
      </div>

      <UploadSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={picks}
        people={people}
        onDone={(p) => {
          setPicks(p);
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
