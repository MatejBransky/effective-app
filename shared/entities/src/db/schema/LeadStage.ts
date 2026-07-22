import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hostIsolationPolicy } from "../rls.ts";
import { hosts } from "./Host.ts";

export const leadStages = pgTable(
  "lead_stages",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => hosts.id),
    name: text("name").notNull(),
    color: text("color"),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [hostIsolationPolicy(t.hostId)],
).enableRLS();
