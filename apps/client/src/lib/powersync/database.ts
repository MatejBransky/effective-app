import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { PowerSyncDatabase } from "@powersync/web";
import { Connector } from "./connector.ts";
import { AppSchema, drizzleSchema } from "./schema.ts";

/**
 * Created once at module scope, not inside a React effect - React Strict Mode's dev-mode
 * double-mount would destroy the shared-worker DB proxy on the first mount's cleanup
 * before the second mount could use it (see the powersync skill's powersync-js-react.md
 * "React Strict Mode destroys PowerSyncDatabase" pitfall).
 */
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: "effective-app.db" },
});

/**
 * Type-safe query/write layer over `db` - `wrapPowerSyncWithDrizzle` returns a distinct
 * object (a `PowerSyncSQLiteDatabase`, not the same instance as `db`) that only exposes
 * Drizzle's query builder, not `db`'s connection-management methods (`connect`/
 * `disconnect`/`currentStatus`/raw `execute`) - those still go through `db` directly (see
 * `reconnect` below and `_authenticated.tsx`'s `disconnectAndClear()` call).
 */
export const drizzleDb = wrapPowerSyncWithDrizzle(db, { schema: drizzleSchema });

const connector = new Connector();

// `connect()` is fire-and-forget - it starts the sync stream and uploadData loop in the
// background, and retries `fetchCredentials`/`uploadData` automatically (with backoff)
// until a session exists - see Connector.fetchCredentials/uploadData. Not gated on login
// here: a `logout()` redirects to Keycloak, so the whole page (and this module) reloads
// on return anyway - there's no in-SPA "reconnect after logout" case to handle.
db.connect(connector);

/**
 * Forces a fresh connection attempt outside PowerSync's own automatic retry/backoff
 * schedule - there's no public "retry this upload now" API (checked
 * `AbstractPowerSyncDatabase`'s surface), so a full disconnect+reconnect is the closest
 * real "try again" action available. Used by the UI's "Try again" button after a write
 * has been stuck unsynced for a while - see `_authenticated.index.tsx`.
 */
export const reconnect = async (): Promise<void> => {
  await db.disconnect();
  db.connect(connector);
};
