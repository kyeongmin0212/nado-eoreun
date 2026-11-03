/* 나도으른 Service Worker — 알림 표시와 클릭 이동만 담당한다.
 * 개인 사진·API 응답을 캐시하지 않는다 (fetch 핸들러 없음). */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function safePath(url) {
  // 같은 origin 의 앱 경로만 허용 (/sos/..., /, /friends 등). 외부 주소·프로토콜 상대 경로는 홈으로.
  if (typeof url !== "string") return "/";
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return "/";
  if (!/^\/[A-Za-z0-9\-_\/?=&.%]*$/.test(url)) return "/";
  return url;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "나도으른 · SOS", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "나도으른";
  const options = {
    body: data.body || "요청을 열어 확인해줘!",
    tag: data.tag || "nado-sos",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: { url: safePath(data.url) },
  };
  // iOS 는 push 이벤트마다 알림을 반드시 표시해야 한다.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(target);
              return;
            }
            client.postMessage({ type: "navigate", url: target });
            return;
          } catch {
            // 아래에서 새 창으로 폴백
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
