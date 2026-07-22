import { Schema } from "effect";

import { ActorType } from "./Actor.ts";
import { DomainEventId, HostId, SequenceActionId } from "./Id.ts";
import { SequenceActionType } from "./SequenceAction.ts";

// `Schema.toTaggedUnion` requires exactly one literal per branch to discriminate on, so
// the doc's "EMAIL" | "SMS" and "TAG_ADD" | "TAG_REMOVE" pairs (same shape, two allowed
// `actionType` values each) are split into one struct per literal rather than one struct
// with a `Schema.Literals([...])` `actionType` field.
const EmailResult = Schema.Struct({
  actionType: Schema.Literal("EMAIL"),
  messageId: Schema.String,
  sentAt: Schema.DateFromString,
  provider: Schema.String,
});

const SmsResult = Schema.Struct({
  actionType: Schema.Literal("SMS"),
  messageId: Schema.String,
  sentAt: Schema.DateFromString,
  provider: Schema.String,
});

const ConditionResult = Schema.Struct({
  actionType: Schema.Literal("CONDITION"),
  branchTaken: Schema.Literals(["true", "false"]),
});

const TagAddResult = Schema.Struct({
  actionType: Schema.Literal("TAG_ADD"),
  tagId: Schema.String.check(Schema.isUUID()),
});

const TagRemoveResult = Schema.Struct({
  actionType: Schema.Literal("TAG_REMOVE"),
  tagId: Schema.String.check(Schema.isUUID()),
});

/** The `result` discriminated union from the `SequenceActionExecuted` example in docs/data-model.md. */
export const SequenceActionExecutionResult = Schema.Union([
  EmailResult,
  SmsResult,
  ConditionResult,
  TagAddResult,
  TagRemoveResult,
]).pipe(Schema.toTaggedUnion("actionType"));
export type SequenceActionExecutionResult = typeof SequenceActionExecutionResult.Type;

/**
 * The one payload shape docs/data-model.md fully specifies, for `eventType:
 * "SequenceActionExecuted"` - covers per-action execution results (legacy's
 * `HostCampaignSequenceRunLogs` + a separate polymorphic result table per action type)
 * via this single per-`eventType` payload shape instead of extra tables.
 */
export const SequenceActionExecutedPayload = Schema.Struct({
  actionId: SequenceActionId,
  actionType: SequenceActionType,
  result: SequenceActionExecutionResult,
});
export type SequenceActionExecutedPayload = typeof SequenceActionExecutedPayload.Type;

/**
 * Generic, append-only audit trail spanning every aggregate - not per-aggregate audit
 * tables, see "Why one generic DomainEvent" in docs/data-model.md. `eventType` is an
 * extensible string (grows the same way as `MarketingSequence.triggerType`), so unlike
 * `SequenceAction.config`, `payload` can't be a single closed discriminated union at the
 * `DomainEvent` level - it's `unknown` here, and callers decode it against whichever
 * payload schema matches the `eventType` they're handling (e.g.
 * `SequenceActionExecutedPayload` for `"SequenceActionExecuted"`).
 */
export const DomainEvent = Schema.Struct({
  id: DomainEventId,
  hostId: HostId,
  /** e.g. "Member", "MemberHost", "MarketingSequence", "SequenceEnrollment". */
  aggregateType: Schema.String,
  /** Polymorphic - references whichever aggregate `aggregateType` names, not a single fixed FK. */
  aggregateId: Schema.String.check(Schema.isUUID()),
  /** e.g. "MemberEnrolled", "SequenceActionExecuted", "SequenceReverted". */
  eventType: Schema.String,
  payload: Schema.Unknown,
  actorType: ActorType,
  actorId: Schema.NullOr(Schema.String),
  occurredAt: Schema.DateFromString,
});
export type DomainEvent = typeof DomainEvent.Type;
export type DomainEventEncoded = typeof DomainEvent.Encoded;
