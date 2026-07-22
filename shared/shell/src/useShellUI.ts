import { useAtomSet } from "@effect/atom-react";
import type { Atom } from "effect/unstable/reactivity";
import type * as React from "react";

export type ShellUIOpenRender = (resolve: (value: unknown) => void) => React.ReactNode;

/**
 * Component-side dispatch for one of `ShellUI`'s `open*` methods. Takes the app's own
 * `runtime.fn(...)` atom (built from an `Effect.gen` that `yield*`s `ShellUI`) so this hook
 * shares the exact same runtime-built `ShellUI` singleton that `<ShellHost/>` subscribes to -
 * never a separately-built instance. Generic over which `open*` method the atom wraps
 * (`shellOpenSidebarAtom`, later `shellOpenModalAtom`, ...) - the atom itself, not this hook,
 * says which overlay kind gets opened.
 */
export function useShellUI<E>(openAtom: Atom.AtomResultFn<ShellUIOpenRender, unknown, E>) {
  const run = useAtomSet(openAtom, { mode: "promise" });

  return <A>(render: (resolve: (value: A) => void) => React.ReactNode): Promise<A> =>
    run(render as ShellUIOpenRender) as Promise<A>;
}
