import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isImageGatewayConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { Editor } from "@/components/Editor";

export const metadata: Metadata = { title: "사진 편집" };

/** EDITOR-01 */
export default async function EditorPage({ params }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/editor/${id}`);
  const data = await getData();
  const row = await data.getGeneration(user.id, id);
  if (!row) notFound();
  const parent = row.parent_id ? await data.getGeneration(user.id, row.parent_id) : null;
  return <Editor key={row.id} row={row} parent={parent} imageConfigured={isImageGatewayConfigured()} />;
}
