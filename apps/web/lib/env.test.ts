import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test Plan §1 (Zod schema validation) applied to the environment contract.
 *
 * `getEnv()` memoizes its result, so each test imports the module fresh via
 * `vi.resetModules()` — otherwise the first test's environment would leak
 * into every later assertion.
 */
async function loadGetEnv() {
  vi.resetModules();
  return import("@/lib/env");
}

describe("getEnv", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = original;
  });

  it("throws when DATABASE_URL is absent — Prisma has no mock fallback", async () => {
    process.env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    const { getEnv } = await loadGetEnv();
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("names the offending variable in the error so a failed boot is self-diagnosing", async () => {
    process.env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    const { getEnv } = await loadGetEnv();
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });
});

/**
 * Guards against drift between the documented environment contract
 * (.env.example, mirrored in docs/DEPLOYMENT.md) and the schema that
 * actually validates it. A variable added to one and not the other is a
 * silent production failure: either it is never validated, or it is
 * required but undocumented.
 */
describe("environment contract", () => {
  it("validates every variable that .env.example documents", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");

    const examplePath = fileURLToPath(new URL("../../../.env.example", import.meta.url));
    const documented = readFileSync(examplePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.split("=")[0])
      .filter((name): name is string => Boolean(name));

    const schemaSource = readFileSync(fileURLToPath(new URL("./env.ts", import.meta.url)), "utf8");

    // n8n basic-auth credentials are consumed by the self-hosted n8n
    // container (infra/), never by this Next.js app, so they are documented
    // without being part of the app's own schema.
    const notAppConfig = new Set(["N8N_BASIC_AUTH_USER", "N8N_BASIC_AUTH_PASSWORD"]);

    const unvalidated = documented.filter((name) => !notAppConfig.has(name) && !schemaSource.includes(name));

    expect(unvalidated).toEqual([]);
  });
});
