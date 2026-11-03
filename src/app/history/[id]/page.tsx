import { redirect } from "next/navigation";

/** v1 경로 호환: 내역 상세 → 편집기 */
export default async function HistoryDetailRedirect({ params }: PageProps<"/history/[id]">) {
  const { id } = await params;
  redirect(`/editor/${id}`);
}
