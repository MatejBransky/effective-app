import { Layer } from "effect";
import { ModalService, SidebarService } from "@repo/shared-shell";

// Real domain layers get merged in here as they're built, e.g.
// Layer.mergeAll(SidebarService.layer, ModalService.layer, HostsLive, MembersLive, ...).
export const MainLayer = Layer.mergeAll(SidebarService.layer, ModalService.layer);
