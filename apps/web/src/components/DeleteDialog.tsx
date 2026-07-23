import { useModal } from "@repo/shared-shell";

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
    </div>
  );
}
