import { useAtomSet } from "@effect/atom-react";
import { useShellContext } from "./ShellContext.tsx";
import { useOverlayActions, type OverlayActions } from "./useOverlayActions.ts";

export interface SidebarActions extends OverlayActions {
  // Moves through sidebar history without closing anything - the entry moved away from
  // stays alive, reachable again via the other direction. See useSidebarHistory() for
  // whether either is currently possible and what it would show.
  readonly back: () => Promise<void>;
  readonly forward: () => Promise<void>;
}

/** Component-side actions for the sidebar - `open`/`close`/`closeAll`/`back`/`forward`,
 * nothing else. Reads them off `<ShellProvider/>`'s context, reachable from any depth
 * without an atom passed through props. */
export function useSidebar(): SidebarActions {
  const { sidebar } = useShellContext();
  const actions = useOverlayActions(sidebar);
  const runBack = useAtomSet(sidebar.back, { mode: "promise" });
  const runForward = useAtomSet(sidebar.forward, { mode: "promise" });

  return {
    ...actions,
    back: () => runBack(),
    forward: () => runForward(),
  };
}
