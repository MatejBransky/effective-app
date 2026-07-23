import { useAtomSet } from "@effect/atom-react";
import { useModal, useSidebar, useSidebarHistory } from "@repo/shared-shell";
import { useState } from "react";
import { DeleteDialog, type DeleteChoice } from "./DeleteDialog.tsx";
import { NotifyDialog } from "./NotifyDialog.tsx";
import { askQuestionAtom } from "../demo/askQuestionAction.tsx";
import type { QuestionAnswer } from "./QuestionDialog.tsx";

// Every button here is scaffolding proving SidebarService/ModalService round-trip end to
// end through useSidebar()/useModal() (and, for "Ask question", a plain Effect action
// that never touches React) - not a real feature. A first real domain replaces this once
// one exists.
export function Navbar() {
  const sidebar = useSidebar();
  const sidebarHistory = useSidebarHistory();
  const modal = useModal();
  const askQuestion = useAtomSet(askQuestionAtom, { mode: "promise" });
  const [lastChoice, setLastChoice] = useState<DeleteChoice | null>(null);
  const [lastAnswer, setLastAnswer] = useState<QuestionAnswer | null>(null);

  return (
    <nav className="navbar">
      <span className="navbar-brand">Effective</span>
      <div className="navbar-actions">
        <button
          type="button"
          onClick={() => {
            void sidebar.open<void>(
              (resolve) => (
                <div data-testid="sidebar-panel">
                  <p>Menu</p>
                  <button type="button" onClick={() => resolve()}>
                    Close
                  </button>
                </div>
              ),
              { label: "Menu" },
            );
          }}
        >
          Menu
        </button>
        <button
          type="button"
          onClick={() => {
            // Opened on top of whatever's already showing (e.g. Menu's sidebar) - closing
            // this one (or navigating back to Menu) reveals it again automatically.
            void sidebar.open<void>(
              (resolve) => (
                <div data-testid="sidebar-panel">
                  <p>Details</p>
                  <button type="button" onClick={() => resolve()}>
                    Close
                  </button>
                </div>
              ),
              { label: "Details" },
            );
          }}
        >
          Details
        </button>
        <button
          type="button"
          disabled={!sidebarHistory.canGoBack}
          onClick={() => void sidebar.back()}
        >
          Back{sidebarHistory.backLabel ? ` (${sidebarHistory.backLabel})` : ""}
        </button>
        <button
          type="button"
          disabled={!sidebarHistory.canGoForward}
          onClick={() => void sidebar.forward()}
        >
          Forward{sidebarHistory.forwardLabel ? ` (${sidebarHistory.forwardLabel})` : ""}
        </button>
        <button type="button" onClick={() => void sidebar.close()}>
          Close sidebar
        </button>
        <button type="button" onClick={() => void sidebar.closeAll()}>
          Close all sidebars
        </button>
        <button
          type="button"
          onClick={async () => {
            const choice = await modal.open<DeleteChoice>((resolve) => (
              <DeleteDialog onChoice={resolve} />
            ));
            setLastChoice(choice);
          }}
        >
          Delete
        </button>
        {lastChoice && <span data-testid="last-choice">{lastChoice}</span>}
        <button
          type="button"
          onClick={() => {
            // { replace: true } - discards whatever modal was open (if any) instead of
            // stacking on top of it. Dismissing this one reveals nothing, unlike
            // DeleteDialog's Help button.
            void modal.open<void>((resolve) => <NotifyDialog onDismiss={() => resolve()} />, {
              replace: true,
            });
          }}
        >
          Notify (replaces)
        </button>
        <button
          type="button"
          onClick={async () => {
            const answer = await askQuestion();
            setLastAnswer(answer);
          }}
        >
          Ask question
        </button>
        {lastAnswer && <span data-testid="last-answer">{lastAnswer}</span>}
      </div>
    </nav>
  );
}
