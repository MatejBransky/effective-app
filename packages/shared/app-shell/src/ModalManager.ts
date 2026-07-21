import { registry } from "@repo/shared-lib";
import { Atom } from "effect/unstable/reactivity";
import type { ReactNode } from "react";

export interface ModalHandle {
  readonly id: string;
  readonly close: () => void;
}

interface ModalEntry {
  readonly id: string;
  readonly render: (handle: ModalHandle) => ReactNode;
  /** See `ModalOpenOptions.locked`. */
  readonly locked?: boolean;
  /** Suspended by a later `restorePrevious` replace - kept in the stack but skipped by
   * `ModalHost` until whatever replaced it closes. */
  readonly hidden?: boolean;
}

export interface ModalOpenOptions {
  readonly stack?: boolean;
  /** Refuses to let *any* later `openModal` call (stacked or not) replace or cover this modal
   * while it's open - use for the rare dialog that must be resolved before anything else can
   * show (e.g. a blocking error). The refused call still returns a `ModalHandle`, so callers
   * don't need special-case error handling; its `close()` is just a harmless no-op. */
  readonly locked?: boolean;
  /** Marks *this* modal as a temporary, unintrusive overlay (e.g. a keyboard-shortcuts help
   * dialog) - when it replaces a currently-open modal, that modal isn't discarded, it's
   * suspended and brought back automatically once this one closes. The replaced modal doesn't
   * need any cooperation or advance opt-in for this - a plain `openModal(...)` call with no
   * options gets restored just the same. Only protects one level: if a *different* modal
   * without this option replaces this one, whatever this one was covering is discarded along
   * with it, same as today's default destructive replace. */
  readonly restorePrevious?: boolean;
}

/** The open-modal stack, bottom to top. `ModalHost` (mounted once in the app shell) renders
 * every non-`hidden` entry; nothing else needs to import this Atom directly - use
 * `openModal`/`closeModal`.
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

/** Opens a modal from anywhere in the component tree, no prop-drilling or context provider
 * needed. `render` receives a handle so the modal's own content can close itself (e.g. a
 * "Cancel" button) without the caller having to track the id.
 *
 * By default this **replaces** any currently-open modal(s) rather than stacking on top of
 * them - two unrelated modals overlapping is almost never the intent, and native `<dialog>`
 * elements don't visually communicate "there's another one behind this" the way a z-indexed
 * card stack might. Pass `{ stack: true }` for the rarer case where nesting is actually
 * wanted (e.g. a "discard changes?" confirmation opened from within a form modal). See
 * `ModalOpenOptions.locked` and `.restorePrevious` for changing that default per call. */
export const openModal = (
  render: (handle: ModalHandle) => ReactNode,
  options?: ModalOpenOptions,
): ModalHandle => {
  const id = crypto.randomUUID();
  const handle: ModalHandle = { id, close: () => closeModal(id) };
  if (registry.get(modalStackAtom).at(-1)?.locked) return handle;
  const entry: ModalEntry = { id, render, locked: options?.locked };
  registry.update(modalStackAtom, (stack) => {
    if (options?.stack) return [...stack, entry];
    const top = stack.at(-1);
    const preserved =
      options?.restorePrevious && top ? [...stack.slice(0, -1), { ...top, hidden: true }] : [];
    return [...preserved, entry];
  });
  return handle;
};

export const closeModal = (id: string): void => {
  registry.update(modalStackAtom, (stack) => {
    const next = stack.filter((entry) => entry.id !== id);
    if (next.length === 0) return next;
    // Whatever's now on top should be visible - un-suspends a modal that was hidden to make
    // room for the one just closed (see `restorePrevious` above).
    const top = next.at(-1)!;
    return top.hidden ? [...next.slice(0, -1), { ...top, hidden: false }] : next;
  });
};
