import * as schema from "@repo/entities/db";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Schema } from "effect";
import { CurrentHost } from "./CurrentHost.ts";
import { Db } from "./Db.ts";

export class CoachingDbError extends Schema.TaggedError<CoachingDbError>()(
  "CoachingDbError",
  {},
  { httpApiStatus: 500 },
) {}

/**
 * Coaching analogue of `HostScopedDb`: runs a query inside a transaction with
 * `app.user_id` (the JWT `sub` from `CurrentHost`) set for its duration, which
 * is what the coaching tables' RLS policies filter on. Every query issued
 * through `query` is caller-scoped by construction.
 */
export class UserScopedDb extends Context.Service<
  UserScopedDb,
  {
    readonly query: <A>(
      fn: (tx: NodePgDatabase<typeof schema>) => Promise<A>,
    ) => Effect.Effect<A, CoachingDbError, CurrentHost>;
  }
>()("effective-app/UserScopedDb") {}

export const layer = Layer.effect(
  UserScopedDb,
  Effect.gen(function* () {
    const db = yield* Db;

    return {
      query: (fn) =>
        Effect.gen(function* () {
          const host = yield* CurrentHost;

          return yield* Effect.tryPromise({
            try: () =>
              db.transaction(async (tx) => {
                await tx.execute(sql`select set_config('app.user_id', ${host.subject}, true)`);

                return fn(tx);
              }),
            catch: () => new CoachingDbError(),
          });
        }),
    };
  }),
);
