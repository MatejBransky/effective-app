import { useAtomSet } from "@effect/atom-react";
import { useModal, useSidebar } from "@repo/shared-shell";
import { useState } from "react";
import { DeleteDialog, type DeleteChoice } from "./DeleteDialog.tsx";
import { NotifyDialog } from "./NotifyDialog.tsx";
import { askQuestionAtom } from "../demo/askQuestionAction.tsx";
import type { QuestionAnswer } from "./QuestionDialog.tsx";

// Every button here is scaffolding proving SidebarService/ModalService round-trip end to
// end through useSidebar()/useModal() (and, for "Ask question", a plain Effect action
// that never touches React) - not a real feature. A first real domain replaces this once
// one exists. Back/Forward/Close/Minimize live in <SidebarHost/>'s own toolbar, not here -
// they're part of the sidebar UI itself, not something every trigger has to rebuild.
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
            // key: "menu" - re-clicking while Menu is already the active sidebar entry
            // replaces it in place instead of pushing a duplicate back/forward stop.
            void sidebar.open<void>(() => <p>Menu</p>, { label: "Menu", key: "menu" });
          }}
        >
          Menu
        </button>
        <button
          type="button"
          onClick={() => {
            // Opened on top of whatever's already showing (e.g. Menu's sidebar) - closing
            // this one (or navigating back via the sidebar's own toolbar) reveals it again.
            void sidebar.open<void>(() => <p>Details</p>, { label: "Details", key: "details" });
          }}
        >
          Details
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
