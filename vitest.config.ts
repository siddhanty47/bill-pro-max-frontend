import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Pin the timezone before any Date use so date/overdue tests are deterministic.
process.env.TZ = 'UTC';

// Separate from vite.config.ts so the app build config stays untouched.
// Layers and rules: see TESTING.md.
export default defineConfig({
  plugins: [react()],
  // Never load the developer's .env files (they may point at prod): read env
  // from an empty dir and set explicit fake values below.
  envDir: './src/test/env',
  test: {
    environment: 'jsdom',
    // Heavy form tests slow down under full-suite CPU load.
    testTimeout: 15000,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_API_URL: 'http://api.test/api/v1',
      VITE_WS_URL: 'http://api.test',
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/types/**',
      ],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      // Repo-wide floor (ratchet): raise when coverage grows, never lower.
      thresholds: { lines: 97 },
    },
  },
});
