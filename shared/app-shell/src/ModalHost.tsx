import { runtime } from "@repo/shared-lib";
import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { closeModal, modalStackAtom, type ModalHandle } from "./ModalManager.ts";

/** Mount once in the app shell (not per-page) - renders every entry in `modalStackAtom`. */
export const ModalHost = () => {
  const stack = useAtomValue(modalStackAtom);
  return (
    <>
      {stack
        .filter((entry) => !entry.hidden)
        .map(({ id, render }) => (
          <Modal key={id} id={id} render={render} />
        ))}
    </>
  );
};

const Modal = ({
  id,
  render,
}: {
  readonly id: string;
  readonly render: (handle: ModalHandle) => React.ReactNode;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // `runtime` is `@repo/shared-lib`'s Atom.runtime-backed AtomRegistryService - reached
  // through the same RegistryContext useAtomValue already uses, no separate Context needed.
  const context = useAtomValue(runtime, AsyncResult.getOrThrow);
  const close = useCallback(
    () => Effect.runSync(Effect.provide(closeModal(id), context)),
    [id, context],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    // Native <dialog> already closes itself on Escape (and fires "close") - keep the stack
    // Atom in sync when that happens instead of only reacting to our own closeModal() calls.
    const onClose = () => close();
    dialog?.addEventListener("close", onClose);
    return () => dialog?.removeEventListener("close", onClose);
  }, [close]);

  const handle: ModalHandle = { id, close };
  return createPortal(<dialog ref={dialogRef}>{render(handle)}</dialog>, document.body);
};
