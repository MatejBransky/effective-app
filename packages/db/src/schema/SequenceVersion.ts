import { type AnyPgColumn, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hosts } from "./Host.ts";
import { marketingSequences } from "./MarketingSequence.ts";

export const sequenceVersions = pgTable("sequence_versions", {
  id: text("id").primaryKey(),
  sequenceId: text("sequence_id")
    .notNull()
    .references(() => marketingSequences.id),
  hostId: text("host_id")
    .notNull()
    .references(() => hosts.id),
  snapshot: jsonb("snapshot").notNull(),
  revertedFromVersionId: text("reverted_from_version_id").references(
    (): AnyPgColumn => sequenceVersions.id,
  ),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
