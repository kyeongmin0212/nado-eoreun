import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

/** 결과 파일 보관 위치. docker 에서는 /data/storage, 로컬 개발은 ./.data/storage */
export function storageRoot(): string {
  return process.env.LOCAL_STORAGE_DIR || join(process.cwd(), ".data", "storage");
}

function resolveSafe(relPath: string): string {
  const root = storageRoot();
  // 저장 위치는 실행 시 환경변수로 정해진다. 빌드 추적 대상이 아니므로 Turbopack 추적에서 제외한다.
  const full = normalize(join(/* turbopackIgnore: true */ root, relPath));
  if (!full.startsWith(normalize(root))) throw new Error("잘못된 저장 경로");
  return full;
}

export async function putObject(relPath: string, bytes: Uint8Array): Promise<void> {
  const full = resolveSafe(relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function getObject(relPath: string): Promise<Uint8Array | null> {
  try {
    const buf = await readFile(resolveSafe(relPath));
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function removeObject(relPath: string): Promise<void> {
  await rm(resolveSafe(relPath), { force: true });
}

/** 사용자 폴더 전체 삭제 (회원 탈퇴) */
export async function removeDir(relDir: string): Promise<void> {
  if (!relDir || relDir === "." || relDir === "/") throw new Error("잘못된 삭제 경로");
  await rm(resolveSafe(relDir), { recursive: true, force: true });
}
