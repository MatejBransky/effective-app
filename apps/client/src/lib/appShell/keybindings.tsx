import { openModal, type Keybinding, type ModalHandle } from "@repo/shared-app-shell";
import { registry, runtime } from "@repo/shared-lib";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { toggleSidebar } from "./sidebarAtoms.ts";

/** `restorePrevious` marks the help dialog itself as a temporary, unintrusive overlay:
 * opening it never destroys whatever was open before it - that modal is suspended and
 * comes back automatically once this help dialog closes. Exported (not just used inline in
 * `appKeybindings` below) so `Sidebar.tsx`'s own "Keyboard shortcuts" button opens the exact
 * same dialog the Mod+/ keybinding does. */
export const openShortcutsHelp = (): ModalHandle =>
  Effect.runSync(
    Effect.provide(
      openModal((handle) => <ShortcutsHelp handle={handle} />, { restorePrevious: true }),
      AsyncResult.getOrThrow(registry.get(runtime)),
    ),
  );

/**
 * The app's global keyboard shortcuts - registered once at bootstrap (`main.tsx`), not
 * per-component, so they exist independent of whether `Sidebar.tsx` (or anything else) has
 * mounted. `Sidebar.tsx`'s own buttons trigger the exact same handlers, just from a click
 * instead of a keypress.
 */
export const appKeybindings: ReadonlyArray<Keybinding> = [
  {
    keys: "mod+b",
    handler: () =>
      Effect.runSync(Effect.provide(toggleSidebar, AsyncResult.getOrThrow(registry.get(runtime)))),
  },
  { keys: "mod+/", handler: () => openShortcutsHelp() },
];

const ShortcutsHelp = ({ handle }: { readonly handle: ModalHandle }) => (
  <div>
    <h2>Keyboard shortcuts</h2>
    <ul>
      <li>
        <kbd>⌘/Ctrl + B</kbd> - toggle sidebar
      </li>
      <li>
        <kbd>⌘/Ctrl + /</kbd> - this help
      </li>
    </ul>
    <button type="button" onClick={handle.close}>
      Close
    </button>
  </div>
);
