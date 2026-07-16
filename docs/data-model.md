# Data model

First vertical-slice domain: a `Host` (tenant/customer) has `Member`s spanning a
spectrum from lead to fully enrolled, and can define marketing sequences that
automatically act on members over time.

This model is deliberately lean for a PoC. It's informed by the equivalent
domain in Momence's production system (`work/monorepo/view/backend`), adopting
patterns that have proven themselves there while intentionally simplifying or
deferring parts that aren't needed yet. See [Comparison to legacy](#comparison-to-legacy-momence)
below.

## Entities

### Host

The tenant boundary - every tenant-scoped table carries a `hostId` column
directly (no separate abstract "tenant" concept).

| Field          | Type      | Notes                                                                                                                                                                                      |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`           | uuid      | client-generated (see [Why client-generated UUID ids](#why-client-generated-uuid-ids))                                                                                                     |
| `name`         | string    |                                                                                                                                                                                            |
| `slug`         | string    | unique, used as subdomain/URL identifier                                                                                                                                                   |
| `email`        | string    |                                                                                                                                                                                            |
| `timeZone`     | string    |                                                                                                                                                                                            |
| `currency`     | string    |                                                                                                                                                                                            |
| `businessType` | string    | required - e.g. `"gym"`, `"yoga_studio"`, `"martial_arts"`, `"spa"` (extensible, same pattern as `triggerType`); drives `LeadStage` seeding, see [`LeadStageTemplate`](#leadstagetemplate) |
| `createdAt`    | timestamp |                                                                                                                                                                                            |

### Member

A person's global identity, independent of any host. One `Member` can be
associated with multiple hosts (see [`MemberHost`](#memberhost)) - e.g. the
same person can be a member at two different studios.

| Field         | Type           | Notes |
| ------------- | -------------- | ----- |
| `id`          | uuid           |       |
| `email`       | string         |       |
| `firstName`   | string \| null |       |
| `lastName`    | string \| null |       |
| `phoneNumber` | string \| null |       |
| `createdAt`   | timestamp      |       |

### MemberHost

The junction between a `Member` and a `Host` - this is where the lead ↔
enrolled spectrum actually lives, because it's a property of the
_relationship_ between a person and a specific host, not of the person
globally. The same `Member` can be `enrolled` at one host and a `lead` at
another simultaneously.

| Field         | Type                          | Notes                                                                                                                                                                                                                                                                                  |
| ------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid                          | own primary key (not a composite key - see [Why client-generated UUID ids](#why-client-generated-uuid-ids))                                                                                                                                                                            |
| `memberId`    | uuid (FK → Member)            |                                                                                                                                                                                                                                                                                        |
| `hostId`      | uuid (FK → Host)              |                                                                                                                                                                                                                                                                                        |
| `status`      | `"lead" \| "enrolled"`        |                                                                                                                                                                                                                                                                                        |
| `convertedAt` | timestamp \| null             | when `status` most recently transitioned to `"enrolled"`. Captures the _latest_ transition only - if a member could ever flip `enrolled → lead → enrolled` and the full transition history mattered, that would need to come from `DomainEvent` instead. Decided against that for now. |
| `leadStageId` | uuid \| null (FK → LeadStage) | CRM pipeline position while `status` is `"lead"`. Independent of `status`: `status` is the binary "converted yet or not", `leadStageId` is "how far along the funnel" - the same split legacy makes between `CustomerLeads.stageId` and `convertedToCustomerAt`.                       |
| `createdAt`   | timestamp                     |                                                                                                                                                                                                                                                                                        |

Unique constraint on `(memberId, hostId)`.

### LeadStageTemplate

Platform-maintained reference data, not tenant-editable - the default set of
CRM pipeline stages for a given `businessType`. Different business types need
meaningfully different default funnels (a gym's lead process looks nothing
like a spa's), so this isn't one fixed list.

| Field          | Type           | Notes                       |
| -------------- | -------------- | --------------------------- |
| `id`           | uuid           |                             |
| `businessType` | string         | matches `Host.businessType` |
| `name`         | string         |                             |
| `color`        | string \| null |                             |
| `order`        | number         |                             |

### LeadStage

A host's actual, editable CRM pipeline stages - seeded (copied, not
live-referenced) from the matching `LeadStageTemplate` rows when the host is
created, then fully owned by the host from that point on. Renaming, reordering,
recoloring, adding, or removing a host's stages never touches
`LeadStageTemplate` or any other host.

| Field       | Type             | Notes |
| ----------- | ---------------- | ----- |
| `id`        | uuid             |       |
| `hostId`    | uuid (FK → Host) |       |
| `name`      | string           |       |
| `color`     | string \| null   |       |
| `order`     | number           |       |
| `createdAt` | timestamp        |       |

### MarketingSequence

A host-defined automation: on a trigger, run a sequence of actions against
enrolled/lead members.

| Field         | Type                              | Notes                                                                                                                                         |
| ------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid                              |                                                                                                                                               |
| `hostId`      | uuid (FK → Host)                  |                                                                                                                                               |
| `name`        | string                            |                                                                                                                                               |
| `triggerType` | string                            | validated against a growing Schema union in code, not a native DB enum or lookup table - adding a new trigger type never requires a migration |
| `filterSetId` | uuid \| null (FK → HostFilterSet) | who this sequence targets beyond "the trigger fired" - `null` means everyone the trigger fires for                                            |
| `isEnabled`   | boolean                           |                                                                                                                                               |
| `createdAt`   | timestamp                         |                                                                                                                                               |

### HostFilterSet

A named, reusable set of targeting rules for a host - replaces having one
one-off nullable FK column per targeting dimension on `MarketingSequence`
(the kind of thing legacy started with and later refactored away from - see
[Comparison to legacy](#comparison-to-legacy-momence)).

| Field       | Type             | Notes                           |
| ----------- | ---------------- | ------------------------------- |
| `id`        | uuid             |                                 |
| `hostId`    | uuid (FK → Host) |                                 |
| `name`      | string           |                                 |
| `rules`     | jsonb            | a `FilterRule` tree - see below |
| `createdAt` | timestamp        |                                 |

`rules` is a recursive expression tree, not normalized rule rows - boolean
`AND`/`OR`/`NOT` nesting maps awkwardly onto relational rows, and legacy
itself stores its equivalent (`counterConditions`) as jsonb rather than a rule
table:

```
FilterRule =
  | { type: "condition", field: string, operator: FilterOperator, value: unknown }
  | { type: "group", combinator: "and" | "or", rules: FilterRule[] }

FilterOperator =
  | "equals" | "not_equals" | "contains"
  | "gt" | "gte" | "lt" | "lte"
  | "in" | "not_in"
```

`field` is an extensible string (grows the same way as `triggerType` and
`SequenceAction.type`, no migration needed to add a new targetable field).
`operator` is a fixed union - comparison operators are stable enough not to
need the same growability.

### SequenceAction

One node in a sequence's action graph.

| Field           | Type                                                           | Notes                                                                                                                                                            |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | uuid                                                           | client-generated - stable across a `SequenceVersion` revert                                                                                                      |
| `sequenceId`    | uuid (FK → MarketingSequence)                                  |                                                                                                                                                                  |
| `type`          | `"EMAIL" \| "SMS" \| "CONDITION" \| "TAG_ADD" \| "TAG_REMOVE"` | small starter set; extensible the same way as `triggerType`                                                                                                      |
| `offsetMinutes` | number                                                         | **absolute** offset from the trigger time, not relative to the previous action - avoids compounding drift and simplifies reordering actions in a flow-builder UI |
| `config`        | jsonb                                                          | shape depends on `type` (e.g. template/subject for `EMAIL`, tag id for `TAG_ADD`)                                                                                |

### SequenceEdge

The DAG structure between actions - explicit adjacency, not a `nextActionId`
pointer on the action itself. This is what lets a `CONDITION` action branch.

| Field             | Type                          | Notes                                                                                         |
| ----------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| `id`              | uuid                          |                                                                                               |
| `sequenceId`      | uuid (FK → MarketingSequence) |                                                                                               |
| `fromActionId`    | uuid (FK → SequenceAction)    |                                                                                               |
| `toActionId`      | uuid (FK → SequenceAction)    |                                                                                               |
| `conditionBranch` | `"true" \| "false" \| null`   | `null` = unconditional edge; otherwise which branch of a `CONDITION` action this edge follows |

### SequenceEnrollment

One run of a sequence for one member - i.e. the enrollment record.

| Field         | Type                          | Notes                            |
| ------------- | ----------------------------- | -------------------------------- |
| `id`          | uuid                          |                                  |
| `hostId`      | uuid (FK → Host)              | denormalized, for tenant scoping |
| `sequenceId`  | uuid (FK → MarketingSequence) |                                  |
| `memberId`    | uuid (FK → Member)            |                                  |
| `triggeredAt` | timestamp                     |                                  |
| `finishedAt`  | timestamp \| null             |                                  |
| `cancelledAt` | timestamp \| null             |                                  |

Lifecycle is expressed via these nullable timestamps, not a status enum.
"Current position in the sequence" is not persisted as authoritative state -
it's recomputed from `SequenceAction`/`SequenceEdge` plus these timestamps
whenever the enrollment is advanced, which keeps it tolerant of the sequence
definition changing mid-flight.

### SequenceVersion

A full snapshot of a sequence's definition at a point in time, enabling undo /
revert-to-a-point-in-history (not full event sourcing - see
[Why snapshots, not event sourcing](#why-snapshots-not-event-sourcing)).

| Field                   | Type                                    | Notes                                                                                |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                    | uuid                                    |                                                                                      |
| `sequenceId`            | uuid (FK → MarketingSequence)           |                                                                                      |
| `hostId`                | uuid (FK → Host)                        |                                                                                      |
| `snapshot`              | jsonb                                   | full definition at this point: name, triggerType, isEnabled, actions, edges          |
| `revertedFromVersionId` | uuid \| null (FK → SequenceVersion)     | set when this version was created _as the result of_ reverting to an earlier version |
| `actorType`             | `"host_user" \| "ai_agent" \| "system"` |                                                                                      |
| `actorId`               | uuid \| null                            |                                                                                      |
| `createdAt`             | timestamp                               |                                                                                      |

Reverting means restoring the live `SequenceAction`/`SequenceEdge` rows from
`snapshot` **using the original ids captured in the snapshot** (an upsert
keyed by `id`, not a wipe-and-regenerate-fresh-ids operation) - see
[Why client-generated UUID ids](#why-client-generated-uuid-ids) for why that's
safe. Reverting also writes a _new_ `SequenceVersion` row (with
`revertedFromVersionId` set) rather than just mutating history in place.

### DomainEvent

A generic, append-only audit trail spanning every aggregate in the system -
not per-aggregate audit tables.

| Field           | Type                                    | Notes                                                                                     |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `id`            | uuid                                    |                                                                                           |
| `hostId`        | uuid (FK → Host)                        |                                                                                           |
| `aggregateType` | string                                  | e.g. `"Member"`, `"MemberHost"`, `"MarketingSequence"`, `"SequenceEnrollment"`            |
| `aggregateId`   | uuid                                    | polymorphic - references whichever aggregate `aggregateType` names, not a single fixed FK |
| `eventType`     | string                                  | e.g. `"MemberEnrolled"`, `"SequenceActionExecuted"`, `"SequenceReverted"`                 |
| `payload`       | jsonb                                   | shape depends on `eventType`                                                              |
| `actorType`     | `"host_user" \| "ai_agent" \| "system"` | who/what caused this - important for auditing AI-agent-triggered mutations                |
| `actorId`       | uuid \| null                            |                                                                                           |
| `occurredAt`    | timestamp                               |                                                                                           |

`payload` also covers detailed per-action execution results (legacy's
`HostCampaignSequenceRunLogs` + a separate polymorphic result table per action
type) - no extra tables needed, just a per-`eventType` payload shape, the same
pattern `SequenceAction.config` already uses for `type`:

```
eventType: "SequenceActionExecuted"
aggregateType: "SequenceEnrollment"
aggregateId: <enrollmentId>
payload: {
  actionId: uuid
  actionType: "EMAIL" | "SMS" | "CONDITION" | "TAG_ADD" | "TAG_REMOVE"
  result:
    // discriminated union depending on actionType
    | { actionType: "EMAIL" | "SMS", messageId: string, sentAt: timestamp, provider: string }
    | { actionType: "CONDITION", branchTaken: "true" | "false" }
    | { actionType: "TAG_ADD" | "TAG_REMOVE", tagId: uuid }
}
```

## Relationships

```mermaid
erDiagram
  HOST ||--o{ MEMBER_HOST : has
  MEMBER ||--o{ MEMBER_HOST : has
  HOST ||--o{ MARKETING_SEQUENCE : defines
  HOST ||--o{ SEQUENCE_ENROLLMENT : scopes
  HOST ||--o{ DOMAIN_EVENT : scopes
  HOST ||--o{ HOST_FILTER_SET : defines
  HOST ||--o{ LEAD_STAGE : defines
  LEAD_STAGE ||--o{ MEMBER_HOST : "positions"
  MEMBER ||--o{ SEQUENCE_ENROLLMENT : "enrolled in"
  HOST_FILTER_SET ||--o{ MARKETING_SEQUENCE : targets
  MARKETING_SEQUENCE ||--o{ SEQUENCE_ACTION : contains
  MARKETING_SEQUENCE ||--o{ SEQUENCE_EDGE : contains
  MARKETING_SEQUENCE ||--o{ SEQUENCE_ENROLLMENT : runs
  MARKETING_SEQUENCE ||--o{ SEQUENCE_VERSION : "versioned by"
  SEQUENCE_ACTION ||--o{ SEQUENCE_EDGE : starts
  SEQUENCE_ACTION ||--o{ SEQUENCE_EDGE : ends
  SEQUENCE_VERSION ||--o| SEQUENCE_VERSION : "reverted from"
```

## Design decisions

### Why client-generated UUID ids

Every synced table uses a single `id: uuid` primary key generated on the
client, never a database auto-increment integer. This is a hard requirement
from PowerSync (every synced table needs a single `text`-typed primary key
column named `id`, recommended as a client-generated UUID) so that the client
can write optimistically to its local replica before the server confirms
anything - not a stylistic choice.

It also happens to solve stable identity across a `SequenceVersion` revert for
free: restoring a snapshot re-creates rows with their _original_ ids rather
than minting new ones, so anything that referenced an action by id (edges,
idempotency checks when the action actually runs) keeps working across a
revert with no extra "stable key" field needed.

### Why snapshots, not event sourcing

`DomainEvent` records _what happened_, but reconstructing "the full state of a
sequence at time T" by replaying deltas is full event sourcing - which adds
real friction against PowerSync's sync-based architecture (state would need to
exist only as a projection, complicating what actually gets synced). Momence's
own sequence-run engine doesn't do this either: `finishedAt`/`cancelledAt` are
plain columns, not derived by replay.

For the one thing that genuinely needs point-in-time revert (a sequence's
definition), a full-state snapshot per version is simpler than event replay:
revert is "restore this snapshot," not "replay N deltas against a blank
state."

### Why status lives on `MemberHost`, not `Member`

Enrollment status is a property of the relationship between a person and a
specific host, not of the person globally - the same `Member` can be
`enrolled` at one host and a `lead` at another at the same time.

### Why one generic `DomainEvent`, not per-aggregate audit tables

Momence's own system grew three overlapping "customer state machine" concepts
over time (lead pipeline stages, member journeys, campaign sequence runs) that
its own codebase flags as organic growth rather than intentional design. A
single generic event log across all aggregates avoids repeating that.

## Comparison to legacy (Momence)

Legacy reference: `work/monorepo/view/backend/db/entities/` (`Hosts`,
`RibbonMembers`, `RibbonMembersHosts`, `CustomerLeads`,
`HostCampaignSequence*`).

| Aspect                          | Legacy                                                                                                                               | This model                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member identity                 | 4 tables (`RibbonMembers` + `RibbonMembersHosts` + `CustomerLeads` with its own id space + `UserRegistrationRequests` capture layer) | 2 tables (`Member` + `MemberHost` with `status` directly on the junction)                                                                                        |
| Status                          | none - inferred from row presence/absence and timestamps (`convertedToCustomerAt`, existence of a `BoughtMemberships` row)           | explicit `status: "lead" \| "enrolled"`                                                                                                                          |
| Trigger types                   | DB lookup table with per-trigger capability flags (`enabledForEmails`, `pickSession`, ...), 48 values                                | plain extensible string, no capability-flag metadata, fewer starter values                                                                                       |
| Action types                    | 14 values (incl. `WHATSAPP`, `HOST_TASK`, `MONEY_CREDITS_ADD`, `MEMBERSHIP_ADD`)                                                     | 5 starter values (`EMAIL`, `SMS`, `CONDITION`, `TAG_ADD`, `TAG_REMOVE`)                                                                                          |
| Action offset                   | 3 columns (`offsetDays`/`offsetHours`/`offsetMinutes`)                                                                               | 1 column (`offsetMinutes`), same absolute-from-trigger principle                                                                                                 |
| DAG structure                   | separate edges table (`start_action_id`/`end_action_id`/`condition_branch_type`)                                                     | adopted ~1:1 (`SequenceEdge`)                                                                                                                                    |
| Audit/history                   | split across `HostCampaignSequenceRunLogs` (sequence-run-specific) + per-action-type polymorphic result tables                       | one generic `DomainEvent` across all aggregates, incl. per-action execution results via `payload`                                                                |
| Sequence definition undo/revert | not found in legacy                                                                                                                  | `SequenceVersion` (net-new)                                                                                                                                      |
| AI-agent actor tracking         | not applicable (no AI-agent concept)                                                                                                 | `actorType`/`actorId` on `DomainEvent` and `SequenceVersion` (net-new)                                                                                           |
| Sequence targeting              | one `hostFilterSetId` FK + jsonb `counterConditions` (after refactoring away from ~15 one-off FK columns)                            | `HostFilterSet` + jsonb `rules` tree (adopted ~1:1)                                                                                                              |
| Lead pipeline stages            | `CustomerLeadsStages` - per-host only, freely defined from a blank slate, no business-type templating found                          | `LeadStageTemplate` (per `businessType`, platform-maintained) seeds `LeadStage` (per-host, then freely editable) - net-new templating layer, not found in legacy |
| Host entity                     | ~250-relation aggregate covering billing, scheduling, messaging, integrations, etc.                                                  | lean (7 fields); everything else added iteratively as separate concerns                                                                                          |

### Effect Schema → Drizzle bridge

Built as `packages/db`: hand-written Drizzle table definitions (Postgres, via
`drizzle-orm`/`drizzle-kit`) alongside the Effect Schema entities in
`packages/schema`, plus a drift test (`packages/db/src/drift.test.ts`) that
compares each Drizzle table's column-name set against its corresponding Effect
Schema's field-name set, failing if they diverge.

Rejected alternative: codegen instead of a drift test. Drizzle does ship an
Effect Schema bridge (`drizzle-orm/effect-schema`'s `createInsertSchema`/
`createUpdateSchema`/`createSelectSchema`, generating Effect Schema validators
from a Drizzle table - genuinely targets Effect v4, not a stale v3 tool), but
two things rule it out here: it only exists on Drizzle's `1.0.0-rc.*` line, not
the `0.45.x` stable release this repo pins, and it generates in the opposite
direction from what we need - DB table to per-operation validator, not our
domain-model-is-the-source-of-truth direction. It also wouldn't replace
`packages/schema`'s branded ids or discriminated unions (`SequenceAction`,
`FilterRule`), only auto-derive raw CRUD-shaped validators from the DB row
shape. Worth revisiting once Drizzle v1 is stable, as a way to generate
`apps/server`'s raw insert/update/select validators - not as a replacement for
this drift test or for `packages/schema` itself.

`id`/foreign-key columns are `text`, not Postgres's native `uuid` type - same
PowerSync requirement as the `id` column itself (see "Why client-generated UUID
ids" above). `SequenceAction` is one flat table in Postgres even though
`packages/schema` models it as a discriminated union in TypeScript - `config`'s
shape depends on `type` at the application layer, not the DB layer, so the
drift test reads its field set from any one of the union's cases (they all
share the same top-level keys).

### Postgres RLS for multi-tenancy - not enabled yet

`AGENTS.md` names "Drizzle + Postgres RLS for multi-tenancy" as the intended
mechanism, but RLS policies need a session-level value (e.g. the current
request's `hostId`) to filter rows against, and nothing in this repo sets that
yet. `apps/server` and its `AuthService` now exist (see "Auth: Keycloak +
apps/server" below) and every request has a verified `hostId` available, but
nothing sets that value into a Postgres session variable per request yet -
enabling RLS before that wiring exists would mean policies against a session
variable nothing sets, which is worse than not having RLS at all. Deferred
until `apps/server`'s request handling sets that session context per request.

### Auth: Keycloak + apps/server

Self-hosted Keycloak (`docker-compose.yml`'s `keycloak` service, dev-mode
`start-dev --import-realm`) is the identity provider; `apps/server` never
talks to it directly - business logic depends only on `AuthService`
(`apps/server/src/JwtVerifier.ts`/`Auth.ts`), a swappable `Layer` per
`AGENTS.md`'s auth rule, so Keycloak could be swapped for another OIDC
provider without touching domain code. Realm/client/test-user config lives in
`keycloak/realm-export.json`, imported automatically on first start - no
manual admin-console clicking needed to reproduce this setup.

`host_id` reaches the JWT via a Keycloak user-attribute protocol mapper
(`oidc-usermodel-attribute-mapper`) mapping the user's `host_id` attribute to
a `host_id` claim. Two gotchas hit while wiring this up, both easy to hit
again if this config is hand-edited later:

- **Keycloak 24+ ignores custom user attributes by default** ("unmanaged
  attributes" are disabled unless the realm's declarative user profile
  explicitly declares them) - `host_id` had to be added to the realm's user
  profile config (`components` → `org.keycloak.userprofile.UserProfileProvider`
  in `keycloak/realm-export.json`) before the attribute would even persist on
  import, let alone reach a token.
- **The mapper's config key is `user.attribute`, not `userAttribute`** -
  the latter is what the analogous OID4VC mapper uses, easy to confuse, and
  Keycloak silently accepts the wrong key (no validation error) while just
  never populating the claim. Confirmed the correct key via the running
  instance's own `/admin/serverinfo` endpoint, which lists every protocol
  mapper's real config property names.

A second mapper (`oidc-audience-mapper`, `included.custom.audience:
powersync-dev`) adds `powersync-dev` to the token's `aud` claim - this is
what lets the exact same Keycloak-issued token satisfy both `apps/server`'s
`AuthService` and PowerSync's `client_auth` (see below), rather than needing
two different tokens for the two consumers.

`apps/server` (`effect/unstable/httpapi`) has a public `/health` endpoint and
a protected `/me` endpoint behind an `Auth` `HttpApiMiddleware.Service` using
`HttpApiSecurity.bearer` - which only extracts the raw credential, the actual
verification is `JwtVerifier`, backed by `jose`'s `createRemoteJWKSet` against
Keycloak's realm JWKS endpoint. `JwtVerifier` is itself swappable (`layer` for
the real remote JWKS, `layerWithJwks` for tests using an in-memory JWK set),
so `AuthService.test.ts`-style unit tests never make a real network call, per
`AGENTS.md`'s "external I/O goes through swappable services" rule.

**Verified end-to-end** (2026-07-16): a password-grant token from Keycloak's
test user (`test-host-owner`, `host_id` attribute set to a fixed test UUID)
correctly returns `401` from `/me` with no token, and with the token returns
`200` with the exact `hostId`/`subject` from the JWT claims. The identical
token was then POSTed to PowerSync's `/sync/stream` and accepted, with the
returned checkpoint's `host_data` bucket correctly scoped to that same
`host_id` - confirming the audience mapper and `client_auth.jwks_uri` wiring
in `powersync/service.yaml` (see below) actually works against a real token,
not just against the hand-signed HS256 dev tokens used before Keycloak existed.

### PowerSync sync streams

Self-hosted PowerSync (not PowerSync Cloud - consistent with this repo's "no
cloud account needed for local dev" approach) runs via `docker-compose.yml`'s
`powersync`/`pg-storage` services, config in `powersync/service.yaml` and
`powersync/sync-config.yaml`. Scaffolded with the official `powersync` CLI
(`npx powersync init self-hosted` + `powersync docker configure --database
postgres --storage postgres`) rather than hand-assembled, to match the
tool's own tested defaults - notably, PowerSync's bucket/checkpoint metadata
store (`pg-storage`) is a **separate** Postgres instance from the replication
source (the existing `postgres` service, i.e. our actual app data), not a
schema on the same one.

Sync rules are written as **Sync Streams** (`config: { edition: 3 }` in
`sync-config.yaml`), not the legacy `bucket_definitions` format - Streams are
PowerSync's current recommended approach for new projects, and their expanded
SQL support (real `JOIN`s) is what lets `host_data`'s queries reach `members`
(via `member_hosts`) and `sequence_actions`/`sequence_edges` (via
`marketing_sequences`) without denormalizing `hostId` onto those tables just
for sync purposes.

One thing still explicitly deferred, same shape as the RLS gap above:

- **Replication role**: the `postgres` service's `powersync` publication
  (`powersync/init-scripts/01-powersync-publication.sql`) is `FOR ALL TABLES`,
  and PowerSync connects as the app's own `effective_app` superuser rather
  than a scoped-down, replication-only role - fine for a PoC, not for
  production.

**Verified working** (2026-07-16, against a real local Docker stack - the
sandbox this was originally built in had Docker Hub pulls blocked, but the
setup was later confirmed on a real machine): `pnpm run dev:infra` brings up
all four services healthy, the `powersync` publication is created, an
`INSERT INTO hosts` shows up in `docker logs` within milliseconds as
`Replicating "public"."hosts" ...` / `Flushed 1 + 0 + 1 updates`. Two real
bugs were caught and fixed in the process, both worth knowing about since
they'll resurface on a fresh machine otherwise:

- **`postgres:18+`'s data directory layout changed** - the image now expects
  its volume mounted at `/var/lib/postgresql` (a parent directory it manages
  itself), not `/var/lib/postgresql/data` directly (the old convention);
  mounting at the old path made `postgres` fail its healthcheck outright on
  a fresh init. Fixed in `docker-compose.yml`'s `postgres` and `pg-storage`
  volume mounts. An existing volume created before this fix has data laid
  out for the old path and needs to be reinitialized once: `pnpm run
dev:infra:down && docker volume rm effective-app_postgres-data
effective-app_powersync-storage-data`.
- **`sslmode` defaults to `verify-full`** on PowerSync's Postgres connections
  (both `replication.connections` and `storage`) - our local Postgres
  containers have no TLS configured, so the client's SSL negotiation was
  failing the connection outright. Surfaced as a generic, unhelpful `"Fatal
startup error ... postgres query failed"` at the wire-protocol level (not a
  SQL error - confirmed by extracting and running the exact failing query,
  `CREATE TABLE IF NOT EXISTS locks (...)`, directly via `psql`, which
  succeeded fine). Fixed by adding `sslmode: disable` to both connections in
  `powersync/service.yaml` - local/private-network only, per PowerSync's own
  docs on that setting.

#### Verifying this works

1. **Apply the Drizzle migration first.** `sync-config.yaml` references real
   table names (`hosts`, `member_hosts`, ...) - they need to exist in Postgres
   before PowerSync can replicate them, so run `packages/db`'s
   `db:generate`/`db:migrate` (see "Effect Schema → Drizzle bridge" above)
   before starting PowerSync for the first time.
2. **Start the stack and check health.**
   ```sh
   pnpm run dev:infra
   docker compose ps                    # postgres, pg-storage, powersync all healthy
   docker compose logs powersync        # look for replication/connection errors
   docker exec -it effective-app-postgres-1 \
     psql -U effective_app -c "select * from pg_publication;"  # expect a `powersync` row
   ```
3. **Insert a row and watch it replicate** - the fastest concrete proof,
   no client SDK needed:
   ```sh
   docker exec -it effective-app-postgres-1 psql -U effective_app -d effective_app -c "
     INSERT INTO hosts (id, name, slug, email, time_zone, currency, business_type, created_at)
     VALUES ('11111111-1111-4111-8111-111111111111', 'Test', 'test', 'a@b.test', 'UTC', 'USD', 'gym', now());
   "
   docker compose logs powersync --tail 10  # expect "Replicating \"public\".\"hosts\" ..."
   ```
4. **Get a real token from Keycloak** for the seeded test user (see "Auth:
   Keycloak + apps/server" above) via the password grant:
   ```sh
   curl -X POST http://localhost:${KEYCLOAK_PORT:-8180}/realms/effective-app/protocol/openid-connect/token \
     -d "grant_type=password" -d "client_id=effective-app-client" \
     -d "username=test-host-owner" -d "password=local_dev_only"
   ```
   The `access_token` in the response carries both the `host_id` claim and the
   `powersync-dev` audience - the same token works against both `apps/server`
   and PowerSync below.
5. **Confirm `apps/server` accepts it**:
   ```sh
   curl http://localhost:3000/me                                   # 401, no token
   curl -H "Authorization: Bearer <access_token>" http://localhost:3000/me
   # 200 {"hostId":"<the test user's host_id attribute>","subject":"<sub>"}
   ```
6. **Confirm PowerSync accepts the same token**, scoped to that `host_id`:
   ```sh
   curl -X POST http://localhost:8080/sync/stream \
     -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
     -d '{"include_checksum": true}'
   # the host_data bucket's key includes the token's host_id, e.g.:
   # "bucket":"1#host_data|0[\"<host_id>\"]"
   ```
7. **The full end-to-end proof** - a real client syncing to local SQLite and
   seeing row changes - needs the client SDK wired into `apps/client`, which is
   intentionally out of scope here (see the task's original scoping notes).

## Deferred / out of scope for this PoC

These exist in legacy and are consciously not modeled yet:

- **Multi-location / franchise structure** (legacy: `HostLocations`,
  `CorporateHosts`)
