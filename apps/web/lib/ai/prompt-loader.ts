import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * SAD §10: prompts live in `prompts/*.md` at the repo root, "version-
 * controlled and code-reviewed separately from application code... loaded
 * at runtime by agent name, never inlined." Cached in-memory after first
 * read per process (prompt files don't change without a redeploy in this
 * phase — no n8n hot-reload-from-volume mechanism to replicate here).
 */
const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached) return cached;

  // apps/web is the Next.js app's cwd at runtime; repo root is two levels up.
  const filePath = path.join(process.cwd(), "..", "..", "prompts", `${name}.md`);
  const content = readFileSync(filePath, "utf8");
  cache.set(name, content);
  return content;
}
