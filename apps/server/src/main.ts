import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { createServer } from "node:http";
import { Api } from "./Api.ts";
import { AuthLive } from "./Auth.ts";
import { HealthGroupLive, MeGroupLive } from "./Handlers.ts";
import { layer as jwtVerifierLayer } from "./JwtVerifier.ts";

const issuer = process.env["KEYCLOAK_ISSUER"];
const jwksUri = process.env["KEYCLOAK_JWKS_URI"];
if (!issuer || !jwksUri) {
  throw new Error("KEYCLOAK_ISSUER and KEYCLOAK_JWKS_URI must be set (see .env.example)");
}

const clientOrigin = process.env["CLIENT_ORIGIN"];
if (!clientOrigin) {
  throw new Error("CLIENT_ORIGIN must be set (see .env.example)");
}

const port = Number(process.env["PORT"] ?? 4000);

const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthGroupLive),
  Layer.provide(MeGroupLive),
  Layer.provide(AuthLive),
  Layer.provide(jwtVerifierLayer({ issuer, jwksUri })),
  (layer) =>
    HttpRouter.serve(layer, {
      middleware: HttpMiddleware.cors({ allowedOrigins: [clientOrigin] }),
    }),
  Layer.provide(NodeHttpServer.layer(createServer, { port })),
);

Layer.launch(ApiLive).pipe(NodeRuntime.runMain);
