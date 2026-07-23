import { Effect, SubscriptionRef } from "effect";
import type * as React from "react";

export interface OverlayEntry {
  readonly id: number;
  readonly node: React.ReactNode;
}

// Type-erased on purpose: SidebarService/ModalService's dispatch atoms share one
// render/resolve shape regardless of which concrete `A` a given open() call resolves.
export type OverlayOpenRender = (resolve: (value: unknown) => void) => React.ReactNode;

export interface OverlayStackService {
  readonly stack: SubscriptionRef.SubscriptionRef<ReadonlyArray<OverlayEntry>>;
  readonly open: <A>(render: (resolve: (value: A) => void) => React.ReactNode) => Effect.Effect<A>;
}

/**
 * Shared implementation behind both SidebarService and ModalService - a stack of
 * Promise-like `open` calls built on `Effect.callback`, backed by one SubscriptionRef.
 * Each service built from this gets its own independent stack (this Effect description
 * runs fresh per Layer build, so SidebarService and ModalService never share state even
 * though they share this code) - only the *rendering* differs (docked panel vs backdrop
 * overlay), which is why they're separate services/tags rather than a `kind` field on
 * one shared stack (that was the earlier, more ambiguous design).
 */
export const makeOverlayStack: Effect.Effect<OverlayStackService> = Effect.gen(function* () {
  const stack = yield* SubscriptionRef.make<ReadonlyArray<OverlayEntry>>([]);
  let nextId = 0;

  const open = <A>(render: (resolve: (value: A) => void) => React.ReactNode): Effect.Effect<A> =>
    Effect.callback<A>((resume) => {
      const id = nextId++;
      // Shared by the caller-triggered resolve and Effect.callback's own interrupt
      // cleanup, so a cancelled caller (e.g. a route navigation away) never leaves a
      // stale entry on the stack - resolve already having run it makes this a no-op.
      const remove = () =>
        Effect.runSync(
          SubscriptionRef.update(stack, (entries) => entries.filter((entry) => entry.id !== id)),
        );

      const node = render((value) => {
        remove();
        resume(Effect.succeed(value));
      });

      Effect.runSync(SubscriptionRef.update(stack, (entries) => [...entries, { id, node }]));

      return Effect.sync(remove);
    });

  return { stack, open };
});
