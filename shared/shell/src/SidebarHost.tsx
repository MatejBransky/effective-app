import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayEntry } from "./OverlayStack.ts";

/**
 * Renders only the top-of-stack sidebar entry, not the whole stack. Opening a second
 * sidebar while one is already showing doesn't close the first - it just becomes the new
 * top; closing the second reveals the first again automatically, since it's still on the
 * (now shorter) stack. Mount once wherever the docked sidebar panel should appear in the
 * app's layout.
 */
export function SidebarHost() {
  const { sidebar } = useShellContext();
  const entries = useAtomValue(sidebar.stack, (result) =>
    AsyncResult.getOrElse(result, () => [] as ReadonlyArray<OverlayEntry>),
  );
  const top = entries[entries.length - 1];
  if (!top) return null;

  return (
    <div key={top.id} className="shell-sidebar" data-shell-overlay="sidebar">
      {top.node}
    </div>
  );
}
