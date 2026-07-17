import { useQuery, useStatus } from "@powersync/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { db } from "../lib/powersync/database.ts";

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
  const status = useStatus();

  const host = hostRows[0];
  const [draftName, setDraftName] = useState<string | null>(null);

  if (hostLoading || membersLoading) return <p>Loading...</p>;
  if (!host) return <p>No host synced yet.</p>;

  const renameHost = async (name: string) => {
    await db.execute("UPDATE hosts SET name = ? WHERE id = ?", [name, host.id]);
    setDraftName(null);
  };

  // Demonstrates the "reads work offline, mutations need connectivity" split this app's
  // README leads with: `connected`/`uploading` come from PowerSync's sync status, not
  // from the browser's online/offline events, so this reflects the actual upload queue
  // state (still true immediately after reconnecting, while a queued write is in flight).
  const canMutate = status.connected && !status.dataFlowStatus.uploading;

  return (
    <>
      <h1>
        <input
          value={draftName ?? host.name}
          disabled={!canMutate}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={(e) => void renameHost(e.target.value)}
        />
      </h1>
      {!status.connected && <p>Offline - changes will sync once back online.</p>}
      {status.dataFlowStatus.uploading && <p>Syncing...</p>}
      {status.dataFlowStatus.uploadError && (
        <p>Failed to save changes: {status.dataFlowStatus.uploadError.message}</p>
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
