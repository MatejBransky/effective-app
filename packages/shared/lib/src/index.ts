import { AtomRegistry } from "effect/unstable/reactivity";

/**
 * `@effect/atom-react` is Effect-TS's own official React bindings for
 * `effect/unstable/reactivity`'s Atom/AtomRegistry - a real package published under the
 * `@effect` scope (`packages/atom/react` in the effect monorepo itself, confirmed directly
 * against `externals/effect/packages/atom/react/package.json`), pinned to the exact same
 * `4.0.0-beta.98` line as `effect` (its own `peerDependencies.effect` matches exactly - checked
 * via `npm view @effect/atom-react@4.0.0-beta.98 peerDependencies`). This replaces both the
 * original hand-rolled 2-hook stopgap and the later from-scratch port of the *older*,
 * standalone `@effect-atom/atom-react` (still pins `effect@^3.19`, incompatible here) - once
 * the real, version-matched package existed there was nothing left to hand-write.
 */
export * from "@effect/atom-react";

/**
 * The one app-wide registry, provided via `RegistryContext.Provider` (re-exported above) at
 * the app root so React hooks (`useAtomValue`, `useAtomSet`, ...) read/write it. Exported here
 * too because plenty of this app's Atom access is *not* through a hook: `ModalManager.ts`'s
 * `openModal`/`closeModal`, `Keybindings.ts`'s `registerKeybinding`, `syncAtoms.ts`'s `retry` -
 * all plain functions called from event handlers or effect callbacks, not component bodies, so
 * they can't go through React Context at all and need the same registry instance directly.
 */
export const registry: AtomRegistry.AtomRegistry = AtomRegistry.make();
