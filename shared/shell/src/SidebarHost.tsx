import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayHistory } from "./OverlayStack.ts";

const empty: OverlayHistory = { entries: [], cursor: -1 };

/**
 * Renders only the entry at the cursor, not the whole history. Opening a second sidebar
 * while one is already showing doesn't close the first - it just becomes the new cursor
 * position; closing the second (or navigating back to the first via useSidebar().back())
 * reveals the first again, since it's still on the (unshortened) history. Mount once
 * wherever the docked sidebar panel should appear in the app's layout.
 */
export function SidebarHost() {
  const { sidebar } = useShellContext();
  const { entries, cursor } = useAtomValue(sidebar.history, (result) =>
    AsyncResult.getOrElse(result, () => empty),
  );
  const current = entries[cursor];
  if (!current) return null;

  return (
    <div key={current.id} className="shell-sidebar" data-shell-overlay="sidebar">
      {current.node}
    </div>
  );
}
