import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayEntry } from "./OverlayStack.ts";

/** Renders whatever is on the modal stack, each entry as a backdrop-covered overlay.
 * Mount once near the app root - modals should float above everything else. */
export function ModalHost() {
  const { modal } = useShellContext();
  const entries = useAtomValue(modal.state, (result) =>
    AsyncResult.getOrElse(result, () => [] as ReadonlyArray<OverlayEntry>),
  );

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.id} className="shell-modal-backdrop" data-shell-overlay="modal">
          <div className="shell-modal">{entry.node}</div>
        </div>
      ))}
    </>
  );
}
