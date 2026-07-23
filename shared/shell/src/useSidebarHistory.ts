import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayHistory } from "./OverlayStack.ts";

export interface SidebarHistoryPreview {
  readonly canGoBack: boolean;
  // The label of whatever back()/forward() would activate, for a control to show (e.g.
  // "Back (Menu)") - null when there's nothing in that direction.
  readonly backLabel: string | null;
  readonly canGoForward: boolean;
  readonly forwardLabel: string | null;
}

const empty: OverlayHistory = { entries: [], cursor: -1 };

/**
 * Read-only preview for rendering back/forward controls - deliberately separate from
 * useSidebar() (which is actions-only) since this is genuinely reading history, not
 * dispatching anything.
 */
export function useSidebarHistory(): SidebarHistoryPreview {
  const { sidebar } = useShellContext();

  return useAtomValue(sidebar.history, (result) => {
    const { entries, cursor } = AsyncResult.getOrElse(result, () => empty);
    return {
      canGoBack: cursor > 0,
      backLabel: cursor > 0 ? (entries[cursor - 1]?.label ?? null) : null,
      canGoForward: cursor < entries.length - 1,
      forwardLabel: cursor < entries.length - 1 ? (entries[cursor + 1]?.label ?? null) : null,
    };
  });
}
