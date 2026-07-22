import { helloFromShared } from "@repo/shared-hello"; // ALLOWED: same layer ("shared" allows same-layer imports)
import { helloFromEntities } from "@repo/entities"; // FORBIDDEN: "shared" may not import "entities" (above it)

export function helloFromSharedConsumer(): string {
  return `shared-hello-consumer says: ${helloFromShared()} (and, against the rules, from entities: ${helloFromEntities()})`;
}
