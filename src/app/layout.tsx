import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/copy";
import { getSessionUser } from "@/lib/auth";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { NotificationProvider } from "@/components/NotificationProvider";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "통금이 있는 성인이 오늘의 상황을 미리 정하고, AI 사진과 친구 SOS로 대응하는 모바일 웹앱",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// 모든 화면이 로그인 사용자별 데이터이므로 정적 프리렌더를 하지 않는다.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FDE6DE",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 레이아웃은 화면을 오갈 때 다시 그려지지 않는다. 로그인·로그아웃 뒤에는 router.refresh() 로 갱신한다.
  const user = await getSessionUser().catch(() => null);
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col">
        <NotificationProvider userId={user?.id ?? null}>
          {children}
          <TabBar authed={Boolean(user)} />
        </NotificationProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
