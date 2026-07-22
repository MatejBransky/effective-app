import { Effect } from "effect";
import { ShellUI, type ShellUIOpenRender } from "@repo/shared-shell";
import { runtime } from "./runtime.ts";

// Bridges ShellUI's SubscriptionRef into an atom for <ShellHost/> - built here (not in
// @repo/shared-shell) since only this app owns the composed runtime/MainLayer.
export const shellStateAtom = runtime.subscriptionRef(Effect.map(ShellUI, (shell) => shell.state));

// Dispatch side for useShellUI(shellOpenSidebarAtom) - runs against the same runtime-built
// ShellUI singleton <ShellHost/> subscribes to above.
export const shellOpenSidebarAtom = runtime.fn((render: ShellUIOpenRender) =>
  Effect.gen(function* () {
    const shell = yield* ShellUI;
    return yield* shell.openSidebar(render);
  }),
);
