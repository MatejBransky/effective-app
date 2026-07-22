import { useAtomSet } from "@effect/atom-react";
import type { Atom } from "effect/unstable/reactivity";
import type * as React from "react";
import type { OverlayKind } from "./ShellUI.ts";

export interface ShellUIOpenInput {
  readonly render: (resolve: (value: unknown) => void) => React.ReactNode;
  readonly kind?: OverlayKind;
}

/**
 * Component-side dispatch for `ShellUI.open`. Takes the app's own `runtime.fn(...)` atom
 * (built from an `Effect.gen` that `yield*`s `ShellUI`) so this hook shares the exact same
 * runtime-built `ShellUI` singleton that `<ShellHost/>` subscribes to - never a
 * separately-built instance.
 */
export function useShellUI<E>(openAtom: Atom.AtomResultFn<ShellUIOpenInput, unknown, E>) {
  const run = useAtomSet(openAtom, { mode: "promise" });

  return <A>(
    render: (resolve: (value: A) => void) => React.ReactNode,
    options?: { readonly kind?: OverlayKind },
  ): Promise<A> =>
    run({ render: render as ShellUIOpenInput["render"], kind: options?.kind }) as Promise<A>;
}
