import { test, expect } from '@playwright/test';

// testInfo.retry is 0 on the first attempt and 1 on the first retry.
// Playwright provides this reliably without relying on module-level state
// (which gets reset if Playwright reloads the module between attempts).
//
// With retries: 1:
//   attempt 1 → retry=0 → throws → reporter sees status='failed', retry=0 → FAIL
//   attempt 2 → retry=1 → passes → reporter sees status='passed', retry=1 → RERUN_PASS

test('flaky test - fails first then passes on retry', async ({}, testInfo) => {
  if (testInfo.retry === 0) {
    throw new Error('Intentional first-attempt failure');
  }
  expect(testInfo.retry).toBe(1);
});

// This test always fails on every attempt.
// With retries: 1 it runs twice:
//   attempt 1 → FAIL (retry=0)
//   attempt 2 → RERUN_FAIL (retry=1)
test('always failing test', async () => {
  expect(1).toBe(999);
});
