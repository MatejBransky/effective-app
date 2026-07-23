import { Effect, SubscriptionRef } from "effect";
import type * as React from "react";

export interface OverlayEntry {
  readonly id: number;
  readonly node: React.ReactNode;
  // Lets `close()` dismiss an entry from *outside* its own render (e.g. a Navbar button),
  // not just via a callback the entry's own JSX chose to wire up. Resolving externally
  // with `undefined` is the "went away, no specific outcome" case - callers that need a
  // specific outcome (Cancel vs Confirm) should still resolve via the entry's own JSX.
  readonly resolve: (value: unknown) => void;
}

// Type-erased on purpose: SidebarService/ModalService's dispatch atoms share one
// render/resolve shape regardless of which concrete `A` a given open() call resolves.
export type OverlayOpenRender = (resolve: (value: unknown) => void) => React.ReactNode;

export interface OverlayStackService {
  readonly stack: SubscriptionRef.SubscriptionRef<ReadonlyArray<OverlayEntry>>;
  readonly open: <A>(render: (resolve: (value: A) => void) => React.ReactNode) => Effect.Effect<A>;
  // Closes a specific entry (by id) or, more commonly, whichever is currently on top -
  // the same "went away, no specific outcome" resolve as an entry's own dismiss button.
  readonly close: (id?: number) => Effect.Effect<void>;
}

/**
 * Shared implementation behind both SidebarService and ModalService - a stack of
 * Promise-like `open` calls built on `Effect.callback`, backed by one SubscriptionRef.
 * Each service built from this gets its own independent stack (this Effect description
 * runs fresh per Layer build, so SidebarService and ModalService never share state even
 * though they share this code) - only the *rendering* differs (docked panel vs backdrop
 * overlay), which is why they're separate services/tags rather than a `kind` field on
 * one shared stack (that was the earlier, more ambiguous design).
 *
 * Only the top-of-stack entry is ever rendered (see SidebarHost/ModalHost) - opening a
 * second entry while one is already open doesn't close the first, it just becomes the new
 * top. Closing the second one reveals the first again, unprompted - this is what gives a
 * "temporary" overlay (a help dialog opened on top of a form, say) its "return to what was
 * showing before" behavior, for free, with no separate "replace" concept needed.
 */
export const makeOverlayStack: Effect.Effect<OverlayStackService> = Effect.gen(function* () {
  const stack = yield* SubscriptionRef.make<ReadonlyArray<OverlayEntry>>([]);
  let nextId = 0;

  const open = <A>(render: (resolve: (value: A) => void) => React.ReactNode): Effect.Effect<A> =>
    Effect.callback<A>((resume) => {
      const id = nextId++;
      // Shared by the caller-triggered resolve, `close()`, and Effect.callback's own
      // interrupt cleanup, so a cancelled caller (e.g. a route navigation away) never
      // leaves a stale entry on the stack - each already having run it makes the others
      // no-ops.
      const remove = () =>
        Effect.runSync(
          SubscriptionRef.update(stack, (entries) => entries.filter((entry) => entry.id !== id)),
        );

      const resolve = (value: A) => {
        remove();
        resume(Effect.succeed(value));
      };

      const node = render(resolve);

      Effect.runSync(
        SubscriptionRef.update(stack, (entries) => [
          ...entries,
          { id, node, resolve: resolve as (value: unknown) => void },
        ]),
      );

      return Effect.sync(remove);
    });

  const close = (id?: number): Effect.Effect<void> =>
    Effect.gen(function* () {
      const entries = yield* SubscriptionRef.get(stack);
      const target =
        id === undefined ? entries[entries.length - 1] : entries.find((entry) => entry.id === id);
      target?.resolve(undefined);
    });

  return { stack, open, close };
});
