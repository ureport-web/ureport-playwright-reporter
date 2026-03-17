import { defineConfig } from '@playwright/test';
import * as path from 'path';

const reporterPath = path.join(process.cwd(), 'dist', 'cjs', 'index.js');

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'retries.spec.ts',
  retries: 1,                    // each failing test gets one retry
  workers: 1,                    // single worker so module-level state persists between retries
  reporter: [
    [reporterPath, {
      serverUrl:   process.env.MOCK_SERVER_URL ?? 'http://localhost:4100',
      apiToken:    'retry-token',
      product:     'RetryProduct',
      type:        'E2E',
      buildNumber: 1,
      includeSteps: false,
      includeScreenshots: false,
    }],
  ],
});
