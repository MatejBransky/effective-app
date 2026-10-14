# Life Coaching Example – Requirements & Implementation Plan

## 1. Goal

E2E-working example app: `auth → settings → daily unlock → push → verified listening → coach review`.
Not a prototype with mocks – every phase below stays deployable and verified.

## 2. Roles

- `admin`: manages coaches, clients, audio content.
- `coach`: sees only assigned clients + their daily completion.
- `client`: sees only own program + settings.

## 3. Core domain model

- `User(id, role, locale, coachId?)`
- `ClientProfile(userId, firstName, lastName, bio, focusHour, focusMinute, timeZone)`
- `DailyContent(date, locale, focusAudioKey, recharge1AudioKey, recharge2AudioKey)`
- `DailyState(userId, date, focus: SlotState, recharge1: SlotState, recharge2: SlotState)`
  - `SlotState = locked | unlocked | listened` (+ `unlockedAt`, `listenedAt`)
- `PushSubscription(userId, endpoint, keys, locale)`
- S3 keys: `audio/{date}/{focus|r1|r2}/{locale}.mp3` (video-ready layout).

## 4. Critical business scenarios (P0)

1. **Focus time setting:** client sets wall-clock `focusHour:focusMinute` + IANA `timeZone` (e.g. `Europe/Prague`). Derived: `R1 = +2h`, `R2 = +4h` absolute. Change applies from next program day, never retroactively.
2. **Unlocking:** backend computes `unlocked = nowUtc >= unlockAtUtc`. Frontend only displays, never decides. Each program day opens a new set; past days stay replayable via `today` default + history selector.
3. **Push on unlock:** 3 notifications/day/client (focus, R1, R2). One subscription per device. Missed push never loses state – state is always derivable from time.
4. **Verified listening + submit:** `submit` enabled only after proven listening (`playedRatio >= 90%` + `reachedEnd`, progress heartbeats to BE, forward-seek does not count). BE re-validates; FE keeps the button disabled until then.
5. **Coach dashboard:** client list + today overview (`locked/unlocked/listened/missed` per slot), client detail with history.
6. **Client settings:** first/last name, bio, focus time + R1/R2 preview, locale switch.
7. **Client day view:** the three audios stacked (focus, R1, R2) with lock state; history selector replays or completes missing slots.
8. **i18n:** all UI strings via Paraglide JS; audio content per locale with default-locale fallback.

## 5. Tech decisions (locked)

- **Auth:** `@yielded/auth`. JWT carries `userId + role`. Every API route guarded by role.
- **DB:** PostgreSQL. Unlock instants stored as `timestamptz` (UTC); settings store wall time + zone.
- **DateTime:** `effect/DateTime` – `Zoned` for computation, `Utc` for storage/comparison.
  - Day: `DateTime.makeZoned({ year, month, day, hour, minute }, timeZone)` – DST gaps/overlaps handled by `Intl`, no custom logic.
  - R1/R2: `DateTime.add(focusZoned, { hours: 2 })` / `{ hours: 4 }` (absolute elapsed time; wall-clock display shifts correctly on DST days).
  - Test P0: `Europe/Prague` spring-forward / fall-back cases.
- **API contract:** single shared Effect Schema package consumed by FE and BE. No untyped JSON.
- **FE state:** React + `@effect/atom-react` atoms: `session, todayProgram, historyDay, playerProgress, settings`.
- **PWA:** `vite-plugin-pwa` manifest + Service Worker, installable, VAPID push. Offline caches app shell only; audio always online via short-lived presigned S3 URLs.
- **Storage:** S3-compatible bucket for media. Private bucket; admin uploads, clients read via presigned GET.
- **Infra:** `alchemy.run` v2 – static FE, API service, Postgres, S3 bucket, scheduler (unlock-check → send-push).
- **i18n:** Paraglide JS – `messages/en.json` (source) + `cs.json`, compiled via Vite plugin. `Schema.Literal("cs","en")` mirrors `availableLanguageTags`. Server/scheduler imports the same compiled messages and localizes push text per `user.locale` at send time.
- **Tests:** `vitest` + `@effect/vitest` for unit/integration (Effect `Layer`, `TestClock` for unlock logic; contract, RLS, S3-presign integration against local `docker compose` stack). `playwright` for E2E in `apps/client/e2e/` with a root turbo `test:e2e` task.

## 6. Explicit non-goals (example scope)

- No offline audio, no background audio analytics beyond progress heartbeat.
- No payment/billing, no chat, no video calls.
- No automatic transcription or AI-generated content.

## 7. Edge cases

- Program day follows the client's time zone, not the server's.
- Midnight rollover: after midnight client-time, a new set opens; unfinished slots move to history as `missed` (still completable).
- Missing audio for day/locale → default-locale fallback + `missing-content` flag visible to coach.
- Undelivered push (closed browser, iOS limits) → no state loss; next app open recomputes from time.
- DST transition day: absolute +2h/+4h holds; displayed wall times may shift by one hour – accepted and covered by test.

## 8. Implementation plan

1. **Skeleton:** shared contracts package, FE/BE hello-world, alchemy v2 deploy + Postgres + S3 stub.
2. **Auth + roles:** login/logout, seed `admin/coach/client`, route + API guards.
3. **Content + S3:** admin upload, presigned read, `DailyContent` per day/locale.
4. **Schedule core:** wall time + zone → `unlockAtUtc`; `GET /today`, `GET /history?date`; unit tests for +2h/+4h, midnight, DST.
5. **Client player:** 3 stacked audio cards, lock/unlock display, progress tracking, `POST /submit` with BE validation.
6. **Coach UI:** client list + today status + history detail.
7. **Settings:** profile fields, focus time + R1/R2 preview, locale switch (Paraglide + persisted atom).
8. **PWA + push:** SW/manifest, subscribe/unsubscribe, scheduler `unlock-check → send-push` with localized templates.
9. **i18n pass:** `cs/en` dictionaries, push localization, fallback audit.
10. **E2E verify:** `vitest` matrix green + `playwright` P0 flow green: seed `coach+client` → login → set 6:00 → time-mock 6/8/10 → unlock + push stub → play → submit → coach sees 3/3.

## 9. Open questions for review

1. Is `playedRatio >= 90%` + `reachedEnd` the right definition of "listened"?
2. Focus-time change effective from tomorrow – accepted?
3. Are `cs/en` enough for the example?

## 10. Implementation notes (built 2026-10-14)

Deliberate deviations from the plan above, all in favor of "works E2E":

- **Auth: existing Keycloak, not `@yielded/auth`.** `@yielded/auth@0.1.0-beta.1`
  is password-hashing primitives, not an IdP - swapping the repo's verified
  Keycloak loop for it would have broken E2E. Coaching authorizes against the
  existing `Auth`/`JwtVerifier` seam (`CurrentHost.subject` as user id);
  `@yielded/auth` can plug in at that same seam later.
- **E2E browser runs on `@playwright/test` (repo-local Chromium), not MCP
  Playwright** - no Playwright MCP server is configured (`.mcp.json` only has
  `cloudflare`), and none is callable from here. Same verification value:
  `apps/client/e2e/coaching.spec.ts` drives a real browser through login,
  settings, playback, submit, push, coach review, and locale switch.
- **Coaching reads go over direct HttpApi, not PowerSync sync.** The
  host/member local-first loop is untouched; syncing coaching tables would
  need new sync streams + RLS publication work. Follow-up, not needed for the
  E2E flow.
- **Audio is served by the API (`GET /coaching/audio/:key`), not S3
  presigned URLs.** Fixture WAVs stand in for the media bucket; the unlock
  gate + short-lived-URL shape are the same, only the storage backend differs.
- **Push scheduler is an admin-triggered endpoint** (`POST
  /coaching/push/check-due`), not a cron worker - same due/send/idempotency
  logic, invoked directly in E2E. Production wires it to an alchemy cron.
- **Push E2E mocks only `PushManager.subscribe`.** Real headless subscribe is
  impossible in Playwright (Chromium: no Push API in incognito contexts;
  Firefox: no push-service reachability - microsoft/playwright#23954), so
  `push.spec.ts` stubs `subscribe` with a valid P-256 keypair while keeping
  everything else real (permission flow, SW, subscription API, scheduler,
  web-push encryption up to the network send, which fails gracefully with
  `{ sent: 0 }` and records nothing). Real delivery additionally needs a
  one-time manual check in a headed browser. The `check-due` unit test (fake
  sender) proves the send/idempotency logic itself.
- **Server push texts are a tiny typed `cs`/`en` map**, not Paraglide
  (Paraglide compiles for the Vite client; sharing its runtime with the
  server was out of scope).
- **RLS lesson: no self-referencing policies.** `admin_all` on
  `coaching_users` and `exists` coach checks on `client_profiles` recursed
  infinitely - coach reads go through a `SECURITY DEFINER`
  `coaching_coach_of()` function instead (migration 0004).
- **`submit` heartbeat merge is monotonic** (max played, OR reachedEnd) so a
  late in-flight heartbeat can never un-reach the end.
- **Babel stays on 7.x** - `vite-plugin-babel@1.7.3` (latest) breaks on
  Babel 8 (default-export removal); React Compiler needs that plugin.
