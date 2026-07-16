import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Auth } from "./Auth.ts";
import { DbError } from "./HostScopedDb.ts";

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

export class HostNotFound extends Schema.TaggedErrorClass<HostNotFound>()(
  "HostNotFound",
  {},
  { httpApiStatus: 404 },
) {}

const HostResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  email: Schema.String,
  timeZone: Schema.String,
  currency: Schema.String,
  businessType: Schema.String,
});

// Proves Postgres RLS (packages/db's per-table policies) actually filters by the
// caller's hostId, not just that apps/server trusts the claim - see docs/data-model.md's
// "Postgres RLS for multi-tenancy" section.
const HostsGroup = HttpApiGroup.make("Hosts")
  .add(
    HttpApiEndpoint.get("me", "/hosts/me", {
      success: HostResponse,
      error: [DbError, HostNotFound],
    }),
  )
  .middleware(Auth);

export const Api = HttpApi.make("EffectiveApp").add(HealthGroup).add(MeGroup).add(HostsGroup);
