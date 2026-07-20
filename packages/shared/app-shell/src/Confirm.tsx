import { Effect } from "effect";
import { openModal } from "./ModalManager.ts";

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

/**
 * Opens a confirmation modal and returns an Effect that resolves to whether the user
 * confirmed. Built on `Effect.callback` (effect v4's callback-integration primitive - "async"
 * in older effect versions), not a plain Promise, so an action's `execute` can `yield*` it
 * directly inside an `Effect.gen` alongside any other step (a fetch, a PowerSync write, a
 * second confirm) instead of mixing `await` and Effect styles. The registration function's
 * returned cleanup Effect matters here specifically: if the fiber running this is interrupted
 * (e.g. the triggering component unmounts mid-confirmation), it closes the modal instead of
 * leaving it open with nothing left listening for its result.
 */
export const confirm = (options: ConfirmOptions): Effect.Effect<boolean> =>
  Effect.callback<boolean>((resume) => {
    const handle = openModal((modalHandle) => (
      <ConfirmDialog
        {...options}
        onConfirm={() => {
          modalHandle.close();
          resume(Effect.succeed(true));
        }}
        onCancel={() => {
          modalHandle.close();
          resume(Effect.succeed(false));
        }}
      />
    ));
    return Effect.sync(() => handle.close());
  });

const ConfirmDialog = ({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmOptions & { readonly onConfirm: () => void; readonly onCancel: () => void }) => (
  <div>
    <h2>{title}</h2>
    <p>{message}</p>
    <button type="button" onClick={onCancel}>
      {cancelLabel}
    </button>
    <button type="button" onClick={onConfirm}>
      {confirmLabel}
    </button>
  </div>
);
