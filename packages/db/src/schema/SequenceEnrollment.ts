import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hostIsolationPolicy } from "../rls.ts";
import { hosts } from "./Host.ts";
import { marketingSequences } from "./MarketingSequence.ts";
import { members } from "./Member.ts";

export const sequenceEnrollments = pgTable(
  "sequence_enrollments",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => hosts.id),
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => marketingSequences.id),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [hostIsolationPolicy(t.hostId)],
).enableRLS();
