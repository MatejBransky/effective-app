# Life Coaching Example – Glossary

Canonical terms for the life-coaching example app. Use these exact words in
conversation, docs, schemas, and code identifiers. Do not invent synonyms.

## Slots and program

- **Program day** (`programDate`, ISO calendar date) – one coaching day in the
  client's time zone. New content unlocks per program day, never per server day.
- **Slot** – one unlockable audio unit within a program day. Exactly three
  slots per day.
- **Daily Focus** (`focus`) – the first slot of the day. Unlocks at the
  client's focus time.
- **Recharge #1** (`recharge1`) – the second slot. Unlocks 2 hours (absolute)
  after the Daily Focus.
- **Recharge #2** (`recharge2`) – the third slot. Unlocks 4 hours (absolute)
  after the Daily Focus.
- **Focus time** (`focusHour`, `focusMinute`) – the client's wall-clock setting
  in their time zone. Recharge times derive from it.
- **Daily Content** (`DailyContent`) – the admin-managed audio set
  (focus + R1 + R2) for one date and locale.
- **Daily State** (`DailyState`) – the per-client, per-day progress record
  holding the three slot states.

## Slot lifecycle

- **Locked** (`locked`) – `nowUtc < unlockAtUtc`. No audio URL is issued.
- **Unlocked** (`unlocked`) – `nowUtc >= unlockAtUtc`, not yet submitted.
  Playable.
- **Listened** (`listened`) – submitted after verified listening (`listenedAt`
  set). Terminal state.
- **Missed** (`missed`) – read-model label for a past-program-day slot that was
  never submitted. Still completable from history.
- **Unlock time** (`unlockAtUtc`) – the absolute UTC instant a slot becomes
  playable. Computed with `effect/DateTime` (`Zoned` in, `Utc` stored).
- **Submit** – the `POST /submit` action transitioning a slot to `listened`
  after BE-side proof validation.
- **Listening proof** – `playedRatio >= 90%` plus `reachedEnd`, reported via
  progress heartbeats. Forward-seek does not count.

## People and access

- **Admin** (`admin`) – manages coaches, clients, and audio content.
- **Coach** (`coach`) – sees only assigned clients and their slot states.
- **Client** (`client`) – sees only their own program and settings.
- **Client Profile** (`ClientProfile`) – name, bio, focus time, time zone,
  locale.

## Notifications and language

- **Push subscription** (`PushSubscription`) – one Web Push subscription per
  device.
- **Unlock notification** – the push message sent when a slot unlocks (3 per
  client per day).
- **Locale** (`locale`: `cs` | `en`) – Paraglide JS language tag for UI strings
  and push texts. Audio content falls back to the default locale.

## Banned synonyms

Do not use: lesson, episode, meditation, session (means auth session), course,
completed / finished (use `listened`), alarm / reminder (use unlock
notification).
