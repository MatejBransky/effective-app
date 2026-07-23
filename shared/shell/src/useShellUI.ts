import { useAtomSet } from "@effect/atom-react";
import type * as React from "react";
import { useShellRuntime } from "./ShellRuntimeContext.tsx";
import type { ShellUIOpenRender } from "./ShellUI.ts";

/**
 * Component-side dispatch for `ShellUI.openSidebar`. Reads the dispatch atom from
 * `<ShellRuntimeProvider/>` - same runtime-built `ShellUI` singleton `<ShellHost/>`
 * subscribes to, reachable from any depth without an atom passed through props.
 */
export function useShellUI() {
  const { openSidebar } = useShellRuntime();
  const run = useAtomSet(openSidebar, { mode: "promise" });

  return <A>(render: (resolve: (value: A) => void) => React.ReactNode): Promise<A> =>
    run(render as ShellUIOpenRender) as Promise<A>;
}
