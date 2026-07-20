import { useAtomValue } from "@effective-app/shared-lib";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { closeModal, modalStackAtom, type ModalHandle } from "./ModalManager.ts";

/** Mount once in the app shell (not per-page) - renders every entry in `modalStackAtom`. */
export const ModalHost = () => {
  const stack = useAtomValue(modalStackAtom);
  return (
    <>
      {stack.map(({ id, render }) => (
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

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    // Native <dialog> already closes itself on Escape (and fires "close") - keep the stack
    // Atom in sync when that happens instead of only reacting to our own closeModal() calls.
    const onClose = () => closeModal(id);
    dialog?.addEventListener("close", onClose);
    return () => dialog?.removeEventListener("close", onClose);
  }, [id]);

  const handle: ModalHandle = { id, close: () => closeModal(id) };
  return createPortal(<dialog ref={dialogRef}>{render(handle)}</dialog>, document.body);
};
