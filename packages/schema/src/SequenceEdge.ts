import { Schema } from "effect";

import { MarketingSequenceId, SequenceActionId, SequenceEdgeId } from "./Id.ts";

/**
 * Explicit adjacency between `SequenceAction`s (a DAG), not a `nextActionId` pointer on
 * the action itself - this is what lets a `CONDITION` action branch.
 */
export const SequenceEdge = Schema.Struct({
  id: SequenceEdgeId,
  sequenceId: MarketingSequenceId,
  fromActionId: SequenceActionId,
  toActionId: SequenceActionId,
  /** `null` = unconditional edge; otherwise which branch of a `CONDITION` action this edge follows. */
  conditionBranch: Schema.NullOr(Schema.Literals(["true", "false"])),
});
export type SequenceEdge = typeof SequenceEdge.Type;
export type SequenceEdgeEncoded = typeof SequenceEdge.Encoded;
