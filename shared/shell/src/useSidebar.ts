import { useShellContext } from "./ShellContext.tsx";
import { useOverlayActions, type OverlayActions } from "./useOverlayActions.ts";

/** Component-side actions for the sidebar - `open`/`close`, nothing else. Reads them off
 * `<ShellProvider/>`'s context, reachable from any depth without an atom passed through
 * props. */
export function useSidebar(): OverlayActions {
  const { sidebar } = useShellContext();
  return useOverlayActions(sidebar);
}
