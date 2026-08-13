import { defineConfig } from 'vitest/config';

// Pinned to this directory on purpose. Without a local config, vitest walks up
// the filesystem looking for one and can pick up an unrelated config from a
// parent directory, which fails in a way that looks like a broken test suite.
export default defineConfig({
  root: __dirname,
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
