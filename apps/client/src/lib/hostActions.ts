import { confirm, defineAction } from "@repo/shared-app-shell";
import { eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { drizzleDb } from "./powersync/database.ts";
import { hosts } from "./powersync/schema.ts";

const DEFAULT_HOST_NAME = "Untitled Host";

export class ResetHostNameError extends Schema.TaggedErrorClass<ResetHostNameError>()(
  "ResetHostNameError",
  { cause: Schema.Unknown },
) {}

/**
 * A concrete demo of `@repo/shared-app-shell`'s action registry against real synced
 * data (not an invented example) - `execute` has full control over the trigger: it `yield*`s
 * `confirm(...)` (an Effect, not a Promise, so it composes directly in this `Effect.gen`
 * alongside the PowerSync write that follows it) and only proceeds to write if confirmed.
 * `isDisabled` depends on the specific host instance passed in, not global state - the same
 * shape as "disabled because this particular member's status doesn't allow it" would be.
 */
export const resetHostName = defineAction<{ id: string; name: string }, ResetHostNameError>({
  id: "reset-host-name",
  label: `Reset name to "${DEFAULT_HOST_NAME}"`,
  isDisabled: (host) => host.name === DEFAULT_HOST_NAME && "Name is already reset",
  execute: (host) =>
    Effect.gen(function* () {
      const confirmed = yield* confirm({
        title: "Reset host name?",
        message: `This will rename "${host.name}" back to "${DEFAULT_HOST_NAME}".`,
      });
      if (!confirmed) return;

      yield* Effect.tryPromise({
        try: () =>
          drizzleDb.update(hosts).set({ name: DEFAULT_HOST_NAME }).where(eq(hosts.id, host.id)),
        catch: (cause) => new ResetHostNameError({ cause }),
      });
    }),
});
