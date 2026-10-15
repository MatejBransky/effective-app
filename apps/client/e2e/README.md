# Life-coaching example: try it out

## Run it

```sh
pnpm install
cp .env.example .env
pnpm --filter @repo/server exec web-push generate-vapid-keys
# put the two keys into .env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
# (and the public one as VITE_VAPID_PUBLIC_KEY)
pnpm run dev:infra
pnpm --filter @repo/entities run db:migrate
pnpm --filter @repo/server run seed:coaching
pnpm --filter @repo/server run dev     # terminal 1 (:4000)
pnpm --filter @repo/client run dev     # terminal 2 (:5173)
```

Open http://localhost:5173/coaching and log in:

| user        | password       | role   |
| ----------- | -------------- | ------ |
| client-jan  | local_dev_only | client |
| coach-maria | local_dev_only | coach  |
| coach-admin | local_dev_only | admin  |

Run the suite: `pnpm --filter @repo/client run test:e2e`
(chromium flow + push wiring; needs the infra and both dev servers up -
the config starts them itself if missing).

## Supported scenarios

- **Client settings** (`/coaching/settings`): name, bio, Daily Focus time +
  time zone with recharge preview (`+2h`/`+4h`), language switch, push
  subscribe button.
- **Day view** (`/coaching`): today by default, 3 stacked slots
  (focus/recharge1/recharge2) locking/unlocking by time, audio playback,
  submit enabled only after verified listening, history date picker for
  replaying or completing past days.
- **Push**: subscribe in settings (real browser), then trigger the scheduler
  as admin - password-grant a token for `coach-admin` and
  `POST /coaching/push/check-due` - due slots notify, sends are idempotent.
- **Coach dashboard** (`/coach`): assigned clients with today's statuses,
  click through to a client's day. Only assigned clients are visible.
- **Locales**: `cs`/`en` across UI and push texts (profile locale drives
  both).

## Known E2E limits

- Headless Chromium cannot really subscribe (no Push API in Playwright's
  incognito contexts, microsoft/playwright#23954) - `push.spec.ts` stubs
  only `PushManager.subscribe`; permission flow, worker, API, scheduler and
  encryption are real. Verify real delivery once in a headed browser.
- Audio is fixture WAVs served by the API, not S3; the scheduler is an
  admin-triggered endpoint, not cron (see `tasks/life-coaching-example.md`).
