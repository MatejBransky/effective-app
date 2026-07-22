import { Schema } from "effect";

import { HostId } from "./Id.ts";

export const Host = Schema.Struct({
  id: HostId,
  name: Schema.String,
  slug: Schema.String,
  email: Schema.String,
  timeZone: Schema.String,
  currency: Schema.String,
  /**
   * Extensible string (e.g. "gym", "yoga_studio", "martial_arts", "spa"), not a closed
   * union - same growability as `MarketingSequence.triggerType` - drives `LeadStage`
   * seeding from `LeadStageTemplate`.
   */
  businessType: Schema.String,
  createdAt: Schema.DateFromString,
});
export type Host = typeof Host.Type;
export type HostEncoded = typeof Host.Encoded;
