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
} from "@repo/schema";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  domainEvents,
  hostFilterSets,
  hosts,
  leadStages,
  leadStageTemplates,
  marketingSequences,
  memberHosts,
  members,
  sequenceActions,
  sequenceEdges,
  sequenceEnrollments,
  sequenceVersions,
} from "./schema.ts";

/**
 * Guards against `packages/schema` (Effect Schema, source of truth) and this file's
 * hand-written Drizzle SQLite tables drifting apart - same spirit, and now the same
 * mechanism (`getTableColumns`), as `packages/db/src/drift.test.ts` does for the Postgres
 * side, now that the client schema is a Drizzle schema too (see `schema.ts`'s
 * `DrizzleAppSchema` comment for why - one client-side schema instead of two).
 *
 * `SequenceAction` is a discriminated union in packages/schema but one flat
 * `sequence_actions` table here (`config`'s shape depends on `type` at the application
 * layer) - same gap `packages/db/src/drift.test.ts` documents; its field set is read from
 * any one case, since every case shares the same top-level keys.
 */
const entities = [
  { name: "Host", fields: Object.keys(Host.fields), table: hosts },
  { name: "Member", fields: Object.keys(Member.fields), table: members },
  { name: "MemberHost", fields: Object.keys(MemberHost.fields), table: memberHosts },
  {
    name: "LeadStageTemplate",
    fields: Object.keys(LeadStageTemplate.fields),
    table: leadStageTemplates,
  },
  { name: "LeadStage", fields: Object.keys(LeadStage.fields), table: leadStages },
  { name: "HostFilterSet", fields: Object.keys(HostFilterSet.fields), table: hostFilterSets },
  {
    name: "MarketingSequence",
    fields: Object.keys(MarketingSequence.fields),
    table: marketingSequences,
  },
  {
    name: "SequenceAction",
    fields: Object.keys(SequenceAction.cases.EMAIL.fields),
    table: sequenceActions,
  },
  { name: "SequenceEdge", fields: Object.keys(SequenceEdge.fields), table: sequenceEdges },
  {
    name: "SequenceEnrollment",
    fields: Object.keys(SequenceEnrollment.fields),
    table: sequenceEnrollments,
  },
  { name: "SequenceVersion", fields: Object.keys(SequenceVersion.fields), table: sequenceVersions },
  { name: "DomainEvent", fields: Object.keys(DomainEvent.fields), table: domainEvents },
];

describe("Effect Schema <-> Drizzle client schema drift", () => {
  it.each(entities)("$name: schema fields match table columns", ({ fields, table }) => {
    const columns = Object.keys(getTableColumns(table));
    expect([...columns].sort()).toEqual([...fields].sort());
  });
});
