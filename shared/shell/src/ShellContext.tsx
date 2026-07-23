import { Effect } from "effect";
import { AsyncResult, type Atom } from "effect/unstable/reactivity";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ModalService } from "./ModalService.ts";
import { SidebarService } from "./SidebarService.ts";
import type { OverlayEntry, OverlayOpenRender } from "./OverlayStack.ts";

export interface OverlayRuntime {
  readonly state: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<OverlayEntry>, unknown>>;
  readonly open: Atom.AtomResultFn<OverlayOpenRender, unknown, unknown>;
}

/**
 * Everything Shell-specific (SidebarService, ModalService, and whatever comes next - a
 * view-mode toggle, say) bundled behind one Context, provided once at the app root via
 * `<ShellProvider/>`. Adding a future Shell capability means: a new `Context.Service` (its
 * own file, same shape as SidebarService/ModalService), a new field here and in
 * `makeShellRuntime` below, merging its `.layer` into `MainLayer`, and (if components need
 * to call it) a small `useXxx()` hook alongside `useSidebar`/`useModal` - shared/shell
 * owns the "how", the app just supplies its runtime once.
 */
export interface ShellRuntime {
  readonly sidebar: OverlayRuntime;
  readonly modal: OverlayRuntime;
}

function makeShellRuntime<E>(
  runtime: Atom.AtomRuntime<SidebarService | ModalService, E>,
): ShellRuntime {
  return {
    sidebar: {
      state: runtime.subscriptionRef(Effect.map(SidebarService, (service) => service.state)),
      open: runtime.fn((render: OverlayOpenRender) =>
        Effect.gen(function* () {
          const sidebar = yield* SidebarService;
          return yield* sidebar.open(render);
        }),
      ),
    },
    modal: {
      state: runtime.subscriptionRef(Effect.map(ModalService, (service) => service.state)),
      open: runtime.fn((render: OverlayOpenRender) =>
        Effect.gen(function* () {
          const modal = yield* ModalService;
          return yield* modal.open(render);
        }),
      ),
    },
  };
}

const ShellContext = createContext<ShellRuntime | undefined>(undefined);

/**
 * Mount once at the app root, given the app's own `Atom.runtime(MainLayer)` (only the
 * composing app owns one, per AGENTS.md). Everything Shell-specific becomes reachable
 * from any component or Effect service beneath it - no further wiring needed per call
 * site, in `apps/web` or in any `domains/*` package.
 */
export function ShellProvider<E>(props: {
  readonly runtime: Atom.AtomRuntime<SidebarService | ModalService, E>;
  readonly children?: ReactNode;
}) {
  // Built once per `runtime` identity - atoms must stay referentially stable across
  // renders (a fresh atom every render breaks useAtomValue's subscription/caching), so
  // this can't be rebuilt inline in useSidebar/useModal/SidebarHost/ModalHost.
  const shellRuntime = useMemo(() => makeShellRuntime(props.runtime), [props.runtime]);
  return <ShellContext.Provider value={shellRuntime}>{props.children}</ShellContext.Provider>;
}

export function useShellContext(): ShellRuntime {
  const runtime = useContext(ShellContext);
  if (!runtime) {
    throw new Error(
      "useSidebar/useModal/<SidebarHost/>/<ModalHost/> must be used within <ShellProvider>",
    );
  }
  return runtime;
}
