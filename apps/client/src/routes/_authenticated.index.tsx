import { useQuery } from "@powersync/react";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { drizzleDb, reconnect } from "../lib/powersync/database.ts";
import { hosts, members } from "../lib/powersync/schema.ts";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

/** How long an unsynced local write is allowed to sit in PowerSync's upload queue before
 * the UI treats it as "stuck" and offers a retry - see `pendingCount`'s comment below for
 * why this reads `ps_crud` instead of `useStatus()`. */
const STUCK_AFTER_MS = 30_000;

function HomePage() {
  // The sync stream (see powersync/sync-config.yaml's `host_data`) only ever sends the
  // authenticated host's own row - RLS-scoped the same way apps/server's queries are, so
  // there's no `WHERE` clause to write here either. Drizzle queries implement
  // `CompilableQuery`, so `useQuery` accepts them directly - `hostRows`/`memberRows` are
  // typed from `hosts`/`members` (schema.ts) with no separate hand-written row interface
  // to keep in sync by hand.
  const { data: hostRows, isLoading: hostLoading } = useQuery(
    toCompilableQuery(drizzleDb.select().from(hosts).limit(1)),
  );
  const { data: memberRows, isLoading: membersLoading } = useQuery(
    toCompilableQuery(drizzleDb.select().from(members).orderBy(members.createdAt)),
  );
  // `ps_crud` is PowerSync's own internal SQLite table backing the upload queue, not part
  // of this app's domain schema - counting it is the documented way to track
  // pending-write state reactively (see PowerSync's "Production Readiness Guide" -
  // `SELECT COUNT(*) AS row_count FROM ps_crud`), and unlike `useStatus()` it reflects
  // *this app's* actual unsynced-write state rather than the PowerSync service's
  // download-stream connection health (see below for why that distinction matters).
  const { data: pendingRows } = useQuery<{ n: number }>("SELECT COUNT(*) as n FROM ps_crud");
  const pendingCount = pendingRows[0]?.n ?? 0;

  const [stuck, setStuck] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

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
  const host = hostRows[0];
  if (!host) return <p>No host synced yet.</p>;

  const renameHost = async (name: string) => {
    try {
      await drizzleDb.update(hosts).set({ name }).where(eq(hosts.id, host.id));
    } catch (error) {
      // The local SQLite write itself failed (rare - distinct from a sync/upload failure,
      // which never throws here). Nothing to revert: the input below is uncontrolled, so
      // it just keeps showing what the user typed - logged for visibility in this PoC.
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
        {/* Uncontrolled on purpose (`key`+`defaultValue`, not `value`) - the DOM owns the
            displayed text until `key` changes, which only happens once the watched query
            confirms a (new) name, whether from our own write or someone else's. No local
            "draft" state or effect is needed to avoid showing a stale value mid-write: an
            uncontrolled input never fights the query's own reactivity for control of what
            renders, so there's nothing to race in the first place. */}
        <input
          key={host.name}
          defaultValue={host.name}
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
        {memberRows.map((member) => (
          <li key={member.id}>
            {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}
          </li>
        ))}
      </ul>
    </>
  );
}
