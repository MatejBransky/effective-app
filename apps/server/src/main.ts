import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "./Api.ts";
import { AuthLive } from "./Auth.ts";
import { HealthGroupLive, MeGroupLive } from "./Handlers.ts";
import * as JwtVerifier from "./JwtVerifier.ts";

const PORT = Number(process.env["PORT"] ?? 3000);
// Fail fast on missing auth config rather than starting a server that would 500 on every
// protected request - see .env.example for where these come from.
const ISSUER = process.env["KEYCLOAK_ISSUER"];
const JWKS_URI = process.env["KEYCLOAK_JWKS_URI"];
if (!ISSUER || !JWKS_URI) {
  throw new Error("KEYCLOAK_ISSUER and KEYCLOAK_JWKS_URI must be set - see .env.example");
}

const AuthLayer = AuthLive.pipe(
  Layer.provide(JwtVerifier.layer({ issuer: ISSUER, jwksUri: JWKS_URI })),
);

const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthGroupLive),
  Layer.provide(MeGroupLive),
  Layer.provide(AuthLayer),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: PORT })),
);

Layer.launch(ApiLive).pipe(NodeRuntime.runMain);
