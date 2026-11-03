"use client";

import { useEffect, useState } from "react";
import { casualSubject } from "@/lib/copy";

type Target = { id: "kakao" | "sms" | "insta"; label: string; mark: string; bg: string; fg: string; note: string; sent: string };

const TARGETS: Target[] = [
  { id: "kakao", label: "카카오톡", mark: "K", bg: "#FEE500", fg: "#3A1D1D", note: "링크를 복사하고 카카오톡을 열었어요. 친구 채팅방에 붙여넣어 주세요.", sent: "카카오톡으로 보낼 초대 링크를 복사했어요. 친구가 수락하면 목록에 추가돼요." },
  { id: "sms", label: "메시지", mark: "✉", bg: "#DDF2E6", fg: "#1C5B38", note: "초대 문구가 들어간 메시지 창을 열었어요.", sent: "메시지로 초대 링크를 보냈어요. 친구가 수락하면 목록에 추가돼요." },
  { id: "insta", label: "인스타 DM", mark: "◎", bg: "#FDEDE8", fg: "#8A3A2E", note: "링크를 복사하고 인스타그램 DM을 열었어요. 대화창에 붙여넣어 주세요.", sent: "인스타 DM으로 보낼 초대 링크를 복사했어요. 친구가 수락하면 목록에 추가돼요." },
];

async function copyText(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // 아래 대체 방법
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** FRIEND-01 「초대 링크 보내기」 → 초대 시트(링크 복사 · 카카오톡 · 메시지 · 인스타 DM). 링크는 7일 유효. */
export function InviteSection({ myName }: { myName: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <section aria-label="친구 초대하기" className="flex flex-col gap-[10px] rounded-[18px] border border-line bg-white p-4">
      <h2 className="text-[15px] font-bold">친구 초대하기</h2>
      <p className="text-[13px] leading-[1.5] text-sub">친구가 직접 사진을 등록하고 사용 권한을 승인하면 함께 AI 사진을 만들 수 있어요. 친구 관계와 사진 사용 동의는 따로 관리돼요.</p>
      <button type="button" onClick={() => setOpen(true)} className="h-[50px] rounded-[14px] bg-charcoal text-[15px] font-bold text-cream">
        초대 링크 보내기
      </button>
      {sent ? (
        <p role="status" className="rounded-[10px] bg-ok-bg px-3 py-2 text-[13px] text-ok">
          {sent}
        </p>
      ) : null}
      {open ? <InviteSheet myName={myName} onClose={() => setOpen(false)} onSent={setSent} /> : null}
    </section>
  );
}

function InviteSheet({ myName, onClose, onSent }: { myName: string; onClose: () => void; onSent: (s: string) => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/invites", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { ok: boolean; url?: string; message?: string } | null;
        if (!alive) return;
        if (!data?.ok || !data.url) setError(data?.message ?? "초대 링크를 만들지 못했어요.");
        else setLink(data.url);
      } catch {
        if (alive) setError("네트워크 오류로 초대 링크를 만들지 못했어요.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const message = link ? `${casualSubject(myName)} 나도으른에 초대했어! 링크를 눌러서 사진을 등록하고 같이 써 줘 (7일 동안 유효) ${link}` : "";

  async function copyLink() {
    if (!link) return;
    const ok = await copyText(link);
    setCopied(ok);
    setNote(ok ? "초대 링크를 복사했어요. 원하는 곳에 붙여넣어 주세요." : "복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.");
  }

  async function share(t: Target) {
    if (!link) return;
    if (t.id !== "sms") {
      const ok = await copyText(message);
      if (ok) setCopied(true);
    }
    setNote(t.note);
    onSent(t.sent);
    const href = t.id === "kakao" ? "kakaotalk://launch" : t.id === "insta" ? "instagram://direct-inbox" : `sms:?&body=${encodeURIComponent(message)}`;
    window.location.assign(href);
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="친구 초대하기" className="sheet sheet-in gap-[14px] px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-3">
        <div aria-hidden className="sheet-handle" />
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-black">친구 초대하기</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-[10px] h-11 w-11 text-[22px]">
            ×
          </button>
        </div>
        <p className="text-[13px] leading-[1.5] text-sub">링크를 받은 친구가 앱에서 사진을 등록하고 사용을 승인하면 함께할 수 있어요. 링크는 7일 동안 유효해요.</p>
        <div className="flex items-center gap-2 rounded-[14px] border border-line bg-warm py-1.5 pl-[14px] pr-1.5">
          <span data-testid="invite-link" className="min-w-0 flex-1 truncate text-[14px]">
            {error ?? (link ? link.replace(/^https?:\/\//, "") : "링크 만드는 중…")}
          </span>
          <button type="button" onClick={copyLink} disabled={!link} className={`h-10 shrink-0 rounded-[10px] px-4 text-[13px] font-bold disabled:opacity-50 ${copied ? "bg-ok-bg text-ok" : "bg-charcoal text-warm"}`}>
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TARGETS.map((t) => (
            <button key={t.id} type="button" onClick={() => void share(t)} disabled={!link} aria-label={`${t.label}(으)로 초대 링크 보내기`} className="flex flex-col items-center gap-1.5 py-1 text-[12px] disabled:opacity-50">
              <span aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] text-[18px] font-black" style={{ background: t.bg, color: t.fg }}>
                {t.mark}
              </span>
              {t.label}
            </button>
          ))}
        </div>
        {note ? (
          <p role="status" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] leading-[1.5] text-ink">
            {note}
          </p>
        ) : null}
      </div>
    </>
  );
}
