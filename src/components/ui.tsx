"use client";

import type { ReactNode } from "react";
import { IconClose } from "@/components/Icons";

/** 선택 칩 */
export function Chip({ on, dark, children, onClick, disabled, ariaLabel }: { on?: boolean; dark?: boolean; children: ReactNode; onClick?: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button type="button" aria-pressed={on ? true : false} aria-label={ariaLabel} onClick={onClick} disabled={disabled} className={`chip ${dark ? "border-dusk bg-dusk text-mist" : ""}`}>
      {children}
    </button>
  );
}

/** 세그먼트 컨트롤 */
export function Segment<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-peach p-1">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={`h-10 rounded-[10px] text-[14px] ${value === o.id ? "bg-white font-bold text-charcoal" : "text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 토글 스위치 */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="toggle" />;
}

/** 바텀시트 */
export function Sheet({ open, onClose, title, ariaLabel, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; ariaLabel?: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)} className="sheet sheet-in">
        <div aria-hidden className="sheet-handle mt-[10px]" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
          <div className="min-w-0">{title}</div>
          <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoal">
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">{children}</div>
        {footer ? <div className="px-5 pb-4 pt-2">{footer}</div> : null}
      </div>
    </>
  );
}

/** 간단한 확인 대화상자 */
export function Confirm({ open, title, body, confirmLabel, danger, busy, onConfirm, onCancel }: { open: boolean; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop z-[70]" onClick={busy ? undefined : onCancel} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-x-4 top-1/2 z-[71] mx-auto max-w-[360px] -translate-y-1/2 rounded-[24px] bg-white p-5 text-charcoal shadow-xl">
        <p id="confirm-title" className="text-[17px] font-extrabold">{title}</p>
        {body ? <div className="mt-2 text-[14px] text-sub">{body}</div> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-white">
            취소
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} aria-busy={busy} className={`btn ${danger ? "bg-danger text-white" : "btn-dark"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

export function Notice({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "danger" | "dark" }) {
  const cls = tone === "danger" ? "bg-peach text-danger" : tone === "dark" ? "bg-dusk text-cream" : "bg-peach text-ink";
  return <p className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${cls}`}>{children}</p>;
}
