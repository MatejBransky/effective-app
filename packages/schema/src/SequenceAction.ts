import { Schema } from "effect";

import { FilterRule } from "./FilterRule.ts";
import { MarketingSequenceId, SequenceActionId } from "./Id.ts";

/** Small starter set, extensible the same way as `MarketingSequence.triggerType`. */
export const SequenceActionType = Schema.Literals([
  "EMAIL",
  "SMS",
  "CONDITION",
  "TAG_ADD",
  "TAG_REMOVE",
]);
export type SequenceActionType = typeof SequenceActionType.Type;

const TagId = Schema.String.check(Schema.isUUID());

/**
 * One node in a sequence's action graph. `config`'s shape depends on `type` - see
 * "SequenceAction" in docs/data-model.md - so this is modeled as a discriminated union
 * on `type` rather than a struct with a loosely-typed `config: unknown` field.
 *
 * `EMAIL`/`TAG_ADD` shapes come directly from the doc's examples; `SMS`/`CONDITION`/
 * `TAG_REMOVE` are the smallest shapes consistent with those examples (`CONDITION`
 * reuses the `FilterRule` tree already defined for `HostFilterSet` to decide which
 * branch to take).
 */
const EmailAction = Schema.Struct({
  id: SequenceActionId,
  sequenceId: MarketingSequenceId,
  type: Schema.Literal("EMAIL"),
  offsetMinutes: Schema.Number,
  config: Schema.Struct({
    subject: Schema.String,
    template: Schema.String,
  }),
});

const SmsAction = Schema.Struct({
  id: SequenceActionId,
  sequenceId: MarketingSequenceId,
  type: Schema.Literal("SMS"),
  offsetMinutes: Schema.Number,
  config: Schema.Struct({
    template: Schema.String,
  }),
});

const ConditionAction = Schema.Struct({
  id: SequenceActionId,
  sequenceId: MarketingSequenceId,
  type: Schema.Literal("CONDITION"),
  offsetMinutes: Schema.Number,
  config: Schema.Struct({
    rule: FilterRule,
  }),
});

const TagAddAction = Schema.Struct({
  id: SequenceActionId,
  sequenceId: MarketingSequenceId,
  type: Schema.Literal("TAG_ADD"),
  offsetMinutes: Schema.Number,
  config: Schema.Struct({
    tagId: TagId,
  }),
});

const TagRemoveAction = Schema.Struct({
  id: SequenceActionId,
  sequenceId: MarketingSequenceId,
  type: Schema.Literal("TAG_REMOVE"),
  offsetMinutes: Schema.Number,
  config: Schema.Struct({
    tagId: TagId,
  }),
});

export const SequenceAction = Schema.Union([
  EmailAction,
  SmsAction,
  ConditionAction,
  TagAddAction,
  TagRemoveAction,
]).pipe(Schema.toTaggedUnion("type"));
export type SequenceAction = typeof SequenceAction.Type;
export type SequenceActionEncoded = typeof SequenceAction.Encoded;
