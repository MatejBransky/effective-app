import { useShellContext } from "./ShellContext.tsx";
import { useOverlayOpen } from "./useOverlayOpen.ts";

/** Component-side dispatch for `SidebarService.open` - reads it off `<ShellProvider/>`'s
 * context, reachable from any depth without an atom passed through props. */
export function useSidebar() {
  const { sidebar } = useShellContext();
  return useOverlayOpen(sidebar);
}
