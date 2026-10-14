import { useAtomSet, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useState } from "react";
import { DayTitle, DayView } from "../components/coaching/DayView.tsx";
import { dayAtom, localeAtom, todayAtom } from "../lib/coaching/atoms.ts";
import * as api from "../lib/coaching/api.ts";
import { applyLocale } from "../lib/coaching/locale.ts";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/_authenticated/coaching/")({
  beforeLoad: async () => {
    const me = await api.getMe().catch(() => null);

    if (!me) throw redirect({ to: "/" });

    if (me.role !== "client") throw redirect({ to: "/coach" });

    return { me };
  },
  component: CoachingDayPage,
});

function CoachingDayPage() {
  const { me } = Route.useRouteContext();
  const todayState = useAtomValue(todayAtom);

  if (me.role !== "client") return <p>{m.day_noAudio()}</p>;

  return (
    <>
      <nav>
        <Link to="/coaching">{m.nav_day()}</Link> ·{" "}
        <Link to="/coaching/settings">{m.nav_settings()}</Link>
      </nav>
      {AsyncResult.builder(todayState)
        .onInitial(() => <p>Loading…</p>)
        .onFailure((cause) => <p role="alert">Failed to load: {String(cause)}</p>)
        .onSuccess((today) => (
          <DayViewer initialDate={today.programDate} profileLocale={me.profile?.locale ?? "en"} />
        ))
        .render()}
    </>
  );
}

function DayViewer(props: { readonly initialDate: string; readonly profileLocale: "cs" | "en" }) {
  const [selected, setSelected] = useState<string | null>(null);
  // Subscribed for re-render on locale switch; setter syncs profile locale.
  useAtomValue(localeAtom);
  const setLocaleState = useAtomSet(localeAtom);
  const date = selected ?? props.initialDate;
  const viewState = useAtomValue(dayAtom(date));
  const refreshDay = useAtomRefresh(dayAtom(date));
  const refreshToday = useAtomRefresh(todayAtom);

  useEffect(() => {
    setLocaleState(props.profileLocale);
    applyLocale(props.profileLocale);
  }, [props.profileLocale, setLocaleState]);
  useEffect(() => {
    refreshDay();
  }, [date, refreshDay]);

  const refresh = (): void => {
    refreshDay();
    refreshToday();
  };

  return (
    <>
      <DayTitle isToday={selected === null} date={date} />
      <p>
        <label>
          {m.day_selectDate()}:{" "}
          <input
            type="date"
            value={date}
            max={props.initialDate}
            onChange={(event) => setSelected(event.currentTarget.value || null)}
          />
        </label>{" "}
        {selected !== null && (
          <button type="button" onClick={() => setSelected(null)}>
            {m.day_today()}
          </button>
        )}
      </p>
      {AsyncResult.builder(viewState)
        .onInitial(() => <p>Loading…</p>)
        .onFailure((cause) => <p role="alert">Failed to load: {String(cause)}</p>)
        .onSuccess((view) => <DayView view={view} onSubmitted={refresh} />)
        .render()}
    </>
  );
}
