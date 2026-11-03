/** 제품 카피. 디자인 최종안(docs/DESIGN_FINAL.md)과 기능명세서(최종)의 문구를 따른다. */
import QUOTES from "@/lib/quotes.json";

export const APP_NAME = "나도으른";
export const APP_VERSION = "1.1.0";
export const APP_TAGLINE = "오늘도 으른답게, 마음 편히 놀다 와";
export const APP_SUBLINE = "통금 걱정은 줄이고, 친구와 함께 오늘의 상황을 미리 준비해요";

/** 홈 '오늘의 한마디' 30개 (디자인 원본 그대로) */
export const HOME_QUOTES: string[] = QUOTES as string[];

/** SOS 알림 제목 (알림 배너 디자인) */
export const SOS_TITLE = "비상사태! 엄마 전화다! 어셈블!";
/** SOS 요청에 저장하는 고정 문구 */
export const SOS_MESSAGE = SOS_TITLE;

export const SOS_BAR_LABEL = "SOS 보내기";
export const SOS_SEND_LABEL = "SOS";
export const CALL_LABEL = "실제 동행인에게 전화하기";
export const RESPOND_FALLBACK_LABEL = "확인했어 · 전화할게";

export const TABS = [
  { href: "/", label: "홈" },
  { href: "/create", label: "만들기" },
  { href: "/album", label: "보관함" },
  { href: "/friends", label: "친구" },
] as const;

function lastHangul(name: string): number | null {
  const t = name.trim();
  const c = t.charCodeAt(t.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? c : null;
}
function hasJong(name: string): boolean {
  const c = lastHangul(name);
  return c !== null && (c - 0xac00) % 28 !== 0;
}

/** 부르는 이름: 받침 있으면 '지은이', 없으면 '민지', 한글이 아니면 '○○님' */
export function casualName(name: string): string {
  const t = name.trim();
  if (lastHangul(t) === null) return `${t}님`;
  return hasJong(t) ? `${t}이` : t;
}
/** 주격: '지은이가'/'민지가' (부르는 이름 + 가) */
export function casualSubject(name: string): string {
  const c = casualName(name);
  return c.endsWith("님") ? `${c}이` : `${c}가`;
}
/** 짧은 주격: '수진이'/'민지가'/'○○님이' */
export function subject(name: string): string {
  const t = name.trim();
  if (lastHangul(t) === null) return `${t}님이`;
  return hasJong(t) ? `${t}이` : `${t}가`;
}
/** '지은이와'/'민지와'/'○○님과' */
export function withName(name: string): string {
  const c = casualName(name);
  return lastHangul(c) !== null && hasJong(c) ? `${c}과` : `${c}와`;
}
/** 소유격: '지은이의' */
export function ofName(name: string): string {
  return `${casualName(name)}의`;
}
/** 호격 인사 '지은아' / '민지야' / '○○님' */
export function vocative(name: string): string {
  const t = name.trim();
  if (lastHangul(t) === null) return `${t}님`;
  return hasJong(t) ? `${t}아` : `${t}야`;
}

/** SOS 알림 본문 (알림 배너 디자인) */
export function sosBody(senderName: string): string {
  return `${casualSubject(senderName)} SOS를 보냈어요. 눌러서 바로 확인해 줘!`;
}
