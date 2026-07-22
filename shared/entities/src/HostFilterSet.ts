import { Schema } from "effect";

import { FilterRule } from "./FilterRule.ts";
import { HostFilterSetId, HostId } from "./Id.ts";

/**
 * A named, reusable set of targeting rules for a host - see "HostFilterSet" in
 * docs/data-model.md for why this replaces one-off nullable FK columns on
 * `MarketingSequence`.
 */
export const HostFilterSet = Schema.Struct({
  id: HostFilterSetId,
  hostId: HostId,
  name: Schema.String,
  rules: FilterRule,
  createdAt: Schema.DateFromString,
});
export type HostFilterSet = typeof HostFilterSet.Type;
export type HostFilterSetEncoded = typeof HostFilterSet.Encoded;
