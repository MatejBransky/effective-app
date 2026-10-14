import { Schema } from "effect";

/** Product roles for the life-coaching example (see tasks/life-coaching-glossary.md). */
export const CoachingRole = Schema.Literals(["admin", "coach", "client"]);

export type CoachingRole = typeof CoachingRole.Type;

/** UI/push locales (mirrors Paraglide `availableLanguageTags` on the client). */
export const CoachingLocale = Schema.Literals(["cs", "en"]);

export type CoachingLocale = typeof CoachingLocale.Type;

/** One unlockable audio unit within a program day. */
export const SlotKey = Schema.Literals(["focus", "recharge1", "recharge2"]);

export type SlotKey = typeof SlotKey.Type;

export const SlotKeys: ReadonlyArray<SlotKey> = ["focus", "recharge1", "recharge2"];

/** Lifecycle of a slot (see glossary: locked/unlocked/listened/missed). */
export const SlotStatus = Schema.Literals(["locked", "unlocked", "listened", "missed"]);

export type SlotStatus = typeof SlotStatus.Type;

/**
 * A program-day calendar date in the client's time zone (`YYYY-MM-DD`).
 * Format is enforced at the schedule boundary (`CoachingSchedule`), not here -
 * this brand only keeps program dates distinct from other strings.
 */
export const ProgramDate = Schema.String.pipe(Schema.brand("ProgramDate"));

export type ProgramDate = typeof ProgramDate.Type;

// Bounds (0-23 / 0-59) are enforced in `CoachingSchedule.computeUnlocks`, which
// returns `None` out of range - plain `Int` here keeps the JSON contract simple
// while every reader and the settings write path reject bad values uniformly.
const FocusHour = Schema.Int;
const FocusMinute = Schema.Int;

/** Editable client settings (see glossary: Client Profile, Focus time). */
export const ClientProfile = Schema.Struct({
  userId: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  bio: Schema.NullOr(Schema.String),
  focusHour: FocusHour,
  focusMinute: FocusMinute,
  /** IANA zone id (e.g. `Europe/Prague`) - never a UTC offset (see `CoachingSchedule`). */
  timeZone: Schema.String,
  locale: CoachingLocale,
  /** Owning coach's user id, if assigned. */
  coachId: Schema.NullOr(Schema.String),
});

export type ClientProfile = typeof ClientProfile.Type;

export const ClientSettingsPayload = Schema.Struct({
  firstName: Schema.String,
  lastName: Schema.String,
  bio: Schema.NullOr(Schema.String),
  focusHour: FocusHour,
  focusMinute: FocusMinute,
  timeZone: Schema.String,
  locale: CoachingLocale,
});

export type ClientSettingsPayload = typeof ClientSettingsPayload.Type;

/** Admin-managed audio set for one program date and locale. */
export const DailyContent = Schema.Struct({
  programDate: ProgramDate,
  locale: CoachingLocale,
  focusAudioKey: Schema.String,
  recharge1AudioKey: Schema.String,
  recharge2AudioKey: Schema.String,
});

export type DailyContent = typeof DailyContent.Type;

/** One slot's read-model state within a day view. */
export const SlotView = Schema.Struct({
  slot: SlotKey,
  status: SlotStatus,
  // `FromString` variants: these DTOs cross JSON (HttpApi), where instants
  // travel as ISO strings - plain `DateTimeUtc` only accepts live instances.
  unlockedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  listenedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  /** Present only once unlocked (null while locked). */
  audioKey: Schema.NullOr(Schema.String),
});

export type SlotView = typeof SlotView.Type;

/** A full program day as the client sees it. */
export const DayView = Schema.Struct({
  programDate: ProgramDate,
  slots: Schema.Array(SlotView),
  /** Wall-clock preview of derived recharge times (`HH:MM` in the client's zone). */
  focusTime: Schema.String,
  recharge1Time: Schema.String,
  recharge2Time: Schema.String,
});

export type DayView = typeof DayView.Type;

/** Player heartbeat proving real listening (see glossary: Listening proof). */
export const ProgressReport = Schema.Struct({
  programDate: ProgramDate,
  slot: SlotKey,
  playedSeconds: Schema.Number,
  durationSeconds: Schema.Number,
  reachedEnd: Schema.Boolean,
});

export type ProgressReport = typeof ProgressReport.Type;

export const SubmitPayload = Schema.Struct({
  programDate: ProgramDate,
  slot: SlotKey,
});

export type SubmitPayload = typeof SubmitPayload.Type;

/** Web Push subscription, one per device. */
export const PushSubscriptionPayload = Schema.Struct({
  endpoint: Schema.String,
  p256dh: Schema.String,
  auth: Schema.String,
});

export type PushSubscriptionPayload = typeof PushSubscriptionPayload.Type;

/** Coach dashboard row: one assigned client + today's slot statuses. */
export const CoachClientRow = Schema.Struct({
  userId: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  programDate: ProgramDate,
  focus: SlotStatus,
  recharge1: SlotStatus,
  recharge2: SlotStatus,
});

export type CoachClientRow = typeof CoachClientRow.Type;

/** Caller's own role + profile (null profile until settings are saved). */
export const CoachingMe = Schema.Struct({
  role: CoachingRole,
  profile: Schema.NullOr(ClientProfile),
});

export type CoachingMe = typeof CoachingMe.Type;
