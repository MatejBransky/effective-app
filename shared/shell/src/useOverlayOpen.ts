import { useAtomSet } from "@effect/atom-react";
import type * as React from "react";
import type { OverlayOpenRender } from "./OverlayStack.ts";
import type { OverlayRuntime } from "./ShellContext.tsx";

/** Shared dispatch logic behind useSidebar()/useModal() - not exported, both hooks are
 * just this bound to a different slice of ShellRuntime. */
export function useOverlayOpen(overlay: OverlayRuntime) {
  const run = useAtomSet(overlay.open, { mode: "promise" });

  return <A>(render: (resolve: (value: A) => void) => React.ReactNode): Promise<A> =>
    run(render as OverlayOpenRender) as Promise<A>;
}
