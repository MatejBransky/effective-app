import { Schema, Table, column } from "@powersync/web";

/**
 * PowerSync's client-side SQLite schema - hand-written, mirroring `packages/db`'s
 * Effect-Schema-is-source-of-truth pattern (see `schema.check.test.ts` alongside this
 * file for the drift guard) rather than generated, for the same reasoning
 * `docs/data-model.md`'s "Effect Schema -> Drizzle bridge" section gives for Drizzle.
 *
 * Table names match `packages/db`'s Postgres table names exactly, so a PowerSync
 * `CrudEntry.table` lines up 1:1 with `apps/server/src/SyncEntities.ts`'s write
 * allowlist. Column types are limited to `column.text`/`column.integer` (no boolean,
 * date, or JSON native type in SQLite) - booleans as 0/1, dates as ISO strings, and the
 * four jsonb-backed fields (`rules`/`config`/`snapshot`/`payload`) as JSON-stringified
 * text, matching what `apps/server`'s upload endpoint expects on the wire (see its
 * `preprocessOpData`). Never define an `id` column - PowerSync adds it automatically as
 * `TEXT PRIMARY KEY`.
 */
const hosts = new Table({
  name: column.text,
  slug: column.text,
  email: column.text,
  timeZone: column.text,
  currency: column.text,
  businessType: column.text,
  createdAt: column.text,
});

const members = new Table({
  email: column.text,
  firstName: column.text,
  lastName: column.text,
  phoneNumber: column.text,
  createdAt: column.text,
});

const memberHosts = new Table({
  memberId: column.text,
  hostId: column.text,
  status: column.text,
  convertedAt: column.text,
  leadStageId: column.text,
  createdAt: column.text,
});

const leadStages = new Table({
  hostId: column.text,
  name: column.text,
  color: column.text,
  order: column.integer,
  createdAt: column.text,
});

// Platform-maintained reference data (see docs/data-model.md's "LeadStageTemplate") -
// synced (read) but never written by client code; `apps/server`'s upload allowlist
// deliberately excludes it too, as the actual enforcement backstop.
const leadStageTemplates = new Table({
  businessType: column.text,
  name: column.text,
  color: column.text,
  order: column.integer,
});

const hostFilterSets = new Table({
  hostId: column.text,
  name: column.text,
  rules: column.text,
  createdAt: column.text,
});

const marketingSequences = new Table({
  hostId: column.text,
  name: column.text,
  triggerType: column.text,
  filterSetId: column.text,
  isEnabled: column.integer,
  createdAt: column.text,
});

const sequenceActions = new Table({
  sequenceId: column.text,
  type: column.text,
  offsetMinutes: column.integer,
  config: column.text,
});

const sequenceEdges = new Table({
  sequenceId: column.text,
  fromActionId: column.text,
  toActionId: column.text,
  conditionBranch: column.text,
});

const sequenceEnrollments = new Table({
  hostId: column.text,
  sequenceId: column.text,
  memberId: column.text,
  triggeredAt: column.text,
  finishedAt: column.text,
  cancelledAt: column.text,
});

const sequenceVersions = new Table({
  sequenceId: column.text,
  hostId: column.text,
  snapshot: column.text,
  revertedFromVersionId: column.text,
  actorType: column.text,
  actorId: column.text,
  createdAt: column.text,
});

const domainEvents = new Table({
  hostId: column.text,
  aggregateType: column.text,
  aggregateId: column.text,
  eventType: column.text,
  payload: column.text,
  actorType: column.text,
  actorId: column.text,
  occurredAt: column.text,
});

// Object keys (not the local const names above) are the actual PowerSync/SQLite table
// names - kept snake_case here to match `packages/db`'s Postgres table names exactly, so
// a `CrudEntry.table` lines up 1:1 with `apps/server/src/SyncEntities.ts`'s allowlist
// keys without any name-mapping step.
export const AppSchema = new Schema({
  hosts,
  members,
  member_hosts: memberHosts,
  lead_stages: leadStages,
  lead_stage_templates: leadStageTemplates,
  host_filter_sets: hostFilterSets,
  marketing_sequences: marketingSequences,
  sequence_actions: sequenceActions,
  sequence_edges: sequenceEdges,
  sequence_enrollments: sequenceEnrollments,
  sequence_versions: sequenceVersions,
  domain_events: domainEvents,
});

export type Database = (typeof AppSchema)["types"];
