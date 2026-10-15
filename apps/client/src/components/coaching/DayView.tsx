import { useAtomValue } from "@effect/atom-react";
import type { DayView as DayViewData } from "@repo/entities";
import { m } from "../../paraglide/messages.js";
import { localeAtom } from "../../lib/coaching/atoms.ts";
import { SlotCard } from "./SlotCard.tsx";

/** One program day: the three slot cards stacked under a time header. */
export function DayView(props: {
  readonly view: DayViewData;
  readonly onSubmitted: () => void;
  readonly interactive?: boolean;
}) {
  const { view, onSubmitted, interactive = true } = props;
  useAtomValue(localeAtom);

  return (
    <div>
      <p>
        {view.programDate} · {view.focusTime} / {view.recharge1Time} / {view.recharge2Time}
      </p>
      {view.slots.map((slot) => (
        <SlotCard
          key={slot.slot}
          slot={slot}
          programDate={view.programDate}
          onSubmitted={onSubmitted}
          interactive={interactive}
        />
      ))}
    </div>
  );
}

/** Locale-reactive day title. */
export function DayTitle(props: { readonly isToday: boolean; readonly date: string }) {
  useAtomValue(localeAtom);

  return <h2>{props.isToday ? m.day_today() : props.date}</h2>;
}
