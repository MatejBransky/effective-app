import { useQuery } from "@powersync/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, reconnect } from "../lib/powersync/database.ts";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

interface HostRow {
  id: string;
  name: string;
}

interface MemberRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/** How long an unsynced local write is allowed to sit in PowerSync's upload queue before
 * the UI treats it as "stuck" and offers a retry - see `pendingCount`'s comment below for
 * why this reads `ps_crud` instead of `useStatus()`. */
const STUCK_AFTER_MS = 30_000;

function HomePage() {
  // The sync stream (see powersync/sync-config.yaml's `host_data`) only ever sends the
  // authenticated host's own row - RLS-scoped the same way apps/server's queries are, so
  // there's no `WHERE` clause to write here either.
  const { data: hostRows, isLoading: hostLoading } = useQuery<HostRow>(
    "SELECT id, name FROM hosts LIMIT 1",
  );
  const { data: members, isLoading: membersLoading } = useQuery<MemberRow>(
    "SELECT id, email, firstName, lastName FROM members ORDER BY createdAt",
  );
  // `ps_crud` is PowerSync's own internal SQLite table backing the upload queue - counting
  // it is the documented way to track pending-write state reactively (see PowerSync's
  // "Production Readiness Guide" - `SELECT COUNT(*) AS row_count FROM ps_crud`), and unlike
  // `useStatus()` it reflects *this app's* actual unsynced-write state rather than the
  // PowerSync service's download-stream connection health (see below for why that
  // distinction matters).
  const { data: pendingRows } = useQuery<{ n: number }>("SELECT COUNT(*) as n FROM ps_crud");
  const pendingCount = pendingRows[0]?.n ?? 0;

  const host = hostRows[0];
  const [draftName, setDraftName] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Clears the optimistic draft once the *watched* query confirms the write, not when
  // `db.execute()`'s promise resolves - see `renameHost`'s comment for why those two
  // moments aren't the same instant, and why resetting on the promise instead caused the
  // old-value flicker.
  useEffect(() => {
    if (draftName !== null && host?.name === draftName) {
      setDraftName(null);
    }
  }, [host?.name, draftName]);

  // Only escalates to a visible error after STUCK_AFTER_MS of a *non-empty* queue - a
  // brief offline blip or a slow-but-working retry shouldn't alarm the user. Resets
  // whenever the queue empties (success) or `retryAttempt` changes (the "Try again"
  // button gives it a fresh window rather than re-triggering an already-fired timer).
  useEffect(() => {
    if (pendingCount === 0) {
      setStuck(false);
      return;
    }
    const timeout = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [pendingCount, retryAttempt]);

  if (hostLoading || membersLoading) return <p>Loading...</p>;
  if (!host) return <p>No host synced yet.</p>;

  const renameHost = async (name: string) => {
    // Set optimistically and *stay* optimistic through the write - PowerSync applies
    // `db.execute()` to local SQLite synchronously from the caller's perspective, but the
    // `useQuery` watching `hosts` only re-runs after its own throttle window (30ms by
    // default - `DEFAULT_WATCH_THROTTLE_MS` in @powersync/common's WatchedQuery module,
    // same value `useQuery`'s `throttleMs` option defaults to). Clearing `draftName` here
    // instead of in the effect above would show `host.name`'s stale pre-write value for
    // that ~30ms gap before the watched query catches up - the flicker this replaced.
    setDraftName(name);
    try {
      await db.execute("UPDATE hosts SET name = ? WHERE id = ?", [name, host.id]);
    } catch (error) {
      // The local SQLite write itself failed (rare - distinct from a sync/upload
      // failure, which never throws here) - nothing for the effect above to confirm, so
      // revert immediately instead of leaving a draft that can never clear.
      setDraftName(null);
      console.error("Failed to write host name locally:", error);
    }
  };

  const handleRetry = () => {
    setStuck(false);
    setRetryAttempt((n) => n + 1);
    void reconnect();
  };

  return (
    <>
      <h1>
        <input
          value={draftName ?? host.name}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={(e) => void renameHost(e.target.value)}
        />
      </h1>
      {stuck && (
        <p>
          Failed to save changes to the server.{" "}
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      <h2>Members</h2>
      <ul>
        {members.map((member) => (
          <li key={member.id}>
            {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}
          </li>
        ))}
      </ul>
    </>
  );
}
