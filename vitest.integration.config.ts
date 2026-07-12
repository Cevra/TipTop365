import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const emptyStub = fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url));

// Integration tests hit a real Postgres via Prisma. They need DATABASE_URL to
// point at a disposable DB (a Neon branch locally, a Postgres service container
// in CI). No Docker/Testcontainers dependency — see docs/TESTING.md.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': emptyStub,
      'client-only': emptyStub,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.spec.ts'],
    // A cold Neon branch can take a moment to wake; give integration room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
