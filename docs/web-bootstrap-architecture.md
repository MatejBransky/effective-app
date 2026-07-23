# apps/web Effect bootstrap - app shell (modals/overlays) + cross-domain actions

Design doc, not yet implemented. Written to answer four concrete questions before
anyone builds `apps/web`'s bootstrap against guesses:

1. How does `apps/web`'s bootstrap compose domain `Layer`s so that missing
   dependencies or unhandled errors show up as TypeScript errors right at the
   composition point, before the app ever runs?
2. How can any domain or component imperatively open a modal or sidebar with
   arbitrary JSX - a true "open this from anywhere" capability - while keeping
   React a thin view layer and the actual state/logic in an Effect service?
3. How do domains expose actions callable by other domains without a direct
   package-to-package dependency, using `shared/*` as the neutral "description"
   layer?
4. How does business logic (inside a domain's Effect code) request a user
   decision (confirm/alert) before proceeding with an action - the same
   imperative shape as the legacy Promise-based `const result = await
openModal((resolve) => jsx)` pattern, just as an `Effect` instead of a
   `Promise`?

## Where this fits

`apps/web` is currently a bare Vite + React 19 + TanStack Router SPA
(`apps/web/src/main.tsx`, `apps/web/src/routes/__root.tsx`): no React
providers, no `components/` folder, no global state, zero Effect usage.
`AGENTS.md` has already made the binding decisions this doc builds on:

- Every app does DI via Effect v4 (`effect` `4.0.0-beta.100`, the "smol"
  rewrite, beta) `Layer`/`Context.Service` - external I/O goes through
  swappable services, never called directly.
- Four top-level layers: `shared/*` (generic tier + business-shape tier),
  `domains/*` (one pnpm package per business domain, FSD-style
  `package.json#exports` discipline, **domains never import each other
  directly**), `apps/*`, `scripts`.
- Cross-domain calls go through a `Context.Service` tag defined in `shared/*`
  next to the shape it identifies - the calling domain `yield*`s the tag,
  never the implementing domain's package. Whichever app composes every
  domain imports every domain's `Layer`, merges them with `Layer.mergeAll`,
  and builds the result once at bootstrap.
- `AGENTS.md`/`README.md` already name **a modal manager** as the canonical
  example of `shared/*`'s generic tier (cross-cutting, no business shapes).
- `pnpm-workspace.yaml`'s catalog already pins `@effect/atom-react`
  (`4.0.0-beta.100`, the effect-v4-native binding - deliberately not the older
  `@effect-atom/atom-react`, which needs effect v3) as the React state
  binding.
- `apps/server` already establishes the concrete Effect v4 idiom to mirror:
  `Context.Service` tags (not `Context.Tag`/`Effect.Service` class syntax),
  `Layer.succeed`/`Layer.effect` factories, composition via chained
  `Layer.provide` ending in `Layer.launch(...).pipe(NodeRuntime.runMain)` (see
  `apps/server/src/JwtVerifier.ts`, `apps/server/src/Auth.ts`,
  `apps/server/src/main.ts`).

Two scope notes for this pass:

- The domain examples below (`domains/hosts`, `domains/members`) are
  **illustrative only** - real entity names from `CONTEXT.md`'s glossary, but
  no such domain package exists yet (`docs/implement-domain-model.md` is
  unstarted). Nothing here should be created as a real package; replace the
  sketches once real domains land.
- `apps/web/src/lib/auth.ts`'s Keycloak/`oidc-client-ts` login is deliberately
  **left untouched** in this pass, even though `AGENTS.md` already mandates
  wrapping it behind an `AuthService` `Layer` eventually. Tracked as known
  follow-up, not resolved here.

## 1. `shared/shell` - the app-shell package

Home for global, cross-cutting UI-adjacent state with no business shapes,
starting with sidebar/modal overlay management. Package `@repo/shared-shell`.

This is a normal package: it holds **both** the Effect services and whatever
React they need to render themselves (`<SidebarHost/>`, `<ModalHost/>`,
hooks). There's no rule forcing React out of this package, or out of
`domains/*` either - a layer holds whatever belongs to it. The actual
principle this architecture is built around is narrower: **business logic
(decisions, orchestration, state) gets modeled in Effect, independent of
React; React supplies specific rendered actions on top of it** (a dialog's
buttons, a sidebar's contents) - not "no React in shared/domains packages."

Since there's no cross-domain isolation concern here (nothing needs to depend
on a description without depending on the implementation - see the reasoning
in section 2), this follows the same principle `apps/server`'s
`JwtVerifier.ts` already established: no artificial split between a tag and
its `Layer` when nothing needs to depend on one without the other.

The concrete shape differs by how many concrete implementations a service
has, though - two established idioms in this repo, pick whichever fits:

- **Exactly one Live implementation, no config/swappable backend** (e.g.
  `SidebarService`/`ModalService` below - both just an in-memory overlay
  stack, nothing to fake in tests): pass `make` inline as `Context.Service`'s
  `make` option, and add a `static readonly layer` on the class itself
  deriving the `Layer` from `this.make`. This isn't a repo-specific
  invention: it's what the vendored Effect source itself does for an
  equivalently-shaped service (`MemoryDriver` in
  `externals/effect/packages/effect/src/unstable/cluster/MessageStorage.ts:828-1036`).
- **Multiple concrete implementations to swap** (e.g. `JwtVerifier` - a real
  network-fetching `layer(options)` vs. an in-memory `layerWithJwks(options)`
  for tests): keep the tag and its `Layer` factories as separate exported
  consts in the same file, since a single static property can't hold more
  than one variant.

```
shared/shell/
  package.json           # @repo/shared-shell
  src/
    OverlayStack.ts        # shared history/Effect.callback implementation, no tag of its own
    SidebarService.ts      # Context.Service tag over OverlayStack, `static readonly layer`
    ModalService.ts         # Context.Service tag over OverlayStack, `static readonly layer`
    ShellContext.tsx        # React Context bundling both services' runtime-bound atoms
    SidebarHost.tsx          # renders the entry at the cursor
    ModalHost.tsx            # renders the entry at the cursor (as a backdrop overlay)
    useSidebar.ts            # hook: { open, close, closeAll, back, forward }
    useSidebarHistory.ts     # read-only preview hook for back/forward controls
    useModal.ts              # hook: { open, close, closeAll } (no navigation UI)
    useOverlayActions.ts     # dispatch logic shared by useSidebar/useModal
```

**Two separate `Context.Service` tags, not one service with a `kind`
parameter.** An earlier iteration had one `ShellUI` tag with `open(render, {
kind? })` - an optional `kind` with a silent default read ambiguously at the
call site (was `open(render)` a sidebar or a modal?). Splitting into
`SidebarService`/`ModalService` resolves that structurally: `yield*
SidebarService` vs. `yield* ModalService` already says which kind, no
parameter needed, and each gets its own independent stack instead of sharing
one array keyed by `kind`. Since both are otherwise identical (a stack of
Promise-like `open` calls built on `Effect.callback`, resolving whatever
value the caller's `render` passes to `resolve`), they share one
implementation (`OverlayStack.ts`'s `makeOverlayStack`, an `Effect` reused as
each tag's `make`) rather than duplicating the plumbing:

```ts
// shared/shell/src/OverlayStack.ts
export interface OverlayEntry {
  readonly id: number;
  readonly label: string; // shown by back()/forward() consumers, never used to look anything up
  readonly node: React.ReactNode;
  // Lets close()/closeAll() dismiss an entry from *outside* its own render, not just via
  // a callback the entry's own JSX chose to wire up.
  readonly resolve: (value: unknown) => void;
}

// Browser-history-shaped: entries never disappear just because you navigated away from
// them (back()/forward() only move `cursor`) - only close()/opening a genuinely new entry
// actually removes one.
export interface OverlayHistory {
  readonly entries: ReadonlyArray<OverlayEntry>;
  readonly cursor: number; // -1 when entries is empty
}

export interface OverlayOpenOptions {
  readonly label?: string;
  // Discards the *entire* history first (not just anything ahead of the cursor), so
  // closing this entry reveals nothing. Default (false): "temporary, stacks on top,
  // returns to what was showing before" - discards only anything ahead of the cursor,
  // same as a browser tab navigating away from its own forward history.
  readonly replace?: boolean;
}

export interface OverlayStackService {
  readonly history: SubscriptionRef.SubscriptionRef<OverlayHistory>;
  readonly open: <A>(
    render: (resolve: (value: A) => void) => React.ReactNode,
    options?: OverlayOpenOptions,
  ) => Effect.Effect<A>;
  readonly close: (id?: number) => Effect.Effect<void>; // no id = whichever is at the cursor
  readonly closeAll: () => Effect.Effect<void>; // clears the whole history, not just the cursor
  readonly back: () => Effect.Effect<void>; // moves the cursor without closing anything
  readonly forward: () => Effect.Effect<void>;
}
```

```ts
// shared/shell/src/SidebarService.ts
export class SidebarService extends Context.Service<SidebarService, OverlayStackService>()(
  "shared-shell/SidebarService",
  { make: makeOverlayStack },
) {
  static readonly layer: Layer.Layer<SidebarService> = Layer.effect(this, this.make);
}

// shared/shell/src/ModalService.ts - identical shape, different tag
export class ModalService extends Context.Service<ModalService, OverlayStackService>()(
  "shared-shell/ModalService",
  { make: makeOverlayStack },
) {
  static readonly layer: Layer.Layer<ModalService> = Layer.effect(this, this.make);
}
```

Reusing the same `makeOverlayStack` Effect value for both tags is safe and
gives each its own independent history: `Effect.gen(...)` only _describes_
the computation, so `Layer.effect(this, this.make)` runs it fresh per Layer
build, and `SubscriptionRef.make`/`let nextId = 0` inside execute once per
run - `SidebarService` and `ModalService` never share a `SubscriptionRef`
even though they share the code that builds one.

`resolve` itself already removes the entry, and `Effect.callback`'s own
interrupt cleanup covers the cancelled-caller case - so `close(id?)` is only
needed for dismissing an overlay from somewhere that isn't the overlay's own
render (a Navbar button, say), and `closeAll()` for clearing the whole
history at once rather than just the entry at the cursor. Both resolve with
`undefined` - the "went away, no specific outcome" case; a caller that needs
a specific outcome (Cancel vs. Confirm) should still resolve via the entry's
own JSX.

**Only the entry at the cursor is ever rendered** (`SidebarHost`/`ModalHost`
below). Opening a new entry discards anything _ahead_ of the cursor (a
genuinely new navigation, same as a browser tab discarding its forward
history) and appends after it, moving the cursor to it - unless `{ replace:
true }` is passed, which discards the _whole_ history first instead. Closing
the entry at the cursor reveals whatever's now the last one, unprompted -
this is what gives a temporary overlay (a help dialog opened from within a
confirm dialog, say) its "return to what was showing before" behavior, using
the default (non-replace) `open()`, no separate concept needed. `back()`/
`forward()` move the cursor the same way, but _without_ closing anything -
the entry moved away from stays alive (still pending its own `resolve`),
reachable again via the other direction.

Usable identically from a React component or from inside a domain's business
logic - domain code is explicitly allowed to construct JSX here. The only
rule is that the overlay _history state_ itself lives in the service, not in
a React component:

```ts
// from a component: open a sidebar with arbitrary JSX, or close whatever's showing
const sidebar = useSidebar() // { open, close, closeAll, back, forward } - actions only
sidebar.open((resolve) => <MySidebarContent onDone={() => resolve(undefined)} />, { label: "Details" })
sidebar.close()
```

```tsx
// from domain business logic: confirm before proceeding, resolving to a plain boolean...
Effect.gen(function* () {
  const modal = yield* ModalService;
  const confirmed = yield* modal.open<boolean>((resolve) => (
    <ConfirmDialog
      title="Archive item?"
      onConfirm={() => resolve(true)}
      onCancel={() => resolve(false)}
    />
  ));
  if (!confirmed) return;
});
```

```tsx
// ...or to a richer, non-boolean result - open<A> is generic, not tied to yes/no
type DeleteChoice = "cancel" | "archive" | "deleteForever";
const choice = yield * modal.open<DeleteChoice>((resolve) => <DeleteDialog onChoice={resolve} />);
```

```tsx
// { replace: true } - discards whatever was open (permanently) instead of stacking on
// top of it, e.g. a notification that supersedes any dialog currently showing
yield *
  modal.open<void>((resolve) => <NotifyDialog onDismiss={() => resolve()} />, { replace: true });
```

React side - `<SidebarHost/>`/`<ModalHost/>`, each mounted once near the app
root, no renderer registry needed since each entry's `node` was already
produced by `render(...)` inside `open`, up front, not deferred to render
time. Only `entries[cursor]` is rendered:

```tsx
export function SidebarHost() {
  const { sidebar } = useShellContext();
  const { entries, cursor } = useAtomValue(sidebar.history, (result) =>
    AsyncResult.getOrElse(result, () => ({ entries: [], cursor: -1 })),
  );
  const current = entries[cursor];
  if (!current) return null;
  return (
    <div key={current.id} className="shell-sidebar">
      {current.node}
    </div>
  );
}
```

`SidebarHost`/`ModalHost`/`useSidebar`/`useModal` are runtime-agnostic -
none of them imports an `Atom.runtime` directly, since only the composing app
owns one. But they also take no atom as an explicit prop/argument:
`<ShellProvider/>` takes the app's raw `runtime` (from
`apps/web/src/runtime/runtime.ts`) and derives both services' `history`/
`open`/`close`/`closeAll`/`back`/`forward` atoms internally
(`makeShellRuntime`, in `ShellContext.tsx`, via
`runtime.subscriptionRef(...)`/`runtime.fn(...)`), memoized once per
`runtime` identity (`useMemo`, keyed on the app's module-scope-singleton
`runtime` reference) so the atoms stay stable across renders - then exposes
the result through one `ShellRuntime` React Context, provided **once** at
the app root. `useSidebarHistory()` is a separate, deliberately read-only
hook (not part of `useSidebar()`'s actions) giving a back/forward control the
neighboring entry's `label` to preview, e.g. "Back (Menu)".

`open`'s dispatch atom passes `runtime.fn(..., { concurrent: true })` -
`Atom.fn`'s default (a new call interrupts the previous in-flight one) would
silently drop whichever overlay was already open the moment a second one
opened, since `open`'s Effect stays pending the whole time its entry is
displayed (it only completes on `resolve`/`close`/interrupt), not on the
next tick like a typical query/mutation atom.

```tsx
// apps/web/src/routes/__root.tsx
<ShellProvider runtime={runtime}>
  <Navbar />
  <Outlet />
  <SidebarHost />
  <ModalHost />
</ShellProvider>
```

`shared/shell` owns the "how to derive these atoms from a runtime" logic, not
`apps/web` - adding a future Shell capability (a view-mode toggle, say) means
a new `Context.Service` + a field in `ShellRuntime`/`makeShellRuntime` (both
in `ShellContext.tsx`) + a `useXxx()` hook, nothing to hand-wire in
`apps/web`.

This is the same shape `@effect/atom-react`'s own `ScopedAtom.make`
(`externals/effect/packages/atom/react/src/ScopedAtom.ts:120-151`) uses
internally - `createContext` + a `use()` that throws outside its provider -
just bundling more than the single atom `ScopedAtom` is built around, and
providing one global instance rather than a fresh one per subtree (`ScopedAtom`
solves the opposite problem: per-instance isolation for a component reused
many times on a page). Passing an atom explicitly as a prop one level (root
→ one host component) is fine for a single mount point, but doesn't scale
once other components - anywhere in the tree, at any depth, including a
future domain widget - need to reach `useSidebar()`/`useModal()` too:
threading an atom through every intermediate component's props for that
would be real prop drilling. Context avoids it the same way `RegistryContext`
already avoids threading the `AtomRegistry` itself - and matters concretely
here, not just hypothetically: `domains/*` packages must never import from
`apps/web` (per `AGENTS.md`), so a domain widget calling `useSidebar()` has no
way to reach an app-specific atom directly; it can only reach whatever
`shared/shell` exposes through this Context.

`shared/shell/src/useOverlayActions.ts` - the dispatch logic shared by
`useSidebar()`/`useModal()` (each just this bound to a different slice of
`ShellRuntime`), pairing the exposed `open`/`close`/`closeAll` atoms with
`useAtomSet(..., { mode: "promise" })`-style dispatch so components and
domain code share one mental model regardless of which service they're
calling. Deliberately returns only actions, not the history/state - so a
component reading `useSidebar()`/`useModal()` never mistakes it for a place
to read what's currently open. `useSidebar()` layers `back()`/`forward()` on
top (`ModalService` has no navigation UI, so `useModal()` doesn't); a
component that needs to read history - `<SidebarHost/>`/`<ModalHost/>`
rendering the current entry, or a back/forward control previewing the next
one - uses its own internal access (`useShellContext()`) or the dedicated
`useSidebarHistory()` instead.

## 2. Action descriptions: generic shape, per-entity description, implementation, merge

Four layers, each answering a different question:

1. **Generic `Action<A>` shape, in `shared/shell`** - so any shell UI (a
   page's action menu, a widget's button, a command palette) can render/list
   actions the same way, regardless of which domain owns them. Generic tier:
   parameterized over `A`, no business shape baked in.

   ```ts
   // shared/shell/src/Action.ts
   export interface Action<A> {
     readonly id: string;
     readonly label: string;
     readonly isVisible?: (data: A) => boolean;
     readonly isDisabled?: (data: A) => boolean | string; // string = reason (tooltip)
     readonly run: (data: A) => Effect.Effect<void, unknown, ShellUI>;
   }
   ```

2. **Concrete, per-entity description, in `shared/entities`**, next to the
   shape - builds on `Action<A>` when actions need to render in shared UI.
   Same cross-domain-tag reasoning as any other action: the split exists so a
   _different_ domain can depend on the description without depending on the
   owning domain's package - not a blanket "`shared/*` never implements
   anything" rule (`shared/shell` above proves it can; it just has no
   single owning domain to isolate from).

   ```ts
   // shared/entities/src/host/HostActions.ts
   export class HostActions extends Context.Service<
     HostActions,
     {
       readonly getById: (id: HostId) => Effect.Effect<Host, HostNotFoundError>;
       readonly archive: (id: HostId) => Effect.Effect<void, HostNotFoundError>;
       readonly menuActions: (host: Host) => ReadonlyArray<Action<Host>>;
     }
   >()("shared-entities/HostActions") {}
   ```

3. **Implementation, in `domains/hosts`** - business rules (when is archive
   disabled?) and any user-decision step (confirm dialog, inline JSX and all)
   live here, behind the tag above:

   ```tsx
   // domains/hosts/src/HostActionsLive.ts
   export const HostActionsLive = Layer.effect(
     HostActions,
     Effect.gen(function* () {
       const shell = yield* ShellUI;
       const archive = (id: HostId) => Effect.gen(function* () /* ... */ {});

       const menuActions = (host: Host): ReadonlyArray<Action<Host>> => [
         {
           id: "archive",
           label: "Archive",
           isDisabled: (h) => h.archivedAt !== null && "Already archived",
           run: (h) =>
             Effect.gen(function* () {
               const confirmed = yield* shell.openModal<boolean>((resolve) => (
                 <ConfirmDialog
                   title={`Archive ${h.name}?`}
                   onConfirm={() => resolve(true)}
                   onCancel={() => resolve(false)}
                 />
               ));
               if (confirmed) yield* archive(h.id);
             }),
         },
       ];

       return { getById, archive, menuActions };
     }),
   );
   ```

4. **Merge, in `apps/web`** (`MainLayer`, section 3) - and this is what makes
   cross-domain triggering work: a widget living in a _different_ domain
   (e.g. `domains/members`, showing a linked Host) imports only the tag from
   `shared/entities`, never `domains/hosts`:

   ```ts
   // domains/members/src/SomeWidget.ts - foreign domain, no import of domains/hosts
   import { HostActions } from "@repo/shared-entities/host";

   Effect.gen(function* () {
     const hosts = yield* HostActions;
     const host = yield* hosts.getById(member.hostId);
     return hosts.menuActions(host); // renders via shared/shell's generic ActionMenu
   });
   ```

Same shape works whether the actions are shown in a generic per-page menu or
triggered from a completely unrelated domain's widget - both just `yield*`
the tag from `shared/entities`, and only `apps/web` ever knows both concrete
`Layer`s.

## 3. `apps/web` bootstrap composition

```
apps/web/src/
  runtime/
    MainLayer.ts    # Layer.mergeAll(ShellUI.layer, ...domain layers)
    runtime.ts      # export const runtime = Atom.runtime(MainLayer)
  main.tsx          # wrap RouterProvider in RegistryProvider
  routes/__root.tsx # mount <ShellHost/> alongside <Outlet/>
```

```ts
// apps/web/src/runtime/MainLayer.ts (illustrative)
import { ShellUI } from "@repo/shared-shell";
// import real domain layers here as they're built, e.g.:
// import { HostsLive } from "@repo/domain-hosts"

export const MainLayer = Layer.mergeAll(
  ShellUI.layer,
  // HostsLive, MembersLive, ...
);

export const runtime = Atom.runtime(MainLayer);
```

The key property is on the Requirements (`R`) channel only. Per the actual
`RuntimeFactory` signature
(`externals/effect/packages/effect/src/unstable/reactivity/Atom.ts:700-715`),
`Atom.runtime` accepts `Layer.Layer<R, E, AtomRegistry | Reactivity.Reactivity>`

- `R` must reduce to exactly `AtomRegistry | Reactivity.Reactivity`, the two
  services `Atom.runtime` supplies internally via its own global `Reactivity.layer`
  merge (`Atom.ts:726-762`), not `never`. If any merged domain `Layer` still
  needs some other service nobody provided, `R` retains that leftover
  requirement and `Atom.runtime(MainLayer)` fails to typecheck exactly at that
  line - a compile-time "you forgot to wire a dependency" signal, at the single
  composition point, before the app ever runs.

`E` is not required to be `never`, and does **not** need `Layer.catchAll`
before merging: it simply flows into the `AsyncResult<A, E>` failure state of
every atom built from that runtime (see `AtomRuntime`'s `atom`/`fn`/etc.
signatures in the same file), to be handled wherever that atom is consumed in
React (or left as-is to surface as a rendered error state). Composing a
`Layer` that can fail is not itself a type error.

## 4. React consumption via `@effect/atom-react`

- `useAtomValue(state, ...)` inside `<ShellHost/>` (`state` from
  `useShellRuntime()`) - reactive subscription to the overlay stack; each
  entry's `node` was already produced by `render(...)` inside `open`, so
  `<ShellHost/>` just renders it.
- `useAtomSet(runtime.fn(...))` for a component-triggered domain action.
- Domain-triggered `shell.openModal(...)`/`openSidebar(...)` calls need no
  React hook at all - plain `Effect` code (via `Effect.callback`), rendered by
  whichever `entry.node` `<ShellHost/>` renders for that stack entry.

## 5. Known gaps intentionally out of scope for this doc

- `apps/web/src/lib/auth.ts` stays as plain `oidc-client-ts` async code for
  now - not wrapped into `domains/auth` in this pass. `AGENTS.md` already
  mandates that eventually ("business logic should talk to an `AuthService`
  `Layer`, never to the identity provider's SDK directly"); tracked as
  follow-up work, not resolved here.
- No real domains exist yet - `domains/hosts`/`domains/members` above are
  illustrative sketches (real entity names from `CONTEXT.md`'s glossary, but
  no such package exists), meant to be replaced by whatever
  `docs/implement-domain-model.md` actually builds.

## References

- `AGENTS.md` - the layer rules this design follows.
- `apps/server/src/JwtVerifier.ts`, `apps/server/src/Auth.ts`,
  `apps/server/src/main.ts` - the existing Effect v4 idiom this mirrors.
- `docs/roadmap.md` - what's reset/done/next at the repo level.
- `docs/implement-domain-model.md` - the (unstarted) real domain model this
  doc's toy examples stand in for.
