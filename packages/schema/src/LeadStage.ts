import { Schema } from "effect";

import { HostId, LeadStageId } from "./Id.ts";

/**
 * A host's own, editable CRM pipeline stages - seeded (copied) from `LeadStageTemplate`
 * at host creation, then fully owned by the host from that point on.
 */
export const LeadStage = Schema.Struct({
  id: LeadStageId,
  hostId: HostId,
  name: Schema.String,
  color: Schema.NullOr(Schema.String),
  order: Schema.Number,
  createdAt: Schema.DateFromString,
});
export type LeadStage = typeof LeadStage.Type;
export type LeadStageEncoded = typeof LeadStage.Encoded;
