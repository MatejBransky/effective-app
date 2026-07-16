import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const leadStageTemplates = pgTable("lead_stage_templates", {
  id: text("id").primaryKey(),
  businessType: text("business_type").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  order: integer("order").notNull(),
});
