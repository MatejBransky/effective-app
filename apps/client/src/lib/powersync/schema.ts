import { DrizzleAppSchema } from "@powersync/drizzle-driver";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * PowerSync's client-side SQLite schema, expressed as a Drizzle schema (not PowerSync's
 * own `Schema`/`Table` API) - `DrizzleAppSchema` below generates the actual PowerSync
 * schema *from* this, so there's only one client-side schema to hand-maintain, and every
 * query written against it (see `database.ts`'s `drizzleDb`) is type-checked instead of
 * being a raw SQL string paired with a hand-typed, unchecked row interface. See the
 * powersync skill's `references/sdks/powersync-js-orm.md`.
 *
 * Table names (the string passed to `sqliteTable`, not the JS export name) match
 * `packages/db`'s Postgres table names exactly, so a `CrudEntry.table` lines up 1:1 with
 * `apps/server/src/SyncEntities.ts`'s write allowlist. Column keys are camelCase, matching
 * `@effective-app/schema`'s field names (and thus `apps/server`'s decode logic) - same
 * convention the previous hand-written PowerSync `Table` version used. Column types are
 * limited to `text`/`integer` (SQLite has no boolean/date/JSON type) - booleans as 0/1,
 * dates as ISO strings, and the four jsonb-backed fields (`rules`/`config`/`snapshot`/
 * `payload`) as JSON-stringified text. Never define an `id` column with a value - `id` is
 * declared here (Drizzle needs it for the local SQLite table) but `DrizzleAppSchema`
 * strips it back out when generating the PowerSync schema, since PowerSync always adds
 * its own `id TEXT PRIMARY KEY`.
 */
export const hosts = sqliteTable("hosts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  email: text("email").notNull(),
  timeZone: text("timeZone").notNull(),
  currency: text("currency").notNull(),
  businessType: text("businessType").notNull(),
  createdAt: text("createdAt").notNull(),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  phoneNumber: text("phoneNumber"),
  createdAt: text("createdAt").notNull(),
});

export const memberHosts = sqliteTable("member_hosts", {
  id: text("id").primaryKey(),
  memberId: text("memberId").notNull(),
  hostId: text("hostId").notNull(),
  status: text("status").notNull(),
  convertedAt: text("convertedAt"),
  leadStageId: text("leadStageId"),
  createdAt: text("createdAt").notNull(),
});

export const leadStages = sqliteTable("lead_stages", {
  id: text("id").primaryKey(),
  hostId: text("hostId").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  order: integer("order").notNull(),
  createdAt: text("createdAt").notNull(),
});

// Platform-maintained reference data (see docs/data-model.md's "LeadStageTemplate") -
// synced (read) but never written by client code; `apps/server`'s upload allowlist
// deliberately excludes it too, as the actual enforcement backstop.
export const leadStageTemplates = sqliteTable("lead_stage_templates", {
  id: text("id").primaryKey(),
  businessType: text("businessType").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  order: integer("order").notNull(),
});

export const hostFilterSets = sqliteTable("host_filter_sets", {
  id: text("id").primaryKey(),
  hostId: text("hostId").notNull(),
  name: text("name").notNull(),
  rules: text("rules").notNull(),
  createdAt: text("createdAt").notNull(),
});

export const marketingSequences = sqliteTable("marketing_sequences", {
  id: text("id").primaryKey(),
  hostId: text("hostId").notNull(),
  name: text("name").notNull(),
  triggerType: text("triggerType").notNull(),
  filterSetId: text("filterSetId"),
  isEnabled: integer("isEnabled").notNull(),
  createdAt: text("createdAt").notNull(),
});

export const sequenceActions = sqliteTable("sequence_actions", {
  id: text("id").primaryKey(),
  sequenceId: text("sequenceId").notNull(),
  type: text("type").notNull(),
  offsetMinutes: integer("offsetMinutes").notNull(),
  config: text("config").notNull(),
});

export const sequenceEdges = sqliteTable("sequence_edges", {
  id: text("id").primaryKey(),
  sequenceId: text("sequenceId").notNull(),
  fromActionId: text("fromActionId").notNull(),
  toActionId: text("toActionId").notNull(),
  conditionBranch: text("conditionBranch"),
});

export const sequenceEnrollments = sqliteTable("sequence_enrollments", {
  id: text("id").primaryKey(),
  hostId: text("hostId").notNull(),
  sequenceId: text("sequenceId").notNull(),
  memberId: text("memberId").notNull(),
  triggeredAt: text("triggeredAt").notNull(),
  finishedAt: text("finishedAt"),
  cancelledAt: text("cancelledAt"),
});

export const sequenceVersions = sqliteTable("sequence_versions", {
  id: text("id").primaryKey(),
  sequenceId: text("sequenceId").notNull(),
  hostId: text("hostId").notNull(),
  snapshot: text("snapshot").notNull(),
  revertedFromVersionId: text("revertedFromVersionId"),
  actorType: text("actorType").notNull(),
  actorId: text("actorId"),
  createdAt: text("createdAt").notNull(),
});

export const domainEvents = sqliteTable("domain_events", {
  id: text("id").primaryKey(),
  hostId: text("hostId").notNull(),
  aggregateType: text("aggregateType").notNull(),
  aggregateId: text("aggregateId").notNull(),
  eventType: text("eventType").notNull(),
  payload: text("payload").notNull(),
  actorType: text("actorType").notNull(),
  actorId: text("actorId"),
  occurredAt: text("occurredAt").notNull(),
});

export const drizzleSchema = {
  hosts,
  members,
  memberHosts,
  leadStages,
  leadStageTemplates,
  hostFilterSets,
  marketingSequences,
  sequenceActions,
  sequenceEdges,
  sequenceEnrollments,
  sequenceVersions,
  domainEvents,
};

export const AppSchema = new DrizzleAppSchema(drizzleSchema);
export type Database = (typeof AppSchema)["types"];
