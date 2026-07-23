import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayEntry } from "./OverlayStack.ts";

/** Renders whatever is on the sidebar stack. Mount once wherever the docked sidebar
 * panel should appear in the app's layout. */
export function SidebarHost() {
  const { sidebar } = useShellContext();
  const entries = useAtomValue(sidebar.state, (result) =>
    AsyncResult.getOrElse(result, () => [] as ReadonlyArray<OverlayEntry>),
  );

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.id} className="shell-sidebar" data-shell-overlay="sidebar">
          {entry.node}
        </div>
      ))}
    </>
  );
}
