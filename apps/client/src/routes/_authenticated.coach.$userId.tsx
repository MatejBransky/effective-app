import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useEffect } from "react";
import { DayTitle, DayView } from "../components/coaching/DayView.tsx";
import { coachDayAtom, localeAtom } from "../lib/coaching/atoms.ts";
import * as api from "../lib/coaching/api.ts";
import { m } from "../paraglide/messages.js";

// `?date=` is an optional `YYYY-MM-DD` string; anything else means "no date".
const CoachClientSearch = Schema.Struct({ date: Schema.optional(Schema.String) });

export const Route = createFileRoute("/_authenticated/coach/$userId")({
  validateSearch: (search) => {
    const decoded = Option.getOrNull(Schema.decodeUnknownOption(CoachClientSearch)(search));

    return { date: decoded?.date ?? null };
  },
  beforeLoad: async () => {
    const me = await api.getMe().catch(() => null);

    if (!me || (me.role !== "coach" && me.role !== "admin")) throw redirect({ to: "/coaching" });

    return { me };
  },
  component: CoachClientPage,
});

function CoachClientPage() {
  const { userId } = Route.useParams();
  const { date } = Route.useSearch();
  const key = `${userId}|${date ?? ""}`;
  const viewState = useAtomValue(coachDayAtom(key));
  const refresh = useAtomRefresh(coachDayAtom(key));
  useAtomValue(localeAtom);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <nav>
        <Link to="/coach">{m.nav_coach()}</Link>
      </nav>
      {date === null ? (
        <p role="alert">Missing date</p>
      ) : (
        <>
          <DayTitle isToday={false} date={date} />
          {AsyncResult.builder(viewState)
            .onInitial(() => <p>Loading…</p>)
            .onFailure((cause) => <p role="alert">Failed to load: {String(cause)}</p>)
            .onSuccess((view) => <DayView view={view} onSubmitted={refresh} interactive={false} />)
            .render()}
        </>
      )}
    </>
  );
}
