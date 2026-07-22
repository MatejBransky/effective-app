import { AtomRegistryService, runtime } from "@repo/shared-lib";
import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useCallback, useState } from "react";

export interface ActionDefinition<Ctx, E = never> {
  readonly id: string;
  readonly label: string | ((ctx: Ctx) => string);
  /** `false`/`undefined` = enabled; `true` or a string (shown as the disabled reason) =
   * disabled. Depends on `ctx` (e.g. a specific member's current status), not global state. */
  readonly isDisabled?: (ctx: Ctx) => boolean | string;
  /**
   * Full control over what happens when triggered - a confirmation dialog, a fetch/PowerSync
   * write, several sequential steps, whatever the action needs - expressed as a normal Effect
   * program (`yield* confirm(...)`, `yield* Effect.tryPromise(...)`, branching on the result).
   * Nothing here is orchestrated by the registry on the action's behalf; this is simply what
   * runs, in whatever order it composes itself. Requires `AtomRegistryService` (an ordinary
   * Effect dependency, see `@repo/shared-lib`) since most actions reach for `confirm`/
   * `openModal` somewhere in their flow; `useActionTrigger` below supplies it.
   */
  readonly execute: (ctx: Ctx) => Effect.Effect<void, E, AtomRegistryService>;
}

/** Identity function - exists for type inference (`E` is easier to infer at the call site
 * than annotated by hand), the same shape as e.g. `Schema.Struct`. */
export const defineAction = <Ctx, E = never>(
  definition: ActionDefinition<Ctx, E>,
): ActionDefinition<Ctx, E> => definition;

/** Resolves `label`'s `string | ((ctx) => string)` union - every consumer rendering a label
 * needs this same resolution, so it lives here once rather than repeated at each call site. */
export const resolveActionLabel = <Ctx>(
  action: Pick<ActionDefinition<Ctx, never>, "label">,
  ctx: Ctx,
): string => (typeof action.label === "function" ? action.label(ctx) : action.label);

export interface ActionTrigger<Ctx, E> {
  readonly trigger: (ctx: Ctx) => void;
  readonly pending: boolean;
  readonly error: E | undefined;
}

/**
 * Runs an action's `execute` against `@repo/shared-lib`'s `runtime` atom, tracking
 * `pending`/`error` locally to the component that calls this hook - two components
 * triggering the same `ActionDefinition` for different `ctx` (e.g. two different members)
 * get independent pending states, not one shared state keyed by action id.
 */
export const useActionTrigger = <Ctx, E>(
  action: ActionDefinition<Ctx, E>,
): ActionTrigger<Ctx, E> => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<E | undefined>(undefined);
  const context = useAtomValue(runtime, AsyncResult.getOrThrow);

  const trigger = useCallback(
    (ctx: Ctx) => {
      setPending(true);
      setError(undefined);
      const effect = Effect.provide(action.execute(ctx), context);
      void Effect.runPromise(
        Effect.match(effect, { onFailure: (e) => e, onSuccess: () => undefined }),
      ).then((maybeError: E | undefined) => {
        setPending(false);
        setError(maybeError);
      });
    },
    [action, context],
  );

  return { trigger, pending, error };
};
