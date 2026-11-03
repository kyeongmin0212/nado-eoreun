import { redirect } from "next/navigation";

/** 이전 경로 호환: 공유 설정 → 마이페이지 공유 설정 */
export default function ShareRedirect() {
  redirect("/my?share=1");
}
