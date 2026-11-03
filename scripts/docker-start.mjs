/**
 * docker 컨테이너 시작: DB 대기 → 스키마 적용 → 시드(계정·친구·보관 사진) → Next 서버 실행.
 * standalone 산출물 디렉터리(/app)에서 실행된다. 중복 실행해도 시드가 중복되지 않는다.
 */
import pg from "pg";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import path from "node:path";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[start] DATABASE_URL 이 없습니다.");
  process.exit(1);
}
const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || "/data/storage";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function waitForDb(pool) {
  for (let i = 0; i < 60; i++) {
    try {
      await pool.query("select 1");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("DB 연결 대기 시간 초과");
}

async function ensureUser(pool, email, password, name) {
  if (!email || !password) return null;
  const lower = email.trim().toLowerCase();
  const { rows } = await pool.query("select id from users where email = $1", [lower]);
  if (rows[0]) {
    await pool.query("update users set display_name = $2 where id = $1", [rows[0].id, name]);
    return rows[0].id;
  }
  const id = randomUUID();
  await pool.query("insert into users (id, email, password_hash, display_name) values ($1, $2, $3, $4)", [id, lower, hashPassword(password), name]);
  return id;
}

async function ensureFriend(pool, a, b) {
  if (!a || !b || a === b) return;
  const [low, high] = a < b ? [a, b] : [b, a];
  await pool.query("insert into friendships (user_low, user_high) values ($1, $2) on conflict do nothing", [low, high]);
}

async function ensureSeedPhotos(pool, userId) {
  if (!userId) return;
  const { rows } = await pool.query("select count(*)::int as n from image_generations where owner_id = $1", [userId]);
  if (rows[0].n > 0) return;
  const seeds = [
    { file: "seed/history-1.jpg", mode: "background_create", prompt: "노을 지는 해변", placeTag: "바닷가", minutesAgo: 20 },
    { file: "seed/history-2.jpg", mode: "background_swap", prompt: null, placeTag: "바닷가", minutesAgo: 10 },
  ];
  for (const s of seeds) {
    if (!existsSync(s.file)) continue;
    const id = randomUUID();
    const rel = `${userId}/${id}.jpg`;
    const dest = path.join(STORAGE_DIR, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(s.file, dest);
    await pool.query(
      "insert into image_generations (id, owner_id, mode, status, storage_path, media_type, prompt_text, model_id, place_tag, created_at) values ($1, $2, $3, 'completed', $4, 'image/jpeg', $5, 'seed', $6, now() - ($7 || ' minutes')::interval)",
      [id, userId, s.mode, rel, s.prompt, s.placeTag, String(s.minutesAgo)],
    );
  }
}

/** 시드 계정끼리 사진 사용 동의를 양방향으로 켠다 (사진 선택 바텀시트에서 친구 등록 사진을 바로 쓸 수 있게). */
async function ensureConsent(pool, owner, grantee) {
  if (!owner || !grantee || owner === grantee) return;
  await pool.query("insert into photo_consents (owner_id, grantee_id, granted) values ($1, $2, true) on conflict do nothing", [owner, grantee]);
}

/** AI 프로필 정면 사진 1장 (가상 인물). 이미 있으면 건너뛴다. */
async function ensureProfilePhoto(pool, userId, file) {
  if (!userId || !existsSync(file)) return;
  const { rows } = await pool.query("select count(*)::int as n from profile_photos where user_id = $1 and slot = 'front'", [userId]);
  if (rows[0].n > 0) return;
  const id = randomUUID();
  const rel = `${userId}/profile/${id}.jpg`;
  const dest = path.join(STORAGE_DIR, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  await pool.query("insert into profile_photos (id, user_id, slot, storage_path, media_type) values ($1, $2, 'front', $3, 'image/jpeg')", [id, userId, rel]);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  await waitForDb(pool);
  await pool.query(readFileSync("schema.sql", "utf8"));

  const user = await ensureUser(pool, process.env.SEED_USER_EMAIL, process.env.SEED_USER_PASSWORD, process.env.SEED_USER_NAME || "사용자");
  const f1 = await ensureUser(pool, process.env.SEED_FRIEND1_EMAIL, process.env.SEED_FRIEND1_PASSWORD, process.env.SEED_FRIEND1_NAME || "친구1");
  const f2 = await ensureUser(pool, process.env.SEED_FRIEND2_EMAIL, process.env.SEED_FRIEND2_PASSWORD, process.env.SEED_FRIEND2_NAME || "친구2");
  await ensureFriend(pool, user, f1);
  await ensureFriend(pool, user, f2);
  await ensureFriend(pool, f1, f2);
  for (const [a, b] of [[user, f1], [user, f2], [f1, f2]]) {
    await ensureConsent(pool, a, b);
    await ensureConsent(pool, b, a);
  }
  await ensureProfilePhoto(pool, user, "seed/profile-user.jpg");
  await ensureProfilePhoto(pool, f1, "seed/profile-friend1.jpg");
  await ensureSeedPhotos(pool, user);
  await pool.end();
  console.log("[start] seed ready:", { user: Boolean(user), friend1: Boolean(f1), friend2: Boolean(f2) });

  const server = spawn("node", ["server.js"], { stdio: "inherit", env: process.env });
  const stop = (sig) => server.kill(sig);
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
  server.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error("[start] 실패:", err?.message ?? err);
  process.exit(1);
});
