import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { hostIsolationPolicy } from "../rls.ts";
import { hosts } from "./Host.ts";
import { leadStages } from "./LeadStage.ts";
import { members } from "./Member.ts";

export const memberHosts = pgTable(
  "member_hosts",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    hostId: text("host_id")
      .notNull()
      .references(() => hosts.id),
    status: text("status").notNull(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    leadStageId: text("lead_stage_id").references(() => leadStages.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [unique().on(t.memberId, t.hostId), hostIsolationPolicy(t.hostId)],
).enableRLS();
