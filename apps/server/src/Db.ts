import * as schema from "@repo/entities/db";
import { Context, Effect, Layer } from "effect";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Connects as `app_user` (see `postgres/init-scripts/02-app-user-role.sql`), never as
 * the migration-owner role - Postgres lets table owners bypass RLS by default, which
 * would silently defeat every policy in shared/db's schema.
 */
export class Db extends Context.Service<Db, NodePgDatabase<typeof schema>>()("effective-app/Db") {}

export const layer = (connectionString: string) =>
  Layer.effect(
    Db,
    Effect.acquireRelease(
      Effect.sync(() => drizzle(new Pool({ connectionString }), { schema })),
      (db) => Effect.promise(() => db.$client.end()),
    ),
  );
