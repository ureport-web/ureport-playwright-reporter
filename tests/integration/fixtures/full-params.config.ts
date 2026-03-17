import { defineConfig } from '@playwright/test';
import * as path from 'path';

const reporterPath = path.join(process.cwd(), 'dist', 'cjs', 'index.js');

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'steps.spec.ts',
  retries: 0,
  workers: 1,
  reporter: [
    [reporterPath, {
      serverUrl:        process.env.MOCK_SERVER_URL ?? 'http://localhost:4100',
      apiToken:         'full-params-token',
      product:          'MyApp',
      type:             'API',
      buildNumber:      99,
      team:             'Backend Team',
      browser:          'firefox',          // explicit — overrides auto-detect
      device:           'MacBook Pro 15',
      platform:         'test-platform',    // explicit — overrides process.platform
      platform_version: '14.2.1',
      stage:            'production',
      version:          '2.5.0',
      batchSize:        10,
      includeSteps:     true,
      includeScreenshots: false,
    }],
  ],
});
