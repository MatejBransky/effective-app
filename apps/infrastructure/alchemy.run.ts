import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import HelloWorker from "./src/HelloWorker.ts";

export default Alchemy.Stack(
  "Effective",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* HelloWorker;
    return { helloUrl: worker.url.as<string>() };
  }),
);
