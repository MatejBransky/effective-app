import {
  ClientSettingsPayload,
  CoachClientRow,
  CoachingMe,
  DayView,
  ProgressReport,
  PushSubscriptionPayload,
  SlotView,
  SubmitPayload,
} from "@repo/entities";
import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";
import { Auth } from "./Auth.ts";
import { CoachingDbError } from "./UserScopedDb.ts";

export class CoachingNotFound extends Schema.TaggedError<CoachingNotFound>()(
  "CoachingNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class CoachingForbidden extends Schema.TaggedError<CoachingForbidden>()(
  "CoachingForbidden",
  {},
  { httpApiStatus: 403 },
) {}

/** Submit attempted without listening proof (see glossary). */
export class ProofNotMet extends Schema.TaggedError<ProofNotMet>()(
  "ProofNotMet",
  {},
  {
    httpApiStatus: 422,
  },
) {}

/** Submit attempted before the unlock instant. */
export class SlotLocked extends Schema.TaggedError<SlotLocked>()(
  "SlotLocked",
  {},
  {
    httpApiStatus: 409,
  },
) {}

/** Settings payload that cannot produce a schedule (bad time or zone). */
export class InvalidSettings extends Schema.TaggedError<InvalidSettings>()(
  "InvalidSettings",
  {},
  { httpApiStatus: 400 },
) {}

const DayQuery = Schema.Struct({ date: Schema.String });

/**
 * Life-coaching example slice (see tasks/life-coaching-example.md). All routes
 * require a Bearer JWT (`Auth`); role checks (`admin`/`coach`/`client`) happen
 * inside handlers against `coaching_users`, and row isolation is enforced by
 * Postgres RLS on `app.user_id`, never by trusting the client.
 */
export const CoachingGroup = HttpApiGroup.make("Coaching")
  .add(
    HttpApiEndpoint.get("me", "/coaching/me", {
      success: CoachingMe,
      error: [CoachingDbError, CoachingForbidden],
    }),
  )
  .add(
    HttpApiEndpoint.put("settings", "/coaching/settings", {
      payload: ClientSettingsPayload,
      success: CoachingMe,
      error: [CoachingDbError, CoachingForbidden, InvalidSettings],
    }),
  )
  .add(
    HttpApiEndpoint.get("today", "/coaching/today", {
      success: DayView,
      error: [CoachingDbError, CoachingForbidden, CoachingNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("day", "/coaching/day", {
      query: DayQuery,
      success: DayView,
      error: [CoachingDbError, CoachingForbidden, CoachingNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post("progress", "/coaching/progress", {
      payload: ProgressReport,
      success: Schema.Struct({ ok: Schema.Literal(true) }),
      error: [CoachingDbError, CoachingForbidden],
    }),
  )
  .add(
    HttpApiEndpoint.post("submit", "/coaching/submit", {
      payload: SubmitPayload,
      success: SlotView,
      error: [CoachingDbError, CoachingForbidden, CoachingNotFound, ProofNotMet, SlotLocked],
    }),
  )
  .add(
    HttpApiEndpoint.get("audio", "/coaching/audio/:audioKey", {
      params: Schema.Struct({ audioKey: Schema.String }),
      query: DayQuery,
      success: HttpApiSchema.StreamUint8Array({ contentType: "audio/wav" }),
      error: [CoachingDbError, CoachingForbidden, CoachingNotFound, SlotLocked],
    }),
  )
  .add(
    HttpApiEndpoint.get("coachClients", "/coaching/coach/clients", {
      success: Schema.Array(CoachClientRow),
      error: [CoachingDbError, CoachingForbidden, CoachingNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("coachClientDay", "/coaching/coach/clients/:userId/day", {
      params: Schema.Struct({ userId: Schema.String }),
      query: DayQuery,
      success: DayView,
      error: [CoachingDbError, CoachingForbidden, CoachingNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post("pushSubscribe", "/coaching/push/subscriptions", {
      payload: PushSubscriptionPayload,
      success: Schema.Struct({ ok: Schema.Literal(true) }),
      error: [CoachingDbError, CoachingForbidden],
    }),
  )
  .add(
    HttpApiEndpoint.post("pushUnsubscribe", "/coaching/push/unsubscribe", {
      payload: Schema.Struct({ endpoint: Schema.String }),
      success: Schema.Struct({ ok: Schema.Literal(true) }),
      error: [CoachingDbError],
    }),
  )
  .add(
    HttpApiEndpoint.post("pushCheckDue", "/coaching/push/check-due", {
      success: Schema.Struct({ sent: Schema.Number }),
      error: [CoachingDbError, CoachingForbidden],
    }),
  )
  .middleware(Auth);
