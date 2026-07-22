import { Schema } from "effect";

import { LeadStageTemplateId } from "./Id.ts";

/**
 * Platform-maintained reference data, not tenant-editable - seeds `LeadStage` rows for
 * a host at creation time, keyed by the host's `businessType`.
 */
export const LeadStageTemplate = Schema.Struct({
  id: LeadStageTemplateId,
  businessType: Schema.String,
  name: Schema.String,
  color: Schema.NullOr(Schema.String),
  order: Schema.Number,
});
export type LeadStageTemplate = typeof LeadStageTemplate.Type;
export type LeadStageTemplateEncoded = typeof LeadStageTemplate.Encoded;
