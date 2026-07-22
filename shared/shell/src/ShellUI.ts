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
 * domain's business logic - via a Promise-like `openSidebar` built on `Effect.callback`.
 * See docs/web-bootstrap-architecture.md section 1.
 *
 * One explicit method per overlay kind (`openSidebar` now, `openModal` once Iteration 3
 * needs it) rather than a single `open(render, { kind? })` - an optional `kind` with a
 * silent default reads ambiguously at the call site.
 */
export class ShellUI extends Context.Service<
  ShellUI,
  {
    readonly state: SubscriptionRef.SubscriptionRef<ReadonlyArray<OverlayEntry>>;
    readonly openSidebar: <A>(
      render: (resolve: (value: A) => void) => React.ReactNode,
    ) => Effect.Effect<A>;
  }
>()("shared-shell/ShellUI", {
  make: Effect.gen(function* () {
    const state = yield* SubscriptionRef.make<ReadonlyArray<OverlayEntry>>([]);
    let nextId = 0;

    const open = <A>(
      kind: OverlayKind,
      render: (resolve: (value: A) => void) => React.ReactNode,
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
          SubscriptionRef.update(state, (entries) => [...entries, { id, kind, node }]),
        );

        return Effect.sync(remove);
      });

    const openSidebar = <A>(
      render: (resolve: (value: A) => void) => React.ReactNode,
    ): Effect.Effect<A> => open("sidebar", render);

    return { state, openSidebar };
  }),
}) {
  static readonly layer: Layer.Layer<ShellUI> = Layer.effect(this, this.make);
}
