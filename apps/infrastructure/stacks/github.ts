import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

/**
 * One-time, locally-run bootstrap - NOT part of the CI pipeline itself. Mints
 * a Cloudflare API token scoped to exactly what `alchemy.run.ts` uses (no
 * KV/R2/D1/Queues/Pages permissions - this app doesn't use those resources),
 * and writes it into the repo as GitHub Actions secrets so `ci.yml`'s deploy
 * job never needs a human to paste credentials into the GitHub UI.
 *
 * Requires a more-privileged credential than day-to-day `alchemy deploy` -
 * minting API tokens needs `API Tokens > Write`, which a normal "Edit
 * Cloudflare Workers" token doesn't grant (see docs/data-model.md's
 * "GitHub CI/CD" section). Run once via:
 *
 *   pnpm --filter @repo/infra run bootstrap-github
 *
 * Re-run only to rotate the token or change its permissions.
 */
export default Alchemy.Stack(
  "GitHub",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID");

    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Workers Scripts Write",
            // Cloudflare.state() keeps its state-store worker's bearer token here -
            // binding it (even to a short-lived edge-preview worker) needs Write, not
            // just Read (see docs/data-model.md's "Why Secrets Store Write?" note).
            "Secrets Store Write",
            "Account Settings Write",
            "Workers Tail Read",
          ],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
      ],
    });

    yield* GitHub.Secret("cf-api-token", {
      owner: "MatejBransky",
      repository: "effective-app",
      name: "CLOUDFLARE_API_TOKEN",
      value: apiToken.value,
    });

    yield* GitHub.Secret("cf-account-id", {
      owner: "MatejBransky",
      repository: "effective-app",
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: Redacted.make(accountId),
    });
  }),
);
