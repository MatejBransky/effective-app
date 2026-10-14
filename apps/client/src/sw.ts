/// <reference lib="webworker" />
import { Option, Schema } from "effect";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

// Push payloads carry localized title/body rendered verbatim. Unknown fields
// are ignored and a missing/corrupt payload falls back to generic copy below.
const PushPayload = Schema.Struct({
  title: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
});

const NotificationData = Schema.Struct({
  url: Schema.optional(Schema.String),
});

// Unlock notifications (see apps/server's pushCheckDue): the payload carries
// localized title/body, the SW only renders it and deep-links to /coaching.
self.addEventListener("push", (event: PushEvent) => {
  const raw: unknown = event.data?.json() ?? {};
  const data = Option.getOrNull(Schema.decodeUnknownOption(PushPayload)(raw)) ?? {};
  const title = data.title ?? "Coaching";
  const body = data.body ?? "";
  event.waitUntil(self.registration.showNotification(title, { body, data: { url: "/coaching" } }));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const raw: unknown = event.notification.data ?? {};
  const data = Option.getOrNull(Schema.decodeUnknownOption(NotificationData)(raw)) ?? {};
  event.waitUntil(self.clients.openWindow(data.url ?? "/coaching"));
});
