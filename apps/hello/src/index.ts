import { helloFromDomain } from "@repo/domain-hello"; // ALLOWED: "app" may import "domains" (below it)
import { helloFromEntities } from "@repo/entities"; // ALLOWED: "app" may import "entities" (below it)
import { helloFromShared } from "@repo/shared-hello"; // ALLOWED: "app" may import "shared" (below it)
import { helloFromScripts } from "@repo/scripts"; // FORBIDDEN: "app" may not import "scripts" (above it)

export function helloFromApp(): string {
  return [
    "hello from app",
    helloFromDomain(),
    helloFromEntities(),
    helloFromShared(),
    helloFromScripts(),
  ].join(" / ");
}
