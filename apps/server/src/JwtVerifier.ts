import { Context, Effect, Layer, Redacted, Schema } from "effect";
import type { JWTVerifyGetKey } from "jose";
import * as jose from "jose";

// Deliberately no detail beyond the tag: leaking *why* a token was rejected (expired vs.
// bad signature vs. wrong audience) helps an attacker narrow down how to forge one. Real
// diagnostics belong in server-side logs, never in the response body.
export class InvalidToken extends Schema.TaggedErrorClass<InvalidToken>()(
  "InvalidToken",
  {},
  { httpApiStatus: 401 },
) {}

export interface VerifiedToken {
  readonly hostId: string;
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
    ) => Effect.Effect<VerifiedToken, InvalidToken>;
  }
>()("effective-app/JwtVerifier") {}

const make = (options: { readonly issuer: string; readonly getKey: JWTVerifyGetKey }) => ({
  verify: (token: Redacted.Redacted<string>) =>
    Effect.tryPromise({
      try: async () => {
        const { payload } = await jose.jwtVerify(Redacted.value(token), options.getKey, {
          issuer: options.issuer,
        });
        // host_id comes from a Keycloak user-attribute mapper (see
        // keycloak/realm-export.json) - not a standard OIDC claim, so it isn't
        // guaranteed present just because the signature/issuer checked out.
        const hostId = payload["host_id"];
        if (typeof hostId !== "string" || typeof payload.sub !== "string") {
          throw new Error("token missing required host_id/sub claim");
        }
        return { hostId, subject: payload.sub };
      },
      catch: () => new InvalidToken(),
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
