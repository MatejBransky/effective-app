import { useQuery } from "@powersync/react";
import { useEffect, useState } from "react";
import { reconnect } from "./database.ts";

/** How long an unsynced local write is allowed to sit in PowerSync's upload queue before
 * the UI treats it as "stuck" and offers a retry. */
const STUCK_AFTER_MS = 30_000;

export interface SyncStatus {
  /** True once a write has been unsynced for longer than `STUCK_AFTER_MS`. */
  readonly stuck: boolean;
  /** Forces a fresh connection attempt and gives the write a new grace window. */
  readonly retry: () => void;
}

/**
 * App-shell-level sync status - mounted once in `_authenticated.tsx`'s layout (so every
 * authenticated page shares one status bar) rather than duplicated per page. Any page
 * that writes through PowerSync automatically gets "stuck write" surfacing without
 * implementing it itself.
 *
 * `ps_crud` is PowerSync's own internal SQLite table backing the upload queue, not part
 * of this app's domain schema - counting it is the documented way to track pending-write
 * state reactively (see PowerSync's "Production Readiness Guide" - `SELECT COUNT(*) AS
 * row_count FROM ps_crud`), and unlike `useStatus()` it reflects *this app's* actual
 * unsynced-write state rather than the PowerSync service's download-stream connection
 * health - offline reads should keep working undisturbed; only a write stuck unsynced
 * for a while is worth interrupting the user about.
 */
export const useSyncStatus = (): SyncStatus => {
  const { data: pendingRows } = useQuery<{ n: number }>("SELECT COUNT(*) as n FROM ps_crud");
  const pendingCount = pendingRows[0]?.n ?? 0;

  const [stuck, setStuck] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Only escalates to a visible error after STUCK_AFTER_MS of a *non-empty* queue - a
  // brief offline blip or a slow-but-working retry shouldn't alarm the user. Resets
  // whenever the queue empties (success) or `retryAttempt` changes (`retry` gives it a
  // fresh window rather than re-triggering an already-fired timer).
  useEffect(() => {
    if (pendingCount === 0) {
      setStuck(false);
      return;
    }
    const timeout = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [pendingCount, retryAttempt]);

  const retry = () => {
    setStuck(false);
    setRetryAttempt((n) => n + 1);
    void reconnect();
  };

  return { stuck, retry };
};
