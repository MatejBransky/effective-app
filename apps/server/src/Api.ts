import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Auth } from "./Auth.ts";

const MeResponse = Schema.Struct({
  subject: Schema.String,
});

const HealthGroup = HttpApiGroup.make("Health").add(
  HttpApiEndpoint.get("health", "/health", { success: Schema.String }),
);

// Proves the Auth middleware/JwtVerifier wiring works end-to-end against a real Keycloak.
const MeGroup = HttpApiGroup.make("Me")
  .add(HttpApiEndpoint.get("me", "/me", { success: MeResponse }))
  .middleware(Auth);

export const Api = HttpApi.make("AppServer").add(HealthGroup).add(MeGroup);
