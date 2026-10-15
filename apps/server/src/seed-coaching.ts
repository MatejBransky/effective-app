import { Client } from "pg";

// Seeds the life-coaching example slice for local E2E: three Keycloak users
// (admin/coach/client, each with the `host_id` attribute `JwtVerifier`
// requires) plus their `coaching_users` rows, the client's profile, and a
// week of `daily_contents` in both locales. Idempotent - rerunning only tops
// up missing rows. Run: `pnpm --filter @repo/server run seed:coaching`.
//
// Uses raw SQL over the owner `DATABASE_URL` (bypasses RLS, like migrations)
// and plain `fetch` against Keycloak's Admin API - no app code paths involved.

const KEYCLOAK_URL = process.env["VITE_KEYCLOAK_URL"] ?? "http://localhost:8180";
const REALM = process.env["VITE_KEYCLOAK_REALM"] ?? "effective-app";
const ADMIN_USER = process.env["KEYCLOAK_ADMIN_USERNAME"] ?? "admin";
const ADMIN_PASSWORD = process.env["KEYCLOAK_ADMIN_PASSWORD"] ?? "local_dev_only";
const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");

const USERS = [
  {
    username: "coach-admin",
    role: "admin",
    email: "admin@example.com",
    firstName: "Ada",
    lastName: "Admin",
  },
  {
    username: "coach-maria",
    role: "coach",
    email: "maria@example.com",
    firstName: "Maria",
    lastName: "Coach",
  },
  {
    username: "client-jan",
    role: "client",
    email: "jan@example.com",
    firstName: "Jan",
    lastName: "Novak",
  },
] as const;

const USER_PASSWORD = process.env["SEED_USER_PASSWORD"] ?? "local_dev_only";

async function adminToken(): Promise<string> {
  const res = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`keycloak admin login failed: ${res.status}`);
  // SAFETY: `res.ok` was checked above, and Keycloak's token endpoint always returns
  // `{ access_token }` on 2xx per OIDC - a missing field would surface immediately as
  // an undefined Bearer on the very next call, never as a silently wrong value.
  const data = (await res.json()) as { access_token: string };

  return data.access_token;
}

async function ensureUser(
  token: string,
  user: { username: string; email: string; firstName: string; lastName: string },
): Promise<string> {
  const base = `${KEYCLOAK_URL}/admin/realms/${REALM}/users`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const create = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: true,
      attributes: { host_id: [`coaching-${user.username}`] },
      credentials: [{ type: "password", value: USER_PASSWORD, temporary: false }],
    }),
  });

  if (create.status === 201 || create.status === 204) {
    const location = create.headers.get("location") ?? "";
    const id = location.split("/").pop();

    if (id) return id;
  } else if (create.status !== 409) {
    throw new Error(`create user ${user.username} failed: ${create.status}`);
  }

  const lookup = await fetch(`${base}?username=${encodeURIComponent(user.username)}`, { headers });

  if (!lookup.ok) throw new Error(`lookup user ${user.username} failed: ${lookup.status}`);
  // SAFETY: Keycloak's admin user-search returns an array of user objects carrying
  // `id` - and the optional chain plus `if (!id) throw` below rejects anything else
  // before the id is ever used.
  const found = (await lookup.json()) as Array<{ id: string }>;
  const id = found[0]?.id;

  if (!id) throw new Error(`user ${user.username} missing after create`);

  // Clear any realm-default required actions (e.g. VERIFY_EMAIL) and fill the
  // profile name - programmatic users must be able to use the password grant
  // immediately, without an update-profile round-trip.
  // SAFETY: this object is only read through optional chains (`?.`) below and
  // re-serialized for the PUT that follows - an unexpected shape degrades to empty
  // patch fields, never to an unsound value in a typed position.
  const current = (await (await fetch(`${base}/${id}`, { headers })).json()) as {
    requiredActions?: Array<string>;
    firstName?: string;
    lastName?: string;
  };

  const patched = { ...current, requiredActions: [] };

  if (!current.firstName) patched.firstName = user.firstName;

  if (!current.lastName) patched.lastName = user.lastName;

  if (current.requiredActions?.length || !current.firstName || !current.lastName) {
    const reset = await fetch(`${base}/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(patched),
    });

    if (!reset.ok && reset.status !== 204) {
      throw new Error(`patch user ${user.username} failed: ${reset.status}`);
    }
  }

  return id;
}

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

const token = await adminToken();
const ids: Record<string, string> = {};

for (const user of USERS) {
  ids[user.username] = await ensureUser(token, user);
  console.log(`keycloak user ${user.username} -> ${ids[user.username]}`);
}

const pg = new Client({ connectionString: DATABASE_URL });

await pg.connect();

try {
  for (const user of USERS) {
    await pg.query(
      `insert into coaching_users (user_id, role, created_at) values ($1, $2, now())
       on conflict (user_id) do update set role = excluded.role`,
      [ids[user.username], user.role],
    );
  }

  await pg.query(
    `insert into client_profiles
       (user_id, first_name, last_name, bio, focus_hour, focus_minute, time_zone, locale, coach_id)
     values ($1, 'Jan', 'Novak', 'E2E client', 6, 0, 'Europe/Prague', 'en', $2)
     on conflict (user_id) do nothing`,
    [ids["client-jan"], ids["coach-maria"]],
  );
  const today = new Date();

  for (let offset = -7; offset <= 1; offset++) {
    const date = ymd(new Date(today.getTime() + offset * 86_400_000));

    for (const locale of ["cs", "en"]) {
      await pg.query(
        `insert into daily_contents
           (program_date, locale, focus_audio_key, recharge1_audio_key, recharge2_audio_key)
         values ($1, $2, 'focus.wav', 'recharge1.wav', 'recharge2.wav')
         on conflict do nothing`,
        [date, locale],
      );
    }
  }

  console.log("db seed ok");
} finally {
  await pg.end();
}
