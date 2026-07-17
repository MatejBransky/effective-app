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
import { SyncGroupLive } from "./SyncHandlers.ts";

const PORT = Number(process.env["PORT"] ?? 3000);
// Fail fast on missing config rather than starting a server that would 500 on every
// protected request - see .env.example for where these come from.
const ISSUER = process.env["KEYCLOAK_ISSUER"];
const JWKS_URI = process.env["KEYCLOAK_JWKS_URI"];
const APP_DATABASE_URL = process.env["APP_DATABASE_URL"];
const CLIENT_ORIGIN = process.env["CLIENT_ORIGIN"];
if (!ISSUER || !JWKS_URI) {
  throw new Error("KEYCLOAK_ISSUER and KEYCLOAK_JWKS_URI must be set - see .env.example");
}
if (!APP_DATABASE_URL) {
  throw new Error("APP_DATABASE_URL must be set - see .env.example");
}
if (!CLIENT_ORIGIN) {
  throw new Error("CLIENT_ORIGIN must be set - see .env.example");
}

const AuthLayer = AuthLive.pipe(
  Layer.provide(JwtVerifier.layer({ issuer: ISSUER, jwksUri: JWKS_URI })),
);

const HostScopedDbLayer = HostScopedDb.layer.pipe(Layer.provide(Db.layer(APP_DATABASE_URL)));

// `apps/client` calls this API cross-origin (localhost:5173 -> localhost:3000). Bearer
// tokens go in the Authorization header, not cookies, so `credentials: true` isn't
// actually needed for auth to work - kept off (the safer default) since nothing here
// relies on cookies.
const CorsLayer = HttpRouter.cors({
  allowedOrigins: [CLIENT_ORIGIN],
  allowedHeaders: ["Authorization", "Content-Type"],
});

const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthGroupLive),
  Layer.provide(MeGroupLive),
  Layer.provide(HostsGroupLive),
  Layer.provide(SyncGroupLive),
  Layer.provide(AuthLayer),
  // Unlike HostScopedDbLayer below, CORS is global router middleware - it needs the
  // `HttpRouter` service itself (to register a global middleware against it), which is
  // available while routes are still being built, not after `HttpRouter.serve` has
  // already collapsed that requirement.
  Layer.provide(CorsLayer),
  // Per-handler service deps (as opposed to middleware-provided ones like CurrentHost)
  // surface as a specially-tagged `HttpRouter.Request<"Requires", _>` requirement that
  // only collapses to the plain service tag once `HttpRouter.serve` runs - providing
  // HostScopedDbLayer before `serve` silently fails to satisfy it (different types).
  HttpRouter.serve,
  Layer.provide(HostScopedDbLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: PORT })),
);

Layer.launch(ApiLive).pipe(NodeRuntime.runMain);
