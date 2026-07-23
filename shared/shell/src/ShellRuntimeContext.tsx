import { Effect } from "effect";
import { AsyncResult, type Atom } from "effect/unstable/reactivity";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ShellUI, type OverlayEntry, type ShellUIOpenRender } from "./ShellUI.ts";

/**
 * The runtime-bound atoms `shared/shell`'s components need. Only the composing app owns an
 * `Atom.runtime(MainLayer)` (per AGENTS.md), so `<ShellRuntimeProvider/>` takes that raw
 * runtime and derives these atoms internally (`makeShellRuntime` below) - shared/shell owns
 * the "how", the app just supplies its runtime once at the root. Reachable from
 * `<ShellHost/>`, `useShellUI()`, and any future deeply-nested consumer (a domain widget,
 * say) without threading an atom through every intermediate component's props.
 */
export interface ShellRuntime {
  readonly state: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<OverlayEntry>, unknown>>;
  readonly openSidebar: Atom.AtomResultFn<ShellUIOpenRender, unknown, unknown>;
}

function makeShellRuntime<E>(runtime: Atom.AtomRuntime<ShellUI, E>): ShellRuntime {
  return {
    state: runtime.subscriptionRef(Effect.map(ShellUI, (shell) => shell.state)),
    openSidebar: runtime.fn((render: ShellUIOpenRender) =>
      Effect.gen(function* () {
        const shell = yield* ShellUI;
        return yield* shell.openSidebar(render);
      }),
    ),
  };
}

const ShellRuntimeContext = createContext<ShellRuntime | undefined>(undefined);

export function ShellRuntimeProvider<E>(props: {
  readonly runtime: Atom.AtomRuntime<ShellUI, E>;
  readonly children?: ReactNode;
}) {
  // Built once per `runtime` identity - the composing app creates its runtime exactly once
  // at module scope (apps/web/src/runtime/runtime.ts), so this memo never recomputes for
  // the lifetime of the app. Atoms must stay referentially stable across renders (a fresh
  // atom object every render breaks useAtomValue's subscription/caching), so this can't be
  // built inline in ShellHost/useShellUI on every call.
  const shellRuntime = useMemo(() => makeShellRuntime(props.runtime), [props.runtime]);
  return (
    <ShellRuntimeContext.Provider value={shellRuntime}>
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
