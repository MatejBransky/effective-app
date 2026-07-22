import { Context, Effect, Layer, SubscriptionRef } from "effect";
import type * as React from "react";

export type OverlayKind = "modal" | "sidebar";

export interface OverlayEntry {
  readonly id: number;
  readonly kind: OverlayKind;
  readonly node: React.ReactNode;
}

/**
 * Global overlay stack (modals/sidebars), openable from anywhere - a React component or a
 * domain's business logic - via a single Promise-like `open` built on `Effect.callback`.
 * See docs/web-bootstrap-architecture.md section 1.
 */
export class ShellUI extends Context.Service<
  ShellUI,
  {
    readonly state: SubscriptionRef.SubscriptionRef<ReadonlyArray<OverlayEntry>>;
    readonly open: <A>(
      render: (resolve: (value: A) => void) => React.ReactNode,
      options?: { readonly kind?: OverlayKind },
    ) => Effect.Effect<A>;
  }
>()("shared-shell/ShellUI") {}

const make = Effect.gen(function* () {
  const state = yield* SubscriptionRef.make<ReadonlyArray<OverlayEntry>>([]);
  let nextId = 0;

  const open = <A>(
    render: (resolve: (value: A) => void) => React.ReactNode,
    options?: { readonly kind?: OverlayKind },
  ): Effect.Effect<A> =>
    Effect.callback<A>((resume) => {
      const id = nextId++;
      // Shared by the caller-triggered resolve and Effect.callback's own interrupt
      // cleanup, so a cancelled caller (e.g. a route navigation away) never leaves a
      // stale entry on the stack - resolve already having run it makes this a no-op.
      const remove = () =>
        Effect.runSync(
          SubscriptionRef.update(state, (entries) => entries.filter((entry) => entry.id !== id)),
        );

      const node = render((value) => {
        remove();
        resume(Effect.succeed(value));
      });

      Effect.runSync(
        SubscriptionRef.update(state, (entries) => [
          ...entries,
          { id, kind: options?.kind ?? "sidebar", node },
        ]),
      );

      return Effect.sync(remove);
    });

  return { state, open };
});

export const ShellUILive: Layer.Layer<ShellUI> = Layer.effect(ShellUI, make);
