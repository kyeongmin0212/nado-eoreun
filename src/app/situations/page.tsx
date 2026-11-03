import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { todayKst } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { SituationPlanner } from "@/components/SituationPlanner";

export const metadata: Metadata = { title: "오늘의 상황" };

export default async function SituationsPage({ searchParams }: PageProps<"/situations">) {
  const sp = await searchParams;
  const user = await requireUser("/situations");
  const data = await getData();
  const [items, friends] = await Promise.all([data.listSituations(user.id), data.getFriends(user.id)]);
  const editId = typeof sp.edit === "string" ? sp.edit : null;
  return (
    <AppShell title="오늘의 상황" back="/">
      <SituationPlanner key={editId ?? "new"} initial={items} friends={friends} today={todayKst()} editId={editId} />
    </AppShell>
  );
}
