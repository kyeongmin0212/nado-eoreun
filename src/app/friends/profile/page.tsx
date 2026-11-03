import { redirect } from "next/navigation";

/** 이전 경로 호환: 내 AI 프로필 사진 관리 → 마이페이지 사진 관리 */
export default function ProfileRedirect() {
  redirect("/my?sheet=photos");
}
