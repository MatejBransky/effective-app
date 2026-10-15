import { Client } from "pg";

// Resets per-run coaching state for E2E isolation: completions, heartbeats,
// push log, and subscriptions. Seed/reference data (`coaching_users`,
// `client_profiles`, `daily_contents`) is left intact - `seed-coaching`
// owns that. Run: `pnpm --filter @repo/server run reset:coaching`.
//
// TRUNCATE (not DELETE) so sequences/stats reset too; these four tables are
// leaves - nothing references them. Owner connection, like migrations.

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");

const pg = new Client({ connectionString: DATABASE_URL });

await pg.connect();

try {
  await pg.query(
    "truncate slot_completions, listening_progress, push_deliveries, push_subscriptions",
  );
  console.log("coaching state reset");
} finally {
  await pg.end();
}
