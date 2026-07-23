import { useShellContext } from "./ShellContext.tsx";
import { useOverlayOpen } from "./useOverlayOpen.ts";

/** Component-side dispatch for `ModalService.open`. Resolves to whatever the caller's
 * render passes to `resolve` - a boolean for a confirm dialog, a union of string
 * literals for a multi-choice prompt, or a richer object. */
export function useModal() {
  const { modal } = useShellContext();
  return useOverlayOpen(modal);
}
