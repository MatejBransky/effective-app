import { useModal, useSidebar } from "@repo/shared-shell";
import { useState } from "react";

type DeleteChoice = "cancel" | "archive" | "deleteForever";

function DeleteDialog(props: { readonly onChoice: (choice: DeleteChoice) => void }) {
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

// Menu/Delete buttons + their dialog content are a minimal proof that
// SidebarService/ModalService round-trip end to end through useSidebar()/useModal() -
// not a real feature. A first real domain replaces this once one exists.
export function Navbar() {
  const openSidebar = useSidebar();
  const openModal = useModal();
  const [lastChoice, setLastChoice] = useState<DeleteChoice | null>(null);

  return (
    <nav className="navbar">
      <span className="navbar-brand">Effective</span>
      <div className="navbar-actions">
        <button
          type="button"
          onClick={() => {
            void openSidebar<void>((resolve) => (
              <button type="button" onClick={() => resolve()}>
                Close
              </button>
            ));
          }}
        >
          Menu
        </button>
        <button
          type="button"
          onClick={async () => {
            const choice = await openModal<DeleteChoice>((resolve) => (
              <DeleteDialog onChoice={resolve} />
            ));
            setLastChoice(choice);
          }}
        >
          Delete
        </button>
        {lastChoice && <span data-testid="last-choice">{lastChoice}</span>}
      </div>
    </nav>
  );
}
