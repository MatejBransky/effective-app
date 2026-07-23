import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellRuntime } from "./ShellRuntimeContext.tsx";
import type { OverlayEntry } from "./ShellUI.ts";

/** Renders whatever is on the overlay stack. Reads the runtime-bound state atom from
 * `<ShellRuntimeProvider/>` (see ShellRuntimeContext.ts) - mount once near the app root. */
export function ShellHost() {
  const { state } = useShellRuntime();
  const entries = useAtomValue(state, (result) =>
    AsyncResult.getOrElse(result, () => [] as ReadonlyArray<OverlayEntry>),
  );

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.id} data-shell-overlay={entry.kind}>
          {entry.node}
        </div>
      ))}
    </>
  );
}
