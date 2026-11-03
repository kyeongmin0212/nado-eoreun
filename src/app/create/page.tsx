import type { Metadata } from "next";
import { isImageGatewayConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { CreateStudio } from "@/components/create/CreateStudio";

export const metadata: Metadata = { title: "사진 만들기" };

/** PHOTO-01 직접 만들기 */
export default async function CreatePage({ searchParams }: PageProps<"/create">) {
  const sp = await searchParams;
  const user = await requireUser("/create");
  const data = await getData();
  const people = await data.listUsablePhotos(user.id);
  const mode = typeof sp.mode === "string" ? sp.mode : null;
  return (
    <AppShell eyebrow="NADO EOREUN · AI STUDIO" title="사진 만들기" tabs>
      <CreateStudio key={`direct-${mode ?? ""}`} tab="direct" initialMode={mode} imageConfigured={isImageGatewayConfigured()} people={people} />
    </AppShell>
  );
}
