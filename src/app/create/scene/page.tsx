import type { Metadata } from "next";
import { isImageGatewayConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { CreateStudio } from "@/components/create/CreateStudio";

export const metadata: Metadata = { title: "상황으로 만들기" };

/** PHOTO-02 상황으로 만들기 */
export default async function CreateScenePage() {
  const user = await requireUser("/create/scene");
  const data = await getData();
  const people = await data.listUsablePhotos(user.id);
  return (
    <AppShell eyebrow="NADO EOREUN · AI STUDIO" title="사진 만들기" tabs>
      <CreateStudio key="scene" tab="scene" initialMode={null} imageConfigured={isImageGatewayConfigured()} people={people} />
    </AppShell>
  );
}
