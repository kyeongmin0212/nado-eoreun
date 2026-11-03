import type { DataBackend } from "@/lib/data/types";
import { dataBackend } from "@/lib/env";

let instance: DataBackend | null = null;

/** 환경에 맞는 데이터 백엔드. DATA_BACKEND=local 이면 docker 모드, 아니면 Supabase. */
export async function getData(): Promise<DataBackend> {
  if (instance) return instance;
  if (dataBackend() === "local") {
    const { LocalBackend } = await import("@/lib/data/local/adapter");
    instance = new LocalBackend();
  } else {
    const { SupabaseBackend } = await import("@/lib/data/supabase");
    instance = new SupabaseBackend();
  }
  return instance;
}
