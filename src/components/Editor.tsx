"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { ImageGeneration } from "@/lib/types";
import { EXPRESSION_OPTIONS, POSE_OPTIONS, editOption } from "@/lib/image/presets";
import { MODE_LABEL } from "@/lib/image/modes";
import { buildGenerateForm, firstPersonPreview, recallInputs, rememberInputs } from "@/lib/image/session-inputs";
import { saveImageToDevice } from "@/lib/image/save-to-device";
import { generationSrc } from "@/lib/urls";
import { Confirm } from "@/components/ui";
import { IconBack, IconDownload, IconSpark, IconTrash } from "@/components/Icons";

type Props = { row: ImageGeneration; parent: ImageGeneration | null; imageConfigured: boolean };
type Phase = "idle" | "editing" | "regenerating" | "saving" | "deleting";

const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** 다시 만들기 입력이 없을 때 돌아갈 만들기 화면 */
function createHref(row: ImageGeneration) {
  if (row.mode === "situation") return "/create/scene";
  if (row.mode === "add_friend" || row.mode === "hairstyle" || row.mode === "background_swap") return `/create?mode=${row.mode}`;
  return "/create";
}

/** EDITOR-01 사진 편집 (디자인 최종안): 원본 비교 · 포즈/표정 · 변경 적용 · 다시 만들기 · 보관함에 저장 · 기기에 저장 */
export function Editor({ row, parent, imageConfigured }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"pose" | "expression">("pose");
  const [pose, setPose] = useState<string | null>(row.params?.pose ?? null);
  const [expression, setExpression] = useState<string | null>(row.params?.expression ?? null);
  const [compare, setCompare] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // 세션 입력 저장소는 클라이언트 메모리에만 있으므로 하이드레이션 뒤에 읽는다.
  const hydrated = useHydrated();
  const sessionInputs = hydrated ? recallInputs(row.id) : undefined;
  const sessionOriginal = firstPersonPreview(sessionInputs);
  const canRegenerate = Boolean(sessionInputs) || (row.mode === "edit" && Boolean(row.parent_id));

  const src = generationSrc(row.id, row.version, row.updated_at);
  const originalSrc = sessionOriginal ?? (parent ? generationSrc(parent.id, parent.version, parent.updated_at) : null);
  const isEdit = row.mode === "edit";
  const applied = isEdit && (row.params?.pose ?? null) === pose && (row.params?.expression ?? null) === expression;
  const unchanged = (row.params?.pose ?? null) === pose && (row.params?.expression ?? null) === expression;
  const friends = (row.params?.people ?? []).filter((p) => p.tag !== "self").map((p) => p.name).filter(Boolean);
  const tag = [row.place_tag, row.params?.companion, ...friends].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const busy = phase !== "idle";

  async function post(url: string, body?: BodyInit, json = true) {
    const res = await fetch(url, { method: "POST", ...(body ? { body } : {}), ...(json && body ? { headers: { "Content-Type": "application/json" } } : {}) });
    return (await res.json().catch(() => null)) as { ok: boolean; generationId?: string; message?: string } | null;
  }

  function goTo(id: string) {
    router.refresh();
    router.push(`/editor/${id}`);
  }

  async function applyEdit() {
    if (busy || unchanged || (!pose && !expression)) return;
    setPhase("editing");
    setError(null);
    try {
      const data = await post(`/api/images/${row.id}/edit`, JSON.stringify({ pose, expression }));
      if (!data?.ok || !data.generationId) {
        setError(data?.message ?? "편집에 실패했어요.");
        return;
      }
      const inputs = recallInputs(row.id);
      if (inputs) rememberInputs(data.generationId, inputs);
      goTo(data.generationId);
    } catch {
      setError("네트워크 오류로 편집하지 못했어요.");
    } finally {
      setPhase("idle");
    }
  }

  async function regenerate() {
    if (busy) return;
    const inputs = recallInputs(row.id);
    if (!inputs && !(isEdit && row.parent_id)) {
      router.push(createHref(row));
      return;
    }
    setPhase("regenerating");
    setError(null);
    try {
      const data = inputs ? await post("/api/images/generate", buildGenerateForm(inputs), false) : await post(`/api/images/${row.id}/regenerate`);
      if (!data?.ok || !data.generationId) {
        setError(data?.message ?? "다시 만들기에 실패했어요.");
        return;
      }
      if (inputs) rememberInputs(data.generationId, inputs);
      goTo(data.generationId);
    } catch {
      setError("네트워크 오류로 다시 만들지 못했어요.");
    } finally {
      setPhase("idle");
    }
  }

  async function keep(action: "overwrite" | "new") {
    setPhase("saving");
    setError(null);
    try {
      const data = await post(`/api/images/${row.id}/keep`, JSON.stringify({ action }));
      if (!data?.ok) {
        setError(data?.message ?? "보관함에 저장하지 못했어요.");
        return;
      }
      setKeepOpen(false);
      router.refresh();
      router.push("/album");
    } catch {
      setError("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setPhase("idle");
    }
  }

  function save() {
    if (busy) return;
    if (parent) setKeepOpen(true);
    else void keep("new");
  }

  async function saveToDevice() {
    setNotice(null);
    try {
      const how = await saveImageToDevice(src, `nado-eoreun-${row.id.slice(0, 8)}`);
      setNotice(how === "shared" ? "공유 시트에서 「이미지 저장」을 고르면 사진 앱에 저장돼요." : "기기에 저장했어요 (다운로드).");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "저장에 실패했어요.");
    }
  }

  async function remove() {
    setPhase("deleting");
    try {
      const res = await fetch(`/api/images/${row.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { ok: boolean; message?: string } | null;
      if (!data?.ok) {
        setError(data?.message ?? "삭제에 실패했어요.");
        return;
      }
      router.refresh();
      router.replace("/album");
    } finally {
      setPhase("idle");
      setDeleteOpen(false);
    }
  }

  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/album");
  }

  const options = tab === "pose" ? POSE_OPTIONS : EXPRESSION_OPTIONS;
  const current = tab === "pose" ? pose : expression;
  const summary = `포즈: ${editOption(POSE_OPTIONS, pose)?.label ?? "그대로"} · 표정: ${editOption(EXPRESSION_OPTIONS, expression)?.label ?? "그대로"}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-charcoal pb-[calc(28px+env(safe-area-inset-bottom))] text-cream">
      <div className="safe-top" />
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <button type="button" onClick={back} aria-label="뒤로" className="flex h-11 w-11 items-center justify-center">
          <IconBack />
        </button>
        <h1 className="text-[17px] font-bold">사진 편집</h1>
        <button type="button" onClick={save} disabled={busy} className="flex h-9 items-center rounded-[18px] bg-cream px-[14px] text-[13px] font-bold text-charcoal disabled:opacity-50">
          저장
        </button>
      </header>

      <div className="flex items-center justify-between px-4 pb-[10px] pt-1">
        <span className="text-[13px] text-mist">{compare ? "원본 사진" : isEdit ? `편집본 v${row.version}` : "새로 생성한 사진"}</span>
        <button type="button" aria-pressed={compare} disabled={!originalSrc} onClick={() => setCompare((v) => !v)} className="h-8 rounded-[16px] bg-dusk px-3 text-[12px] text-cream disabled:opacity-40" title={originalSrc ? undefined : "원본은 생성한 세션에서만 비교할 수 있어요"}>
          {compare ? "생성본 보기" : "원본 비교"}
        </button>
      </div>

      <div className="relative mx-4 aspect-[3/4] shrink-0 overflow-hidden rounded-[22px] bg-dusk" data-testid="generation-result" data-generation-id={row.id}>
        <img src={compare && originalSrc ? originalSrc : src} alt={compare ? "원본 사진" : "생성 결과"} decoding="async" className="absolute inset-0 h-full w-full object-contain" />
        {!compare ? (
          <span className="absolute left-[14px] top-[14px] flex h-[30px] items-center gap-1 rounded-[15px] bg-charcoal px-3 text-[12px] text-cream">
            <IconSpark size={14} className="text-coral" strokeWidth={2} />
            AI 생성
          </span>
        ) : null}
        {tag && !compare ? <span className="absolute right-[14px] top-[14px] flex h-[30px] max-w-[60%] items-center truncate rounded-[15px] bg-white px-3 text-[12px] text-charcoal">{tag}</span> : null}
        {busy && phase !== "saving" && phase !== "deleting" ? (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal/70 text-[14px] font-bold">
            <span aria-hidden className="spinner" />
            {phase === "editing" ? "편집을 적용하는 중…" : "다시 만드는 중…"}
            <span className="px-8 text-center text-[12px] font-normal text-mist">실제 모델이 만드는 중이에요. 보통 수십 초 걸려요.</span>
          </div>
        ) : null}
      </div>
      <p className="px-4 pt-2 text-[11px] text-mist/80">{MODE_LABEL[row.mode]} · AI 합성 이미지는 실제 촬영·치료·위치의 증빙이 아니에요.</p>

      <div role="tablist" aria-label="편집 도구" className="flex gap-2 px-4 pb-[10px] pt-[18px]">
        {(["pose", "expression"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-10 rounded-[20px] px-[18px] text-[14px] ${tab === t ? "bg-cream font-bold text-charcoal" : "border border-sub text-mist"}`}>
            {t === "pose" ? "포즈 변경" : "표정 변경"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 px-4">
        {options.map((o) => {
          const on = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              disabled={busy || !imageConfigured}
              onClick={() => (tab === "pose" ? setPose(on ? null : o.id) : setExpression(on ? null : o.id))}
              className={`h-11 rounded-[14px] border-2 px-4 text-[14px] disabled:opacity-60 ${on ? "border-coral bg-coral font-bold text-charcoal" : "border-dusk bg-dusk text-mist"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <section aria-label="선택한 편집" className="mx-4 mt-4 flex flex-col gap-[10px] rounded-[18px] bg-dusk px-4 py-[14px]">
        <div className="flex justify-between text-[13px]">
          <span className="text-mist">선택한 편집</span>
          <span className={`font-bold ${applied ? "text-[#9FE1CB]" : "text-petal"}`}>{applied ? "적용됨" : "미적용"}</span>
        </div>
        <span className="text-[15px] font-bold">{summary}</span>
        <button type="button" onClick={applyEdit} disabled={busy || unchanged || (!pose && !expression) || !imageConfigured} className="h-[46px] rounded-[14px] bg-cream text-[14px] font-bold text-charcoal disabled:opacity-50">
          {phase === "editing" ? "적용 중…" : "변경 적용"}
        </button>
        <span className="text-[11px] text-mist/80">변경 적용은 이 사진을 바탕으로 새 버전을 만들어요 (이미지 생성 1회).</span>
      </section>

      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-[14px] bg-[#5a3a3a] px-4 py-3 text-[13px] font-bold text-cream">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-[10px] px-4 pt-4">
        <button type="button" onClick={regenerate} disabled={busy || !imageConfigured} className="h-[52px] rounded-[16px] bg-dusk text-[15px] font-bold text-cream disabled:opacity-50">
          {phase === "regenerating" ? "만드는 중…" : "다시 만들기"}
        </button>
        <button type="button" onClick={save} disabled={busy} className="h-[52px] rounded-[16px] bg-coral text-[15px] font-black text-charcoal disabled:opacity-50">
          {phase === "saving" ? "저장 중…" : "보관함에 저장"}
        </button>
      </div>
      {hydrated && !canRegenerate ? <p className="px-4 pt-2 text-center text-[11px] text-mist/80">원본 사진은 저장하지 않아서, 다시 만들기를 누르면 사진을 다시 고르는 화면으로 가요.</p> : null}

      <div className="flex items-center justify-between px-5 pt-5 text-[13px]">
        <button type="button" onClick={saveToDevice} className="flex h-10 items-center gap-1.5 font-bold text-mist">
          <IconDownload size={16} />
          기기에 저장
        </button>
        <Link href="/album" className="flex h-10 items-center text-mist">
          보관함 보기
        </Link>
        <button type="button" onClick={() => setDeleteOpen(true)} disabled={busy} className="flex h-10 items-center gap-1 text-petal">
          <IconTrash size={16} />
          삭제
        </button>
      </div>
      {notice ? (
        <p role="status" className="px-4 pt-1 text-center text-[12px] text-mist">
          {notice}
        </p>
      ) : null}

      {keepOpen ? (
        <>
          <div className="sheet-backdrop z-[70]" onClick={() => (busy ? null : setKeepOpen(false))} aria-hidden />
          <div role="dialog" aria-modal="true" aria-labelledby="keep-title" className="fixed inset-x-4 top-1/2 z-[71] mx-auto max-w-[360px] -translate-y-1/2 rounded-[24px] bg-white p-5 text-charcoal shadow-xl">
            <p id="keep-title" className="text-[17px] font-black">
              어떻게 저장할까요?
            </p>
            <p className="mt-1 text-[13px] text-sub">원래 사진을 이 편집본으로 바꾸거나, 둘 다 남길 수 있어요.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={() => keep("overwrite")} disabled={busy} className="btn btn-dark w-full">
                덮어쓰기
              </button>
              <button type="button" onClick={() => keep("new")} disabled={busy} className="btn btn-coral w-full">
                새 버전으로 저장
              </button>
              <button type="button" onClick={() => setKeepOpen(false)} disabled={busy} className="btn btn-white w-full">
                취소
              </button>
            </div>
          </div>
        </>
      ) : null}

      <Confirm open={deleteOpen} title="이 사진을 삭제할까요?" body="보관함과 저장소에서 지워지고 복구할 수 없어요." confirmLabel="삭제" danger busy={phase === "deleting"} onConfirm={remove} onCancel={() => setDeleteOpen(false)} />
    </div>
  );
}
