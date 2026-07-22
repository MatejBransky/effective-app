# Business context

Domain/business vocabulary for this app - the terms code, docs, and conversations should
consistently use, and what they actually mean. Intentionally incomplete: add an entry
whenever a new business term/concept is introduced, renamed, or its meaning changes.
Stale or missing entries are worse than none - they actively mislead whoever (human or
agent) reads them next, so keep this current as the domain model develops (see
`docs/roadmap.md` for what's decided so far).

## Glossary

- **Host** - a tenant: the business/organization account that owns data in this app.
  This is the multi-tenancy scoping key everything else (RLS, sync streams, auth claims)
  will key off of once that's built. "Tenant" and "Host" are the same concept - prefer
  "Host" in code/docs.
- **Member** / **Lead** - the customer: an end-user belonging to a Host. Likely different
  lifecycle stages of the same underlying entity (e.g. Lead before some conversion event,
  Member after) - exact lifecycle/relationship not yet defined; refine this entry once it
  is.
- **Admin** - the internal team (the people building/operating this app), not a
  customer-facing role.
