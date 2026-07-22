import { integer, pgTable, text } from "drizzle-orm/pg-core";

// Platform-maintained reference data (seeds LeadStage per businessType), not scoped to
// any single host - deliberately no RLS policy here, unlike every other table in this
// schema (see docs/data-model.md's "Postgres RLS for multi-tenancy" section).
export const leadStageTemplates = pgTable("lead_stage_templates", {
  id: text("id").primaryKey(),
  businessType: text("business_type").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  order: integer("order").notNull(),
});
