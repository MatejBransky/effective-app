import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * effect v4 ("effect smol", the beta this repo tracks - see pnpm-workspace.yaml) ships its
 * own Atom reactivity primitives natively as `effect/unstable/reactivity` - the same design
 * tim-smart previously shipped as the standalone `@effect-atom/atom`/`@effect-atom/atom-react`
 * packages for effect v3, folded into effect core for v4 (confirmed via
 * github.com/tim-smart/effect-atom issue #413, tim-smart's own reply: "In v4 Atom is part of
 * the library `import { Atom } from 'effect/unstable/reactivity'`").
 *
 * The published `@effect-atom/atom-react` still requires `effect: ^3.19` as a peer (checked
 * directly against the vendored copy in `externals/effect-atom/packages/atom-react/package.json`
 * - still true as of that subtree's current HEAD, not just an old assumption) - installing it
 * would pull a second, incompatible major version of `effect` into this workspace. So these
 * hooks are a from-scratch port of `externals/effect-atom/packages/atom-react/src/Hooks.ts`'s
 * design against our own `effect/unstable/reactivity` registry, rather than a second dependency
 * tree - the same "analyze the vendored source before writing this kind of code" approach
 * `AGENTS.md` already asks for with `externals/effect`/`externals/alchemy-effect`.
 *
 * Deliberately not ported: `useAtomSuspense` (this app doesn't use Suspense), `useAtomRef`/
 * `useAtomRefProp`/`useAtomRefPropValue` (nothing here uses `AtomRef`), `useAtomInitialValues`
 * (no SSR/preloading need), and `RegistryContext` (a `useContext`-provided registry supporting
 * multiple registries per subtree - this app only ever needs the one global registry below, so
 * a Context provider would be machinery with no current use). Add any of these later by
 * revisiting that source, not by guessing.
 *
 * Lives here (not in apps/client) so every layer above `shared` - entities, features,
 * widgets, and apps/client itself - shares one registry instance. A registry per package
 * would mean Atoms set in one package are invisible to `useAtomValue` calls in another.
 */
export const registry: AtomRegistry.AtomRegistry = AtomRegistry.make();

interface AtomStore<A> {
  readonly subscribe: (onStoreChange: () => void) => () => void;
  readonly snapshot: () => A;
  readonly getServerSnapshot: () => A;
}

/** One store per atom, cached for the registry's lifetime (this app never has more than one
 * registry) - `useSyncExternalStore` needs a referentially-stable `subscribe`/`getSnapshot`
 * pair, and caching per atom (not per call site) means every component reading the same atom
 * shares one subscription setup rather than each mounting its own. */
const stores = new WeakMap<Atom.Atom<unknown>, AtomStore<unknown>>();

const getStore = <A>(atom: Atom.Atom<A>): AtomStore<A> => {
  const existing = stores.get(atom) as AtomStore<A> | undefined;
  if (existing) return existing;
  const store: AtomStore<A> = {
    subscribe: (onStoreChange) => registry.subscribe(atom, onStoreChange),
    snapshot: () => registry.get(atom),
    getServerSnapshot: () => Atom.getServerValue(atom, registry),
  };
  stores.set(atom, store);
  return store;
};

const useStore = <A>(atom: Atom.Atom<A>): A => {
  const store = getStore(atom);
  return useSyncExternalStore(store.subscribe, store.snapshot, store.getServerSnapshot);
};

/** Subscribes a component to an Atom's current value, re-rendering on change. The optional
 * `map` transforms the value (via `Atom.map`, so the derived atom is itself cached/shared,
 * not recomputed ad hoc per render). */
export const useAtomValue: {
  <A>(atom: Atom.Atom<A>): A;
  <A, B>(atom: Atom.Atom<A>, map: (value: A) => B): B;
} = (
  // Implementation signature deliberately widened to `unknown` - the ternary below produces
  // `Atom<A> | Atom<B>`, which the public overload's stricter per-branch types can't unify
  // against a single generic call. Callers only ever see the overloads above, never this.
  atom: Atom.Atom<unknown>,
  map?: (value: unknown) => unknown,
): unknown => {
  const mapped = useMemo(() => (map ? Atom.map(atom, map) : atom), [atom, map]);
  return useStore(mapped);
};

/** Keeps an atom mounted (subscribed, so the registry never schedules its node for removal -
 * see `ModalManager.ts`/`Keybindings.ts` for what happens without this or `Atom.keepAlive`)
 * for as long as the calling component stays mounted, without reading its value. */
export const useAtomMount = <A>(atom: Atom.Atom<A>): void => {
  useEffect(() => registry.mount(atom), [atom]);
};

/** Returns a stable setter for a writable Atom - accepts either a value directly or an
 * updater function reading the atom's current value, and mounts the atom for as long as the
 * calling component is mounted (matching `useAtomMount`, since something has to hold a
 * writable atom alive if nothing else reads it via `useAtomValue`). */
export const useAtomSet = <R, W>(
  atom: Atom.Writable<R, W>,
): ((value: W | ((current: R) => W)) => void) => {
  useAtomMount(atom);
  return useCallback(
    (value: W | ((current: R) => W)) =>
      registry.set(
        atom,
        typeof value === "function" ? (value as (current: R) => W)(registry.get(atom)) : value,
      ),
    [atom],
  );
};

/** `[value, setter]`, the same shape as `useState` - convenience for the common case of
 * reading and writing the same atom in one component. */
export const useAtom = <R, W>(
  atom: Atom.Writable<R, W>,
): readonly [R, (value: W | ((current: R) => W)) => void] => [useStore(atom), useAtomSet(atom)];

/** Returns a stable callback that recomputes a derived atom from scratch, discarding any
 * cached value - mounts the atom the same way `useAtomSet` does. */
export const useAtomRefresh = <A>(atom: Atom.Atom<A>): (() => void) => {
  useAtomMount(atom);
  return useCallback(() => registry.refresh(atom), [atom]);
};

/** Runs `f` as a side effect whenever `atom` changes, without subscribing the calling
 * component to re-render on that change itself (unlike `useAtomValue`). */
export const useAtomSubscribe = <A>(
  atom: Atom.Atom<A>,
  f: (value: A) => void,
  options?: { readonly immediate?: boolean },
): void => {
  // Destructured to a primitive so the effect can depend on it honestly (exhaustive-deps
  // clean) without re-subscribing every render just because a caller passed a fresh `options`
  // object literal - the same "don't depend on the whole object" reasoning as `syncAtoms.ts`'s
  // `syncErrorAtom` depending on an error *message*, not the `Error` instance.
  const immediate = options?.immediate;
  useEffect(() => registry.subscribe(atom, f, { immediate }), [atom, f, immediate]);
};
