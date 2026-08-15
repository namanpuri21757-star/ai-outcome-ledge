import { defineConfig } from 'vitest/config';

/**
 * The live smoke check, kept out of the committed gate on purpose.
 *
 * `npm test` must be answerable offline and must not go red because a
 * third party is having a bad afternoon — a gate that fails for reasons
 * outside the diff stops being read. The checks here do the opposite:
 * they talk to the real source and are meant to be run deliberately,
 * before a deploy and when the pipeline reports a source-level failure.
 *
 *   npm run smoke
 */
export default defineConfig({
  root: __dirname,
  test: {
    include: ['smoke/**/*.live.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
