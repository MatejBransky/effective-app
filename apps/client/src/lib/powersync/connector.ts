import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web";
import { getAccessToken } from "../auth.ts";

interface SyncUploadResponse {
  readonly errors: ReadonlyArray<{ readonly id: string; readonly reason: string }>;
}

export interface ConnectorOptions {
  readonly powersyncUrl?: string;
  readonly serverUrl?: string;
}

/**
 * Implements PowerSync's client-side connector against apps/server's custom (non-Supabase)
 * backend - see the powersync skill's references/custom-backend.md.
 *
 * `powersyncUrl`/`serverUrl` default to the `VITE_*` env vars (real app usage - see
 * `database.ts`'s `new Connector()`) but can be passed explicitly, so tests don't need
 * `import.meta.env` populated just to construct one - the CI environment has no `.env`
 * (gitignored, per docs/data-model.md), and a unit test for this class's logic shouldn't
 * require real app config to even run.
 */
export class Connector implements PowerSyncBackendConnector {
  private readonly powersyncUrl: string;
  private readonly serverUrl: string;

  constructor(options: ConnectorOptions = {}) {
    const powersyncUrl = options.powersyncUrl ?? import.meta.env["VITE_POWERSYNC_URL"];
    const serverUrl = options.serverUrl ?? import.meta.env["VITE_SERVER_URL"];
    if (!powersyncUrl || !serverUrl) {
      throw new Error("VITE_POWERSYNC_URL/VITE_SERVER_URL must be set - see .env.example");
    }
    this.powersyncUrl = powersyncUrl;
    this.serverUrl = serverUrl;
  }

  /** Called automatically every few minutes when the sync stream reconnects - must
   * always return a fresh token, never a cached one (per the PowerSync SDK's contract).
   * Throwing here (no session) makes PowerSync retry rather than connect anonymously. */
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Not authenticated - PowerSync will retry fetchCredentials");
    }
    return { endpoint: this.powersyncUrl, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const token = await getAccessToken();
    if (!token) {
      // No session - throw so PowerSync backs off and retries later instead of
      // uploading unauthenticated (which apps/server would reject with 401 anyway).
      throw new Error("Not authenticated - upload will retry");
    }

    const operations = transaction.crud.map((op) => ({
      id: op.id,
      op: op.op,
      table: op.table,
      opData: op.opData,
    }));

    const response = await fetch(`${this.serverUrl}/sync/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ operations }),
    });

    if (!response.ok) {
      // apps/server's /sync/upload always returns 2xx by design (see SyncHandlers.ts) -
      // a non-2xx here means something else broke (network, CORS, an expired/invalid
      // token rejected by the Auth middleware), not a per-op validation failure. Throw
      // to retry with backoff rather than silently dropping the batch.
      throw new Error(`Sync upload failed: ${response.status}`);
    }

    const result: SyncUploadResponse = await response.json();
    if (result.errors.length > 0) {
      // Per-op validation errors surface here, never as a blocked upload queue (see
      // custom-backend.md's "Backend API for uploadData" contract). Logged for this PoC;
      // a real app would write these to a local-only table and surface them in the UI.
      console.warn("PowerSync upload had per-op errors:", result.errors);
    }

    // MUST call complete() even when `result.errors` is non-empty - a 2xx response
    // always advances the queue. If `transaction.complete()` is never called,
    // `getNextCrudTransaction()` returns the same transaction forever.
    await transaction.complete();
  }
}
