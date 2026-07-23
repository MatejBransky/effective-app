import { Context, Layer } from "effect";
import { makeOverlayStack, type OverlayStackService } from "./OverlayStack.ts";

/**
 * Docked sidebar stack, openable from anywhere - a React component (`useSidebar()`) or a
 * domain's business logic (`yield* SidebarService`) - via a Promise-like `open` built on
 * `Effect.callback`. See docs/web-bootstrap-architecture.md section 1.
 */
export class SidebarService extends Context.Service<SidebarService, OverlayStackService>()(
  "shared-shell/SidebarService",
  { make: makeOverlayStack },
) {
  static readonly layer: Layer.Layer<SidebarService> = Layer.effect(this, this.make);
}
