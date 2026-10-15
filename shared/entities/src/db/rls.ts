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
 * Standard per-user row-level-security policy for coaching tables scoped by a
 * user-id column - the coaching analogue of `hostIsolationPolicy`. Depends on
 * the `app.user_id` session variable (JWT `sub`, set per-request by
 * apps/server's `UserScopedDb`, transaction-local). Unset means no rows match.
 */
export const userIsolationPolicy = (userIdColumn: AnyPgColumn) =>
  pgPolicy("user_isolation", {
    for: "all",
    using: sql`${userIdColumn} = current_setting('app.user_id', true)`,
    withCheck: sql`${userIdColumn} = current_setting('app.user_id', true)`,
  });

/**
 * Full access for product admins. The admin check reads `coaching_users` by
 * literal table name (same circular-import avoidance as
 * `hostIsolationViaJoinPolicy`) - every coaching table lives next to that
 * table's definition, but the policy helper itself must not import it.
 */
export const adminAllPolicy = () => {
  const isAdmin = sql`exists (
    select 1 from ${sql.raw("coaching_users")}
    where ${sql.raw("coaching_users.user_id")} = current_setting('app.user_id', true)
    and ${sql.raw("coaching_users.role")} = 'admin'
  )`;

  return pgPolicy("admin_all", {
    for: "all",
    using: isAdmin,
    withCheck: isAdmin,
  });
};

/**
 * Read access for the assigned coach: rows whose owner links to the caller via
 * `client_profiles.coach_id`. Goes through the `coaching_coach_of` SECURITY
 * DEFINER function (see migration 0004) instead of an `exists` subquery on
 * `client_profiles` itself - a self-referencing subquery re-triggers this same
 * policy infinitely (the `coaching_users` recursion that migration 0003 fixed
 * is the same class of bug). The function runs as the table owner, bypassing
 * RLS, so evaluation terminates.
 */
export const coachReadPolicy = (ownUserIdColumn: AnyPgColumn) =>
  pgPolicy("coach_read", {
    for: "select",
    using: sql`coaching_coach_of(${ownUserIdColumn}) = current_setting('app.user_id', true)`,
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
