import { DateTime, Option } from "effect";

import type { ClientProfile, ProgramDate, ProgressReport, SlotStatus } from "./Coaching.ts";

export interface Unlocks {
  readonly focus: DateTime.Utc;
  readonly recharge1: DateTime.Utc;
  readonly recharge2: DateTime.Utc;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Strict `YYYY-MM-DD` parse - `None` on any malformed or nonexistent calendar date. */
const parseDateParts = (programDate: string): Option.Option<DateParts> => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(programDate);

  if (!match) return Option.none();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return Option.none();
  }

  return Option.some({ year, month, day });
};

const toUtc = (zoned: DateTime.Zoned): DateTime.Utc =>
  Option.getOrThrow(DateTime.make(zoned.epochMilliseconds));

/**
 * Unlock instants for one program day. The focus wall-clock time is interpreted
 * in the client's zone (`adjustForTimeZone`), so DST gaps/overlaps resolve via
 * `Intl` (`compatible` disambiguation) instead of custom logic. Recharges are
 * absolute elapsed time (+2h/+4h), so on a DST-transition day their wall-clock
 * display shifts while the real interval stays exact.
 *
 * `None` on an invalid program date, unresolvable wall time, or unknown zone.
 */
export const computeUnlocks = (
  profile: Pick<ClientProfile, "focusHour" | "focusMinute" | "timeZone">,
  programDate: ProgramDate,
): Option.Option<Unlocks> => {
  if (profile.focusHour < 0 || profile.focusHour > 23) return Option.none();

  if (profile.focusMinute < 0 || profile.focusMinute > 59) return Option.none();

  return Option.flatMap(parseDateParts(programDate), (parts) =>
    Option.map(
      DateTime.makeZoned(
        {
          year: parts.year,
          month: parts.month,
          day: parts.day,
          hour: profile.focusHour,
          minute: profile.focusMinute,
        },
        { timeZone: profile.timeZone, adjustForTimeZone: true },
      ),
      (focus) => ({
        focus: toUtc(focus),
        recharge1: toUtc(DateTime.add(focus, { hours: 2 })),
        recharge2: toUtc(DateTime.add(focus, { hours: 4 })),
      }),
    ),
  );
};

/** Program date (`YYYY-MM-DD`) of an instant in the given zone. */
export const programDateOf = (
  now: DateTime.DateTime,
  timeZone: string,
): Option.Option<ProgramDate> =>
  Option.map(DateTime.makeZoned(now, { timeZone }), (zoned) => {
    const parts = DateTime.toParts(zoned);

    // SAFETY: parts come from Effect's own DateTime.toParts of a valid instant, so
    // year/month/day are real calendar components and the zero-padded template is necessarily
    // a valid YYYY-MM-DD string; the ProgramDate brand adds no runtime check.
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` as ProgramDate;
  });

/** Wall-clock `HH:MM` of an instant in the given zone (settings preview). */
export const formatWallTime = (utc: DateTime.Utc, timeZone: string): Option.Option<string> =>
  Option.map(DateTime.makeZoned(utc, { timeZone }), (zoned) => {
    const parts = DateTime.toParts(zoned);

    return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  });

/** Read-model status of one slot. String comparison is safe for `YYYY-MM-DD`. */
export const slotStatus = (options: {
  readonly unlockAt: DateTime.Utc;
  readonly listenedAt: DateTime.Utc | null;
  readonly programDate: ProgramDate;
  readonly today: ProgramDate;
  readonly now: DateTime.Utc;
}): SlotStatus => {
  if (options.listenedAt !== null) return "listened";

  if (options.programDate < options.today) return "missed";

  return options.unlockAt.epochMilliseconds <= options.now.epochMilliseconds
    ? "unlocked"
    : "locked";
};

/**
 * Listening-proof rule (see glossary): the player must report reaching the end
 * with at least 90% of the duration actually played. Forward-seek never counts
 * because only really-played seconds accumulate client-side.
 */
export const meetsListeningProof = (report: ProgressReport): boolean =>
  report.reachedEnd &&
  report.durationSeconds > 0 &&
  report.playedSeconds / report.durationSeconds >= 0.9;
