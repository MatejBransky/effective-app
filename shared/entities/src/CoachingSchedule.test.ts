import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";

import type { ProgramDate, ProgressReport } from "./Coaching.ts";
import {
  computeUnlocks,
  formatWallTime,
  meetsListeningProof,
  programDateOf,
  slotStatus,
} from "./CoachingSchedule.ts";

const profile = {
  focusHour: 6,
  focusMinute: 0,
  timeZone: "Europe/Prague",
} as const;

// SAFETY: ProgramDate is a brand-only schema (no format check - Coaching.ts leaves format to
// the schedule boundary), so the runtime value is the plain string; every fixture literal is
// validated downstream by parseDateParts, and the invalid-date test relies on that downstream
// rejection rather than on this helper.
const date = (s: string): ProgramDate => s as ProgramDate;

const utc = (millis: number): DateTime.Utc => Option.getOrThrow(DateTime.make(millis));

describe("computeUnlocks", () => {
  it("derives focus/+2h/+4h instants in the client zone", () => {
    // 2026-10-14, Prague = UTC+2 -> 06:00 wall = 04:00Z
    const unlocks = Option.getOrThrow(computeUnlocks(profile, date("2026-10-14")));
    expect(unlocks.focus.epochMilliseconds).toBe(Date.UTC(2026, 9, 14, 4, 0));
    expect(unlocks.recharge1.epochMilliseconds).toBe(Date.UTC(2026, 9, 14, 6, 0));
    expect(unlocks.recharge2.epochMilliseconds).toBe(Date.UTC(2026, 9, 14, 8, 0));
  });

  it("keeps absolute intervals across the autumn DST transition", () => {
    // 2026-10-25: clocks fall back 03:00 -> 02:00 (CEST -> CET).
    // 02:30 resolves to the earlier occurrence (00:30Z); +4h absolute = 04:30Z,
    // which displays as 05:30 wall, not 06:30.
    const unlocks = Option.getOrThrow(
      computeUnlocks({ ...profile, focusMinute: 30, focusHour: 2 }, date("2026-10-25")),
    );

    expect(unlocks.focus.epochMilliseconds).toBe(Date.UTC(2026, 9, 25, 0, 30));
    expect(unlocks.recharge2.epochMilliseconds).toBe(Date.UTC(2026, 9, 25, 4, 30));
    expect(Option.getOrThrow(formatWallTime(unlocks.recharge2, "Europe/Prague"))).toBe("05:30");
  });

  it("resolves a nonexistent spring-forward wall time instead of failing", () => {
    // 2026-03-29: 02:00 -> 03:00, so 02:30 never happens - `compatible`
    // disambiguation still yields an instant.
    const unlocks = computeUnlocks(
      { ...profile, focusMinute: 30, focusHour: 2 },
      date("2026-03-29"),
    );

    expect(Option.isSome(unlocks)).toBe(true);
  });

  it("rejects invalid dates and unknown zones", () => {
    expect(computeUnlocks(profile, date("2026-02-30"))).toEqual(Option.none());
    expect(computeUnlocks(profile, date("not-a-date"))).toEqual(Option.none());
    expect(computeUnlocks({ ...profile, timeZone: "Mars/Olympus" }, date("2026-10-14"))).toEqual(
      Option.none(),
    );
  });
});

describe("programDateOf", () => {
  it("follows the client zone, not UTC", () => {
    // 23:30Z Oct 13 is already Oct 14 in Prague.
    expect(
      Option.getOrThrow(programDateOf(utc(Date.UTC(2026, 9, 13, 23, 30)), "Europe/Prague")),
    ).toBe("2026-10-14");
    expect(Option.getOrThrow(programDateOf(utc(Date.UTC(2026, 9, 13, 23, 30)), "UTC"))).toBe(
      "2026-10-13",
    );
  });
});

describe("slotStatus", () => {
  const unlockAt = utc(Date.UTC(2026, 9, 14, 4, 0));

  const base = {
    unlockAt,
    listenedAt: null,
    programDate: date("2026-10-14"),
    today: date("2026-10-14"),
  } as const;

  it("locks before the unlock instant, unlocks after", () => {
    expect(slotStatus({ ...base, now: utc(Date.UTC(2026, 9, 14, 3, 59)) })).toBe("locked");
    expect(slotStatus({ ...base, now: utc(Date.UTC(2026, 9, 14, 4, 0)) })).toBe("unlocked");
  });

  it("marks listened and past-day misses", () => {
    expect(
      slotStatus({ ...base, listenedAt: utc(Date.UTC(2026, 9, 14, 5, 0)), now: unlockAt }),
    ).toBe("listened");
    expect(
      slotStatus({
        ...base,
        programDate: date("2026-10-13"),
        now: utc(Date.UTC(2026, 9, 14, 12, 0)),
      }),
    ).toBe("missed");
  });
});

describe("meetsListeningProof", () => {
  const base: ProgressReport = {
    programDate: date("2026-10-14"),
    slot: "focus",
    playedSeconds: 90,
    durationSeconds: 100,
    reachedEnd: true,
  };

  it("accepts exactly 90% with reached end", () => {
    expect(meetsListeningProof(base)).toBe(true);
  });
  it("rejects skips, missing end, and empty audio", () => {
    expect(meetsListeningProof({ ...base, playedSeconds: 89 })).toBe(false);
    expect(meetsListeningProof({ ...base, reachedEnd: false })).toBe(false);
    expect(meetsListeningProof({ ...base, durationSeconds: 0, playedSeconds: 0 })).toBe(false);
  });
});
