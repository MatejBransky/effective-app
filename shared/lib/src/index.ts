import { Context, Layer } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";

/**
 * The one app-wide registry instance. React hooks (`useAtomValue`, `useAtomSet`, ...) come
 * directly from `@effect/atom-react` - Effect-TS's own official React bindings for
 * `effect/unstable/reactivity`'s Atom/AtomRegistry, a real package published under the
 * `@effect` scope (`packages/atom/react` in the effect monorepo itself, confirmed directly
 * against `externals/effect/packages/atom/react/package.json`), pinned to the exact same
 * `4.0.0-beta.98` line as `effect` (its own `peerDependencies.effect` matches exactly - checked
 * via `npm view @effect/atom-react@4.0.0-beta.98 peerDependencies`) - not the older, standalone
 * `@effect-atom/atom-react` (still pins `effect@^3.19`, incompatible here).
 *
 * This concrete value only exists for `apps/client/src/main.tsx`'s `RegistryContext.Provider`
 * wiring and to build `AtomRegistryServiceLive`/`runtime` below - nothing else should import
 * it directly. Non-hook code (`ModalManager.ts`'s `openModal`/`closeModal`, `Keybindings.ts`'s
 * `registerKeybinding`, `apps/client`'s `sidebarAtoms.ts`/`syncAtoms.ts`) declares its need
 * as an ordinary `AtomRegistryService` Effect requirement instead, so the exact same
 * functions can run against a different, isolated registry in a test - no module mocking.
 */
export const registry: AtomRegistry.AtomRegistry = AtomRegistry.make();

/** DI tag for the app-wide `AtomRegistry` - see `registry`'s comment above for why this
 * exists instead of every consumer importing that constant directly. */
export class AtomRegistryService extends Context.Service<
  AtomRegistryService,
  AtomRegistry.AtomRegistry
>()("effective-app/AtomRegistryService") {}

/** Wires `AtomRegistryService` to this app's one real registry - the only place this repo
 * does that; everywhere else only ever requires the tag. */
export const AtomRegistryServiceLive: Layer.Layer<AtomRegistryService> = Layer.succeed(
  AtomRegistryService,
  registry,
);

/**
 * `AtomRegistryServiceLive` turned into an `Atom` (`effect/unstable/reactivity`'s own
 * `Atom.runtime`, not a hand-rolled React Context) - the bridge non-hook Effect code needs
 * to actually *run* (`openModal`, `registerKeybinding`, an action's `execute`). Being an
 * Atom, it's reached through the exact same `AtomRegistry`/`RegistryContext` every other
 * atom here already uses (`main.tsx`'s single `RegistryContext.Provider value={registry}`)
 * - no second Context needed. Read it via `useAtomValue(runtime, AsyncResult.getOrThrow)` in
 * a component, or `AsyncResult.getOrThrow(registry.get(runtime))` imperatively (e.g.
 * `main.tsx`'s bootstrap, before the first render). Test isolation doesn't need a separate
 * `Atom.context({...})` factory either - `runtime.layer` is itself an Atom, overridable per
 * registry via `Atom.initialValue(runtime.layer, testLayer)` in a `RegistryProvider`, the
 * same pattern `externals/effect/packages/atom/react/test/index.test.tsx`'s own "can inject
 * test layers" test uses.
 */
export const runtime: Atom.AtomRuntime<AtomRegistryService> = Atom.runtime(AtomRegistryServiceLive);
