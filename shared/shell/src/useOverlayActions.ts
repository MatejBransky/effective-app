import { useAtomSet } from "@effect/atom-react";
import type * as React from "react";
import type { OverlayOpenRender } from "./OverlayStack.ts";
import type { OverlayRuntime } from "./ShellContext.tsx";

export interface OverlayActions {
  readonly open: <A>(render: (resolve: (value: A) => void) => React.ReactNode) => Promise<A>;
  readonly close: () => Promise<void>;
}

/**
 * Shared dispatch logic behind useSidebar()/useModal() - not exported, both hooks are
 * just this bound to a different slice of ShellRuntime. Deliberately just actions (open,
 * close) - not the stack/state - so a component reading this never mistakes it for a
 * place to read what's currently open. A component that needs that reads the stack via
 * <SidebarHost/>/<ModalHost/>'s own internal access instead.
 */
export function useOverlayActions(overlay: OverlayRuntime): OverlayActions {
  const runOpen = useAtomSet(overlay.open, { mode: "promise" });
  const runClose = useAtomSet(overlay.close, { mode: "promise" });

  return {
    open: <A>(render: (resolve: (value: A) => void) => React.ReactNode): Promise<A> =>
      runOpen(render as OverlayOpenRender) as Promise<A>,
    close: (): Promise<void> => runClose(),
  };
}
