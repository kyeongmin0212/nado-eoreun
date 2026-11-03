import pg, { Pool } from "pg";

let pool: Pool | null = null;

// date 컬럼은 시간대 변환 없이 'YYYY-MM-DD' 문자열로 받는다 (상황 예약 날짜).
pg.types.setTypeParser(1082, (v: string) => v);

/** docker(local) 모드 Postgres 풀. DATABASE_URL 은 compose 가 넣는다. */
export function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 설정되지 않았습니다 (local 백엔드).");
  pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}
