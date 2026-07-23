import { Effect, SubscriptionRef } from "effect";
import type * as React from "react";

export interface OverlayEntry {
  readonly id: number;
  readonly key: string | undefined;
  readonly label: string;
  readonly node: React.ReactNode;
  // Lets close()/closeAll() dismiss an entry from *outside* its own render (e.g. a Navbar
  // button), not just via a callback the entry's own JSX chose to wire up. Resolving
  // externally with `undefined` is the "went away, no specific outcome" case - callers
  // that need a specific outcome (Cancel vs Confirm) should still resolve via the
  // entry's own JSX.
  readonly resolve: (value: unknown) => void;
}

/**
 * Browser-history-shaped: `entries` never loses an entry just because you navigated away
 * from it (`back()`/`forward()` only move `cursor`), only `close()`/opening a genuinely
 * new entry actually removes one.
 */
export interface OverlayHistory {
  readonly entries: ReadonlyArray<OverlayEntry>;
  readonly cursor: number; // -1 when entries is empty
}

// Type-erased on purpose: SidebarService/ModalService's dispatch atoms share one
// render/resolve shape regardless of which concrete `A` a given open() call resolves.
export type OverlayOpenRender = (resolve: (value: unknown) => void) => React.ReactNode;

export interface OverlayOpenOptions {
  // Shown by back()/forward() consumers (e.g. Navbar's "Back (Menu)" button) - purely
  // descriptive, never used to identify or look up an entry.
  readonly label?: string;
  // Identifies which logical view this is (e.g. "menu", "details"). When it matches the
  // entry currently at the cursor, this open() replaces that entry in place instead of
  // pushing a new history entry - re-opening the view you're already looking at (a Navbar
  // button clicked twice in a row, say) doesn't create a duplicate back/forward stop.
  // Omit for one-off overlays (most modals) where there's no notion of "the same view".
  readonly key?: string;
  // Discards the *entire* history (not just anything ahead of the cursor) before adding
  // this entry, so closing it reveals nothing rather than whatever it superseded. Use for
  // "this action's dialog replaces whatever was open, permanently" - the default (false)
  // is "temporary, stacks on top, returns to what was showing before" (a help dialog
  // opened from within a confirm dialog, say).
  readonly replace?: boolean;
}

export interface OverlayStackService {
  readonly history: SubscriptionRef.SubscriptionRef<OverlayHistory>;
  readonly open: <A>(
    render: (resolve: (value: A) => void) => React.ReactNode,
    options?: OverlayOpenOptions,
  ) => Effect.Effect<A>;
  // Closes a specific entry (by id) or, more commonly, whichever is at the cursor - the
  // same "went away, no specific outcome" resolve as an entry's own dismiss button.
  readonly close: (id?: number) => Effect.Effect<void>;
  // Closes every entry, clearing the whole history - not just the one at the cursor.
  readonly closeAll: () => Effect.Effect<void>;
  // Moves the cursor without closing anything - the entry moved away from stays alive
  // (still pending its own resolve), reachable again via forward().
  readonly back: () => Effect.Effect<void>;
  readonly forward: () => Effect.Effect<void>;
}

/**
 * Shared implementation behind both SidebarService and ModalService - a browser-history-
 * shaped stack of Promise-like `open` calls built on `Effect.callback`, backed by one
 * SubscriptionRef. Each service built from this gets its own independent history (this
 * Effect description runs fresh per Layer build, so SidebarService and ModalService never
 * share state even though they share this code) - only the *rendering* differs (docked
 * panel vs backdrop overlay), which is why they're separate services/tags rather than a
 * `kind` field on one shared history (that was an earlier, more ambiguous design).
 *
 * Only the entry at the cursor is ever rendered (see SidebarHost/ModalHost). Opening a new
 * entry discards anything ahead of the cursor (a genuinely new navigation, same as a
 * browser tab discarding forward history) and appends after it - unless `replace` is set,
 * which discards the *whole* history first instead. Re-opening the same `key` as the entry
 * already at the cursor replaces it in place rather than pushing another entry.
 */
export const makeOverlayStack: Effect.Effect<OverlayStackService> = Effect.gen(function* () {
  const history = yield* SubscriptionRef.make<OverlayHistory>({ entries: [], cursor: -1 });
  let nextId = 0;

  const removeById = (id: number): Effect.Effect<void> =>
    SubscriptionRef.update(history, ({ entries, cursor }) => {
      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) return { entries, cursor };
      const nextEntries = entries.filter((entry) => entry.id !== id);
      const nextCursor =
        index < cursor
          ? cursor - 1
          : index === cursor
            ? Math.min(cursor, nextEntries.length - 1)
            : cursor;
      return { entries: nextEntries, cursor: nextCursor };
    });

  const open = <A>(
    render: (resolve: (value: A) => void) => React.ReactNode,
    options?: OverlayOpenOptions,
  ): Effect.Effect<A> =>
    Effect.callback<A>((resume) => {
      const id = nextId++;
      const remove = () => Effect.runSync(removeById(id));

      const resolve = (value: A) => {
        remove();
        resume(Effect.succeed(value));
      };

      const node = render(resolve);
      const entry: OverlayEntry = {
        id,
        key: options?.key,
        label: options?.label ?? `Overlay ${id}`,
        node,
        resolve: resolve as (value: unknown) => void,
      };

      const current = Effect.runSync(SubscriptionRef.get(history));
      const activeEntry = current.entries[current.cursor];
      const reopeningActiveView = options?.key !== undefined && activeEntry?.key === options.key;

      if (reopeningActiveView) {
        // Same logical view as what's already showing - replace it in place instead of
        // pushing a duplicate back/forward stop.
        const nextEntries = current.entries.slice();
        nextEntries[current.cursor] = entry;
        Effect.runSync(
          SubscriptionRef.set(history, { entries: nextEntries, cursor: current.cursor }),
        );
        activeEntry.resolve(undefined);
      } else {
        const survivors = options?.replace ? [] : current.entries.slice(0, current.cursor + 1);
        const superseded = options?.replace
          ? current.entries
          : current.entries.slice(current.cursor + 1);
        const nextEntries = [...survivors, entry];
        Effect.runSync(
          SubscriptionRef.set(history, { entries: nextEntries, cursor: nextEntries.length - 1 }),
        );
        // Already excluded from the state set above, so each of these resolve() calls'
        // own removeById() runs against an id that's no longer present - a harmless no-op.
        superseded.forEach((supersededEntry) => supersededEntry.resolve(undefined));
      }

      return Effect.sync(remove);
    });

  const close = (id?: number): Effect.Effect<void> =>
    Effect.gen(function* () {
      const { entries, cursor } = yield* SubscriptionRef.get(history);
      const target = id === undefined ? entries[cursor] : entries.find((entry) => entry.id === id);
      target?.resolve(undefined);
    });

  const closeAll = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      const { entries } = yield* SubscriptionRef.get(history);
      entries.forEach((entry) => entry.resolve(undefined));
    });

  const back = (): Effect.Effect<void> =>
    SubscriptionRef.update(history, (state) =>
      state.cursor > 0 ? { ...state, cursor: state.cursor - 1 } : state,
    );

  const forward = (): Effect.Effect<void> =>
    SubscriptionRef.update(history, (state) =>
      state.cursor < state.entries.length - 1 ? { ...state, cursor: state.cursor + 1 } : state,
    );

  return { history, open, close, closeAll, back, forward };
});
