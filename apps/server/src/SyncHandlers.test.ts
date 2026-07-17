import { describe, expect, it } from "@effect/vitest";
import { getTableName } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { CurrentHost } from "./CurrentHost.ts";
import { DbError, HostScopedDb } from "./HostScopedDb.ts";
import { syncUpload } from "./SyncHandlers.ts";

const FakeCurrentHostLayer = Layer.succeed(CurrentHost, {
  hostId: "test-host",
  subject: "test-user",
});

const HOST_ID = "11111111-1111-4111-8111-111111111111";

const validHostRow = {
  name: "Test Gym",
  slug: "test-gym",
  email: "owner@test-gym.example",
  timeZone: "UTC",
  currency: "USD",
  businessType: "gym",
  createdAt: "2026-07-16T00:00:00.000Z",
};

/** Records what `applyOp` (in SyncHandlers.ts) tried to write, without touching a real
 * Drizzle connection or Postgres - same "fake the I/O boundary" approach `JwtVerifier.test.ts`
 * uses for `JwtVerifier`, applied to `HostScopedDb` instead. */
type RecordedCall =
  | { readonly kind: "insert"; readonly table: string; readonly row: unknown }
  | { readonly kind: "update"; readonly table: string; readonly row: unknown }
  | { readonly kind: "delete"; readonly table: string };

/** A fake Drizzle transaction object, typed `any` since it only implements the three
 * chained call shapes `SyncHandlers.ts`'s `applyOp` actually uses - not the full
 * `NodePgDatabase` surface (same "dynamic dispatch, untyped at this one boundary"
 * reasoning as `insertOrUpdateRow`/`updateRow` in SyncHandlers.ts). */
const makeFakeTx = (calls: Array<RecordedCall>) => {
  const fakeTx: any = {
    insert: (table: any) => ({
      values: (row: unknown) => ({
        onConflictDoUpdate: () => {
          calls.push({ kind: "insert", table: getTableName(table), row });
          return Promise.resolve();
        },
      }),
    }),
    update: (table: any) => ({
      set: (row: unknown) => ({
        where: () => {
          calls.push({ kind: "update", table: getTableName(table), row });
          return Promise.resolve();
        },
      }),
    }),
    delete: (table: any) => ({
      where: () => {
        calls.push({ kind: "delete", table: getTableName(table) });
        return Promise.resolve();
      },
    }),
  };
  return fakeTx;
};

/** Mirrors the real `HostScopedDb.layer`'s shape (`query` requires `CurrentHost`, fails
 * with `DbError`) so `syncUpload`'s type-level requirements are satisfied the same way in
 * tests as in production - just backed by `makeFakeTx` instead of a real transaction. */
const makeFakeLayers = (calls: Array<RecordedCall>) =>
  Layer.mergeAll(
    Layer.succeed(HostScopedDb, {
      query: (fn) =>
        Effect.gen(function* () {
          yield* CurrentHost;
          return yield* Effect.tryPromise({
            try: () => fn(makeFakeTx(calls)),
            catch: () => new DbError(),
          });
        }),
    }),
    FakeCurrentHostLayer,
  );

describe("syncUpload", () => {
  it.effect("rejects an op against a table not in the write allowlist", () =>
    Effect.gen(function* () {
      const calls: Array<RecordedCall> = [];
      const result = yield* syncUpload({
        operations: [{ id: HOST_ID, op: "PUT", table: "lead_stage_templates", opData: {} }],
      }).pipe(Effect.provide(makeFakeLayers(calls)));

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.reason).toContain("table not writable");
      expect(calls).toHaveLength(0);
    }),
  );

  it.effect("applies a PUT as an insert-or-update on the matching table", () =>
    Effect.gen(function* () {
      const calls: Array<RecordedCall> = [];
      const result = yield* syncUpload({
        operations: [{ id: HOST_ID, op: "PUT", table: "hosts", opData: validHostRow }],
      }).pipe(Effect.provide(makeFakeLayers(calls)));

      expect(result.errors).toHaveLength(0);
      // `createdAt` decodes from the wire ISO string to a real `Date` (via
      // `Schema.DateFromString`) - exactly what Drizzle's `timestamp` column expects.
      expect(calls).toEqual([
        {
          kind: "insert",
          table: "hosts",
          row: { id: HOST_ID, ...validHostRow, createdAt: new Date(validHostRow.createdAt) },
        },
      ]);
    }),
  );

  it.effect("applies a PATCH as an update with only the changed fields decoded", () =>
    Effect.gen(function* () {
      const calls: Array<RecordedCall> = [];
      const result = yield* syncUpload({
        operations: [{ id: HOST_ID, op: "PATCH", table: "hosts", opData: { name: "Renamed Gym" } }],
      }).pipe(Effect.provide(makeFakeLayers(calls)));

      expect(result.errors).toHaveLength(0);
      expect(calls).toEqual([{ kind: "update", table: "hosts", row: { name: "Renamed Gym" } }]);
    }),
  );

  it.effect("applies a DELETE", () =>
    Effect.gen(function* () {
      const calls: Array<RecordedCall> = [];
      const result = yield* syncUpload({
        operations: [{ id: HOST_ID, op: "DELETE", table: "hosts" }],
      }).pipe(Effect.provide(makeFakeLayers(calls)));

      expect(result.errors).toHaveLength(0);
      expect(calls).toEqual([{ kind: "delete", table: "hosts" }]);
    }),
  );

  it.effect(
    "surfaces a decode failure as a per-op error, never as a failed Effect (2xx contract)",
    () =>
      Effect.gen(function* () {
        const calls: Array<RecordedCall> = [];
        // Missing every required Host field - `Schema.decodeUnknownPromise` should reject.
        const result = yield* syncUpload({
          operations: [{ id: HOST_ID, op: "PUT", table: "hosts", opData: {} }],
        }).pipe(Effect.provide(makeFakeLayers(calls)));

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.id).toBe(HOST_ID);
        expect(calls).toHaveLength(0);
      }),
  );

  it.effect("rejects an unknown field on a PATCH instead of writing it through", () =>
    Effect.gen(function* () {
      const calls: Array<RecordedCall> = [];
      const result = yield* syncUpload({
        operations: [{ id: HOST_ID, op: "PATCH", table: "hosts", opData: { notAField: "x" } }],
      }).pipe(Effect.provide(makeFakeLayers(calls)));

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.reason).toContain("unknown field");
      expect(calls).toHaveLength(0);
    }),
  );

  it.effect("coerces a PowerSync 0/1 into a real boolean for isEnabled", () =>
    Effect.gen(function* () {
      const calls: Array<RecordedCall> = [];
      const result = yield* syncUpload({
        operations: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            op: "PUT",
            table: "marketing_sequences",
            opData: {
              hostId: HOST_ID,
              name: "Welcome sequence",
              triggerType: "member_created",
              filterSetId: null,
              isEnabled: 1,
              createdAt: "2026-07-16T00:00:00.000Z",
            },
          },
        ],
      }).pipe(Effect.provide(makeFakeLayers(calls)));

      expect(result.errors).toHaveLength(0);
      const inserted = calls[0];
      expect(inserted?.kind).toBe("insert");
      expect((inserted as { row: { isEnabled: unknown } }).row.isEnabled).toBe(true);
    }),
  );
});
