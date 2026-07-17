import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { useCallback, useSyncExternalStore } from "react";

/**
 * effect v4 ("effect smol", the beta this repo tracks - see pnpm-workspace.yaml) ships its
 * own Atom reactivity primitives natively as `effect/unstable/reactivity` - the same design
 * tim-smart previously shipped as the standalone `@effect-atom/atom`/`@effect-atom/atom-react`
 * packages for effect v3, folded into effect core for v4 (confirmed via
 * github.com/tim-smart/effect-atom issue #413, tim-smart's own reply: "In v4 Atom is part of
 * the library `import { Atom } from 'effect/unstable/reactivity'`"). The published
 * `@effect-atom/atom-react` still requires `effect: ^3.19` as a peer, which would pull a
 * second, incompatible major version of `effect` into this client - so these are minimal
 * hand-rolled React bindings over the registry that already ships in our pinned `effect`,
 * rather than a second dependency tree.
 */
export const registry: AtomRegistry.AtomRegistry = AtomRegistry.make();

/** Subscribes a component to an Atom's current value, re-rendering on change. */
export const useAtomValue = <A>(atom: Atom.Atom<A>): A => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(atom, onStoreChange),
    [atom],
  );
  const getSnapshot = useCallback(() => registry.get(atom), [atom]);
  return useSyncExternalStore(subscribe, getSnapshot);
};

/** Returns a stable setter function for a writable Atom. */
export const useAtomSet = <R, W>(atom: Atom.Writable<R, W>): ((value: W) => void) =>
  useCallback((value: W) => registry.set(atom, value), [atom]);
