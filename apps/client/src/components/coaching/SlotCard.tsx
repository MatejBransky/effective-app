import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, useState } from "react";
import type { ProgramDate, SlotView } from "@repo/entities";
import { Match } from "effect";
import { m } from "../../paraglide/messages.js";
import { localeAtom } from "../../lib/coaching/atoms.ts";
import * as api from "../../lib/coaching/api.ts";

const HEARTBEAT_SECONDS = 5;

const slotLabel = (slot: SlotView["slot"]): string =>
  Match.value(slot).pipe(
    Match.when("focus", () => m.slot_focus()),
    Match.when("recharge1", () => m.slot_recharge1()),
    Match.when("recharge2", () => m.slot_recharge2()),
    Match.exhaustive,
  );

const statusLabel = (status: SlotView["status"]): string =>
  Match.value(status).pipe(
    Match.when("locked", () => m.status_locked()),
    Match.when("unlocked", () => m.status_unlocked()),
    Match.when("listened", () => m.status_listened()),
    Match.when("missed", () => m.status_missed()),
    Match.exhaustive,
  );

const wallTime = (epochMilliseconds: number): string =>
  new Date(epochMilliseconds).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * One slot card: locked state, audio player with verified-listening tracking,
 * and submit. Listening proof mirrors the server rule (`playedRatio >= 90%`
 * plus `reachedEnd`): only really-played seconds accumulate (seek jumps never
 * count), heartbeats go to the server on an interval plus on pause/ended, and
 * the server re-validates on submit - the button state here is UX only, never
 * authority.
 */
export function SlotCard(props: {
  readonly slot: SlotView;
  readonly programDate: ProgramDate;
  readonly onSubmitted: () => void;
  readonly interactive?: boolean;
}) {
  const { slot, programDate, onSubmitted, interactive = true } = props;
  // Re-renders on locale switch so paraglide strings update.
  useAtomValue(localeAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressRef = useRef({ played: 0, duration: 0, reached: false });
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!interactive || !slot.audioKey || slot.status === "locked") return;
    let cancelled = false;
    let url: string | null = null;
    void api
      .fetchAudioObjectUrl(slot.audioKey, programDate)
      .then((created) => {
        if (cancelled) URL.revokeObjectURL(created);
        else {
          url = created;
          setObjectUrl(created);
        }
      })
      .catch(() => {
        if (!cancelled) setError("audio");
      });

    return () => {
      cancelled = true;

      if (url) URL.revokeObjectURL(url);
    };
  }, [interactive, slot.audioKey, slot.status, programDate]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const audio = audioRef.current;

      if (!audio || audio.paused || audio.ended) return;
      const current = progressRef.current;
      void api
        .postProgress({
          programDate,
          slot: slot.slot,
          playedSeconds: current.played,
          durationSeconds: current.duration,
          reachedEnd: current.reached,
        })
        .catch(() => {
          // Heartbeats are best-effort - submit re-validates server-side.
        });
    }, HEARTBEAT_SECONDS * 1000);

    return () => window.clearInterval(id);
  }, [programDate, slot.slot]);

  if (slot.status === "locked") {
    return (
      <section>
        <h3>{slotLabel(slot.slot)}</h3>
        <p>
          {m.status_locked()} ·{" "}
          {slot.unlockedAt
            ? m.day_lockedUntil({ time: wallTime(slot.unlockedAt.epochMilliseconds) })
            : ""}
        </p>
      </section>
    );
  }

  const syncProgress = (played: number, duration: number, reached: boolean): void => {
    progressRef.current = { played, duration, reached };
    setPlayedSeconds(played);
    setDurationSeconds(duration);
    setReachedEnd(reached);
  };

  const report = (reached: boolean): void => {
    const current = progressRef.current;
    void api
      .postProgress({
        programDate,
        slot: slot.slot,
        playedSeconds: current.played,
        durationSeconds: current.duration,
        reachedEnd: reached,
      })
      .catch(() => {
        // Best-effort, see above.
      });
  };

  const proofMet = reachedEnd && durationSeconds > 0 && playedSeconds / durationSeconds >= 0.9;

  const handleSubmit = (): void => {
    setSubmitting(true);
    setError(null);
    const current = progressRef.current;
    // Flush the final proof first and await it: firing submit concurrently
    // with the `ended` heartbeat races fetch ordering and can make the
    // server read a stale heartbeat (ProofNotMet on a fully-played slot).
    void api
      .postProgress({
        programDate,
        slot: slot.slot,
        playedSeconds: current.played,
        durationSeconds: current.duration,
        reachedEnd: true,
      })
      .then(() => api.postSubmit(programDate, slot.slot))
      .then(() => onSubmitted())
      .catch((cause: unknown) =>
        setError(cause instanceof api.ApiError ? (api.apiErrorTag(cause) ?? "submit") : "submit"),
      )
      .finally(() => setSubmitting(false));
  };

  // Coach view: status only, no playback or submit.
  if (!interactive) {
    return (
      <section>
        <h3>
          {slotLabel(slot.slot)} · {statusLabel(slot.status)}
        </h3>
      </section>
    );
  }

  return (
    <section>
      <h3>
        {slotLabel(slot.slot)} · {statusLabel(slot.status)}
      </h3>
      {!slot.audioKey || !objectUrl ? (
        <p>{m.day_noAudio()}</p>
      ) : (
        <audio
          ref={audioRef}
          controls
          src={objectUrl}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration || 0;
            syncProgress(progressRef.current.played, duration, progressRef.current.reached);
          }}
          onPlay={(event) => {
            lastTimeRef.current = event.currentTarget.currentTime;
          }}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;

            // Forward-seek jumps never count: accumulate only while playing
            // linearly (not seeking).
            const played = audio.seeking
              ? progressRef.current.played
              : progressRef.current.played + Math.max(0, audio.currentTime - lastTimeRef.current);

            lastTimeRef.current = audio.currentTime;
            syncProgress(played, progressRef.current.duration, progressRef.current.reached);
          }}
          onSeeking={(event) => {
            lastTimeRef.current = event.currentTarget.currentTime;
          }}
          onPause={() => report(false)}
          onEnded={() => {
            syncProgress(progressRef.current.played, progressRef.current.duration, true);
            report(true);
          }}
        />
      )}
      {slot.status === "listened" ? (
        <p>{m.day_submitted()}</p>
      ) : proofMet ? (
        <button type="button" onClick={handleSubmit} disabled={submitting}>
          {m.day_submit()}
        </button>
      ) : (
        <p>{m.day_listenFirst()}</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
