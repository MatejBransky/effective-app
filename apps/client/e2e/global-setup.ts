import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const waitFor = async (url: string, label: string): Promise<void> => {
  const deadline = Date.now() + 120_000;

  for (;;) {
    try {
      const res = await fetch(url);

      if (res.ok) return;
    } catch {
      // not up yet
    }

    if (Date.now() > deadline) throw new Error(`${label} never became ready at ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

/** Seeds Keycloak users + coaching rows before the suite (idempotent). */
export default async function globalSetup(): Promise<void> {
  await waitFor("http://localhost:8180/realms/effective-app", "keycloak");
  await waitFor("http://localhost:4000/health", "apps/server");
  const root = new URL("../..", import.meta.url).pathname;
  await execFileAsync("pnpm", ["--filter", "@repo/server", "run", "seed:coaching"], { cwd: root });
  // Clean slate for run-scoped state (completions, heartbeats, push log and
  // subscriptions) - the suite asserts exact counts, so a previous run's (or
  // a manual curl smoke test's) rows must not leak in.
  await execFileAsync("pnpm", ["--filter", "@repo/server", "run", "reset:coaching"], {
    cwd: root,
  });
}
