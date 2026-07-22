import { Layer } from "effect";
import { ShellUI } from "@repo/shared-shell";

// Real domain layers get merged in here as they're built, e.g.
// Layer.mergeAll(ShellUI.layer, HostsLive, MembersLive, ...).
export const MainLayer = Layer.mergeAll(ShellUI.layer);
