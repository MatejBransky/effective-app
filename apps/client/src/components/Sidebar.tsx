import { openModal, registerKeybinding, type ModalHandle } from "@repo/shared-app-shell";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { sidebarOpenAtom, toggleSidebar } from "../lib/appShell/sidebarAtoms.ts";

/**
 * A concrete demo of every `@repo/shared-app-shell` capability in one place, not
 * three disconnected examples: open/closed state lives in an Atom (`sidebarOpenAtom`, same
 * pattern as `syncAtoms.ts`), toggled by a registered keybinding (Mod+B) as well as a plain
 * button, and a second keybinding (Mod+/) opens a modal via `openModal`.
 */
export const Sidebar = () => {
  const open = useAtomValue(sidebarOpenAtom);

  useEffect(() => {
    const unregisterToggle = registerKeybinding({ keys: "mod+b", handler: toggleSidebar });
    const unregisterHelp = registerKeybinding({ keys: "mod+/", handler: openShortcutsHelp });
    return () => {
      unregisterToggle();
      unregisterHelp();
    };
  }, []);

  if (!open) {
    return (
      <button type="button" onClick={toggleSidebar} aria-label="Open sidebar">
        ☰
      </button>
    );
  }

  return (
    <aside>
      <button type="button" onClick={toggleSidebar}>
        Close sidebar (⌘/Ctrl+B)
      </button>
      <nav>
        <Link to="/">Home</Link> <Link to="/about">About</Link>
      </nav>
      <button type="button" onClick={openShortcutsHelp}>
        Keyboard shortcuts (⌘/Ctrl+/)
      </button>
    </aside>
  );
};

const openShortcutsHelp = () => openModal((handle) => <ShortcutsHelp handle={handle} />);

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
