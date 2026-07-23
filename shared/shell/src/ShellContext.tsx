import { Effect } from "effect";
import { AsyncResult, type Atom } from "effect/unstable/reactivity";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ModalService } from "./ModalService.ts";
import { SidebarService } from "./SidebarService.ts";
import type { OverlayHistory, OverlayOpenOptions, OverlayOpenRender } from "./OverlayStack.ts";

export interface OverlayOpenDispatch {
  readonly render: OverlayOpenRender;
  readonly options?: OverlayOpenOptions;
}

export interface OverlayRuntime {
  readonly history: Atom.Atom<AsyncResult.AsyncResult<OverlayHistory, unknown>>;
  readonly open: Atom.AtomResultFn<OverlayOpenDispatch, unknown, unknown>;
  // Always closes whichever entry is at the cursor - a generic "dismiss" callable from
  // anywhere (a Navbar button, say), not tied to a specific entry's own render.
  readonly close: Atom.AtomResultFn<void, void, unknown>;
  readonly closeAll: Atom.AtomResultFn<void, void, unknown>;
  readonly back: Atom.AtomResultFn<void, void, unknown>;
  readonly forward: Atom.AtomResultFn<void, void, unknown>;
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
      history: runtime.subscriptionRef(Effect.map(SidebarService, (service) => service.history)),
      // concurrent: true - open() stays pending the whole time its entry is displayed, so
      // Atom.fn's default (a new call interrupts the previous one) would silently drop
      // whichever sidebar was already open the moment a second one is opened on top of it.
      open: runtime.fn(
        (input: OverlayOpenDispatch) =>
          Effect.gen(function* () {
            const sidebar = yield* SidebarService;
            return yield* sidebar.open(input.render, input.options);
          }),
        { concurrent: true },
      ),
      close: runtime.fn(() =>
        Effect.gen(function* () {
          const sidebar = yield* SidebarService;
          yield* sidebar.close();
        }),
      ),
      closeAll: runtime.fn(() =>
        Effect.gen(function* () {
          const sidebar = yield* SidebarService;
          yield* sidebar.closeAll();
        }),
      ),
      back: runtime.fn(() =>
        Effect.gen(function* () {
          const sidebar = yield* SidebarService;
          yield* sidebar.back();
        }),
      ),
      forward: runtime.fn(() =>
        Effect.gen(function* () {
          const sidebar = yield* SidebarService;
          yield* sidebar.forward();
        }),
      ),
    },
    modal: {
      history: runtime.subscriptionRef(Effect.map(ModalService, (service) => service.history)),
      open: runtime.fn(
        (input: OverlayOpenDispatch) =>
          Effect.gen(function* () {
            const modal = yield* ModalService;
            return yield* modal.open(input.render, input.options);
          }),
        { concurrent: true },
      ),
      close: runtime.fn(() =>
        Effect.gen(function* () {
          const modal = yield* ModalService;
          yield* modal.close();
        }),
      ),
      closeAll: runtime.fn(() =>
        Effect.gen(function* () {
          const modal = yield* ModalService;
          yield* modal.closeAll();
        }),
      ),
      back: runtime.fn(() =>
        Effect.gen(function* () {
          const modal = yield* ModalService;
          yield* modal.back();
        }),
      ),
      forward: runtime.fn(() =>
        Effect.gen(function* () {
          const modal = yield* ModalService;
          yield* modal.forward();
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
