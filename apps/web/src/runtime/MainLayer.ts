import { Layer } from "effect";
import { ShellUILive } from "@repo/shared-shell";

// Real domain layers get merged in here as they're built, e.g.
// Layer.mergeAll(ShellUILive, HostsLive, MembersLive, ...).
export const MainLayer = Layer.mergeAll(ShellUILive);
