import { Schema } from "effect";

import { ActorType } from "./Actor.ts";
import { HostId, MarketingSequenceId, SequenceVersionId } from "./Id.ts";

/**
 * A full snapshot of a sequence's definition at a point in time (name, triggerType,
 * isEnabled, actions, edges) - enables undo/revert without full event sourcing. See "Why
 * snapshots, not event sourcing" in docs/data-model.md. `snapshot` is intentionally typed
 * as `unknown` here rather than a nested schema, matching its `jsonb` column: it's a
 * denormalized copy of already-validated `MarketingSequence`/`SequenceAction`/
 * `SequenceEdge` rows at write time, not a shape this schema re-validates on decode.
 */
export const SequenceVersion = Schema.Struct({
  id: SequenceVersionId,
  sequenceId: MarketingSequenceId,
  hostId: HostId,
  snapshot: Schema.Unknown,
  /** Set when this version was created *as the result of* reverting to an earlier version. */
  revertedFromVersionId: Schema.NullOr(SequenceVersionId),
  actorType: ActorType,
  actorId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
});
export type SequenceVersion = typeof SequenceVersion.Type;
export type SequenceVersionEncoded = typeof SequenceVersion.Encoded;
