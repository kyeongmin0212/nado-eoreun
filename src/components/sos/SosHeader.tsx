import Link from "next/link";
import { IconClose } from "@/components/Icons";

export type SosPhase = "ready" | "sent" | "cancelled";

/** SOS-01/03 머리말: 왼쪽 닫기 · 「SOS」 · 단계 알약 */
export function SosHeader({ phase }: { phase: SosPhase }) {
  const pill = phase === "sent" ? "bg-ok-bg text-ok" : "bg-dusk text-mist";
  const label = phase === "sent" ? "발송 완료" : phase === "cancelled" ? "요청 취소됨" : "발송 준비";
  return (
    <header className="flex min-h-[64px] items-center justify-between pt-2">
      <span className="flex items-center gap-2">
        <Link href="/" aria-label="닫기" className="-ml-[10px] flex h-11 w-11 items-center justify-center">
          <IconClose />
        </Link>
        <h1 className="text-[20px] font-black">SOS</h1>
      </span>
      <span data-testid="sos-phase" className={`rounded-[12px] px-[10px] py-1 text-[12px] font-bold ${pill}`}>
        {label}
      </span>
    </header>
  );
}
