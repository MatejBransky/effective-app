// Lives under shared/* on disk, but named "@repo/entities" - repo/layer-boundaries matches by
// package name, not directory, so this is classified as layer "entities", not "shared".
import { helloFromShared } from "@repo/shared-hello"; // ALLOWED: "entities" may import "shared" (below it)
import { helloFromOtherDomain } from "@repo/domain-other"; // FORBIDDEN: "entities" may not import "domains" (above it)

export function helloFromEntities(): string {
  return `hello from entities (${helloFromShared()}, and against the rules, from domains: ${helloFromOtherDomain()})`;
}
