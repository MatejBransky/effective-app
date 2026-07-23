import { useShellContext } from "./ShellContext.tsx";
import { useOverlayActions, type OverlayActions } from "./useOverlayActions.ts";

/** Component-side actions for the modal - `open`/`close`, nothing else. `open` resolves to
 * whatever the caller's render passes to `resolve` - a boolean for a confirm dialog, a
 * union of string literals for a multi-choice prompt, or a richer object. */
export function useModal(): OverlayActions {
  const { modal } = useShellContext();
  return useOverlayActions(modal);
}
