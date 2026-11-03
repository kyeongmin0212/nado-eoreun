"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export const INTRO_FLAG = "nado:intro-shown";

const VISIBLE_MS = 1100;
const FADE_MS = 280;

type Decision = "show" | "hidden";
let decided: Decision | null = null;

function clientSnapshot(): Decision {
  if (decided) return decided;
  try {
    if (sessionStorage.getItem(INTRO_FLAG) === "1") {
      decided = "hidden";
    } else {
      sessionStorage.setItem(INTRO_FLAG, "1");
      decided = "show";
    }
  } catch {
    decided = "show";
  }
  return decided;
}
const serverSnapshot = (): Decision | "pending" => "pending";
const noopSubscribe = () => () => {};

/**
 * SPLASH-01 시작 화면: 앱 실행(세션)당 한 번, 홈 상단과 같은 그라데이션 위에 앱 아이콘·이름을 잠깐 보여준다.
 * 터치를 막지 않으며(pointer-events-none) SOS 알림으로 들어오면 생략한다.
 */
export function IntroGate() {
  const decision = useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (decision !== "show") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setFading(true), VISIBLE_MS);
    const t2 = setTimeout(() => {
      decided = "hidden";
      setDone(true);
    }, VISIBLE_MS + (reduce ? 0 : FADE_MS));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      decided = "hidden";
    };
  }, [decision]);

  if (decision === "hidden" || done) return null;
  return (
    <div role="presentation" aria-hidden className={`bg-splash pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center ${fading ? "splash-out" : ""}`}>
      <div className="splash-in flex flex-col items-center">
        <img src="/brand/icon-256.png" alt="" className="h-[96px] w-[96px] rounded-[24px] shadow-[0_18px_36px_rgba(46,42,51,0.22)]" />
        <p className="mt-5 text-[30px] font-black tracking-tight text-charcoal">
          나도<span className="text-coral">으른</span>
        </p>
        <p className="mt-1 text-[15px] text-sub">오늘도 으른답게</p>
      </div>
      <p className="absolute bottom-[calc(40px+env(safe-area-inset-bottom))] text-[12px] font-bold tracking-[0.3em] text-rust">NADO EOREUN</p>
    </div>
  );
}
