import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";

/**
 * Standard per-host row-level-security policy for tables scoped by a host-id column -
 * see docs/data-model.md's "Postgres RLS for multi-tenancy" section for the
 * `app.host_id` session variable this depends on (set per-request by apps/server, via
 * `set_config`, transaction-local). Unset (e.g. a migration running outside that
 * wrapper) means no rows match, not "everything matches" - the safe failure direction
 * for tenant isolation.
 */
export const hostIsolationPolicy = (hostIdColumn: AnyPgColumn) =>
  pgPolicy("host_isolation", {
    for: "all",
    using: sql`${hostIdColumn} = current_setting('app.host_id', true)`,
    withCheck: sql`${hostIdColumn} = current_setting('app.host_id', true)`,
  });

/**
 * For tables scoped to a host only indirectly, via a join to another host-scoped
 * table (e.g. `members` via `member_hosts`) - referenced by literal table/column name
 * rather than importing the other Drizzle table object, to avoid circular imports
 * between schema files.
 */
export const hostIsolationViaJoinPolicy = (options: {
  readonly joinTable: string;
  /** Column on `joinTable` to match against `ownColumn` - whichever side is the FK. */
  readonly joinTableMatchColumn: string;
  readonly joinTableHostIdColumn: string;
  readonly ownColumn: AnyPgColumn;
}) => {
  const condition = sql`exists (
    select 1 from ${sql.raw(options.joinTable)}
    where ${sql.raw(`${options.joinTable}.${options.joinTableMatchColumn}`)} = ${options.ownColumn}
    and ${sql.raw(`${options.joinTable}.${options.joinTableHostIdColumn}`)} = current_setting('app.host_id', true)
  )`;
  return pgPolicy("host_isolation_via_join", {
    for: "all",
    using: condition,
    withCheck: condition,
  });
};
