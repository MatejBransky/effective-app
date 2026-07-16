import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hostIsolationViaJoinPolicy } from "../rls.ts";

// A member has no host_id of its own (it's a shared identity across hosts, scoped via
// the member_hosts junction) - referenced by literal table/column name below, not by
// importing the memberHosts table object, since MemberHost.ts imports `members` and a
// reverse import would be circular.
export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phoneNumber: text("phone_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    hostIsolationViaJoinPolicy({
      joinTable: "member_hosts",
      joinTableMatchColumn: "member_id",
      joinTableHostIdColumn: "host_id",
      ownColumn: t.id,
    }),
  ],
).enableRLS();
