import { useAtomSet } from "@effect/atom-react";
import { useModal, useSidebar } from "@repo/shared-shell";
import { useState } from "react";
import { DeleteDialog, type DeleteChoice } from "./DeleteDialog.tsx";
import { askQuestionAtom } from "../demo/askQuestionAction.tsx";
import type { QuestionAnswer } from "./QuestionDialog.tsx";

// Every button here is scaffolding proving SidebarService/ModalService round-trip end to
// end through useSidebar()/useModal() (and, for "Ask question", a plain Effect action
// that never touches React) - not a real feature. A first real domain replaces this once
// one exists.
export function Navbar() {
  const sidebar = useSidebar();
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
            void sidebar.open<void>((resolve) => (
              <div data-testid="sidebar-panel">
                <p>Menu</p>
                <button type="button" onClick={() => resolve()}>
                  Close
                </button>
              </div>
            ));
          }}
        >
          Menu
        </button>
        <button
          type="button"
          onClick={() => {
            // Opened on top of whatever's already showing (e.g. Menu's sidebar) - closing
            // this one reveals it again automatically, since <SidebarHost/> only ever
            // renders the top of the stack.
            void sidebar.open<void>((resolve) => (
              <div data-testid="sidebar-panel">
                <p>Details</p>
                <button type="button" onClick={() => resolve()}>
                  Close
                </button>
              </div>
            ));
          }}
        >
          Details
        </button>
        <button type="button" onClick={() => void sidebar.close()}>
          Close sidebar
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
