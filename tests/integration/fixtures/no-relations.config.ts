import { defineConfig } from '@playwright/test';
import * as path from 'path';

const reporterPath = path.join(process.cwd(), 'dist', 'cjs', 'index.js');

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'sample.spec.ts',
  retries: 0,
  workers: 1,
  reporter: [
    [reporterPath, {
      serverUrl:   process.env.MOCK_SERVER_URL ?? 'http://localhost:4100',
      apiToken:    'no-rel-token',
      product:     'NoRelProduct',
      type:        'E2E',
      buildNumber: 1,
      saveRelations: false,
      includeSteps: false,
      includeScreenshots: false,
    }],
  ],
});
