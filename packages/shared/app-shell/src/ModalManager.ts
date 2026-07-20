import { registry } from "@effective-app/shared-lib";
import { Atom } from "effect/unstable/reactivity";
import type { ReactNode } from "react";

export interface ModalHandle {
  readonly id: string;
  readonly close: () => void;
}

interface ModalEntry {
  readonly id: string;
  readonly render: (handle: ModalHandle) => ReactNode;
}

/** The open-modal stack, bottom to top. `ModalHost` (mounted once in the app shell) renders
 * every entry; nothing else needs to import this Atom directly - use `openModal`/`closeModal`.
 *
 * `Atom.keepAlive` matters even though `ModalHost` always subscribes via `useAtomValue`:
 * without it, every atom defaults to `keepAlive: false` and gets scheduled for removal the
 * moment its node is first created (`AtomRegistry.ts`'s `createNode`/`scheduleAtomRemoval`),
 * reset back to `[]` on the very next tick unless something is already mounted at that exact
 * moment. Relying on `ModalHost` having mounted first is fragile (e.g. `openModal` called
 * before the app shell renders) - see `Keybindings.ts`'s `keybindingsAtom` comment for the
 * bug this caused there. */
export const modalStackAtom: Atom.Writable<ReadonlyArray<ModalEntry>> = Atom.keepAlive(
  Atom.make<ReadonlyArray<ModalEntry>>([]),
);

/** Pushes a modal onto the stack from anywhere in the component tree, no prop-drilling or
 * context provider needed. `render` receives a handle so the modal's own content can close
 * itself (e.g. a "Cancel" button) without the caller having to track the id. */
export const openModal = (render: (handle: ModalHandle) => ReactNode): ModalHandle => {
  const id = crypto.randomUUID();
  const handle: ModalHandle = { id, close: () => closeModal(id) };
  registry.update(modalStackAtom, (stack) => [...stack, { id, render }]);
  return handle;
};

export const closeModal = (id: string): void => {
  registry.update(modalStackAtom, (stack) => stack.filter((entry) => entry.id !== id));
};
