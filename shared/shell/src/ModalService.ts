import { Context, Layer } from "effect";
import { makeOverlayStack, type OverlayStackService } from "./OverlayStack.ts";

/**
 * Modal/dialog stack, openable from anywhere, resolving to whatever value the caller's
 * `render` passes to `resolve` - a boolean for a confirm dialog, a union of string
 * literals for a multi-choice prompt, or a richer object. See
 * docs/web-bootstrap-architecture.md section 1.
 */
export class ModalService extends Context.Service<ModalService, OverlayStackService>()(
  "shared-shell/ModalService",
  { make: makeOverlayStack },
) {
  static readonly layer: Layer.Layer<ModalService> = Layer.effect(this, this.make);
}
