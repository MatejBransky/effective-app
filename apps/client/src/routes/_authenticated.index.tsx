import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { useEffect, useRef } from "react";
import { drizzleDb } from "../lib/powersync/database.ts";
import { hosts, members } from "../lib/powersync/schema.ts";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

/** Delay after the user stops typing before the rename actually writes - long enough to
 * not fire on every keystroke, short enough to feel like autosave rather than a form. */
const DEBOUNCE_MS = 400;

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

  // Only the pending-write *timer* needs to survive across renders - the write itself
  // never touches component state (see the input's own comment on why it stays
  // uncontrolled), so a plain ref is enough; no reducer or extra state required.
  const pendingRename = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(pendingRename.current), []);

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

  // Debounced on every keystroke rather than waiting for blur - a local-first app should
  // feel like autosave, not an old-style form you have to click away from to save.
  // `onBlur` still flushes immediately: without it, clicking away (or closing the tab)
  // within the debounce window would silently drop the last few keystrokes.
  const scheduleRename = (name: string) => {
    clearTimeout(pendingRename.current);
    pendingRename.current = setTimeout(() => void renameHost(name), DEBOUNCE_MS);
  };
  const flushRename = (name: string) => {
    clearTimeout(pendingRename.current);
    void renameHost(name);
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
          onChange={(e) => scheduleRename(e.target.value)}
          onBlur={(e) => flushRename(e.target.value)}
        />
      </h1>
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
