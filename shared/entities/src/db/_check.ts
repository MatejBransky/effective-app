/**
 * Compile-time drift check between shared/db's hand-written Drizzle tables and
 * shared/entities's Effect Schema entities - catches divergence at `tsc --noEmit`
 * (part of `pnpm run verify`), instead of waiting for `drift.test.ts` to run. Pattern
 * from https://github.com/kriegcloud/beep-effect (packages/iam/tables/src/_check.ts) -
 * a real production Effect codebase facing the same Drizzle/Effect Schema split.
 *
 * Each line below instantiates `DriftCheck` with a Drizzle table's inferred select row
 * type against the matching Effect Schema's decoded `Type` (not `Encoded` - Drizzle's
 * inferred type already reflects driver-native values like `Date`, which matches `Type`,
 * not the wire-JSON-shaped `Encoded` side). Instantiation fails `tsc` unless the row is
 * assignable to the loosened entity, so a renamed/removed/retyped field on either side
 * breaks the build here. `Loosen` widens branded/literal strings to plain
 * `string` for this comparison only - Drizzle has no concept of branding or literal
 * unions, so a `text` column always infers as `string`, and that's not drift, just a
 * known, documented gap (see docs/data-model.md's "Effect Schema -> Drizzle bridge").
 * jsonb-backed fields (`rules`, `snapshot`, `payload`) are excluded for the same
 * reason: Drizzle infers jsonb as `unknown`, so there's nothing for it to structurally
 * agree or disagree with. This file has no runtime effect - it only exists to fail
 * `tsc` if a field is renamed, removed, or changes type on either side.
 */
import type {
  DomainEvent,
  Host,
  HostFilterSet,
  LeadStage,
  LeadStageTemplate,
  MarketingSequence,
  Member,
  MemberHost,
  SequenceEdge,
  SequenceEnrollment,
  SequenceVersion,
} from "../index.ts";

import type {
  domainEvents,
  hostFilterSets,
  hosts,
  leadStages,
  leadStageTemplates,
  marketingSequences,
  memberHosts,
  members,
  sequenceEdges,
  sequenceEnrollments,
  sequenceVersions,
} from "./schema/index.ts";

type Loosen<T> = T extends string
  ? string
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<Loosen<U>>
    : T extends Date
      ? Date
      : T extends null
        ? null
        : T extends object
          ? { readonly [K in keyof T]: Loosen<T[K]> }
          : T;

// `SequenceAction` isn't checked here - it's a discriminated union on the Effect Schema
// side but one flat table on the Drizzle side (see validators/SequenceAction.ts on the
// db/effect-schema-bridge branch for the same gap in the other direction), so there's no
// single `Type` to assert the flat row shape against without picking one union case.

/**
 * Compile-time assignability probe with no runtime footprint: `DriftCheck<Row, Loosened>`
 * only instantiates when the Drizzle row is assignable to the loosened entity type. A
 * plain `export const x: Loosened = {} as Row` spelling would work too, but the `{}` value
 * is a lie (an empty object is not a row) kept alive only to name `Row` for the annotation
 * check - constraining a type parameter states the same invariant with no value-level
 * assertion at all, so there is nothing to justify with a SAFETY comment.
 */
type DriftCheck<_Row extends Loosened, Loosened> = void;

export type _CheckHost = DriftCheck<typeof hosts.$inferSelect, Loosen<Host>>;

export type _CheckMember = DriftCheck<typeof members.$inferSelect, Loosen<Member>>;

export type _CheckMemberHost = DriftCheck<typeof memberHosts.$inferSelect, Loosen<MemberHost>>;

export type _CheckLeadStageTemplate = DriftCheck<
  typeof leadStageTemplates.$inferSelect,
  Loosen<LeadStageTemplate>
>;

export type _CheckLeadStage = DriftCheck<typeof leadStages.$inferSelect, Loosen<LeadStage>>;

export type _CheckHostFilterSet = DriftCheck<
  typeof hostFilterSets.$inferSelect,
  Omit<Loosen<HostFilterSet>, "rules">
>;

export type _CheckMarketingSequence = DriftCheck<
  typeof marketingSequences.$inferSelect,
  Loosen<MarketingSequence>
>;

export type _CheckSequenceEdge = DriftCheck<
  typeof sequenceEdges.$inferSelect,
  Loosen<SequenceEdge>
>;

export type _CheckSequenceEnrollment = DriftCheck<
  typeof sequenceEnrollments.$inferSelect,
  Loosen<SequenceEnrollment>
>;

export type _CheckSequenceVersion = DriftCheck<
  typeof sequenceVersions.$inferSelect,
  Omit<Loosen<SequenceVersion>, "snapshot">
>;

export type _CheckDomainEvent = DriftCheck<
  typeof domainEvents.$inferSelect,
  Omit<Loosen<DomainEvent>, "payload">
>;
