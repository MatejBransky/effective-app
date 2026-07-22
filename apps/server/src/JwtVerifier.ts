import { Context, Effect, Layer, Redacted } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";
import type { JWTVerifyGetKey } from "jose";
import * as jose from "jose";

export interface VerifiedToken {
  readonly subject: string;
}

/**
 * Verifies a Bearer JWT and extracts the claims our domain cares about. Swappable via
 * `Layer` (see `layer`/`layerWithJwks` below) so tests never make a real network call to
 * fetch JWKS - per AGENTS.md's "external I/O goes through swappable services" rule.
 */
export class JwtVerifier extends Context.Service<
  JwtVerifier,
  {
    readonly verify: (
      token: Redacted.Redacted<string>,
    ) => Effect.Effect<VerifiedToken, HttpApiError.Unauthorized>;
  }
>()("app-server/JwtVerifier") {}

const make = (options: { readonly issuer: string; readonly getKey: JWTVerifyGetKey }) => ({
  verify: (token: Redacted.Redacted<string>) =>
    Effect.tryPromise({
      try: async () => {
        const { payload } = await jose.jwtVerify(Redacted.value(token), options.getKey, {
          issuer: options.issuer,
        });
        if (typeof payload.sub !== "string") {
          throw new Error("token missing required sub claim");
        }
        return { subject: payload.sub };
      },
      // Deliberately no detail beyond the 401: leaking *why* a token was rejected (expired
      // vs. bad signature vs. wrong issuer) helps an attacker narrow down how to forge one.
      // Real diagnostics belong in server-side logs, never in the response body.
      catch: () => new HttpApiError.Unauthorized({}),
    }),
});

/** Production layer - fetches and caches Keycloak's realm signing keys over HTTP. */
export const layer = (options: { readonly issuer: string; readonly jwksUri: string }) =>
  Layer.succeed(
    JwtVerifier,
    make({
      issuer: options.issuer,
      getKey: jose.createRemoteJWKSet(new URL(options.jwksUri)),
    }),
  );

/** Test layer - verifies against an in-memory JWK set, no network involved. */
export const layerWithJwks = (options: {
  readonly issuer: string;
  readonly jwks: jose.JSONWebKeySet;
}) =>
  Layer.succeed(
    JwtVerifier,
    make({ issuer: options.issuer, getKey: jose.createLocalJWKSet(options.jwks) }),
  );
