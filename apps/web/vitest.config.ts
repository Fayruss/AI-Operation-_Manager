import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Test Plan §1 (Unit Tests, Vitest) — "pure functions, Zod schemas, utility
 * logic (SAD §12)". Scoped to unit tests only; the Test Plan's integration
 * (§2) and Playwright e2e (§3) suites need a live test database and are not
 * configured here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    alias: {
      // The modules under test are server-side (`import "server-only"`),
      // which throws outside a React Server Component render. Vitest runs in
      // plain Node, so the guard is stubbed to a no-op — it exists to stop
      // client bundles importing server code, a concern that doesn't apply
      // to a Node test runner.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url))
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  }
});
