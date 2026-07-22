import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hostIsolationPolicy } from "../rls.ts";
import { hosts } from "./Host.ts";

export const domainEvents = pgTable(
  "domain_events",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => hosts.id),
    aggregateType: text("aggregate_type").notNull(),
    /** Polymorphic - references whichever aggregate `aggregateType` names, not a fixed FK. */
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [hostIsolationPolicy(t.hostId)],
).enableRLS();
