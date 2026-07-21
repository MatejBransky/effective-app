import { useAtomValue } from "@effect/atom-react";
import {
  browserOnlineAtom,
  pendingWritesCountAtom,
  retry,
  stuckAtom,
  syncErrorAtom,
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
  // Debounced via syncErrorAtom's grace window - see its comment for why a raw
  // uploadError/downloadError can't be shown the instant it appears.
  const syncError = useAtomValue(syncErrorAtom);

  return (
    <div>
      <p>
        {online ? "Online" : "Offline"} ·{" "}
        {sync.connecting ? "Connecting…" : sync.connected ? "Connected" : "Disconnected"}
        {sync.lastSyncedAt && ` · Last synced ${sync.lastSyncedAt.toLocaleTimeString()}`}
        {(sync.uploading || sync.downloading) && " · Syncing…"}
        {pendingCount > 0 && ` · ${pendingCount} pending change${pendingCount === 1 ? "" : "s"}`}
      </p>
      {syncError && <p role="alert">Sync error: {syncError}</p>}
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
