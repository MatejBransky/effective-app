import { Effect } from "effect";
import { ShellUI, type ShellUIOpenInput } from "@repo/shared-shell";
import { runtime } from "./runtime.ts";

// Bridges ShellUI's SubscriptionRef into an atom for <ShellHost/> - built here (not in
// @repo/shared-shell) since only this app owns the composed runtime/MainLayer.
export const shellStateAtom = runtime.subscriptionRef(Effect.map(ShellUI, (shell) => shell.state));

// Dispatch side for useShellUI() - runs against the same runtime-built ShellUI singleton
// <ShellHost/> subscribes to above.
export const shellOpenAtom = runtime.fn((input: ShellUIOpenInput) =>
  Effect.gen(function* () {
    const shell = yield* ShellUI;
    return yield* shell.open(input.render, { kind: input.kind });
  }),
);
