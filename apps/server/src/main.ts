import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "./Api.ts";
import { AuthLive } from "./Auth.ts";
import * as Db from "./Db.ts";
import { HealthGroupLive, HostsGroupLive, MeGroupLive } from "./Handlers.ts";
import * as HostScopedDb from "./HostScopedDb.ts";
import * as JwtVerifier from "./JwtVerifier.ts";

const PORT = Number(process.env["PORT"] ?? 3000);
// Fail fast on missing config rather than starting a server that would 500 on every
// protected request - see .env.example for where these come from.
const ISSUER = process.env["KEYCLOAK_ISSUER"];
const JWKS_URI = process.env["KEYCLOAK_JWKS_URI"];
const APP_DATABASE_URL = process.env["APP_DATABASE_URL"];
if (!ISSUER || !JWKS_URI) {
  throw new Error("KEYCLOAK_ISSUER and KEYCLOAK_JWKS_URI must be set - see .env.example");
}
if (!APP_DATABASE_URL) {
  throw new Error("APP_DATABASE_URL must be set - see .env.example");
}

const AuthLayer = AuthLive.pipe(
  Layer.provide(JwtVerifier.layer({ issuer: ISSUER, jwksUri: JWKS_URI })),
);

const HostScopedDbLayer = HostScopedDb.layer.pipe(Layer.provide(Db.layer(APP_DATABASE_URL)));

const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthGroupLive),
  Layer.provide(MeGroupLive),
  Layer.provide(HostsGroupLive),
  Layer.provide(AuthLayer),
  // Per-handler service deps (as opposed to middleware-provided ones like CurrentHost)
  // surface as a specially-tagged `HttpRouter.Request<"Requires", _>` requirement that
  // only collapses to the plain service tag once `HttpRouter.serve` runs - providing
  // HostScopedDbLayer before `serve` silently fails to satisfy it (different types).
  HttpRouter.serve,
  Layer.provide(HostScopedDbLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: PORT })),
);

Layer.launch(ApiLive).pipe(NodeRuntime.runMain);
