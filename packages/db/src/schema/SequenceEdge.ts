import { pgTable, text } from "drizzle-orm/pg-core";

import { hostIsolationViaJoinPolicy } from "../rls.ts";
import { marketingSequences } from "./MarketingSequence.ts";
import { sequenceActions } from "./SequenceAction.ts";

export const sequenceEdges = pgTable(
  "sequence_edges",
  {
    id: text("id").primaryKey(),
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => marketingSequences.id),
    fromActionId: text("from_action_id")
      .notNull()
      .references(() => sequenceActions.id),
    toActionId: text("to_action_id")
      .notNull()
      .references(() => sequenceActions.id),
    /** `null` = unconditional edge; otherwise `"true"` | `"false"`. */
    conditionBranch: text("condition_branch"),
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
