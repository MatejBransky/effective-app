import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";
import { useShellContext } from "./ShellContext.tsx";
import { useSidebar } from "./useSidebar.ts";
import { useSidebarHistory } from "./useSidebarHistory.ts";
import type { OverlayHistory } from "./OverlayStack.ts";

const empty: OverlayHistory = { entries: [], cursor: -1 };

/**
 * Renders the entry at the cursor inside the sidebar's own chrome - a toolbar (label,
 * Back/Forward, Minimize, Close) that's part of the sidebar UI itself, not something each
 * app has to rebuild around it. Opening a second sidebar while one is already showing
 * doesn't close the first - it just becomes the new cursor position; closing the second
 * (or navigating back via the toolbar) reveals the first again, since it's still on the
 * (unshortened) history. Mount once wherever the docked sidebar panel should appear in the
 * app's layout.
 */
export function SidebarHost() {
  const { sidebar } = useShellContext();
  const { entries, cursor } = useAtomValue(sidebar.history, (result) =>
    AsyncResult.getOrElse(result, () => empty),
  );
  const actions = useSidebar();
  const preview = useSidebarHistory();
  // Purely a presentation concern (collapse to a thin strip, expand again later) - doesn't
  // touch SidebarService at all, so it's plain component state, not Effect-level history.
  const [minimized, setMinimized] = useState(false);

  const current = entries[cursor];
  if (!current) return null;

  if (minimized) {
    // A completely different, minimal chrome rather than squeezing the full toolbar into
    // a narrow strip - guarantees the one control that can bring it back (Expand) is
    // always fully visible and clickable, never clipped by the collapsed width.
    return (
      <div className="shell-sidebar shell-sidebar--minimized" data-shell-overlay="sidebar">
        <button type="button" className="shell-sidebar-expand" onClick={() => setMinimized(false)}>
          Expand
        </button>
      </div>
    );
  }

  return (
    <div className="shell-sidebar" data-shell-overlay="sidebar">
      <div className="shell-sidebar-toolbar" data-testid="sidebar-toolbar">
        <button type="button" disabled={!preview.canGoBack} onClick={() => void actions.back()}>
          Back{preview.backLabel ? ` (${preview.backLabel})` : ""}
        </button>
        <button
          type="button"
          disabled={!preview.canGoForward}
          onClick={() => void actions.forward()}
        >
          Forward{preview.forwardLabel ? ` (${preview.forwardLabel})` : ""}
        </button>
        <span className="shell-sidebar-label" data-testid="sidebar-label">
          {current.label}
        </span>
        <button type="button" onClick={() => setMinimized(true)}>
          Minimize
        </button>
        <button type="button" onClick={() => void actions.close()}>
          Close
        </button>
      </div>
      <div key={current.id} className="shell-sidebar-content" data-testid="sidebar-content">
        {current.node}
      </div>
    </div>
  );
}
