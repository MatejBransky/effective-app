import {
  domainEvents,
  hostFilterSets,
  hosts,
  leadStages,
  marketingSequences,
  memberHosts,
  members,
  sequenceActions,
  sequenceEdges,
  sequenceEnrollments,
  sequenceVersions,
} from "@repo/db";
import {
  DomainEvent,
  Host,
  HostFilterSet,
  LeadStage,
  MarketingSequence,
  Member,
  MemberHost,
  SequenceAction,
  SequenceEdge,
  SequenceEnrollment,
  SequenceVersion,
} from "@repo/schema";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { Schema } from "effect";

/**
 * One entry per table the PowerSync upload queue (`POST /sync/upload`) is allowed to
 * write to - deliberately excludes `leadStageTemplates` (platform-maintained reference
 * data, not tenant-editable, see docs/data-model.md's "LeadStageTemplate"). `op.table`
 * values outside this map are rejected the same way as any other validation error (2xx,
 * never a 4xx - see `custom-backend.md`'s "Common Pitfalls" #1, a 4xx would block the
 * client's upload queue permanently).
 *
 * `fields`/`fullSchema` reuse `@repo/schema` (the same source of truth
 * `packages/db`'s drift test checks Drizzle against) instead of hand-writing per-table
 * validation here - an invalid write gets rejected with a real type/shape check, not
 * just passed through to Postgres.
 *
 * Typed loosely (`any`) across entities on purpose: this table is a heterogeneous,
 * runtime-dispatched map keyed by table name, not a single statically-known shape -
 * Drizzle/Effect Schema's precise generics don't unify across 11 different row shapes,
 * so the precision is recovered by construction (each entry's `table`/`fields`/
 * `fullSchema` do correspond) rather than by the type checker.
 */
export interface EntityDescriptor {
  readonly table: PgTable & { readonly id: AnyPgColumn };
  /** Per-field schemas, keyed by field name - used to validate a PATCH's partial `opData`. */
  readonly fields: Record<string, Schema.Codec<any>>;
  /** Whole-row schema - used to validate a PUT's full `opData`. */
  readonly fullSchema: Schema.Codec<any>;
  /** Keys whose Postgres column is `jsonb` - PowerSync can only store these as
   * `column.text` client-side, so `opData[key]` arrives JSON-stringified and must be
   * parsed before it reaches Effect Schema/Drizzle. */
  readonly jsonFields?: ReadonlyArray<string>;
  /** Keys whose Postgres column is a native `boolean` - PowerSync has no boolean column
   * type and sends 0/1, which `Schema.Boolean` won't decode directly. */
  readonly booleanFields?: ReadonlyArray<string>;
}

// `SequenceAction` is a discriminated union in packages/schema (`config`'s shape depends
// on `type`), but one flat table here - same gap `packages/db/src/drift.test.ts` already
// documents. For a PATCH's per-field validation there's no single `config` schema to
// check a partial update against without already knowing `type`, so `config` is excluded
// from `fields` (JSON-parsed but not schema-validated on PATCH) and validated only as
// part of a PUT's whole-row decode, where `type` is always present.
const sequenceActionScalarFields = (() => {
  const { config: _config, ...scalarFields } = SequenceAction.cases.EMAIL.fields;
  return scalarFields;
})();

export const entities: Record<string, EntityDescriptor> = {
  hosts: { table: hosts, fields: Host.fields, fullSchema: Host },
  members: { table: members, fields: Member.fields, fullSchema: Member },
  member_hosts: { table: memberHosts, fields: MemberHost.fields, fullSchema: MemberHost },
  lead_stages: { table: leadStages, fields: LeadStage.fields, fullSchema: LeadStage },
  host_filter_sets: {
    table: hostFilterSets,
    fields: HostFilterSet.fields,
    fullSchema: HostFilterSet,
    jsonFields: ["rules"],
  },
  marketing_sequences: {
    table: marketingSequences,
    fields: MarketingSequence.fields,
    fullSchema: MarketingSequence,
    booleanFields: ["isEnabled"],
  },
  sequence_actions: {
    table: sequenceActions,
    fields: sequenceActionScalarFields,
    fullSchema: SequenceAction,
    jsonFields: ["config"],
  },
  sequence_edges: { table: sequenceEdges, fields: SequenceEdge.fields, fullSchema: SequenceEdge },
  sequence_enrollments: {
    table: sequenceEnrollments,
    fields: SequenceEnrollment.fields,
    fullSchema: SequenceEnrollment,
  },
  sequence_versions: {
    table: sequenceVersions,
    fields: SequenceVersion.fields,
    fullSchema: SequenceVersion,
    jsonFields: ["snapshot"],
  },
  domain_events: {
    table: domainEvents,
    fields: DomainEvent.fields,
    fullSchema: DomainEvent,
    jsonFields: ["payload"],
  },
};

/** JSON-parses `jsonFields` and coerces `booleanFields` (0/1 -> boolean) before either a
 * whole-row (PUT) or per-field (PATCH) Effect Schema decode - both need to see real
 * objects/booleans, not the wire-friendly string/0-1 encoding PowerSync's SQLite-backed
 * client schema is limited to. Throws on malformed JSON - caught by the caller as a
 * per-op validation error, same as a schema decode failure. */
export const preprocessOpData = (
  opData: Record<string, unknown>,
  descriptor: EntityDescriptor,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opData)) {
    if (descriptor.jsonFields?.includes(key) && typeof value === "string") {
      result[key] = JSON.parse(value);
    } else if (descriptor.booleanFields?.includes(key)) {
      result[key] = value === 1 || value === true;
    } else {
      result[key] = value;
    }
  }
  return result;
};
