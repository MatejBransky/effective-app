import { PowerSyncDatabase } from "@powersync/web";
import { Connector } from "./connector.ts";
import { AppSchema } from "./schema.ts";

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

// `connect()` is fire-and-forget - it starts the sync stream and uploadData loop in the
// background, and retries `fetchCredentials`/`uploadData` automatically (with backoff)
// until a session exists - see Connector.fetchCredentials/uploadData. Not gated on login
// here: a `logout()` redirects to Keycloak, so the whole page (and this module) reloads
// on return anyway - there's no in-SPA "reconnect after logout" case to handle.
db.connect(new Connector());
