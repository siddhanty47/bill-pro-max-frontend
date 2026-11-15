import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so the app build config stays untouched.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
