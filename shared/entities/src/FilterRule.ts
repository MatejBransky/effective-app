import { Schema } from "effect";

/**
 * Comparison operators are a fixed, stable union - unlike `field` below, they don't need
 * to grow without a migration.
 */
export const FilterOperator = Schema.Literals([
  "equals",
  "not_equals",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
]);
export type FilterOperator = typeof FilterOperator.Type;

export interface FilterConditionRule {
  readonly type: "condition";
  /** Extensible string - grows the same way as `MarketingSequence.triggerType`. */
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
}

export interface FilterGroupRule {
  readonly type: "group";
  readonly combinator: "and" | "or";
  readonly rules: ReadonlyArray<FilterRule>;
}

/**
 * A recursive boolean expression tree (`AND`/`OR`/`NOT`-shaped nesting via `group`) - see
 * "HostFilterSet" in docs/data-model.md for why this is a tree, not normalized rule rows.
 */
export type FilterRule = FilterConditionRule | FilterGroupRule;

const FilterConditionRule = Schema.Struct({
  type: Schema.Literal("condition"),
  field: Schema.String,
  operator: FilterOperator,
  value: Schema.Unknown,
});

const FilterGroupRule = Schema.Struct({
  type: Schema.Literal("group"),
  combinator: Schema.Literals(["and", "or"]),
  rules: Schema.Array(Schema.suspend((): Schema.Codec<FilterRule> => FilterRule)),
});

export const FilterRule: Schema.Codec<FilterRule> = Schema.Union([
  FilterConditionRule,
  FilterGroupRule,
]).pipe(Schema.toTaggedUnion("type"));
