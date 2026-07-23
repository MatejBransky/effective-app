export type QuestionAnswer = "yes" | "no" | "dontKnow" | "cancel";

export function QuestionDialog(props: { readonly onAnswer: (answer: QuestionAnswer) => void }) {
  return (
    <div className="shell-modal-content">
      <p>Do you want to continue?</p>
      <button type="button" onClick={() => props.onAnswer("yes")}>
        Yes
      </button>
      <button type="button" onClick={() => props.onAnswer("no")}>
        No
      </button>
      <button type="button" onClick={() => props.onAnswer("dontKnow")}>
        I don't know
      </button>
      <button type="button" onClick={() => props.onAnswer("cancel")}>
        Cancel
      </button>
    </div>
  );
}
