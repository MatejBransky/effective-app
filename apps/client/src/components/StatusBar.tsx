import { useAtomValue } from "../lib/atom/react.ts";
import {
  browserOnlineAtom,
  pendingWritesCountAtom,
  retry,
  stuckAtom,
  syncSnapshotAtom,
} from "../lib/powersync/syncAtoms.ts";

/**
 * App-shell-level sync status - mounted once in `_authenticated.tsx`'s layout (so every
 * authenticated page shares one status bar) rather than duplicated per page. All state here
 * comes from `syncAtoms.ts`'s Atoms, so this component itself holds no state of its own.
 */
export function StatusBar() {
  const online = useAtomValue(browserOnlineAtom);
  const sync = useAtomValue(syncSnapshotAtom);
  const pendingCount = useAtomValue(pendingWritesCountAtom);
  const stuck = useAtomValue(stuckAtom);

  // Offline reads should never gate the UI - this bar is informational only, except for
  // the "stuck" banner below, which is the one case worth interrupting the user for.
  const syncError = sync.uploadError ?? sync.downloadError;

  return (
    <div>
      <p>
        {online ? "Online" : "Offline"} ·{" "}
        {sync.connecting ? "Connecting…" : sync.connected ? "Connected" : "Disconnected"}
        {sync.lastSyncedAt && ` · Last synced ${sync.lastSyncedAt.toLocaleTimeString()}`}
        {(sync.uploading || sync.downloading) && " · Syncing…"}
        {pendingCount > 0 && ` · ${pendingCount} pending change${pendingCount === 1 ? "" : "s"}`}
      </p>
      {syncError && <p role="alert">Sync error: {syncError.message}</p>}
      {stuck && (
        <p role="alert">
          Failed to save changes to the server.{" "}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
