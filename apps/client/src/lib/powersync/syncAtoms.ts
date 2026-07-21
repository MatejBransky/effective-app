import type { SyncStatus } from "@powersync/web";
import { Atom } from "effect/unstable/reactivity";
import { registry } from "@repo/shared-lib";
import { db, reconnect } from "./database.ts";

/** How long an unsynced local write is allowed to sit in PowerSync's upload queue before
 * the UI treats it as "stuck" and offers a retry. */
const STUCK_AFTER_MS = 30_000;

/** How long `uploadError`/`downloadError` must persist before the UI shows it. PowerSync
 * clears and re-sets these on every reconnect attempt (including ones seconds apart), and
 * a fresh page load races the very first attempt against `restoreSession()`'s silent-renew
 * iframe - `fetchCredentials`/`uploadData` briefly see no token yet and throw "Not
 * authenticated", which resolves itself within about a second once the session restores.
 * Surfacing that instantly reads as a real error for something that was never one - the
 * same "don't alarm the user over a self-resolving blip" reasoning as `STUCK_AFTER_MS`. */
const SYNC_ERROR_GRACE_MS = 10_000;

/**
 * Number of rows in `ps_crud`, PowerSync's own internal SQLite table backing the upload
 * queue (not part of this app's domain schema) - counting it is the documented way to
 * track pending-write state reactively (see PowerSync's "Production Readiness Guide" -
 * `SELECT COUNT(*) AS row_count FROM ps_crud`). Bridges `db.watch`'s callback API into an
 * Atom via `get.setSelf`/`get.addFinalizer` (the same pattern as wrapping any external
 * event listener - see effect's `Atom.make` docs).
 */
export const pendingWritesCountAtom: Atom.Atom<number> = Atom.make((get) => {
  const controller = new AbortController();
  db.watch(
    "SELECT COUNT(*) as n FROM ps_crud",
    [],
    { onResult: (result) => get.setSelf(Number(result.rows?._array[0]?.n ?? 0)) },
    { signal: controller.signal },
  );
  get.addFinalizer(() => controller.abort());
  return 0;
});

/** Bumped by `retry()` to force `stuckAtom` to reset its grace window even when the
 * pending-write count itself hasn't changed (e.g. still stuck after a reconnect). */
export const retryGenerationAtom: Atom.Writable<number> = Atom.make(0);

/**
 * True once a write has been unsynced for longer than `STUCK_AFTER_MS`. A derived atom
 * whose read function reruns whenever `pendingWritesCountAtom` (or `retryGenerationAtom`)
 * changes - effect's `AtomContext` finalizers run on rebuild as well as disposal, so the
 * previous grace-window timer is always cleared before a new one is scheduled, and the
 * value resets to `false` immediately whenever the queue empties or a retry is requested.
 */
export const stuckAtom: Atom.Atom<boolean> = Atom.make((get) => {
  get(retryGenerationAtom);
  if (get(pendingWritesCountAtom) === 0) return false;
  const timeout = setTimeout(() => get.setSelf(true), STUCK_AFTER_MS);
  get.addFinalizer(() => clearTimeout(timeout));
  return false;
});

/** Forces a fresh connection attempt and gives a stuck write a new grace window. */
export const retry = (): void => {
  registry.update(retryGenerationAtom, (n) => n + 1);
  void reconnect();
};

export interface SyncSnapshot {
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly lastSyncedAt: Date | undefined;
  readonly uploading: boolean;
  readonly downloading: boolean;
  readonly uploadError: Error | undefined;
  readonly downloadError: Error | undefined;
}

const toSnapshot = (status: SyncStatus): SyncSnapshot => ({
  connected: status.connected,
  connecting: status.connecting,
  lastSyncedAt: status.lastSyncedAt,
  uploading: status.dataFlowStatus.uploading ?? false,
  downloading: status.dataFlowStatus.downloading ?? false,
  uploadError: status.dataFlowStatus.uploadError,
  downloadError: status.dataFlowStatus.downloadError,
});

/** App-shell-level connection status - PowerSync's own `SyncStatus` (connected/connecting,
 * last successful sync, upload/download activity and errors), bridged via
 * `db.registerListener`'s `statusChanged` callback the same way `pendingWritesCountAtom`
 * bridges `db.watch`. Distinct from `stuckAtom`: this reflects the sync *stream's*
 * connection health, not this app's unsynced-write state - offline reads should keep
 * working undisturbed, so only `uploadError`/`downloadError` (an actual failure, not just
 * "offline") are worth surfacing as errors. */
export const syncSnapshotAtom: Atom.Atom<SyncSnapshot> = Atom.make((get) => {
  const dispose = db.registerListener({
    statusChanged: (status) => get.setSelf(toSnapshot(status)),
  });
  get.addFinalizer(dispose);
  return toSnapshot(db.currentStatus);
});

/** The current error message, if any - a plain string (not the `Error` object) so
 * repeated retries hitting the exact same failure compare equal and don't reset
 * `syncErrorAtom`'s grace-window timer below (PowerSync recreates a fresh `Error`
 * instance on every attempt, even when the underlying problem hasn't changed). */
const syncErrorMessageAtom: Atom.Atom<string | undefined> = Atom.map(
  syncSnapshotAtom,
  (snapshot) => snapshot.uploadError?.message ?? snapshot.downloadError?.message,
);

/** Only reflects `uploadError`/`downloadError` once the *same* error has persisted for
 * `SYNC_ERROR_GRACE_MS` - see that constant's comment for why. Same rebuild-on-dependency-
 * change + finalizer-clears-the-previous-timer pattern as `stuckAtom`. */
export const syncErrorAtom: Atom.Atom<string | undefined> = Atom.make((get) => {
  const message = get(syncErrorMessageAtom);
  if (!message) return undefined;
  const timeout = setTimeout(() => get.setSelf(message), SYNC_ERROR_GRACE_MS);
  get.addFinalizer(() => clearTimeout(timeout));
  return undefined;
});

/** Browser-level connectivity (`navigator.onLine` + `online`/`offline` events) - distinct
 * from `syncSnapshotAtom.connected`: the browser can be "online" while PowerSync is still
 * reconnecting (or vice versa on a flaky captive-portal-style connection), so both are
 * worth showing separately in the status bar. */
export const browserOnlineAtom: Atom.Atom<boolean> = Atom.make((get) => {
  const update = () => get.setSelf(navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  get.addFinalizer(() => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  });
  return navigator.onLine;
});
