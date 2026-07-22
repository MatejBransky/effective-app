# domains/

One pnpm package per business domain (`domains/<name>`, published as `@repo/domain-<name>`)

- see AGENTS.md for the layer rules (never import another domain directly; cross-domain
  calls go through a tag defined in `shared/*`).
- see `docs/web-bootstrap-architecture.md` for the concrete convention (tag in
  `shared/entities` next to the shape it identifies, implementation here, wired
  together only by whichever app composes every domain's `Layer`).

Empty for now - added iteratively, see `docs/roadmap.md` before assuming what's next.
