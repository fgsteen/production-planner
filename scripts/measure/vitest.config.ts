// Plan measurements (not part of `npm test`): `npm run measure:plan`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['scripts/measure/*.measure.ts'], testTimeout: 600_000 },
});
