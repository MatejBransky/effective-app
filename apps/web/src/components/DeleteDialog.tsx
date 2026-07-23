export type DeleteChoice = "cancel" | "archive" | "deleteForever";

export function DeleteDialog(props: { readonly onChoice: (choice: DeleteChoice) => void }) {
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
    </div>
  );
}
