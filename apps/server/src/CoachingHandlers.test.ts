import { describe, expect, it } from "@effect/vitest";
import {
  clientProfiles,
  coachingUsers,
  dailyContents,
  listeningProgress,
  pushDeliveries,
  pushSubscriptions,
  slotCompletions,
} from "@repo/entities/db";
import { DateTime, Effect, Layer, Schema } from "effect";
import { CurrentHost } from "./CurrentHost.ts";
import { CoachingForbidden, InvalidSettings, ProofNotMet, SlotLocked } from "./CoachingApi.ts";
import { SubmitPayload } from "@repo/entities";
import {
  AudioMissing,
  AudioStore,
  coachClients,
  coachingMe,
  pushCheckDue,
  PushSender,
  reportProgress,
  submitSlot,
  updateSettings,
} from "./CoachingHandlers.ts";
import { CoachingDbError, UserScopedDb } from "./UserScopedDb.ts";
import type { PushPayload } from "./CoachingHandlers.ts";
import type { PushSubscriptionPayload } from "@repo/entities";

interface Store {
  coachingUsers: Array<Partial<typeof coachingUsers.$inferSelect>>;
  clientProfiles: Array<Partial<typeof clientProfiles.$inferSelect>>;
  dailyContents: Array<Partial<typeof dailyContents.$inferSelect>>;
  slotCompletions: Array<Partial<typeof slotCompletions.$inferSelect>>;
  listeningProgress: Array<Partial<typeof listeningProgress.$inferSelect>>;
  pushSubscriptions: Array<Partial<typeof pushSubscriptions.$inferSelect>>;
  pushDeliveries: Array<Partial<typeof pushDeliveries.$inferSelect>>;
}

const emptyStore = (): Store => ({
  coachingUsers: [],
  clientProfiles: [],
  dailyContents: [],
  slotCompletions: [],
  listeningProgress: [],
  pushSubscriptions: [],
  pushDeliveries: [],
});

/**
 * The Drizzle tables `CoachingHandlers.ts` queries - table identity comes from the
 * real table objects, so a wrong-table query fails loudly (see `makeFakeTx`).
 * Rows are partials of the real `$inferSelect` shapes: each test seeds exactly the
 * columns its scenario reads, so unseeded columns stay absent (see `Store`).
 */
type CoachingTable =
  | typeof coachingUsers
  | typeof clientProfiles
  | typeof dailyContents
  | typeof slotCompletions
  | typeof listeningProgress
  | typeof pushSubscriptions
  | typeof pushDeliveries;

/** The upsert-key columns the fake reads - the only row fields `keyOf` inspects. */
interface FakeRow {
  readonly userId?: string;
  readonly programDate?: string;
  readonly slot?: string;
  readonly endpoint?: string;
}

const keyOf = (table: CoachingTable, row: FakeRow): string => {
  if (table === clientProfiles || table === coachingUsers) return `u:${row["userId"]}`;

  if (table === pushSubscriptions) return `e:${row["endpoint"]}`;

  return `u:${row["userId"]}|d:${row["programDate"]}|s:${row["slot"]}`;
};

/**
 * Minimal in-memory Drizzle stand-in: `select().from(table)` resolves every
 * row of that table (each test seeds exactly the rows its scenario needs, so
 * ignoring `where` is harmless), inserts apply upsert-by-key. Table identity
 * comes from the real table objects, so a wrong-table query fails loudly.
 */
const makeFakeTx = (store: Store) => {
  const rowsFor = (table: CoachingTable): Array<FakeRow> => {
    if (table === coachingUsers) return store.coachingUsers;

    if (table === clientProfiles) return store.clientProfiles;

    if (table === dailyContents) return store.dailyContents;

    if (table === slotCompletions) return store.slotCompletions;

    if (table === listeningProgress) return store.listeningProgress;

    if (table === pushSubscriptions) return store.pushSubscriptions;

    if (table === pushDeliveries) return store.pushDeliveries;
    throw new Error("fake tx: unknown table");
  };

  const fakeTx: any = {
    select: () => ({
      from: (table: CoachingTable) => {
        const rows = rowsFor(table).map((r) => ({ ...r }));

        // A real promise with `where` attached (not a hand-rolled thenable -
        // `unicorn/no-thenable` forbids `then` on plain objects): `await` works
        // and `.where()` resolves the same rows.
        return Object.assign(Promise.resolve(rows), {
          where: () => Promise.resolve(rowsFor(table).map((r) => ({ ...r }))),
        });
      },
    }),
    insert: (table: CoachingTable) => ({
      values: (row: FakeRow) => ({
        onConflictDoUpdate: ({ set }: { set: FakeRow }) => {
          const rows = rowsFor(table);
          const merged = { ...row, ...set };
          const idx = rows.findIndex((r) => keyOf(table, r) === keyOf(table, row));

          if (idx >= 0) rows[idx] = merged;
          else rows.push(merged);

          return Promise.resolve();
        },
        onConflictDoNothing: () => {
          const rows = rowsFor(table);

          if (!rows.some((r) => keyOf(table, r) === keyOf(table, row))) rows.push({ ...row });

          return Promise.resolve();
        },
      }),
    }),
    delete: (table: CoachingTable) => ({
      where: () => {
        rowsFor(table).length = 0;

        return Promise.resolve();
      },
    }),
  };

  return fakeTx;
};

const layersFor = (store: Store, subject: string, sent: Array<unknown>) =>
  Layer.mergeAll(
    Layer.succeed(CurrentHost, { hostId: "test-host", subject }),
    Layer.succeed(UserScopedDb, {
      // `any` at this one boundary: the fake tx only implements the chains
      // CoachingHandlers.ts uses (see `makeFakeTx`), same reasoning as
      // SyncHandlers.test.ts's fake.
      query: (fn: any) =>
        Effect.tryPromise({
          // SAFETY: `makeFakeTx` implements exactly the Drizzle chains
          // CoachingHandlers.ts uses (`select`/`from`/`where`,
          // `insert`/`values`/`onConflict*`, `delete`/`where`) - the cast only
          // bridges the fake to `DbTx`'s static type, and any failure inside `fn`
          // still rejects and becomes `CoachingDbError` below.
          try: () => fn(makeFakeTx(store)) as Promise<any>,
          catch: () => new CoachingDbError(),
        }),
    }),
    Layer.succeed(AudioStore, {
      readAudio: (_key: string) => Effect.fail(new AudioMissing()),
    }),
    Layer.succeed(PushSender, {
      send: (subscription: PushSubscriptionPayload, payload: PushPayload) =>
        Effect.sync(() => {
          sent.push({ subscription, payload });
        }),
    }),
  );

const seedClient = (
  store: Store,
  subject: string,
  unlockMillis: number,
  coachId: string | null = null,
) => {
  const at = new Date(unlockMillis);
  const programDate = at.toISOString().slice(0, 10);
  store.coachingUsers.push({ userId: subject, role: "client" });
  store.clientProfiles.push({
    userId: subject,
    firstName: "Test",
    lastName: "Client",
    bio: null,
    focusHour: at.getUTCHours(),
    focusMinute: at.getUTCMinutes(),
    timeZone: "UTC",
    locale: "en",
    coachId,
  });
  store.dailyContents.push({
    programDate,
    locale: "en",
    focusAudioKey: "focus.wav",
    recharge1AudioKey: "recharge1.wav",
    recharge2AudioKey: "recharge2.wav",
  });

  return programDate;
};

describe("submitSlot", () => {
  it.effect("fails ProofNotMet without a listening heartbeat", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      const now = yield* DateTime.now;
      const programDate = seedClient(store, "client-1", now.epochMilliseconds - 4 * 3600_000);

      const error = yield* submitSlot(
        Schema.decodeSync(SubmitPayload)({ programDate, slot: "focus" }),
      ).pipe(Effect.flip, Effect.provide(layersFor(store, "client-1", [])));

      expect(error._tag).toBe("ProofNotMet");
      expect(error).toBeInstanceOf(ProofNotMet);
    }),
  );

  it.effect("fails SlotLocked before the unlock instant", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      const now = yield* DateTime.now;
      const programDate = seedClient(store, "client-1", now.epochMilliseconds + 2 * 3600_000);

      const error = yield* submitSlot(
        Schema.decodeSync(SubmitPayload)({ programDate, slot: "focus" }),
      ).pipe(Effect.flip, Effect.provide(layersFor(store, "client-1", [])));

      expect(error).toBeInstanceOf(SlotLocked);
    }),
  );

  it.effect("records listened with valid proof", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      const now = yield* DateTime.now;
      const programDate = seedClient(store, "client-1", now.epochMilliseconds - 5 * 3600_000);
      const pd = Schema.decodeSync(SubmitPayload)({ programDate, slot: "focus" }).programDate;
      const layers = layersFor(store, "client-1", []);
      yield* reportProgress({
        programDate: pd,
        slot: "focus",
        playedSeconds: 95,
        durationSeconds: 100,
        reachedEnd: true,
      }).pipe(Effect.provide(layers));

      const slot = yield* submitSlot({ programDate: pd, slot: "focus" }).pipe(
        Effect.provide(layers),
      );

      expect(slot.status).toBe("listened");
      expect(store.slotCompletions).toHaveLength(1);
    }),
  );
});

describe("updateSettings", () => {
  it.effect("rejects an unknown time zone", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      store.coachingUsers.push({ userId: "client-1", role: "client" });

      const error = yield* updateSettings({
        firstName: "A",
        lastName: "B",
        bio: null,
        focusHour: 6,
        focusMinute: 0,
        timeZone: "Mars/Olympus",
        locale: "en",
      }).pipe(Effect.flip, Effect.provide(layersFor(store, "client-1", [])));

      expect(error).toBeInstanceOf(InvalidSettings);
      expect(store.clientProfiles).toHaveLength(0);
    }),
  );

  it.effect("stores the profile and returns me", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      store.coachingUsers.push({ userId: "client-1", role: "client" });

      const me = yield* updateSettings({
        firstName: "A",
        lastName: "B",
        bio: "hello",
        focusHour: 6,
        focusMinute: 30,
        timeZone: "Europe/Prague",
        locale: "cs",
      }).pipe(Effect.provide(layersFor(store, "client-1", [])));

      expect(me.role).toBe("client");
      expect(me.profile?.focusHour).toBe(6);
      expect(me.profile?.locale).toBe("cs");
      expect(store.clientProfiles).toHaveLength(1);
    }),
  );
});

describe("coachingMe", () => {
  it.effect("fails CoachingForbidden without a coaching row", () =>
    Effect.gen(function* () {
      const store = emptyStore();

      const error = yield* coachingMe().pipe(
        Effect.flip,
        Effect.provide(layersFor(store, "stranger", [])),
      );

      expect(error).toBeInstanceOf(CoachingForbidden);
    }),
  );
});

describe("pushCheckDue", () => {
  it.effect("sends due slots, then stays quiet once delivered, requires admin", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      // NOTE: `it.effect` runs on a frozen TestClock at Unix epoch 0, so
      // "today" is always 1970-01-01 here - seed that exact date. Focus at
      // 00:00 UTC is due exactly at epoch 0; the recharges stay locked.
      store.coachingUsers.push({ userId: "admin-1", role: "admin" });
      store.coachingUsers.push({ userId: "client-1", role: "client" });
      store.clientProfiles.push({
        userId: "client-1",
        firstName: "Test",
        lastName: "Client",
        bio: null,
        focusHour: 0,
        focusMinute: 0,
        timeZone: "UTC",
        locale: "en",
        coachId: "coach-1",
      });
      store.dailyContents.push({
        programDate: "1970-01-01",
        locale: "en",
        focusAudioKey: "focus.wav",
        recharge1AudioKey: "recharge1.wav",
        recharge2AudioKey: "recharge2.wav",
      });
      store.pushSubscriptions.push({
        endpoint: "https://push.example/sub-1",
        userId: "client-1",
        p256dh: "p256dh",
        auth: "auth",
        locale: "en",
      });
      const sent: Array<unknown> = [];
      const adminLayers = layersFor(store, "admin-1", sent);
      const first = yield* pushCheckDue().pipe(Effect.provide(adminLayers));
      expect(first).toEqual({ sent: 1 });
      expect(sent).toHaveLength(1);
      expect(store.pushDeliveries).toHaveLength(1);
      // Second run is a no-op: the slot already has a delivery row.
      const second = yield* pushCheckDue().pipe(Effect.provide(adminLayers));
      expect(second).toEqual({ sent: 0 });

      // Forbidden check runs against its own store: the fake resolves
      // `select` without `where`, so role lookups read rows[0] - sharing the
      // main store would see the admin row here instead of the client.
      const forbiddenStore = emptyStore();
      forbiddenStore.coachingUsers.push({ userId: "client-1", role: "client" });

      const error = yield* pushCheckDue().pipe(
        Effect.flip,
        Effect.provide(layersFor(forbiddenStore, "client-1", [])),
      );

      expect(error).toBeInstanceOf(CoachingForbidden);
    }),
  );
});

describe("coachClients", () => {
  it.effect("lists only assigned clients with today statuses", () =>
    Effect.gen(function* () {
      const store = emptyStore();
      // Same frozen-clock note as above: today is 1970-01-01.
      store.coachingUsers.push({ userId: "coach-1", role: "coach" });
      store.coachingUsers.push({ userId: "client-1", role: "client" });
      store.coachingUsers.push({ userId: "client-2", role: "client" });

      const profile = {
        firstName: "Test",
        lastName: "Client",
        bio: null,
        focusHour: 0,
        focusMinute: 0,
        timeZone: "UTC",
        locale: "en",
      };

      store.clientProfiles.push({ userId: "client-1", coachId: "coach-1", ...profile });
      store.clientProfiles.push({ userId: "client-2", coachId: "coach-9", ...profile });
      store.dailyContents.push({
        programDate: "1970-01-01",
        locale: "en",
        focusAudioKey: "focus.wav",
        recharge1AudioKey: "recharge1.wav",
        recharge2AudioKey: "recharge2.wav",
      });
      store.slotCompletions.push({
        userId: "client-1",
        programDate: "1970-01-01",
        slot: "focus",
        listenedAt: new Date(),
      });
      const rows = yield* coachClients().pipe(Effect.provide(layersFor(store, "coach-1", [])));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBe("client-1");
      expect(rows[0]?.focus).toBe("listened");
    }),
  );
});
