/**
 * 주최 측 실행·CI·로컬이 같은 이름으로 넘기는 값. 기본값은 docker-compose.yml 의 시드 계정과 같다.
 * 주최 측 실행은 docker-compose.yml 의 SEED_USER_EMAIL·SEED_USER_PASSWORD 를 E2E_USER_EMAIL·E2E_USER_PASSWORD 로 넘긴다.
 * 역할: 사용자(발신), 친구1(수신·열람), 친구2(수신·미열람). 친구 계정은 compose 와 같은 값을 기본값으로 둔다.
 */
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "user@example.com"
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "loopthon-2026"
export const E2E_USER_NAME = process.env.E2E_USER_NAME ?? "사용자"
export const E2E_FRIEND1_EMAIL = process.env.E2E_FRIEND1_EMAIL ?? "friend1@example.com"
export const E2E_FRIEND1_PASSWORD = process.env.E2E_FRIEND1_PASSWORD ?? "loopthon-2026"
export const E2E_FRIEND1_NAME = process.env.E2E_FRIEND1_NAME ?? "친구1"
export const E2E_FRIEND2_NAME = process.env.E2E_FRIEND2_NAME ?? "친구2"
