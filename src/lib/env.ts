/**
 * 환경변수 접근을 한 곳에 모은다. 비밀값은 절대 클라이언트로 내려보내지 않는다.
 */

export type ImageProvider = "openai" | "gateway" | "none";

/** OpenAI 직접 호출 기본 모델 ID. Gateway 사용 시에는 `openai/` 접두사가 붙는다. */
export const IMAGE_MODEL_DEFAULT = "gpt-image-2.5-sunburst";
export const IMAGE_MODEL_DEFAULT_GATEWAY = "openai/gpt-image-2.5-sunburst";

/** 데이터 백엔드 선택: "local"(docker, Postgres+파일) 또는 "supabase"(기본). */
export function dataBackend(): "local" | "supabase" {
  return process.env.DATA_BACKEND === "local" ? "local" : "supabase";
}

export function publicSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function publicSupabaseKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicSupabaseUrl() && publicSupabaseKey());
}

/** 로그인·데이터가 동작할 수 있는 상태인지 (local 은 DATABASE_URL, supabase 는 URL+키). */
export function isDataConfigured(): boolean {
  return dataBackend() === "local" ? Boolean(process.env.DATABASE_URL) : isSupabaseConfigured();
}

export function serviceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(serviceRoleKey());
}

/** 사용 가능한 프로바이더: OPENAI_API_KEY 가 있으면 OpenAI 직접, 아니면 AI_GATEWAY_API_KEY 가 있으면 Gateway. */
export function imageProvider(): ImageProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.AI_GATEWAY_API_KEY) return "gateway";
  return "none";
}

export function imageModelId(): string {
  const configured = process.env.IMAGE_MODEL_ID?.trim();
  const provider = imageProvider();
  if (configured) {
    // 프로바이더에 맞게 접두사를 정규화한다 (예: gateway 는 openai/… 필요)
    if (provider === "gateway" && !configured.includes("/")) return `openai/${configured}`;
    if (provider === "openai" && configured.startsWith("openai/")) return configured.slice("openai/".length);
    return configured;
  }
  return provider === "gateway" ? IMAGE_MODEL_DEFAULT_GATEWAY : IMAGE_MODEL_DEFAULT;
}

export function imageQuality(): string | undefined {
  const q = process.env.IMAGE_QUALITY?.trim();
  return q ? q : undefined;
}

export function isImageGatewayConfigured(): boolean {
  return imageProvider() !== "none";
}

export function vapidPublicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

/** 통금 알림 스케줄러가 /api/cron/curfew 를 호출할 때 쓰는 비밀값. */
export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET || undefined;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** 가입 인증번호 메일(SMTP). 예: Gmail — SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=주소, SMTP_PASS=앱 비밀번호 */
export type MailConfig = { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string };

export function mailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS || undefined;
  // 외부 메일 서버는 계정·비밀번호가 모두 있어야 켠다(일부만 넣은 상태에서 보내다 실패하지 않게). 로컬 검사용 수신기만 계정 없이 쓴다.
  const localSink = /^(localhost|127\.0\.0\.1|::1)$/.test(host);
  if (user && !pass) return null;
  if (!localSink && (!user || !pass)) return null;
  const from = process.env.MAIL_FROM?.trim() || `나도으른 <${user ?? "no-reply@nado-eoreun.app"}>`;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  return { host, port, secure, user, pass, from };
}

export function isMailConfigured(): boolean {
  return mailConfig() !== null;
}

/** 클라이언트에 보내도 되는 연결 상태 요약 (값이 아니라 설정 여부만). */
export type IntegrationStatus = {
  backend: "local" | "supabase";
  supabase: boolean;
  serviceRole: boolean;
  imageGateway: boolean; // 이미지 생성 키 설정 여부 (OpenAI 직접 또는 Gateway)
  imageProvider: ImageProvider;
  imageModel: string;
  push: boolean;
  mail: boolean; // 가입 인증번호 메일(SMTP) 설정 여부
};

export function integrationStatus(): IntegrationStatus {
  return {
    backend: dataBackend(),
    supabase: isDataConfigured(),
    serviceRole: isServiceRoleConfigured(),
    imageGateway: isImageGatewayConfigured(),
    imageProvider: imageProvider(),
    imageModel: imageModelId(),
    push: isPushConfigured(),
    mail: isMailConfigured(),
  };
}

/** 배포된 커밋 SHA. CI/docker 는 RELEASE_ID, Vercel 은 VERCEL_GIT_COMMIT_SHA 를 준다. */
export function releaseId(): string {
  return process.env.RELEASE_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev";
}
