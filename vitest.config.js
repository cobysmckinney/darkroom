import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    setupFiles: ['test/setup.js'],
    pool: 'forks',
    testTimeout: 20_000,
  },
})
