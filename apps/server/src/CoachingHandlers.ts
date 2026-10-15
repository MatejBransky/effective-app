import {
  clientProfiles,
  coachingUsers,
  dailyContents,
  listeningProgress,
  pushDeliveries,
  pushSubscriptions,
  slotCompletions,
} from "@repo/entities/db";
import {
  computeUnlocks,
  formatWallTime,
  meetsListeningProof,
  programDateOf,
  slotStatus,
  SlotKeys,
} from "@repo/entities";
import type {
  ClientProfile,
  ClientSettingsPayload,
  CoachClientRow,
  CoachingRole,
  DayView,
  ProgramDate,
  ProgressReport,
  PushSubscriptionPayload,
  SlotKey,
  SlotView,
  SubmitPayload,
  Unlocks,
} from "@repo/entities";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@repo/entities/db";
import { Context, DateTime, Effect, Layer, Match, Option, Schema, Stream } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { readFile } from "node:fs/promises";
import webPush from "web-push";
import { CoachingDbError, UserScopedDb } from "./UserScopedDb.ts";
import { CurrentHost } from "./CurrentHost.ts";
import { Api } from "./Api.ts";
import {
  CoachingForbidden,
  CoachingNotFound,
  InvalidSettings,
  ProofNotMet,
  SlotLocked,
} from "./CoachingApi.ts";

export class AudioMissing extends Schema.TaggedError<AudioMissing>()("AudioMissing", {}) {}

/**
 * Static audio fixture store. Swappable via `Layer` (same rule as
 * `JwtVerifier`): `AudioStoreLive` reads `fixtures/audio` from disk, tests
 * provide an in-memory map. Keys are allowlisted to block path traversal.
 */
export class AudioStore extends Context.Service<
  AudioStore,
  {
    readonly readAudio: (key: string) => Effect.Effect<Uint8Array, AudioMissing>;
  }
>()("effective-app/AudioStore") {}

const AUDIO_KEY_PATTERN = /^[a-z0-9-]+\.wav$/;

export const AudioStoreLive = Layer.succeed(AudioStore, {
  readAudio: (key) =>
    Effect.tryPromise({
      try: async () => {
        if (!AUDIO_KEY_PATTERN.test(key)) throw new Error(`bad audio key: ${key}`);

        return new Uint8Array(await readFile(`fixtures/audio/${key}`));
      },
      catch: () => new AudioMissing(),
    }),
});

export class PushSendError extends Schema.TaggedError<PushSendError>()("PushSendError", {}) {}

/** Web Push notification content - produced by `pushText`, sent via `PushSender`. */
export interface PushPayload {
  readonly title: string;
  readonly body: string;
}

/** Web Push sender (VAPID). Swappable so tests never hit a real push service. */
export class PushSender extends Context.Service<
  PushSender,
  {
    readonly send: (
      subscription: PushSubscriptionPayload,
      payload: PushPayload,
    ) => Effect.Effect<void, PushSendError>;
  }
>()("effective-app/PushSender") {}

export const PushSenderLive = (options: {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
}) =>
  Layer.effect(
    PushSender,
    Effect.sync(() => {
      webPush.setVapidDetails(options.subject, options.publicKey, options.privateKey);

      return {
        send: (subscription, payload) =>
          Effect.tryPromise({
            try: () =>
              webPush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: { p256dh: subscription.p256dh, auth: subscription.auth },
                },
                JSON.stringify(payload),
              ),
            catch: () => new PushSendError(),
          }),
      };
    }),
  );

type DbTx = NodePgDatabase<typeof schema>;

type ProfileRow = typeof clientProfiles.$inferSelect;

type ContentRow = typeof dailyContents.$inferSelect;

const toUtc = (date: Date): DateTime.Utc => Option.getOrThrow(DateTime.make(date));

const orUndefined = <A>(option: Option.Option<A>): A | undefined => Option.getOrUndefined(option);

const roleOf = (tx: DbTx, subject: string): Promise<string | null> =>
  tx
    .select()
    .from(coachingUsers)
    .where(eq(coachingUsers.userId, subject))
    .then((rows) => rows[0]?.role ?? null);

/** Fails with `CoachingForbidden` unless the caller holds one of the roles. */
// SAFETY: `CoachingRole` is a string-literal union, so widening the array only
// admits `includes`' string parameter for a runtime equality check - no value
// is converted or fabricated.
const requireRole = (role: string | null, ...allowed: ReadonlyArray<CoachingRole>) =>
  role !== null && (allowed as ReadonlyArray<string>).includes(role)
    ? Effect.void
    : Effect.fail(new CoachingForbidden());

const profileOf = (tx: DbTx, userId: string): Promise<ProfileRow | null> =>
  tx
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .then((rows) => rows[0] ?? null);

const toClientProfile = (row: ProfileRow): ClientProfile => ({
  userId: row.userId,
  firstName: row.firstName,
  lastName: row.lastName,
  bio: row.bio,
  focusHour: row.focusHour,
  focusMinute: row.focusMinute,
  timeZone: row.timeZone,
  locale: row.locale === "cs" ? "cs" : "en",
  coachId: row.coachId,
});

// SAFETY: `slotCompletions` rows are written only by `submitSlot` with a
// schema-validated `SlotKey`, and the coaching tables are never client-synced -
// the DB round-trip preserves the exact string, so re-narrowing `r.slot` is sound.
const completionsOf = (
  tx: DbTx,
  userId: string,
  programDate: string,
): Promise<Map<SlotKey, DateTime.Utc>> =>
  tx
    .select()
    .from(slotCompletions)
    .where(and(eq(slotCompletions.userId, userId), eq(slotCompletions.programDate, programDate)))
    .then((rows) => new Map(rows.map((r) => [r.slot as SlotKey, toUtc(r.listenedAt)] as const)));

const contentOf = (tx: DbTx, programDate: string, locale: string): Promise<ContentRow | null> =>
  tx
    .select()
    .from(dailyContents)
    .where(and(eq(dailyContents.programDate, programDate), eq(dailyContents.locale, locale)))
    .then(async (rows) => {
      if (rows[0]) return rows[0];

      if (locale === "en") return null;

      const fallback = await tx
        .select()
        .from(dailyContents)
        .where(and(eq(dailyContents.programDate, programDate), eq(dailyContents.locale, "en")));

      return fallback[0] ?? null;
    });

const audioKeyForSlot = (content: ContentRow | null, slot: SlotKey): string | null => {
  if (!content) return null;

  return Match.value(slot).pipe(
    Match.when("focus", () => content.focusAudioKey),
    Match.when("recharge1", () => content.recharge1AudioKey),
    Match.when("recharge2", () => content.recharge2AudioKey),
    Match.exhaustive,
  );
};

interface DayParts {
  readonly profile: ProfileRow;
  readonly programDate: ProgramDate;
  readonly unlocks: Unlocks;
  readonly today: ProgramDate;
  readonly content: ContentRow | null;
  readonly completions: Map<SlotKey, DateTime.Utc>;
}

/** Pure assembly of the read model - all fallible inputs resolved beforehand. */
const assembleDayView = (parts: DayParts, now: DateTime.Utc): DayView => {
  const unlockAt = {
    focus: parts.unlocks.focus,
    recharge1: parts.unlocks.recharge1,
    recharge2: parts.unlocks.recharge2,
  };

  const slots: Array<SlotView> = SlotKeys.map((slot) => {
    const listenedAt = parts.completions.get(slot) ?? null;

    return {
      slot,
      status: slotStatus({
        unlockAt: unlockAt[slot],
        listenedAt,
        programDate: parts.programDate,
        today: parts.today,
        now,
      }),
      unlockedAt: unlockAt[slot],
      listenedAt,
      audioKey: audioKeyForSlot(parts.content, slot),
    };
  });

  // The zone already proved valid via `computeUnlocks` above, so wall-time
  // formatting cannot fail here.
  const time = (utc: DateTime.Utc): string =>
    Option.getOrThrow(formatWallTime(utc, parts.profile.timeZone));

  return {
    programDate: parts.programDate,
    slots,
    focusTime: time(parts.unlocks.focus),
    recharge1Time: time(parts.unlocks.recharge1),
    recharge2Time: time(parts.unlocks.recharge2),
  };
};

/** Full day read-model for one client. Pure read - never writes. */
const dayViewForClient = (userId: string, programDate: ProgramDate) =>
  Effect.gen(function* () {
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const profile = yield* userScopedDb
      .query((tx) => profileOf(tx, userId))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    if (!profile) return yield* new CoachingNotFound();
    const unlocks = orUndefined(computeUnlocks(profile, programDate));

    if (!unlocks) return yield* new CoachingNotFound();
    const today = orUndefined(programDateOf(now, profile.timeZone));

    if (!today) return yield* new CoachingDbError();

    const rest = yield* userScopedDb
      .query(async (tx) => ({
        content: await contentOf(tx, programDate, profile.locale),
        completions: await completionsOf(tx, userId, programDate),
      }))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    return assembleDayView({ profile, programDate, unlocks, today, ...rest }, now);
  });

export const coachingMe = () =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "admin", "coach", "client");

    const profile = yield* userScopedDb
      .query((tx) => profileOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    return {
      // SAFETY: `requireRole` above failed the Effect unless `role` is one of the
      // allowed literals - the cast restates that checked invariant, and any
      // non-conforming DB value would already have been rejected.
      role: role as CoachingRole,
      profile: profile ? toClientProfile(profile) : null,
    };
  });

export const updateSettings = (payload: ClientSettingsPayload) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client");
    // Reject settings that cannot produce a schedule before storing them.
    const trialDate = orUndefined(programDateOf(now, payload.timeZone));

    const trialUnlocks = trialDate
      ? orUndefined(
          computeUnlocks(
            {
              focusHour: payload.focusHour,
              focusMinute: payload.focusMinute,
              timeZone: payload.timeZone,
            },
            trialDate,
          ),
        )
      : undefined;

    if (!trialDate || !trialUnlocks) return yield* new InvalidSettings();
    yield* userScopedDb
      .query((tx) =>
        tx
          .insert(clientProfiles)
          .values({ userId: actor.subject, ...payload })
          .onConflictDoUpdate({ target: clientProfiles.userId, set: { ...payload } }),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));

    return yield* coachingMe();
  });

export const coachingToday = () =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client");

    const profile = yield* userScopedDb
      .query((tx) => profileOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    if (!profile) return yield* new CoachingNotFound();
    const today = orUndefined(programDateOf(now, profile.timeZone));

    if (!today) return yield* new CoachingDbError();

    return yield* dayViewForClient(actor.subject, today);
  });

export const coachingDay = (query: { readonly date: string }) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client");

    // SAFETY: `ProgramDate` is a compile-time brand over `string` with no runtime
    // representation - any query string round-trips through `computeUnlocks`' strict
    // `YYYY-MM-DD` parse (malformed dates become `NotFound`) and DB equality lookups
    // (which simply miss), so the brand cannot fabricate a readable row.
    return yield* dayViewForClient(actor.subject, query.date as ProgramDate);
  });

export const reportProgress = (report: ProgressReport) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client");
    const at = new Date(now.epochMilliseconds);

    // Monotonic merge: a late-arriving heartbeat (e.g. an in-flight interval
    // tick) must never un-reach the end or shrink played time below what the
    // player already reported - otherwise submit could flake on fetch
    // reordering. Proof stays one-directional.
    const existing = yield* userScopedDb
      .query((tx) =>
        tx
          .select()
          .from(listeningProgress)
          .where(
            and(
              eq(listeningProgress.userId, actor.subject),
              eq(listeningProgress.programDate, report.programDate),
              eq(listeningProgress.slot, report.slot),
            ),
          )
          .then((rows) => rows[0] ?? null),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));

    const merged = {
      playedSeconds: Math.max(existing?.playedSeconds ?? 0, report.playedSeconds),
      durationSeconds: Math.max(existing?.durationSeconds ?? 0, report.durationSeconds),
      reachedEnd: (existing?.reachedEnd ?? false) || report.reachedEnd,
    };

    yield* userScopedDb
      .query((tx) =>
        tx
          .insert(listeningProgress)
          .values({
            userId: actor.subject,
            programDate: report.programDate,
            slot: report.slot,
            ...merged,
            updatedAt: at,
          })
          .onConflictDoUpdate({
            target: [
              listeningProgress.userId,
              listeningProgress.programDate,
              listeningProgress.slot,
            ],
            set: { ...merged, updatedAt: at },
          }),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));

    return { ok: true as const };
  });

export const submitSlot = (payload: SubmitPayload) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client");

    const profile = yield* userScopedDb
      .query((tx) => profileOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    if (!profile) return yield* new CoachingNotFound();
    const unlocks = orUndefined(computeUnlocks(profile, payload.programDate));

    if (!unlocks) return yield* new CoachingNotFound();

    const unlockAt = Match.value(payload.slot).pipe(
      Match.when("focus", () => unlocks.focus),
      Match.when("recharge1", () => unlocks.recharge1),
      Match.when("recharge2", () => unlocks.recharge2),
      Match.exhaustive,
    );

    if (unlockAt.epochMilliseconds > now.epochMilliseconds) return yield* new SlotLocked();

    const progress = yield* userScopedDb
      .query((tx) =>
        tx
          .select()
          .from(listeningProgress)
          .where(
            and(
              eq(listeningProgress.userId, actor.subject),
              eq(listeningProgress.programDate, payload.programDate),
              eq(listeningProgress.slot, payload.slot),
            ),
          )
          .then((rows) => rows[0] ?? null),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));

    if (
      !progress ||
      !meetsListeningProof({
        programDate: payload.programDate,
        slot: payload.slot,
        playedSeconds: progress.playedSeconds,
        durationSeconds: progress.durationSeconds,
        reachedEnd: progress.reachedEnd,
      })
    ) {
      return yield* new ProofNotMet();
    }

    yield* userScopedDb
      .query((tx) =>
        tx
          .insert(slotCompletions)
          .values({
            userId: actor.subject,
            programDate: payload.programDate,
            slot: payload.slot,
            listenedAt: new Date(now.epochMilliseconds),
          })
          .onConflictDoNothing(),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));
    const view = yield* dayViewForClient(actor.subject, payload.programDate);
    const slot = view.slots.find((s) => s.slot === payload.slot);

    if (!slot) return yield* new CoachingNotFound();

    return slot;
  });

export const serveAudio = (
  params: { readonly audioKey: string },
  query: { readonly date: string },
) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const audioStore = yield* AudioStore;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client", "admin");
    // SAFETY: `ProgramDate` is a compile-time brand over `string` (see `coachingDay`
    // above) - malformed dates become `NotFound` via `computeUnlocks`' strict parse
    // and miss every DB equality lookup, so the brand cannot fabricate a row.
    const view = yield* dayViewForClient(actor.subject, query.date as ProgramDate);
    const slot = view.slots.find((s) => s.audioKey === params.audioKey);

    if (!slot || slot.status === "locked") return yield* new SlotLocked();

    const bytes = yield* audioStore
      .readAudio(params.audioKey)
      .pipe(Effect.mapError(() => new CoachingNotFound()));

    return Stream.fromIterable([bytes]).pipe(Stream.mapError((cause) => cause));
  });

export const coachClients = () =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "coach");

    const profiles = yield* userScopedDb
      .query((tx) => tx.select().from(clientProfiles))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    const rows: Array<CoachClientRow> = [];

    for (const profile of profiles.filter((p) => p.coachId === actor.subject)) {
      const today = orUndefined(programDateOf(now, profile.timeZone));

      if (!today) continue;
      const view = yield* dayViewForClient(profile.userId, today);
      const bySlot = new Map(view.slots.map((s) => [s.slot, s.status] as const));
      rows.push({
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        programDate: today,
        focus: bySlot.get("focus") ?? "locked",
        recharge1: bySlot.get("recharge1") ?? "locked",
        recharge2: bySlot.get("recharge2") ?? "locked",
      });
    }

    return rows;
  });

export const coachClientDay = (
  params: { readonly userId: string },
  query: { readonly date: string },
) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "coach");

    const profile = yield* userScopedDb
      .query((tx) => profileOf(tx, params.userId))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    if (!profile || profile.coachId !== actor.subject) return yield* new CoachingForbidden();

    // SAFETY: `ProgramDate` is a compile-time brand over `string` (see `coachingDay`
    // above) - malformed dates become `NotFound` via `computeUnlocks`' strict parse
    // and miss every DB equality lookup, so the brand cannot fabricate a row.
    return yield* dayViewForClient(params.userId, query.date as ProgramDate);
  });

const pushText = (locale: string, slot: SlotKey): PushPayload => {
  const cs = locale === "cs";

  switch (slot) {
    case "focus":
      return cs
        ? { title: "Daily Focus je odemčený", body: "Tvůj dnešní Daily Focus je připravený." }
        : { title: "Daily Focus unlocked", body: "Your Daily Focus for today is ready." };
    case "recharge1":
      return cs
        ? { title: "Recharge #1 je odemčený", body: "První dnešní recharge na tebe čeká." }
        : { title: "Recharge #1 unlocked", body: "Your first recharge for today is waiting." };
    case "recharge2":
      return cs
        ? { title: "Recharge #2 je odemčený", body: "Druhý dnešní recharge na tebe čeká." }
        : { title: "Recharge #2 unlocked", body: "Your second recharge for today is waiting." };
  }
};

export const pushSubscribe = (payload: PushSubscriptionPayload) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "client");

    const profile = yield* userScopedDb
      .query((tx) => profileOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    const at = new Date(now.epochMilliseconds);

    const set = {
      userId: actor.subject,
      p256dh: payload.p256dh,
      auth: payload.auth,
      locale: profile?.locale ?? "en",
    };

    yield* userScopedDb
      .query((tx) =>
        tx
          .insert(pushSubscriptions)
          .values({ endpoint: payload.endpoint, createdAt: at, ...set })
          .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set }),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));

    return { ok: true as const };
  });

export const pushUnsubscribe = (payload: { readonly endpoint: string }) =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    yield* userScopedDb
      .query((tx) =>
        tx
          .delete(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.endpoint, payload.endpoint),
              eq(pushSubscriptions.userId, actor.subject),
            ),
          ),
      )
      .pipe(Effect.mapError(() => new CoachingDbError()));

    return { ok: true as const };
  });

interface DueJob {
  readonly userId: string;
  readonly programDate: string;
  readonly slot: SlotKey;
  readonly subscription: {
    readonly endpoint: string;
    readonly p256dh: string;
    readonly auth: string;
  };
  readonly locale: string;
}

/**
 * Sends unlock notifications due right now. Idempotent per (user, date, slot)
 * via `push_deliveries`. Runs as an admin-triggered job (local E2E hits it
 * directly; production wires it to a scheduler) - sends happen outside the
 * read transaction, deliveries are recorded only on success so a failed send
 * retries on the next run.
 */
export const pushCheckDue = () =>
  Effect.gen(function* () {
    const actor = yield* CurrentHost;
    const userScopedDb = yield* UserScopedDb;
    const pushSender = yield* PushSender;
    const now = yield* DateTime.now;

    const role = yield* userScopedDb
      .query((tx) => roleOf(tx, actor.subject))
      .pipe(Effect.mapError(() => new CoachingDbError()));

    yield* requireRole(role, "admin");

    const jobs = yield* userScopedDb
      .query(async (tx): Promise<Array<DueJob>> => {
        const profiles = await tx.select().from(clientProfiles);
        const subs = await tx.select().from(pushSubscriptions);
        const subsByUser = new Map<string, typeof subs>();

        for (const sub of subs) {
          const list = subsByUser.get(sub.userId) ?? [];
          list.push(sub);
          subsByUser.set(sub.userId, list);
        }

        const due: Array<DueJob> = [];

        for (const profile of profiles) {
          const today = orUndefined(programDateOf(now, profile.timeZone));

          if (!today) continue;
          const unlocks = orUndefined(computeUnlocks(profile, today));

          if (!unlocks) continue;
          const userSubs = subsByUser.get(profile.userId) ?? [];

          if (userSubs.length === 0) continue;
          const completions = await completionsOf(tx, profile.userId, today);

          const unlockAt = {
            focus: unlocks.focus,
            recharge1: unlocks.recharge1,
            recharge2: unlocks.recharge2,
          };

          for (const slot of SlotKeys) {
            if (completions.has(slot)) continue;

            if (unlockAt[slot].epochMilliseconds > now.epochMilliseconds) continue;

            const delivered = await tx
              .select()
              .from(pushDeliveries)
              .where(
                and(
                  eq(pushDeliveries.userId, profile.userId),
                  eq(pushDeliveries.programDate, today),
                  eq(pushDeliveries.slot, slot),
                ),
              );

            if (delivered.length > 0) continue;

            for (const sub of userSubs) {
              due.push({
                userId: profile.userId,
                programDate: today,
                slot,
                subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                locale: sub.locale,
              });
            }
          }
        }

        return due;
      })
      .pipe(Effect.mapError(() => new CoachingDbError()));

    let sent = 0;

    for (const job of jobs) {
      const result = yield* pushSender
        .send(job.subscription, pushText(job.locale, job.slot))
        .pipe(Effect.option);

      if (Option.isSome(result)) {
        sent += 1;
        yield* userScopedDb
          .query((tx) =>
            tx
              .insert(pushDeliveries)
              .values({
                userId: job.userId,
                programDate: job.programDate,
                slot: job.slot,
                sentAt: new Date(now.epochMilliseconds),
              })
              .onConflictDoNothing(),
          )
          .pipe(Effect.mapError(() => new CoachingDbError()));
      }
    }

    return { sent };
  });

export const CoachingGroupLive = HttpApiBuilder.group(Api, "Coaching", (handlers) =>
  handlers
    .handle("me", () => coachingMe())
    .handle("settings", ({ payload }) => updateSettings(payload))
    .handle("today", () => coachingToday())
    .handle("day", ({ query }) => coachingDay(query))
    .handle("progress", ({ payload }) => reportProgress(payload))
    .handle("submit", ({ payload }) => submitSlot(payload))
    .handle("audio", ({ params, query }) => serveAudio(params, query))
    .handle("coachClients", () => coachClients())
    .handle("coachClientDay", ({ params, query }) => coachClientDay(params, query))
    .handle("pushSubscribe", ({ payload }) => pushSubscribe(payload))
    .handle("pushUnsubscribe", ({ payload }) => pushUnsubscribe(payload))
    .handle("pushCheckDue", () => pushCheckDue()),
);
