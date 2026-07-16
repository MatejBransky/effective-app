import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Auth } from "./Auth.ts";

const MeResponse = Schema.Struct({
  hostId: Schema.String,
  subject: Schema.String,
});

const HealthGroup = HttpApiGroup.make("Health").add(
  HttpApiEndpoint.get("health", "/health", { success: Schema.String }),
);

// Proves the Auth middleware/JwtVerifier wiring works end-to-end - see
// docs/data-model.md's "PowerSync sync streams" section for how the same host_id claim
// scopes what a client can sync, not just what apps/server lets it call.
const MeGroup = HttpApiGroup.make("Me")
  .add(HttpApiEndpoint.get("me", "/me", { success: MeResponse }))
  .middleware(Auth);

export const Api = HttpApi.make("EffectiveApp").add(HealthGroup).add(MeGroup);
