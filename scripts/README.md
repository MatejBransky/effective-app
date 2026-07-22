# scripts/

A single pnpm package (`@repo/scripts`) - codegen and other repo-maintenance helpers that
aren't shared runtime code (`shared/*`), business logic (`domains/*`), or a deployable app
(`apps/*`). Unlike `shared/*`/`domains/*`, these don't need independent
versioning/`package.json#exports` boundaries from each other, so one script doesn't need one
package - just a file (or folder) per script inside this one.

Empty for now - added iteratively as real tooling needs show up.
