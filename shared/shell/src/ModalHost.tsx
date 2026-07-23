import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayEntry } from "./OverlayStack.ts";

/**
 * Renders only the top-of-stack modal entry, as a backdrop-covered overlay. Opening a
 * second modal while one is already showing doesn't close the first - it just becomes the
 * new top; closing the second reveals the first again automatically, since it's still on
 * the (now shorter) stack - this is what makes a temporary dialog (a help popup opened
 * on top of a form, say) return to what was showing before, with no separate "replace"
 * concept needed. Mount once near the app root - modals should float above everything
 * else.
 */
export function ModalHost() {
  const { modal } = useShellContext();
  const entries = useAtomValue(modal.stack, (result) =>
    AsyncResult.getOrElse(result, () => [] as ReadonlyArray<OverlayEntry>),
  );
  const top = entries[entries.length - 1];
  if (!top) return null;

  return (
    <div className="shell-modal-backdrop" data-shell-overlay="modal">
      <div key={top.id} className="shell-modal">
        {top.node}
      </div>
    </div>
  );
}
