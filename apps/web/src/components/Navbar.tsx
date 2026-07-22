import { useShellUI } from "@repo/shared-shell";
import { shellOpenAtom } from "../runtime/shellAtoms.ts";

// Menu button + sidebar content are a minimal proof that ShellUI/ShellHost/useShellUI
// round-trip end to end (SubscriptionRef push, Effect.callback resume, resolve-closes-entry) -
// not a real feature. Iteration 3 replaces this with a concrete confirm dialog example.
export function Navbar() {
  const open = useShellUI(shellOpenAtom);

  return (
    <nav className="navbar">
      <span className="navbar-brand">Effective</span>
      <button
        type="button"
        onClick={() => {
          void open<void>((resolve) => (
            <div className="shell-sidebar">
              <button type="button" onClick={() => resolve()}>
                Close
              </button>
            </div>
          ));
        }}
      >
        Menu
      </button>
    </nav>
  );
}
