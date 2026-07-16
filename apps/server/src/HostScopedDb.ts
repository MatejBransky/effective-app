import * as schema from "@effective-app/db";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Schema } from "effect";
import { CurrentHost } from "./CurrentHost.ts";
import { Db } from "./Db.ts";

export class DbError extends Schema.TaggedErrorClass<DbError>()(
  "DbError",
  {},
  { httpApiStatus: 500 },
) {}

/**
 * Runs a query inside a transaction with `app.host_id` set for its duration (via
 * `set_config`, transaction-local) - this is what packages/db's RLS policies actually
 * filter on, see docs/data-model.md's "Postgres RLS for multi-tenancy" section. Every
 * query issued through `query` is host-scoped by construction; there is no way to
 * accidentally query without that context set.
 */
export class HostScopedDb extends Context.Service<
  HostScopedDb,
  {
    readonly query: <A>(
      fn: (tx: NodePgDatabase<typeof schema>) => Promise<A>,
    ) => Effect.Effect<A, DbError, CurrentHost>;
  }
>()("effective-app/HostScopedDb") {}

export const layer = Layer.effect(
  HostScopedDb,
  Effect.gen(function* () {
    const db = yield* Db;
    return {
      query: (fn) =>
        Effect.gen(function* () {
          const host = yield* CurrentHost;
          return yield* Effect.tryPromise({
            try: () =>
              db.transaction(async (tx) => {
                // `sql` parameterizes ${host.hostId} as a bound value, not string
                // concatenation - hostId comes from a verified JWT claim already, but
                // this avoids ever building a habit of interpolating untrusted input
                // into raw SQL text.
                await tx.execute(sql`select set_config('app.host_id', ${host.hostId}, true)`);
                return fn(tx);
              }),
            catch: () => new DbError(),
          });
        }),
    };
  }),
);
