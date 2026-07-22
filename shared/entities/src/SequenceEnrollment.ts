import { Schema } from "effect";

import { HostId, MarketingSequenceId, MemberId, SequenceEnrollmentId } from "./Id.ts";

/**
 * One run of a sequence for one member. Lifecycle is expressed via nullable timestamps,
 * not a status enum - "current position in the sequence" is recomputed from
 * `SequenceAction`/`SequenceEdge` plus these timestamps, not persisted as authoritative
 * state. See "SequenceEnrollment" in docs/data-model.md.
 */
export const SequenceEnrollment = Schema.Struct({
  id: SequenceEnrollmentId,
  hostId: HostId,
  sequenceId: MarketingSequenceId,
  memberId: MemberId,
  triggeredAt: Schema.DateFromString,
  finishedAt: Schema.NullOr(Schema.DateFromString),
  cancelledAt: Schema.NullOr(Schema.DateFromString),
});
export type SequenceEnrollment = typeof SequenceEnrollment.Type;
export type SequenceEnrollmentEncoded = typeof SequenceEnrollment.Encoded;
