import { redirect } from "next/navigation";

/** v1 경로 호환: 내역 → 보관함 */
export default function HistoryRedirect() {
  redirect("/album");
}
