import {
  DomainEvent,
  Host,
  HostFilterSet,
  LeadStage,
  LeadStageTemplate,
  MarketingSequence,
  Member,
  MemberHost,
  SequenceAction,
  SequenceEdge,
  SequenceEnrollment,
  SequenceVersion,
} from "@effective-app/schema";
import { describe, expect, it } from "vitest";
import { AppSchema } from "./schema.ts";

/**
 * Guards against `packages/schema` (Effect Schema, source of truth) and this file's
 * hand-written PowerSync `Table`s drifting apart - same spirit as
 * `packages/db/src/drift.test.ts` does for the Drizzle side, adapted to PowerSync's
 * `Table` API (no `getTableColumns` equivalent - `Object.keys(table.columns)` instead).
 *
 * `id` is excluded from every comparison: `packages/schema` declares it explicitly, but
 * PowerSync's `Table` deliberately never does (auto-added as `TEXT PRIMARY KEY`) - that's
 * not drift, just the one structural difference the SDK requires.
 *
 * `SequenceAction` is a discriminated union in packages/schema but one flat
 * `sequence_actions` table here (`config`'s shape depends on `type` at the application
 * layer) - same gap `packages/db/src/drift.test.ts` documents; its field set is read from
 * any one case, since every case shares the same top-level keys.
 */
const withoutId = (fields: Record<string, unknown>) =>
  Object.keys(fields).filter((key) => key !== "id");

const entities = [
  { name: "Host", fields: withoutId(Host.fields), table: AppSchema.props.hosts },
  { name: "Member", fields: withoutId(Member.fields), table: AppSchema.props.members },
  {
    name: "MemberHost",
    fields: withoutId(MemberHost.fields),
    table: AppSchema.props.member_hosts,
  },
  {
    name: "LeadStageTemplate",
    fields: withoutId(LeadStageTemplate.fields),
    table: AppSchema.props.lead_stage_templates,
  },
  { name: "LeadStage", fields: withoutId(LeadStage.fields), table: AppSchema.props.lead_stages },
  {
    name: "HostFilterSet",
    fields: withoutId(HostFilterSet.fields),
    table: AppSchema.props.host_filter_sets,
  },
  {
    name: "MarketingSequence",
    fields: withoutId(MarketingSequence.fields),
    table: AppSchema.props.marketing_sequences,
  },
  {
    name: "SequenceAction",
    fields: withoutId(SequenceAction.cases.EMAIL.fields),
    table: AppSchema.props.sequence_actions,
  },
  {
    name: "SequenceEdge",
    fields: withoutId(SequenceEdge.fields),
    table: AppSchema.props.sequence_edges,
  },
  {
    name: "SequenceEnrollment",
    fields: withoutId(SequenceEnrollment.fields),
    table: AppSchema.props.sequence_enrollments,
  },
  {
    name: "SequenceVersion",
    fields: withoutId(SequenceVersion.fields),
    table: AppSchema.props.sequence_versions,
  },
  {
    name: "DomainEvent",
    fields: withoutId(DomainEvent.fields),
    table: AppSchema.props.domain_events,
  },
];

describe("Effect Schema <-> PowerSync client schema drift", () => {
  it.each(entities)("$name: schema fields match table columns", ({ fields, table }) => {
    expect(Object.keys(table.columnMap).sort()).toEqual([...fields].sort());
  });
});
