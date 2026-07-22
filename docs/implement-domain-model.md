# Implement the domain model (Host / Member / marketing sequences)

> **Pre-reset context:** this task was written against an implementation that
> the 2026-07-22 clean-slate reset (see `docs/roadmap.md`) scrapped entirely.
> `docs/data-model.md` (the field-by-field spec this file deferred to) was
> deleted along with it, and `apps/client` no longer exists. Nothing below is
> "ready to build on" - the entity list is preserved only as a sketch of the
> prior design, not an authoritative spec. Re-derive/re-verify the model
> before implementing anything against it.

## Goal

Implement the domain model as Effect Schema - the first real business-logic
code in this repo, building on the tooling foundation (`shared/lint-config`,
`shared/typescript-config`).

The full field-by-field model, entity relationships (ER diagram), and the
reasoning behind non-obvious decisions (why client-generated UUID ids, why
snapshots instead of event sourcing, why status lives on `MemberHost` not
`Member`, why one generic `DomainEvent` instead of per-aggregate audit tables,
comparison to the Momence legacy system, etc.) lived in `docs/data-model.md`,
which no longer exists. Recover it from git history if needed
(`git show cc13c4686^:docs/data-model.md`, i.e. the commit before the reset)
or redesign it from scratch before treating this file as an implementation
punch list.

## Where entity schemas live (resolved by the current architecture)

An earlier version of this task treated this as an open decision between a
single `packages/schema` package vs. per-slice `packages/entities/*` FSD
packages. Both are obsolete framings - the repo has since moved to the
`shared/*` / `domains/*` / `apps/*` / `scripts` layer split described in
`AGENTS.md`: entity schemas are business-shape code, so they belong in
`shared/*`'s business-shape tier (one pnpm package per cross-cutting concern,
per `AGENTS.md`), not in `domains/*` (business _logic_ that operates on those
shapes) or a resurrected `packages/*` tree. Follow `AGENTS.md`'s current
layer rules, not the FSD `entities`/`features`/`widgets` split it explicitly
replaced.

## Entities to implement (unverified sketch from the pre-reset design)

Field lists and relationships are not written down anywhere current - this is
just the entity names from the deleted design, to be re-validated:

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

## Implementation notes (still applicable regardless of the reset)

- **Branded/opaque id types** per entity (e.g. `HostId`, `MemberId`,
  `SequenceId`) so different UUID-typed foreign keys can't be mixed up at the
  type level - standard Effect Schema practice.
- **Recursive schema**: a `FilterRule`-shaped tree needs `Schema.suspend`.
- **Discriminated unions**: config/payload fields keyed by a `type`/`eventType`
  discriminant (e.g. `SequenceAction.config`, `DomainEvent.payload`,
  `FilterRule`) should use Effect Schema's discriminated-union support.
- If this repo still targets client-generated UUID ids (a PowerSync
  requirement, when PowerSync sync is rebuilt) - don't reach for
  auto-increment/serial ids in this model.
- **Effect Schema → Drizzle bridge is an open technical spike**: either
  hand-write Drizzle table definitions alongside the Effect Schema with a
  drift test, or find/build a codegen step that derives one from the other.
  Decide explicitly at the start of this work, don't default to one silently.

## Testing

Per `AGENTS.md`: no key mechanism ships without tests. At minimum:

- Schema decode/encode round-trip tests for every entity.
- Specific coverage for the recursive tree schema and any discriminated-union
  payloads - these are the parts most likely to have subtle encoding bugs.

## Out of scope for this task (later phases)

- Actual Postgres/Drizzle migrations.
- `apps/server` (doesn't exist yet), auth, PowerSync sync rules.
- Multi-location/franchise structure - deferred in the deleted
  `docs/data-model.md`; re-confirm this deferral still holds once the model
  is redesigned.

## References

- [`AGENTS.md`](../AGENTS.md) - current layer rules (Effect v4, DI via
  `Layer`/`Context`, `shared`/`domains`/`apps`/`scripts` layout)
- [`docs/roadmap.md`](roadmap.md) - what was reset and why
- `externals/effect/` - vendored Effect source, consult before writing Effect code
- `work/monorepo/view/backend/db/entities/` - legacy reference the original
  model was informed by, if that comparison is still useful
