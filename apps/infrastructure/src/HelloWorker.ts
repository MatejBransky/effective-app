import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

/**
 * Smallest possible Worker, deployed on its own before any real service
 * depends on this toolchain - proves credentials, the `Cloudflare.state()`
 * bootstrap, and a real `alchemy deploy` all work (see docs/data-model.md's
 * "Cloudflare deployment (apps/infrastructure)" section).
 */
export default class HelloWorker extends Cloudflare.Worker<HelloWorker>()(
  "HelloWorker",
  { main: import.meta.url },
  Effect.succeed({
    fetch: Effect.succeed(HttpServerResponse.text("hello world")),
  }),
) {}
