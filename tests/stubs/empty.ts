// Stub for `server-only` / `client-only` in the Vitest (node) environment.
// Those packages throw on import outside Next's RSC bundler; unit tests import
// server modules directly, so we alias them to this no-op.
export {};
