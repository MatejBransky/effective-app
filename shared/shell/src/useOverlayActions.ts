import { useAtomSet } from "@effect/atom-react";
import type * as React from "react";
import type { OverlayOpenOptions, OverlayOpenRender } from "./OverlayStack.ts";
import type { OverlayRuntime } from "./ShellContext.tsx";

export interface OverlayActions {
  readonly open: <A>(
    render: (resolve: (value: A) => void) => React.ReactNode,
    options?: OverlayOpenOptions,
  ) => Promise<A>;
  readonly close: () => Promise<void>;
  readonly closeAll: () => Promise<void>;
}

/**
 * Shared dispatch logic behind useSidebar()/useModal() - not exported, both hooks are
 * just this bound to a different slice of ShellRuntime. Deliberately just actions (open,
 * close, closeAll) - not the history/state - so a component reading this never mistakes
 * it for a place to read what's currently open. A component that needs that reads the
 * history via <SidebarHost/>/<ModalHost/>'s own internal access (or useSidebarHistory()
 * for the back/forward preview), not through these actions.
 */
export function useOverlayActions(overlay: OverlayRuntime): OverlayActions {
  const runOpen = useAtomSet(overlay.open, { mode: "promise" });
  const runClose = useAtomSet(overlay.close, { mode: "promise" });
  const runCloseAll = useAtomSet(overlay.closeAll, { mode: "promise" });

  return {
    open: <A>(
      render: (resolve: (value: A) => void) => React.ReactNode,
      options?: OverlayOpenOptions,
    ): Promise<A> => runOpen({ render: render as OverlayOpenRender, options }) as Promise<A>,
    close: (): Promise<void> => runClose(),
    closeAll: (): Promise<void> => runCloseAll(),
  };
}
