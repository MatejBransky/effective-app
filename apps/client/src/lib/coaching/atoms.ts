import { Effect } from "effect";
import { Atom } from "effect/reactivity";
import * as api from "./api";

/**
 * Coaching slice state - one query atom per server read, refreshed
 * imperatively after mutations (`useAtomRefresh` at the call site) rather than
 * by invalidation wiring: the slice is three screens, explicit refresh keeps
 * the data flow visible.
 */
export const todayAtom = Atom.make(Effect.promise(() => api.getToday()));

export const dayAtom = Atom.family((date: string) =>
  Atom.make(Effect.promise(() => api.getDay(date))),
);

export const coachClientsAtom = Atom.make(Effect.promise(() => api.getCoachClients()));

export const coachDayAtom = Atom.family((key: string) => {
  const separator = key.indexOf("|");
  const userId = key.slice(0, separator);
  const date = key.slice(separator + 1);

  return Atom.make(Effect.promise(() => api.getCoachClientDay(userId, date)));
});

/** UI locale (`cs`/`en`) - mirrors the profile locale once it resolves. */
export const localeAtom: Atom.Writable<"cs" | "en"> = Atom.make<"cs" | "en">("en");
