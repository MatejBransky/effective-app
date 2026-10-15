import { Schema } from "effect";

import { CoachingLocale, CoachingRole, ProgramDate, SlotKey } from "./Coaching.ts";

/**
 * Storage shapes mirroring `src/db/schema/Coaching.ts` column-for-column (see
 * the drift test). These are the DB source of truth; the API-facing shapes in
 * `Coaching.ts` are separate on purpose (e.g. `ClientProfile` has no
 * storage-only timestamps, `PushSubscriptionPayload` carries no `userId`).
 */
export const CoachingUser = Schema.Struct({
  userId: Schema.String,
  role: CoachingRole,
  createdAt: Schema.DateTimeUtc,
});

export type CoachingUser = typeof CoachingUser.Type;

export const SlotCompletion = Schema.Struct({
  userId: Schema.String,
  programDate: ProgramDate,
  slot: SlotKey,
  listenedAt: Schema.DateTimeUtc,
});

export type SlotCompletion = typeof SlotCompletion.Type;

export const ListeningProgress = Schema.Struct({
  userId: Schema.String,
  programDate: ProgramDate,
  slot: SlotKey,
  playedSeconds: Schema.Number,
  durationSeconds: Schema.Number,
  reachedEnd: Schema.Boolean,
  updatedAt: Schema.DateTimeUtc,
});

export type ListeningProgress = typeof ListeningProgress.Type;

export const PushSubscription = Schema.Struct({
  endpoint: Schema.String,
  userId: Schema.String,
  p256dh: Schema.String,
  auth: Schema.String,
  locale: CoachingLocale,
  createdAt: Schema.DateTimeUtc,
});

export type PushSubscription = typeof PushSubscription.Type;

export const PushDelivery = Schema.Struct({
  userId: Schema.String,
  programDate: ProgramDate,
  slot: SlotKey,
  sentAt: Schema.DateTimeUtc,
});

export type PushDelivery = typeof PushDelivery.Type;
