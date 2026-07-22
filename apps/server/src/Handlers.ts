import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "./Api.ts";
import { CurrentUser } from "./CurrentUser.ts";

export const HealthGroupLive = HttpApiBuilder.group(Api, "Health", (handlers) =>
  handlers.handle("health", () => Effect.succeed("ok")),
);

export const MeGroupLive = HttpApiBuilder.group(Api, "Me", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      const user = yield* CurrentUser;
      return { subject: user.subject };
    }),
  ),
);
