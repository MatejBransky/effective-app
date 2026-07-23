import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useShellContext } from "./ShellContext.tsx";
import type { OverlayHistory } from "./OverlayStack.ts";

const empty: OverlayHistory = { entries: [], cursor: -1 };

/**
 * Renders only the entry at the cursor, as a backdrop-covered overlay. Opening a second
 * modal while one is already showing doesn't close the first - it just becomes the new
 * cursor position (or, with `{ replace: true }`, discards the whole history first);
 * closing the second reveals the first again automatically when it wasn't a replace -
 * this is what makes a temporary dialog (a help popup opened from within a confirm
 * dialog, say) return to what was showing before, with no separate concept needed beyond
 * the default (non-replace) open(). Mount once near the app root - modals should float
 * above everything else.
 */
export function ModalHost() {
  const { modal } = useShellContext();
  const { entries, cursor } = useAtomValue(modal.history, (result) =>
    AsyncResult.getOrElse(result, () => empty),
  );
  const current = entries[cursor];
  if (!current) return null;

  return (
    <div className="shell-modal-backdrop" data-shell-overlay="modal">
      <div key={current.id} className="shell-modal">
        {current.node}
      </div>
    </div>
  );
}
