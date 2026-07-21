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
      <button type="button" onClick={openLockedDemo}>
        Locked dialog demo
      </button>
      <button type="button" onClick={openPlainDemo}>
        Plain dialog demo
      </button>
    </aside>
  );
};

/** `restorePrevious` marks the help dialog itself as a temporary, unintrusive overlay: opening
 * it never destroys whatever was open before it (a plain dialog, the reset-name confirm, ...) -
 * that modal is suspended and comes back automatically once this help dialog closes. */
const openShortcutsHelp = () =>
  openModal((handle) => <ShortcutsHelp handle={handle} />, { restorePrevious: true });

/** Demo of `openModal`'s `locked` option: while this is open, no other `openModal` call -
 * including the ⌘/Ctrl+/ shortcuts help - can replace or cover it. */
const openLockedDemo = () =>
  openModal(
    (handle) => (
      <div>
        <h2>Locked dialog</h2>
        <p>
          Opened with <code>{"{ locked: true }"}</code>. Try <kbd>⌘/Ctrl + /</kbd> - the shortcuts
          help won&apos;t appear until you close this dialog first.
        </p>
        <button type="button" onClick={handle.close}>
          Close
        </button>
      </div>
    ),
    { locked: true },
  );

/** Demo of the *other* side of `restorePrevious`: this dialog is opened with no special
 * options at all - it doesn't need to know anything about what might replace it. Press
 * ⌘/Ctrl + / to open the shortcuts help on top of it, then close the help dialog - this one
 * reappears instead of being lost, purely because the help dialog opted into
 * `restorePrevious`. */
const openPlainDemo = () =>
  openModal((handle) => (
    <div>
      <h2>Plain dialog</h2>
      <p>
        Opened with no options. Press <kbd>⌘/Ctrl + /</kbd> to open the shortcuts help on top of it,
        then close the help dialog - this one reappears instead of being lost.
      </p>
      <button type="button" onClick={handle.close}>
        Close
      </button>
    </div>
  ));

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
