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
starting with modal/sidebar overlay management. Package `@repo/shared-shell`.

This is a normal package: it holds **both** the Effect service and whatever
React it needs to render itself (`<ShellHost/>`, the base `<Overlay/>`
wrapper, hooks). There's no rule forcing React out of this package, or out of
`domains/*` either - a layer holds whatever belongs to it. The actual
principle this architecture is built around is narrower: **business logic
(decisions, orchestration, state) gets modeled in Effect, independent of
React; React supplies specific rendered actions on top of it** (a dialog's
buttons, a sidebar's contents) - not "no React in shared/domains packages."

Since there's no cross-domain isolation concern here (nothing needs to depend
on a description without depending on the implementation - see the reasoning
in section 2), this follows the same shape `apps/server`'s `JwtVerifier.ts`
already uses: tag _and_ its `Layer` defined together in one file, standard
Effect-TS service style, no artificial split.

```
shared/shell/
  package.json          # @repo/shared-shell
  src/
    ShellUI.ts           # Context.Service tag + its Layer, together (mirrors JwtVerifier.ts)
    ShellHost.tsx         # React component rendering the overlay stack
    useShellUI.ts         # hook for components
```

Core service shape (illustrative) - a single `open` method that mirrors the
legacy Promise-based `openModal((resolve) => jsx)` pattern, built on
`Effect.async` instead of `new Promise(...)`:

```ts
// shared/shell/src/ShellUI.ts
export class ShellUI extends Context.Service<
  ShellUI,
  {
    readonly state: SubscriptionRef.SubscriptionRef<ReadonlyArray<OverlayEntry>>;
    readonly open: <A>(
      render: (resolve: (value: A) => void) => React.ReactNode,
      options?: { readonly kind?: "modal" | "sidebar" },
    ) => Effect.Effect<A>;
    readonly close: (id: OverlayId) => Effect.Effect<void>;
  }
>()("shared-shell/ShellUI") {}
```

One capability, usable identically from a React component or from inside a
domain's business logic - domain code is explicitly allowed to construct JSX
here. The only rule is that the overlay _stack state_ itself lives in
`ShellUI`, not in a React component:

```ts
// from a component: open a sidebar with arbitrary JSX
const openSidebar = useShellUI()
openSidebar((resolve) => <MySidebarContent onDone={() => resolve(undefined)} />)
```

```tsx
// from domain business logic: confirm before proceeding
Effect.gen(function* () {
  const confirmed = yield* shell.open<boolean>((resolve) => (
    <ConfirmDialog
      title="Archive item?"
      onConfirm={() => resolve(true)}
      onCancel={() => resolve(false)}
    />
  ));
  if (!confirmed) return;
});
```

Implementation sketch (same `ShellUI.ts`, the exported `layer`/`ShellUILive`):
`open` is built with `Effect.async` - Effect's equivalent of `new
Promise((resolve) => ...)` - which hands the caller a `resume` callback.
`open` pushes `{ id, kind, render }` onto a single
`SubscriptionRef<OverlayEntry[]>` stack (the source of truth), and its
`render` function is called with a `resolve` that both `resume`s the `Effect`
and removes the entry from the stack. `Effect.async`'s cleanup callback
removes the entry too, so an interrupted/cancelled caller (e.g. a route
navigation away) doesn't leave a stale overlay behind - something the raw
Promise-based legacy version couldn't express as cleanly.

React side (`ShellHost.tsx`) - mounted once near the app root, no renderer
registry needed since the JSX is already inline in each entry:

```tsx
export function ShellHost() {
  const entries = useAtomValue(shellStateAtom); // Atom.subscriptionRef bridging ShellUI.state
  return (
    <>
      {entries.map((entry) => (
        <Overlay kind={entry.kind} key={entry.id}>
          {entry.render(entry.resolve)}
        </Overlay>
      ))}
    </>
  );
}
```

`shared/shell/src/useShellUI.ts` - thin hook pairing `runtime.fn`-style
dispatch with the same `open(render, opts)` call signature, so components and
domain code share one mental model.

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
               const confirmed = yield* shell.open<boolean>((resolve) => (
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
    MainLayer.ts    # Layer.mergeAll(ShellUILive, ...domain layers)
    runtime.ts      # export const runtime = Atom.runtime(MainLayer)
  main.tsx          # wrap RouterProvider in RegistryProvider
  routes/__root.tsx # mount <ShellHost/> alongside <Outlet/>
```

```ts
// apps/web/src/runtime/MainLayer.ts (illustrative)
import { ShellUILive } from "@repo/shared-shell";
// import real domain layers here as they're built, e.g.:
// import { HostsLive } from "@repo/domain-hosts"

export const MainLayer = Layer.mergeAll(
  ShellUILive,
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

- `useAtomValue(shellStateAtom)` inside `<ShellHost/>` - reactive
  subscription to the overlay stack; each entry already carries its own
  JSX-producing `render` function, so `<ShellHost/>` just calls it.
- `useAtomSet(runtime.fn(...))` for a component-triggered domain action.
- Domain-triggered `shell.open(...)` calls need no React hook at all - plain
  `Effect` code (via `Effect.async`), rendered by whichever
  `entry.render(entry.resolve)` call `<ShellHost/>` makes for that stack
  entry.

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
