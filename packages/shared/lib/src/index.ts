import { AtomRegistry } from "effect/unstable/reactivity";

/**
 * The one app-wide registry. Hooks (`useAtomValue`, `useAtomSet`, ...) come directly from
 * `@effect/atom-react` - Effect-TS's own official React bindings for
 * `effect/unstable/reactivity`'s Atom/AtomRegistry, a real package published under the
 * `@effect` scope (`packages/atom/react` in the effect monorepo itself, confirmed directly
 * against `externals/effect/packages/atom/react/package.json`), pinned to the exact same
 * `4.0.0-beta.98` line as `effect` (its own `peerDependencies.effect` matches exactly - checked
 * via `npm view @effect/atom-react@4.0.0-beta.98 peerDependencies`) - not the older, standalone
 * `@effect-atom/atom-react` (still pins `effect@^3.19`, incompatible here).
 *
 * `registry` still lives here, not re-exported from `@effect/atom-react`, because plenty of
 * this app's Atom access is *not* through a hook: `ModalManager.ts`'s `openModal`/`closeModal`,
 * `Keybindings.ts`'s `registerKeybinding`, `syncAtoms.ts`'s `retry` - all plain functions called
 * from event handlers or effect callbacks, not component bodies, so they can't go through React
 * Context (`@effect/atom-react`'s `RegistryContext`, provided this same `registry` at
 * `apps/client/src/main.tsx`'s root) at all and need the instance directly.
 */
export const registry: AtomRegistry.AtomRegistry = AtomRegistry.make();
