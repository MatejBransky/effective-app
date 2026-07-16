import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hostFilterSets } from "./HostFilterSet.ts";
import { hosts } from "./Host.ts";

export const marketingSequences = pgTable("marketing_sequences", {
  id: text("id").primaryKey(),
  hostId: text("host_id")
    .notNull()
    .references(() => hosts.id),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  filterSetId: text("filter_set_id").references(() => hostFilterSets.id),
  isEnabled: boolean("is_enabled").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
