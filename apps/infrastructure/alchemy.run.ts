import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Output from "alchemy/Output";
import HelloWorker from "./src/HelloWorker.ts";

export default Alchemy.Stack(
  "Effective",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* HelloWorker;

    // Deploys apps/client's own already-working `pnpm run build` output as static
    // assets - deliberately `StaticSite` (runs an arbitrary build command, serves the
    // output dir) rather than `Cloudflare.Website.Vite` (which needs the Cloudflare
    // Vite plugin wired into apps/client's own vite.config.ts). apps/client's Vite
    // config is already non-trivial (WASM, PWA, two HTML entry points), so this stays
    // fully decoupled from Vite internals - see docs/data-model.md's "GitHub CI/CD"
    // section for why.
    const clientSite = yield* Cloudflare.Website.StaticSite("ClientSite", {
      cwd: "../client",
      command: "pnpm run build",
      outdir: "dist",
      assets: {
        // TanStack Router's client-side routes need every unmatched path to fall back
        // to index.html - silent-renew.html stays served directly since it's a real
        // file in the build output, not something this fallback intercepts.
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
      },
    });

    // Posts (and keeps updated, via a stable logical id) a preview-URL comment on the
    // PR that triggered this deploy - a no-op outside GitHub Actions or on a
    // non-PR run (github.pr is undefined on pushes to main).
    const github = yield* GitHub.GitHubEnv;
    if (github?.pr) {
      yield* GitHub.Comment("preview-comment", {
        owner: "MatejBransky",
        repository: "effective-app",
        issueNumber: github.pr,
        body: Output.interpolate`
          ## Preview deployed

          **App:** ${clientSite.url}
          **Hello-world smoke test:** ${worker.url}

          ⚠️ Login and data sync will NOT work on this preview - apps/server,
          Keycloak, and PowerSync are still self-hosted on localhost only
          (see docs/data-model.md's "Cloudflare deployment" section). This
          preview shows the UI shell/routing/PWA only, until the backend
          migration lands.

          Built from commit ${github.sha.slice(0, 7)}.

          ---
          _This comment updates automatically with each push._
        `,
      });
    }

    return { helloUrl: worker.url.as<string>(), clientUrl: clientSite.url.as<string>() };
  }),
);
