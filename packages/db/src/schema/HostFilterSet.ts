import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hosts } from "./Host.ts";

export const hostFilterSets = pgTable("host_filter_sets", {
  id: text("id").primaryKey(),
  hostId: text("host_id")
    .notNull()
    .references(() => hosts.id),
  name: text("name").notNull(),
  /** A `FilterRule` tree (see packages/schema's FilterRule.ts) - not normalized rows. */
  rules: jsonb("rules").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
