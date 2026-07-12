import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const emptyStub = fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig "@/*" → project root so tests can import app modules.
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // `server-only`/`client-only` throw on import outside Next's bundler.
      'server-only': emptyStub,
      'client-only': emptyStub,
    },
  },
  test: {
    environment: 'node',
    // Unit tests only — no DB, no network. Runs in the main gate + PR CI.
    // Integration tests (need Postgres) live in vitest.integration.config.ts.
    include: ['tests/unit/**/*.spec.ts'],
  },
});
