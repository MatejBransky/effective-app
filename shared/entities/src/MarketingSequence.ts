import { Schema } from "effect";

import { HostFilterSetId, HostId, MarketingSequenceId } from "./Id.ts";

export const MarketingSequence = Schema.Struct({
  id: MarketingSequenceId,
  hostId: HostId,
  name: Schema.String,
  /**
   * Extensible string, validated against a growing Schema union in application code -
   * not a native DB enum or lookup table, so adding a new trigger type never requires a
   * migration.
   */
  triggerType: Schema.String,
  /** `null` means everyone the trigger fires for - see "MarketingSequence" in docs/data-model.md. */
  filterSetId: Schema.NullOr(HostFilterSetId),
  isEnabled: Schema.Boolean,
  createdAt: Schema.DateFromString,
});
export type MarketingSequence = typeof MarketingSequence.Type;
export type MarketingSequenceEncoded = typeof MarketingSequence.Encoded;
