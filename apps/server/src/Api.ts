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

const SyncOp = Schema.Struct({
  id: Schema.String,
  op: Schema.Literals(["PUT", "PATCH", "DELETE"]),
  table: Schema.String,
  opData: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});

const SyncUploadRequest = Schema.Struct({
  operations: Schema.Array(SyncOp),
});

const SyncOpError = Schema.Struct({
  id: Schema.String,
  reason: Schema.String,
});

const SyncUploadResponse = Schema.Struct({
  errors: Schema.Array(SyncOpError),
});

// The PowerSync upload-queue contract (see references/custom-backend.md's "Backend API
// for uploadData") requires this endpoint to always return 2xx - a 4xx blocks the
// client's upload queue permanently. So there's deliberately no `error` schema here: a
// per-op validation/write failure is reported inside `SyncUploadResponse.errors`, not as
// an HTTP-level error. The only non-2xx this endpoint can produce is `Auth`'s existing
// 401 for a missing/invalid token.
const SyncGroup = HttpApiGroup.make("Sync")
  .add(
    HttpApiEndpoint.post("upload", "/sync/upload", {
      payload: SyncUploadRequest,
      success: SyncUploadResponse,
    }),
  )
  .middleware(Auth);

export const Api = HttpApi.make("EffectiveApp")
  .add(HealthGroup)
  .add(MeGroup)
  .add(HostsGroup)
  .add(SyncGroup);
