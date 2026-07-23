import { Effect } from "effect";
import { ModalService } from "@repo/shared-shell";
import { QuestionDialog, type QuestionAnswer } from "../components/QuestionDialog.tsx";
import { runtime } from "../runtime/runtime.ts";

// A minimal proof that domain-style business logic (`yield* ModalService`, not a React
// hook) can trigger a modal and use the user's answer - the same shape a real domain
// action (e.g. HostActions.archive in docs/web-bootstrap-architecture.md) would use.
const askQuestion: Effect.Effect<QuestionAnswer, never, ModalService> = Effect.gen(function* () {
  const modal = yield* ModalService;
  return yield* modal.open<QuestionAnswer>((resolve) => <QuestionDialog onAnswer={resolve} />);
});

export const askQuestionAtom = runtime.fn(() => askQuestion);
