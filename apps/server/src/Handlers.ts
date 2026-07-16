import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "./Api.ts";
import { CurrentHost } from "./CurrentHost.ts";

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
