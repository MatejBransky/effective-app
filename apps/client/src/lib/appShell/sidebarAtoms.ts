import { registry } from "@repo/shared-lib";
import { Atom } from "effect/unstable/reactivity";

/** Whether the app-shell sidebar is open - toggled by the Mod+B keybinding registered in
 * `Sidebar.tsx`, or by clicking its own toggle button. Same pattern as `syncAtoms.ts`. */
export const sidebarOpenAtom: Atom.Writable<boolean> = Atom.make(true);

export const toggleSidebar = (): void => {
  registry.update(sidebarOpenAtom, (open) => !open);
};
