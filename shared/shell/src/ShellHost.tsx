import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, type Atom } from "effect/unstable/reactivity";
import type { OverlayEntry } from "./ShellUI.ts";

/**
 * Renders whatever is on the overlay stack. Runtime-agnostic on purpose - `shared/shell`
 * doesn't own an `Atom.runtime` (only the composing app does, per AGENTS.md), so the
 * bridged `state` atom (built via that app's `runtime.subscriptionRef(...)`) is passed in.
 */
export function ShellHost(props: {
  readonly state: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<OverlayEntry>, unknown>>;
}) {
  const result = useAtomValue(props.state);
  const entries = AsyncResult.builder(result)
    .onSuccess((value) => value)
    .orElse(() => [] as ReadonlyArray<OverlayEntry>);

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
