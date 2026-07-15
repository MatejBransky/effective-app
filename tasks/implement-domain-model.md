# Implement the domain model (Host / Member / marketing sequences)

## Goal

Implement the data model documented in [`docs/data-model.md`](../docs/data-model.md)
as Effect Schema - the first real business-logic code in this repo, building on
the tooling foundation (`packages/lint-config`, `packages/typescript-config`)
and the `apps/client` vertical slice already in place.

**Read `docs/data-model.md` first.** It has the full field-by-field model,
entity relationships (with an ER diagram), and the reasoning behind every
non-obvious decision (why client-generated UUID ids, why snapshots instead of
event sourcing, why status lives on `MemberHost` not `Member`, why one generic
`DomainEvent` instead of per-aggregate audit tables, comparison to the Momence
legacy system, etc.). This task file does not repeat that content - it's the
implementation punch list, not the design doc.

## Open decision to resolve first

**Where do the entity schemas actually live as packages?** This was never
explicitly reconciled across the design conversation:

- The model was originally planned for a single `packages/schema` package
  holding all entities (see `README.md`/`AGENTS.md`, written before the FSD
  package layout was finalized).
- Later in the same conversation, `packages/entities/*`, `packages/features/*`,
  and `packages/widgets/*` were decided to each be **separate pnpm packages**,
  one per slice, using `package.json#exports` as the public API instead of a
  barrel `index.ts` (see `AGENTS.md`'s FSD section).

Decide before scaffolding: does `Host`/`Member`/`MarketingSequence`/etc. each
become its own `packages/entities/<name>` package, or do they all live
together in one `packages/schema` package? Whichever is chosen, update
`README.md`'s layout section and `AGENTS.md` to match - both currently
describe the pre-FSD single-package version.

## Entities to implement

(full field lists and relationships in `docs/data-model.md`)

- `Host` (incl. `businessType`)
- `Member`
- `MemberHost` (the lead ↔ enrolled junction, incl. `leadStageId`)
- `LeadStageTemplate` (platform-maintained, seeds `LeadStage` per `businessType`)
- `LeadStage` (per-host, editable)
- `MarketingSequence` (incl. `filterSetId`)
- `HostFilterSet` (targeting rules, recursive `FilterRule` tree)
- `SequenceAction`
- `SequenceEdge`
- `SequenceEnrollment`
- `SequenceVersion` (snapshot-based undo/revert)
- `DomainEvent` (generic audit log, incl. per-action execution results via `payload`)

## Implementation notes

- **Branded/opaque id types** per entity (e.g. `HostId`, `MemberId`,
  `SequenceId`) so different UUID-typed foreign keys can't be mixed up at the
  type level - standard Effect Schema practice, not yet discussed explicitly
  but should be applied.
- **Recursive schema**: `HostFilterSet.rules` (the `FilterRule` tree) needs
  `Schema.suspend`.
- **Discriminated unions**: `SequenceAction.config` (by `type`),
  `DomainEvent.payload` (by `eventType`), `FilterRule` (by `type`).
- All ids are client-generated UUIDs - hard PowerSync requirement, also what
  makes `SequenceVersion` revert safe (see `docs/data-model.md`, "Why
  client-generated UUID ids"). Don't reach for auto-increment/serial ids
  anywhere in this model.
- **Effect Schema → Drizzle bridge is an open technical spike**, flagged
  during design but not resolved: either hand-write Drizzle table definitions
  alongside the Effect Schema with a test that catches drift between them, or
  find/build a codegen step that derives one from the other. Decide at the
  start of this work, don't default to one silently.

## Testing

Per `AGENTS.md`: no key mechanism ships without tests. At minimum:

- Schema decode/encode round-trip tests for every entity.
- Specific coverage for the recursive `FilterRule` schema and the
  discriminated-union payloads (`SequenceAction.config`, `DomainEvent.payload`,
  `FilterRule` itself) - these are the parts most likely to have subtle
  encoding bugs.

## Out of scope for this task (later phases)

- Actual Postgres/Drizzle migrations.
- `apps/server`, auth (Keycloak via a swappable `AuthService` `Layer`),
  PowerSync sync rules.
- Multi-location/franchise structure (explicitly deferred in
  `docs/data-model.md`).

## References

- [`docs/data-model.md`](../docs/data-model.md) - the model itself, source of truth
- [`AGENTS.md`](../AGENTS.md) - project conventions (Effect v4, DI via
  `Layer`/`Context`, FSD package layout)
- `repos/effect/` - vendored Effect source, consult before writing Effect code
- `work/monorepo/view/backend/db/entities/` - legacy reference this model was
  informed by (see `docs/data-model.md`'s comparison table for what was
  adopted, simplified, or deliberately not carried over)
