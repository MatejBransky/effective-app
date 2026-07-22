import { AtomRegistryService } from "@repo/shared-lib";
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
 *
 * Requires `AtomRegistryService` (transitively, via `openModal` - see `ModalManager.ts`) -
 * resolved once via `yield*` before entering `Effect.callback`'s plain-JS setup function
 * (which can't itself `yield*`, so `openModal`'s effect is run there with the
 * already-resolved service instead of a fresh lookup).
 */
export const confirm = (
  options: ConfirmOptions,
): Effect.Effect<boolean, never, AtomRegistryService> =>
  Effect.gen(function* () {
    const registryService = yield* AtomRegistryService;
    return yield* Effect.callback<boolean>((resume) => {
      const handle = Effect.runSync(
        Effect.provideService(
          openModal((modalHandle) => (
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
          )),
          AtomRegistryService,
          registryService,
        ),
      );
      return Effect.sync(() => handle.close());
    });
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
