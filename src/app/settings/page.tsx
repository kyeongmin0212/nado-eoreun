import { redirect } from "next/navigation";

/** 이전 경로 호환: 메뉴·설정 → 마이페이지 */
export default function SettingsRedirect() {
  redirect("/my");
}
