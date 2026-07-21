import { resolveActionLabel, useActionTrigger } from "@repo/shared-app-shell";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";
import { resetHostName } from "../lib/hostActions.ts";
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
  const inputRef = useRef<HTMLInputElement>(null);

  // A local, page-scoped error - distinct from the app-shell's global sync-stuck banner
  // (see `_authenticated.tsx`). This is "the local SQLite write itself failed" (rare, and
  // unrelated to whether the change ever reaches the server), so it's shown right next to
  // the field the user was editing rather than in the app-shell.
  const [writeError, setWriteError] = useState<string | null>(null);

  // Demo of @repo/shared-app-shell's action registry: `resetHostName.execute`
  // owns its own confirm-then-write flow (see hostActions.ts) - this hook only tracks
  // pending/error state for the button below, it doesn't orchestrate anything itself.
  const resetAction = useActionTrigger(resetHostName);

  const host = hostRows[0];

  // Keeps the (uncontrolled) input in sync with the watched query without ever
  // remounting it: remounting via a changing `key` (the previous approach) steals focus
  // the moment our *own* debounced write round-trips back through the query, since a
  // freshly-mounted DOM node is never automatically focused. Only touch `.value`
  // imperatively, and only while the user isn't actively focused on the field - otherwise
  // a value confirmed while the user is mid-edit would overwrite what they're typing. Runs
  // unconditionally (before the loading/no-host early returns below) - hooks can't be
  // called conditionally.
  const hostName = host?.name;
  useEffect(() => {
    const input = inputRef.current;
    if (input && hostName !== undefined && document.activeElement !== input) {
      input.value = hostName;
    }
  }, [hostName]);

  if (hostLoading || membersLoading) return <p>Loading...</p>;
  if (!host) return <p>No host synced yet.</p>;

  const renameHost = async (name: string) => {
    try {
      await drizzleDb.update(hosts).set({ name }).where(eq(hosts.id, host.id));
      setWriteError(null);
    } catch (error) {
      // The local SQLite write itself failed (rare - distinct from a sync/upload failure,
      // which never throws here). Nothing to revert: the input stays uncontrolled and
      // keeps showing what the user typed.
      console.error("Failed to write host name locally:", error);
      setWriteError("Failed to save the name locally. Please try again.");
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
        {/* Uncontrolled on purpose (`ref`+`defaultValue`, not `value`) - the DOM owns the
            displayed text; the effect above only pushes a confirmed `host.name` back in
            imperatively, and only while unfocused, so the query's own reactivity never
            fights the user for control of what renders mid-edit. */}
        <input
          ref={inputRef}
          defaultValue={host.name}
          onChange={(e) => scheduleRename(e.target.value)}
          onBlur={(e) => flushRename(e.target.value)}
        />
      </h1>
      {writeError && <p role="alert">{writeError}</p>}
      <p>
        <button
          type="button"
          disabled={resetAction.pending || !!resetHostName.isDisabled?.(host)}
          onClick={() => resetAction.trigger(host)}
        >
          {resetAction.pending ? "Resetting..." : resolveActionLabel(resetHostName, host)}
        </button>
        {resetAction.error && <span role="alert"> Failed to reset the name locally.</span>}
      </p>
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
