import { defineConfig } from "vitest/config";

// Unit/integration tests only - `e2e/` holds @playwright/test specs (run via
// `test:e2e`), which must never execute under vitest.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
