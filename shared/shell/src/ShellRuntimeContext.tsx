import { AsyncResult, type Atom } from "effect/unstable/reactivity";
import { createContext, useContext, type ReactNode } from "react";
import type { OverlayEntry, ShellUIOpenRender } from "./ShellUI.ts";

/**
 * The runtime-bound atoms `shared/shell`'s components need - built once by whichever app
 * composes `ShellUI.layer` into its own `Atom.runtime(MainLayer)` (only it owns that
 * runtime, per AGENTS.md), then provided here once at the app root. Lets `<ShellHost/>`,
 * `useShellUI()`, and any future deeply-nested consumer (a domain widget, say) reach them
 * without threading an atom through every intermediate component's props.
 *
 * Same shape `@effect/atom-react`'s own `ScopedAtom.make` uses internally (`createContext`
 * + a `use()` that throws outside its provider) - just bundling more than the one atom
 * `ScopedAtom` is built around, and providing a single global instance rather than a fresh
 * one per subtree.
 */
export interface ShellRuntime {
  readonly state: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<OverlayEntry>, unknown>>;
  readonly openSidebar: Atom.AtomResultFn<ShellUIOpenRender, unknown, unknown>;
}

const ShellRuntimeContext = createContext<ShellRuntime | undefined>(undefined);

export function ShellRuntimeProvider(props: {
  readonly runtime: ShellRuntime;
  readonly children?: ReactNode;
}) {
  return (
    <ShellRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </ShellRuntimeContext.Provider>
  );
}

export function useShellRuntime(): ShellRuntime {
  const runtime = useContext(ShellRuntimeContext);
  if (!runtime) {
    throw new Error(
      "useShellRuntime/useShellUI/<ShellHost/> must be used within <ShellRuntimeProvider>",
    );
  }
  return runtime;
}
