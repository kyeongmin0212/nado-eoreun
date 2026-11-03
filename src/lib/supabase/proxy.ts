import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/data/local/auth";

const PUBLIC_PATHS = ["/login", "/signup", "/api/status", "/api/auth/login", "/api/auth/signup", "/api/auth/email", "/__health", "/api/cron/curfew", "/sos-manifest"];

function isPublicPath(pathname: string) {
  // 첫 화면(/)은 로그인하지 않아도 서비스 소개를 보여준다 (주최 측 키트 요구)
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 세션 쿠키 갱신 + 간단한 접근 분기. 실제 권한 검사는 각 페이지·API·RLS 에서 다시 수행한다. */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const { pathname, search } = request.nextUrl;

  // 배포 상태 경로는 세션 확인 없이 바로 통과시킨다 (5초 안 응답, 쿠키 불필요)
  if (pathname === "/__health") {
    return NextResponse.next({ request });
  }

  // docker(local) 모드: 세션 쿠키 유무로만 분기한다. 실제 검증은 페이지·API 가 DB 로 수행한다.
  if (process.env.DATA_BACKEND === "local") {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    if (!hasSession) {
      if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
        return NextResponse.json({ ok: false, code: "unauthorized", message: "로그인이 필요합니다." }, { status: 401 });
      }
      if (!isPublicPath(pathname)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", `${pathname}${search}`);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next({ request });
    }
    if (pathname === "/login" || pathname === "/signup") {
      const next = request.nextUrl.searchParams.get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next({ request });
  }

  if (!url || !key) {
    // Supabase 미설정: 앱 셸은 뜨되 로그인 화면에서 연결 대기 안내를 보여준다.
    if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
      return NextResponse.json({ ok: false, code: "not_configured", message: "Supabase 연결 대기" }, { status: 503 });
    }
    if (!isPublicPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // getClaims 는 JWT 를 검증하고 필요 시 토큰을 갱신해 쿠키에 다시 쓴다.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
      return NextResponse.json({ ok: false, code: "unauthorized", message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (!isPublicPath(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  if (pathname === "/login" || pathname === "/signup") {
    const next = request.nextUrl.searchParams.get("next");
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return supabaseResponse;
}
