/* Web Push only. This worker deliberately does not intercept page or audio requests. */
const DESTINATIONS = new Set(["/student/assignments", "/student/membership"]);

self.addEventListener("push", event => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* Show the generic notice below. */ }
    const path = DESTINATIONS.has(payload.path) ? payload.path : "/student/notifications";
    const title = typeof payload.title === "string" && payload.title.length <= 60
        ? payload.title : "Alan English 有新通知";
    const body = typeof payload.body === "string" && payload.body.length <= 120
        ? payload.body : "請登入查看通知。";
    event.waitUntil(self.registration.showNotification(title, {
        body,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        tag: Number.isSafeInteger(payload.notification_id) ? `ae-${payload.notification_id}` : undefined,
        data: { path }
    }));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const path = DESTINATIONS.has(event.notification.data?.path)
        ? event.notification.data.path : "/student/notifications";
    const url = new URL(path, self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const sameOrigin = windows.find(client => new URL(client.url).origin === self.location.origin);
        if (sameOrigin) {
            await sameOrigin.navigate(url);
            await sameOrigin.focus();
        } else {
            await self.clients.openWindow(url);
        }
    })());
});
