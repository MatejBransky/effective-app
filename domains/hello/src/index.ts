import { helloFromEntities } from "@repo/entities"; // ALLOWED: "domains" may import "entities" (below it)
import { helloFromShared } from "@repo/shared-hello"; // ALLOWED: "domains" may import "shared" (two layers below)
import { helloFromOtherDomain } from "@repo/domain-other"; // FORBIDDEN: domains may not import each other
import { helloFromOtherApp } from "@repo/app-other"; // FORBIDDEN: "domains" may not import "app" (above it)

export function helloFromDomain(): string {
  return [
    "hello from domains",
    helloFromEntities(),
    helloFromShared(),
    helloFromOtherDomain(),
    helloFromOtherApp(),
  ].join(" / ");
}
