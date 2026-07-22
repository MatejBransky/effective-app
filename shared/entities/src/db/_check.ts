/**
 * Compile-time drift check between shared/db's hand-written Drizzle tables and
 * shared/entities's Effect Schema entities - catches divergence at `tsc --noEmit`
 * (part of `pnpm run verify`), instead of waiting for `drift.test.ts` to run. Pattern
 * from https://github.com/kriegcloud/beep-effect (packages/iam/tables/src/_check.ts) -
 * a real production Effect codebase facing the same Drizzle/Effect Schema split.
 *
 * Each line asserts a Drizzle table's inferred select row type against the matching
 * Effect Schema's decoded `Type` (not `Encoded` - Drizzle's inferred type already
 * reflects driver-native values like `Date`, which matches `Type`, not the
 * wire-JSON-shaped `Encoded` side). `Loosen` widens branded/literal strings to plain
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

export const _checkHost: Loosen<Host> = {} as typeof hosts.$inferSelect;
export const _checkMember: Loosen<Member> = {} as typeof members.$inferSelect;
export const _checkMemberHost: Loosen<MemberHost> = {} as typeof memberHosts.$inferSelect;
export const _checkLeadStageTemplate: Loosen<LeadStageTemplate> =
  {} as typeof leadStageTemplates.$inferSelect;
export const _checkLeadStage: Loosen<LeadStage> = {} as typeof leadStages.$inferSelect;
export const _checkHostFilterSet: Omit<
  Loosen<HostFilterSet>,
  "rules"
> = {} as typeof hostFilterSets.$inferSelect;
export const _checkMarketingSequence: Loosen<MarketingSequence> =
  {} as typeof marketingSequences.$inferSelect;
export const _checkSequenceEdge: Loosen<SequenceEdge> = {} as typeof sequenceEdges.$inferSelect;
export const _checkSequenceEnrollment: Loosen<SequenceEnrollment> =
  {} as typeof sequenceEnrollments.$inferSelect;
export const _checkSequenceVersion: Omit<
  Loosen<SequenceVersion>,
  "snapshot"
> = {} as typeof sequenceVersions.$inferSelect;
export const _checkDomainEvent: Omit<
  Loosen<DomainEvent>,
  "payload"
> = {} as typeof domainEvents.$inferSelect;
