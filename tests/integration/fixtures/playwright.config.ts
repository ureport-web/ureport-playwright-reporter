import { defineConfig } from '@playwright/test';
import * as path from 'path';

// Points at the compiled CJS output — integration tests require `npm run build` first.
// process.cwd() is the project root when playwright is spawned from the integration test.
const reporterPath = path.join(process.cwd(), 'dist', 'cjs', 'index.js');

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'sample.spec.ts',
  forbidOnly: false,
  retries: 0,
  workers: 2,
  use: {
    baseURL: 'https://staging.example.com',
  },
  reporter: [
    [reporterPath, {
      serverUrl:   process.env.MOCK_SERVER_URL ?? 'http://localhost:4100',
      apiToken:    'integration-token',
      product:     'IntegrationTestProduct',
      type:        'E2E',
      buildNumber: 1,
      includeSteps: true,
      includeScreenshots: false,
      outputFile: process.env.OUTPUT_FILE,
    }],
  ],
});
