import {
  boolean,
  doublePrecision,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { adminAllPolicy, coachReadPolicy, userIsolationPolicy } from "../rls.ts";

/**
 * Coaching tables (see tasks/life-coaching-glossary.md). Unlike the host/member
 * tables these are NOT PowerSync-synced - the coaching slice reads them over a
 * direct API (see tasks/life-coaching-example.md) - so there is no publication
 * to extend.
 *
 * Row isolation keys on the JWT `sub` (`app.user_id`, set per-request by
 * apps/server's `UserScopedDb`), not on `app.host_id`: a coach and their
 * clients fundamentally span tenants. Owners read/write their own rows,
 * coaches read assigned clients via `coach_read` policies, product admins
 * bypass via `admin_all`. Seed/migration scripts connect as the table owner,
 * which bypasses RLS.
 */
export const coachingUsers = pgTable(
  "coaching_users",
  {
    userId: text("user_id").primaryKey(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  // NOTE: deliberately no `admin_all` here - that policy's `exists` subquery
  // reads this same table, which recurses infinitely (every other coaching
  // table's `admin_all` already funnels through this table's `user_isolation`
  // for the caller's own row, which terminates). Admins never need to list
  // other users' role rows; roles are assigned by owner-connected seeds.
  (t) => [userIsolationPolicy(t.userId)],
).enableRLS();

export const clientProfiles = pgTable(
  "client_profiles",
  {
    userId: text("user_id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    bio: text("bio"),
    focusHour: integer("focus_hour").notNull(),
    focusMinute: integer("focus_minute").notNull(),
    timeZone: text("time_zone").notNull(),
    locale: text("locale").notNull(),
    coachId: text("coach_id"),
  },
  (t) => [userIsolationPolicy(t.userId), coachReadPolicy(t.userId), adminAllPolicy()],
).enableRLS();

export const dailyContents = pgTable(
  "daily_contents",
  {
    programDate: text("program_date").notNull(),
    locale: text("locale").notNull(),
    focusAudioKey: text("focus_audio_key").notNull(),
    recharge1AudioKey: text("recharge1_audio_key").notNull(),
    recharge2AudioKey: text("recharge2_audio_key").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.programDate, t.locale] }),
    // One shared set per day+locale, readable by every authenticated caller.
    // Writes happen only via owner-connected seed scripts, never app_user.
    pgPolicy("authenticated_read", { for: "select", using: sql`true` }),
  ],
).enableRLS();

/** Terminal `listened` marks - one row per completed slot, never updated. */
export const slotCompletions = pgTable(
  "slot_completions",
  {
    userId: text("user_id").notNull(),
    programDate: text("program_date").notNull(),
    slot: text("slot").notNull(),
    listenedAt: timestamp("listened_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.programDate, t.slot] }),
    userIsolationPolicy(t.userId),
    coachReadPolicy(t.userId),
    adminAllPolicy(),
  ],
).enableRLS();

/** Latest player heartbeat per slot - backs submit validation. */
export const listeningProgress = pgTable(
  "listening_progress",
  {
    userId: text("user_id").notNull(),
    programDate: text("program_date").notNull(),
    slot: text("slot").notNull(),
    playedSeconds: doublePrecision("played_seconds").notNull(),
    durationSeconds: doublePrecision("duration_seconds").notNull(),
    reachedEnd: boolean("reached_end").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.programDate, t.slot] }),
    userIsolationPolicy(t.userId),
    coachReadPolicy(t.userId),
    adminAllPolicy(),
  ],
).enableRLS();

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: text("user_id").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    locale: text("locale").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [userIsolationPolicy(t.userId), adminAllPolicy()],
).enableRLS();

/** Scheduler send log - doubles as the send idempotency key. */
export const pushDeliveries = pgTable(
  "push_deliveries",
  {
    userId: text("user_id").notNull(),
    programDate: text("program_date").notNull(),
    slot: text("slot").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.programDate, t.slot] }),
    userIsolationPolicy(t.userId),
    coachReadPolicy(t.userId),
    adminAllPolicy(),
  ],
).enableRLS();
