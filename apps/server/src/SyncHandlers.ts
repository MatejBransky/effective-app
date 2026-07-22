import * as schema from "@repo/entities/db";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Effect, Schema } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "./Api.ts";
import { HostScopedDb } from "./HostScopedDb.ts";
import { entities, preprocessOpData } from "./SyncEntities.ts";
import type { EntityDescriptor } from "./SyncEntities.ts";

export interface CrudEntry {
  readonly id: string;
  readonly op: "PUT" | "PATCH" | "DELETE";
  readonly table: string;
  readonly opData?: Record<string, unknown> | undefined;
}

type OpOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Thin wrappers around Drizzle's insert/update, parameters intentionally typed `any` -
 * `EntityDescriptor.table` is a heterogeneous, runtime-dispatched value (see
 * SyncEntities.ts), so there's no single concrete `PgTable` subtype these calls could be
 * typed against without narrowing to one specific entity. Kept to two tiny functions
 * (rather than inlining `any` at each call site) so the untyped boundary is explicit and
 * contained to exactly the two Drizzle calls that need it.
 */
const insertOrUpdateRow = (tx: any, table: any, row: Record<string, unknown>): Promise<unknown> =>
  tx.insert(table).values(row).onConflictDoUpdate({ target: table.id, set: row });

const updateRow = (
  tx: any,
  table: any,
  id: string,
  row: Record<string, unknown>,
): Promise<unknown> => tx.update(table).set(row).where(eq(table.id, id));

/**
 * Applies one PowerSync `CrudEntry` to Postgres via Drizzle. Runs inside its own
 * `HostScopedDb.query` call (its own transaction) rather than sharing one transaction
 * across the whole batch - Postgres aborts an entire transaction on the first error, so a
 * shared transaction would make one bad op silently fail every op after it, defeating the
 * "keep going, report per-op errors" contract below.
 *
 * Never rejects - every failure (unknown table/field, a decode failure, a DB error) is
 * caught and turned into an `OpOutcome`, because a 4xx here would block the client's
 * upload queue permanently (see `Api.ts`'s `SyncGroup` comment).
 */
const applyOp = async (
  tx: NodePgDatabase<typeof schema>,
  descriptor: EntityDescriptor,
  op: CrudEntry,
): Promise<OpOutcome> => {
  try {
    switch (op.op) {
      case "PUT": {
        const raw = preprocessOpData({ id: op.id, ...op.opData }, descriptor);
        const decoded = await Schema.decodeUnknownPromise(descriptor.fullSchema)(raw);
        await insertOrUpdateRow(tx, descriptor.table, decoded);
        return { ok: true };
      }
      case "PATCH": {
        const raw = preprocessOpData(op.opData ?? {}, descriptor);
        const decoded: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(raw)) {
          // `config`/`rules`/`snapshot`/`payload` (this entity's `jsonFields`) have no
          // single per-field schema to validate a partial update against - see
          // SyncEntities.ts's comment on `sequenceActionScalarFields`. Already
          // JSON-parsed by `preprocessOpData`; pass through as-is.
          if (descriptor.jsonFields?.includes(key)) {
            decoded[key] = value;
            continue;
          }
          const fieldSchema = descriptor.fields[key];
          if (!fieldSchema) return { ok: false, reason: `unknown field: ${key}` };
          decoded[key] = await Schema.decodeUnknownPromise(fieldSchema)(value);
        }
        await updateRow(tx, descriptor.table, op.id, decoded);
        return { ok: true };
      }
      case "DELETE": {
        await tx.delete(descriptor.table).where(eq(descriptor.table.id, op.id));
        return { ok: true };
      }
    }
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : "write failed" };
  }
};

/** The handler's actual logic, exported standalone so tests can exercise it against a
 * fake `HostScopedDb` layer without going through the full HTTP/HttpApi machinery -
 * same reasoning as `JwtVerifier.test.ts` testing `JwtVerifier` directly. */
export const syncUpload = (payload: { readonly operations: ReadonlyArray<CrudEntry> }) =>
  Effect.gen(function* () {
    const hostScopedDb = yield* HostScopedDb;
    const errors: Array<{ id: string; reason: string }> = [];

    for (const op of payload.operations) {
      const descriptor = entities[op.table];
      if (!descriptor) {
        errors.push({ id: op.id, reason: `table not writable: ${op.table}` });
        continue;
      }

      const outcome = yield* hostScopedDb
        .query((tx) => applyOp(tx, descriptor, op))
        .pipe(
          // A `DbError` here means the transaction wrapper itself failed (e.g. the
          // `set_config` call) - `applyOp` above never rejects, so this is the only path
          // that can still reach `DbError`. Same "always 2xx" contract applies.
          Effect.orElseSucceed((): OpOutcome => ({ ok: false, reason: "write failed" })),
        );
      if (!outcome.ok) {
        errors.push({ id: op.id, reason: outcome.reason });
      }
    }

    return { errors };
  });

export const SyncGroupLive = HttpApiBuilder.group(Api, "Sync", (handlers) =>
  handlers.handle("upload", ({ payload }) => syncUpload(payload)),
);
