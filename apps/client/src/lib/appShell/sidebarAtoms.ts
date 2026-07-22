import { AtomRegistryService } from "@repo/shared-lib";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

/** Whether the app-shell sidebar is open - toggled by the Mod+B keybinding registered in
 * `Sidebar.tsx`, or by clicking its own toggle button. Same pattern as `syncAtoms.ts`. */
export const sidebarOpenAtom: Atom.Writable<boolean> = Atom.make(true);

/** Requires `AtomRegistryService` (an ordinary Effect dependency, see `@repo/shared-lib`)
 * instead of importing a registry constant directly - `Sidebar.tsx` runs it against
 * `@repo/shared-lib`'s `runtime` atom. */
export const toggleSidebar: Effect.Effect<void, never, AtomRegistryService> = Effect.gen(
  function* () {
    const registry = yield* AtomRegistryService;
    registry.update(sidebarOpenAtom, (open) => !open);
  },
);
