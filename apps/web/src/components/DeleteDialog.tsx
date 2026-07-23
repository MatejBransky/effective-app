import { useModal } from "@repo/shared-shell";
import { NotifyDialog } from "./NotifyDialog.tsx";

export type DeleteChoice = "cancel" | "archive" | "deleteForever";

export function DeleteDialog(props: { readonly onChoice: (choice: DeleteChoice) => void }) {
  const modal = useModal();

  return (
    <div className="shell-modal-content">
      <p>Delete this item?</p>
      <button type="button" onClick={() => props.onChoice("cancel")}>
        Cancel
      </button>
      <button type="button" onClick={() => props.onChoice("archive")}>
        Archive instead
      </button>
      <button type="button" onClick={() => props.onChoice("deleteForever")}>
        Delete forever
      </button>
      <button
        type="button"
        onClick={() => {
          // Default open() (no `replace`) - temporary, stacks on top of this dialog.
          // Closing it reveals this same DeleteDialog again, unprompted.
          void modal.open<void>((resolve) => (
            <div className="shell-modal-content">
              <p>Deleting removes the item everywhere. Archiving just hides it - reversible.</p>
              <button type="button" onClick={() => resolve()}>
                Got it
              </button>
            </div>
          ));
        }}
      >
        Help
      </button>
      <button
        type="button"
        onClick={() => {
          // { replace: true } - discards this whole dialog (not stacked underneath) rather
          // than returning to it once dismissed, unlike Help above. Triggered from inside
          // this dialog's own content since a real trigger (e.g. a pushed notification)
          // would fire from outside React entirely - a modal's backdrop correctly blocks
          // clicks to anything behind it, so an *external* trigger can't be a covered
          // button; it has to be something like this, run from wherever the real event
          // arrives.
          void modal.open<void>((resolve) => <NotifyDialog onDismiss={() => resolve()} />, {
            replace: true,
          });
        }}
      >
        Simulate notification
      </button>
    </div>
  );
}
