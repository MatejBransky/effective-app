import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Redacted } from "effect";
import * as jose from "jose";
import { JwtVerifier, layerWithJwks } from "./JwtVerifier.ts";

const ISSUER = "http://localhost:8180/realms/effective-app";
const HOST_ID = "11111111-1111-4111-8111-111111111111";

// Each test generates its own throwaway RSA keypair - this is what lets these tests
// exercise the real `jose.jwtVerify` codepath (signature, issuer, claim checks) without
// ever making a network call to a real Keycloak instance.
const generateTestKey = async () => {
  const { privateKey, publicKey } = await jose.generateKeyPair("RS256");
  const jwk = { ...(await jose.exportJWK(publicKey)), kid: "test", alg: "RS256" };
  return { privateKey, jwk };
};

type PrivateKey = Awaited<ReturnType<typeof jose.generateKeyPair>>["privateKey"];

const sign = (privateKey: PrivateKey, claims: Record<string, unknown>) =>
  new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

describe("JwtVerifier", () => {
  it.effect("extracts hostId and subject from a valid token", () =>
    Effect.gen(function* () {
      const { privateKey, jwk } = yield* Effect.promise(generateTestKey);
      const token = yield* Effect.promise(() =>
        sign(privateKey, { sub: "user-1", host_id: HOST_ID }),
      );

      const result = yield* JwtVerifier.pipe(
        Effect.flatMap((verifier) => verifier.verify(Redacted.make(token))),
        Effect.provide(layerWithJwks({ issuer: ISSUER, jwks: { keys: [jwk] } })),
      );

      expect(result).toEqual({ hostId: HOST_ID, subject: "user-1" });
    }),
  );

  it.effect("rejects a token missing the host_id claim", () =>
    Effect.gen(function* () {
      const { privateKey, jwk } = yield* Effect.promise(generateTestKey);
      const token = yield* Effect.promise(() => sign(privateKey, { sub: "user-1" }));

      const exit = yield* JwtVerifier.pipe(
        Effect.flatMap((verifier) => verifier.verify(Redacted.make(token))),
        Effect.provide(layerWithJwks({ issuer: ISSUER, jwks: { keys: [jwk] } })),
        Effect.exit,
      );

      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect("rejects a token signed by an unknown key", () =>
    Effect.gen(function* () {
      const { privateKey: signingKey } = yield* Effect.promise(generateTestKey);
      const { jwk: unrelatedJwk } = yield* Effect.promise(generateTestKey);
      const token = yield* Effect.promise(() =>
        sign(signingKey, { sub: "user-1", host_id: HOST_ID }),
      );

      const exit = yield* JwtVerifier.pipe(
        Effect.flatMap((verifier) => verifier.verify(Redacted.make(token))),
        Effect.provide(layerWithJwks({ issuer: ISSUER, jwks: { keys: [unrelatedJwk] } })),
        Effect.exit,
      );

      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );
});
