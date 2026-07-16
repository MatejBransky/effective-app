import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { hostIsolationViaJoinPolicy } from "../rls.ts";
import { marketingSequences } from "./MarketingSequence.ts";

/**
 * `type`/`config` are flat columns here even though packages/schema models
 * `SequenceAction` as a discriminated union - `config`'s shape depends on `type` at the
 * application layer, not at the DB layer, see "SequenceAction" in docs/data-model.md.
 */
export const sequenceActions = pgTable(
  "sequence_actions",
  {
    id: text("id").primaryKey(),
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => marketingSequences.id),
    type: text("type").notNull(),
    offsetMinutes: integer("offset_minutes").notNull(),
    config: jsonb("config").notNull(),
  },
  (t) => [
    hostIsolationViaJoinPolicy({
      joinTable: "marketing_sequences",
      joinTableMatchColumn: "id",
      joinTableHostIdColumn: "host_id",
      ownColumn: t.sequenceId,
    }),
  ],
).enableRLS();
