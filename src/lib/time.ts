/** 날짜·시간 도우미. 제품 기준 시간대는 Asia/Seoul 이다 (서버·클라이언트 공통). */

export const APP_TZ = "Asia/Seoul";

/** YYYY-MM-DD (Asia/Seoul) */
export function todayKst(now: Date = new Date()): string {
  return dateKeyKst(now);
}

export function dateKeyKst(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 현재 Asia/Seoul 기준 시·분 */
export function nowHmKst(now: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { hour: get("hour") % 24, minute: get("minute") };
}

/** "HH:MM" → 분 */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** 분 → "HH:MM" */
export function minutesToHm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** "23:00" → "밤 11:00" 같은 한국어 표기 */
export function formatHmKo(hm: string): string {
  const total = hmToMinutes(hm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h < 5 ? "새벽" : h < 12 ? "오전" : h < 18 ? "오후" : "밤";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

/** "2026-10-29" → "10월 29일" (+ 오늘/내일 표시) */
export function formatDateKo(key: string, today: string = todayKst()): string {
  const [, m, d] = key.split("-").map((x) => Number(x));
  const base = `${m}월 ${d}일`;
  if (key === today) return `${base} (오늘)`;
  const diff = daysBetween(today, key);
  if (diff === 1) return `${base} (내일)`;
  return base;
}

export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const tb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((tb - ta) / 86_400_000);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && dateKeyUtc(d) === key;
}

function dateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 상황 상태: 날짜 범위 기준 */
export function situationStatus(targetDate: string, endDate: string | null, today: string = todayKst()): "active" | "scheduled" | "ended" {
  const end = endDate && endDate >= targetDate ? endDate : targetDate;
  if (today < targetDate) return "scheduled";
  if (today > end) return "ended";
  return "active";
}

/** 오늘 적용할 통금: 오늘 날짜의 임시 통금이 있으면 그것, 아니면 기본 통금 */
export function effectiveCurfew(base: string, overrideTime: string | null, overrideDate: string | null, today: string = todayKst()): string {
  return overrideTime && overrideDate === today ? overrideTime : base;
}
