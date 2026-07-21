import { hosts } from "@repo/db";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api, HostNotFound } from "./Api.ts";
import { CurrentHost } from "./CurrentHost.ts";
import { HostScopedDb } from "./HostScopedDb.ts";

export const HealthGroupLive = HttpApiBuilder.group(Api, "Health", (handlers) =>
  handlers.handle("health", () => Effect.succeed("ok")),
);

export const MeGroupLive = HttpApiBuilder.group(Api, "Me", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      const host = yield* CurrentHost;
      return { hostId: host.hostId, subject: host.subject };
    }),
  ),
);

export const HostsGroupLive = HttpApiBuilder.group(Api, "Hosts", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      const hostScopedDb = yield* HostScopedDb;
      // No WHERE clause needed - RLS (packages/db's host_isolation policy) already
      // limits this to at most the caller's own host row.
      const rows = yield* hostScopedDb.query((tx) => tx.select().from(hosts));
      const host = rows[0];
      if (!host) return yield* new HostNotFound();
      return {
        id: host.id,
        name: host.name,
        slug: host.slug,
        email: host.email,
        timeZone: host.timeZone,
        currency: host.currency,
        businessType: host.businessType,
      };
    }),
  ),
);
