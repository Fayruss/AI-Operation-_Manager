/**
 * Stub for Next.js's `server-only` package under Vitest.
 *
 * `server-only` deliberately throws when resolved outside a server
 * environment, to stop server code leaking into a client bundle. Vitest
 * runs the pure-logic modules under test in plain Node, where that guard
 * has nothing to protect and would abort the import — so the test config
 * aliases the package to this empty module.
 */
export {};
