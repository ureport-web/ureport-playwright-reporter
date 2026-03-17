import { defineConfig } from '@playwright/test';
import * as path from 'path';

const reporterPath = path.join(process.cwd(), 'dist', 'cjs', 'index.js');

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'sample.spec.ts',   // 4 tests total
  retries: 0,
  workers: 1,
  reporter: [
    [reporterPath, {
      serverUrl:   process.env.MOCK_SERVER_URL ?? 'http://localhost:4100',
      apiToken:    'batch-token',
      product:     'BatchProduct',
      type:        'E2E',
      buildNumber: 1,
      batchSize:   2,             // 4 tests → 2 POST /api/test calls of 2 each
      includeSteps: false,
      includeScreenshots: false,
    }],
  ],
});
