"use client";

import { useEffect, useState } from "react";
import { HOME_QUOTES } from "@/lib/copy";

/** 오늘의 한마디: 멘트 30개가 8초마다 무작위로 슬롯처럼 미끄러지며 바뀐다 (같은 멘트 연속 없음). */
export function QuoteTicker() {
  const n = HOME_QUOTES.length;
  const [q, setQ] = useState(0);
  useEffect(() => {
    const start = setTimeout(() => setQ(Math.floor(Math.random() * n)), 0);
    const t = setInterval(() => {
      setQ((cur) => {
        let k = Math.floor(Math.random() * (n - 1));
        if (k >= cur) k += 1;
        return k;
      });
    }, 8000);
    return () => {
      clearTimeout(start);
      clearInterval(t);
    };
  }, [n]);
  return (
    <div aria-label="오늘의 한마디" className="h-[62px] shrink-0 overflow-hidden" aria-live="off">
      <div style={{ transform: `translateY(-${q * 62}px)`, transition: "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {HOME_QUOTES.map((text, i) => (
          <p key={i} aria-hidden={i !== q} className="m-0 h-[62px] overflow-hidden text-[22px] font-bold leading-[31px] text-charcoal">
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}
