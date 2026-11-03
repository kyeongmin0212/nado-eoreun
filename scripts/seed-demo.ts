/**
 * 테스트 계정 3개 + 프로필 + 상호 친구 관계 + 사진 사용 동의 초기화 (중복 실행 가능).
 *
 * 실행: pnpm seed:demo            (기존 사용자의 비밀번호는 바꾸지 않음)
 *       pnpm seed:demo --update-password  (데모 이메일과 일치하는 기존 사용자에 한해 비밀번호를 .env 값으로 갱신)
 *
 * 필요한 환경변수(.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   DEMO_USER_{1,2,3}_EMAIL / _PASSWORD / _NAME(선택)
 *
 * 이 스크립트는 기존 사용자·사진·SOS 요청을 삭제하지 않는다.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local", override: false });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const updatePassword = process.argv.includes("--update-password");

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local).");
  process.exit(1);
}

type Demo = { index: number; email: string; password: string; name: string };

const demos: Demo[] = [1, 2, 3].map((i) => {
  const email = process.env[`DEMO_USER_${i}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`DEMO_USER_${i}_PASSWORD`];
  const name = process.env[`DEMO_USER_${i}_NAME`]?.trim() || `테스트 사용자 ${i}`;
  if (!email || !password) {
    console.error(`DEMO_USER_${i}_EMAIL / DEMO_USER_${i}_PASSWORD 가 비어 있습니다.`);
    process.exit(1);
  }
  if (password.length < 6) {
    console.error(`DEMO_USER_${i}_PASSWORD 는 6자 이상이어야 합니다 (Supabase 기본 정책).`);
    process.exit(1);
  }
  return { index: i, email, password, name };
});

if (new Set(demos.map((d) => d.email)).size !== 3) {
  console.error("세 테스트 계정의 이메일은 서로 달라야 합니다.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return { id: hit.id };
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(d: Demo): Promise<{ id: string; created: boolean }> {
  const existing = await findUserByEmail(d.email);
  if (existing) {
    if (updatePassword) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password: d.password });
      if (error) throw error;
      console.log(`  [${d.index}] 기존 사용자 — 비밀번호 갱신`);
    } else {
      console.log(`  [${d.index}] 기존 사용자 — 비밀번호 유지`);
    }
    return { id: existing.id, created: false };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { display_name: d.name, demo_account: true },
  });
  if (error || !data.user) throw error ?? new Error("createUser 실패");
  console.log(`  [${d.index}] 새 사용자 생성`);
  return { id: data.user.id, created: true };
}

async function main() {
  console.log("1/3 Auth 사용자 확인·생성");
  const ids: string[] = [];
  for (const d of demos) {
    const { id } = await ensureUser(d);
    ids.push(id);
  }

  console.log("2/3 프로필 upsert");
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      demos.map((d, i) => ({ id: ids[i], display_name: d.name })),
      { onConflict: "id" },
    );
  if (profileError) throw profileError;

  console.log("3/3 친구 관계 upsert (1↔2, 1↔3, 2↔3)");
  const pairs: Array<[string, string]> = [
    [ids[0], ids[1]],
    [ids[0], ids[2]],
    [ids[1], ids[2]],
  ];
  const rows = pairs.map(([a, b]) => (a < b ? { user_low: a, user_high: b } : { user_low: b, user_high: a }));
  const { error: friendError } = await admin
    .from("friendships")
    .upsert(rows, { onConflict: "user_low,user_high", ignoreDuplicates: true });
  if (friendError) throw friendError;

  console.log("3-1/3 사진 사용 동의 양방향 upsert (시연 편의, 설정에서 철회 가능)");
  const consentRows = pairs.flatMap(([a, b]) => [
    { owner_id: a, grantee_id: b, granted: true },
    { owner_id: b, grantee_id: a, granted: true },
  ]);
  const { error: consentError } = await admin.from("photo_consents").upsert(consentRows, { onConflict: "owner_id,grantee_id", ignoreDuplicates: true });
  if (consentError) throw consentError;

  console.log("4/4 시연용 AI 프로필 정면 사진 (계정 1·2, 이미 있으면 건너뜀 · 가상 인물 사진)");
  const photoFiles = ["seed/profile-user.jpg", "seed/profile-friend1.jpg"];
  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i];
    if (!existsSync(file)) continue;
    const { count, error: countError } = await admin.from("profile_photos").select("*", { count: "exact", head: true }).eq("user_id", ids[i]).eq("slot", "front");
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      console.log(`  ${demos[i].name}: 정면 사진 있음`);
      continue;
    }
    const id = randomUUID();
    const path = `${ids[i]}/profile/${id}.jpg`;
    const { error: upError } = await admin.storage.from("generations").upload(path, readFileSync(file), { contentType: "image/jpeg", upsert: false, cacheControl: "0" });
    if (upError) throw upError;
    const { error: rowError } = await admin.from("profile_photos").insert({ id, user_id: ids[i], slot: "front", storage_path: path, media_type: "image/jpeg" });
    if (rowError) {
      await admin.storage.from("generations").remove([path]);
      throw rowError;
    }
    console.log(`  ${demos[i].name}: 정면 사진 등록`);
  }

  // 검증: 각 계정의 친구 수
  for (let i = 0; i < ids.length; i++) {
    const { count, error } = await admin
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .or(`user_low.eq.${ids[i]},user_high.eq.${ids[i]}`);
    if (error) throw error;
    console.log(`  ${demos[i].name}: 친구 ${count}명`);
  }
  console.log("완료. (비밀번호·키는 출력하지 않음)");
}

main().catch((e) => {
  console.error("seed 실패:", e?.message ?? e);
  process.exit(1);
});
